import type { FirebaseError } from "firebase/app";

/**
 * Email/password auth for the login and signup forms. Firebase is imported on
 * first use so the landing page never ships the SDK.
 */
const load = async () => {
  const [{ auth, KEEP_KEY }, sdk] = await Promise.all([import("./firebase"), import("firebase/auth")]);
  return { auth, KEEP_KEY, ...sdk };
};

/** Where links in Firebase's emails send people back to. */
const back = () => ({ url: `${window.location.origin}/login` });

/** Retries without the continue URL when this domain isn't on Firebase's allowlist yet. */
async function withContinue(send: (opts?: { url: string }) => Promise<void>) {
  try {
    await send(back());
  } catch (err) {
    const code = (err as FirebaseError).code;
    if (code !== "auth/unauthorized-continue-uri" && code !== "auth/unauthorized-domain") throw err;
    await send();
  }
}

export type AuthFailure = { field: "email" | "password"; message: string };

/** Turns a Firebase error into a message for one of the form's fields. */
export function explain(err: unknown): AuthFailure {
  const code = (err as FirebaseError)?.code ?? (err as Error)?.message;
  switch (code) {
    case "auth/email-already-in-use":
      return { field: "email", message: "This email already has an account. Log in instead." };
    case "auth/invalid-email":
      return { field: "email", message: "That email doesn’t look right." };
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return { field: "password", message: "Email or password is incorrect." };
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return { field: "password", message: "Use 8+ characters with a mix of letters and numbers." };
    case "auth/user-disabled":
      return { field: "email", message: "This account has been disabled." };
    case "EMAIL_NOT_VERIFIED":
      return { field: "email", message: "Confirm your email first. We’ve sent the link again." };
    case "EMAIL_NOT_VERIFIED_RECENT":
      return { field: "email", message: "Confirm your email first, using the link we sent you." };
    case "auth/popup-blocked":
      return { field: "password", message: "Your browser blocked the sign-in window. Allow pop-ups and try again." };
    case "auth/account-exists-with-different-credential":
      return { field: "email", message: "This email already has a password login. Use that instead." };
    case "auth/operation-not-allowed":
      return { field: "password", message: "This sign-in option isn’t switched on yet." };
    case "auth/unauthorized-domain":
      return { field: "password", message: "This site isn’t approved for sign-in yet." };
    case "auth/too-many-requests":
      return { field: "password", message: "Too many attempts. Wait a minute and try again." };
    case "auth/network-request-failed":
      return { field: "password", message: "Can’t reach the server. Check your connection." };
    default:
      return { field: "password", message: "Something went wrong. Try again." };
  }
}

/**
 * Creates the account, sends the confirmation link, then signs out: logging in
 * waits until the email is confirmed.
 */
export async function signUp({ name, email, password }: { name: string; email: string; password: string }) {
  const { auth, createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } = await load();
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: name }).catch(() => {});
  await withContinue((opts) => sendEmailVerification(user, opts)).catch(() => {});
  await signOut(auth);
}

/**
 * "Keep me logged in": on, the session survives closing the browser; off, it
 * ends with the tab. Set when the box changes rather than on submit, so the
 * Google popup can still open straight from the click.
 */
export async function remember(on: boolean) {
  const { auth, KEEP_KEY, setPersistence, indexedDBLocalPersistence, browserSessionPersistence } = await load();
  try {
    localStorage.setItem(KEEP_KEY, on ? "1" : "0");
  } catch {}
  await setPersistence(auth, on ? indexedDBLocalPersistence : browserSessionPersistence).catch(() => {});
}

/** The box's saved state, read after mount so the server render still matches. */
export const keepPreference = async () => (await import("./firebase")).keepPreference();

export async function logIn({ email, password, keep }: { email: string; password: string; keep: boolean }) {
  const { auth, signInWithEmailAndPassword, sendEmailVerification, signOut } = await load();
  await remember(keep);
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  if (!user.emailVerified) {
    // Firebase allows about one link a minute per account; say so honestly when it refuses
    const resent = await withContinue((opts) => sendEmailVerification(user, opts)).then(
      () => true,
      () => false,
    );
    await signOut(auth);
    throw new Error(resent ? "EMAIL_NOT_VERIFIED" : "EMAIL_NOT_VERIFIED_RECENT");
  }
  return user;
}

/** Fetches the SDK ahead of a click, so the provider popup opens inside the click and isn't blocked. */
export const preloadAuth = () => void load().catch(() => {});

/** Closing the popup is a change of mind, not an error. */
export const cancelled = (err: unknown) =>
  ["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"].includes(
    (err as FirebaseError)?.code,
  );

/**
 * Google in a popup. A popup rather than a redirect: the auth domain is
 * Firebase's, not ours, and browsers drop redirect results across that.
 */
export async function continueWithGoogle() {
  const { auth, signInWithPopup, GoogleAuthProvider } = await load();
  const google = new GoogleAuthProvider();
  google.setCustomParameters({ prompt: "select_account" });
  const { user } = await signInWithPopup(auth, google);
  return user;
}

/** Firebase answers the same whether or not the account exists, so the form's copy stays neutral. */
export async function resetPassword(email: string) {
  const { auth, sendPasswordResetEmail } = await load();
  await withContinue((opts) => sendPasswordResetEmail(auth, email, opts));
}

export async function logOut() {
  const { auth, signOut } = await load();
  await signOut(auth);
}

/** Where to go after signing in: the page that sent you to login, or the dashboard. */
export function afterLogin() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return window.location.hostname.startsWith("app.") ? "/" : "/app";
}
