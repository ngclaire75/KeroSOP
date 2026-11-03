import { getApps, initializeApp } from "firebase/app";
import {
  browserPopupRedirectResolver,
  browserSessionPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
} from "firebase/auth";

/** KeroSOP's own Firebase project, used for Auth only. */
const NAME = "kerosop";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** "Keep me logged in", remembered across visits so the login page doesn't reset it. */
export const KEEP_KEY = "kerosop:keep";
export function keepPreference() {
  try {
    return localStorage.getItem(KEEP_KEY) !== "0";
  } catch {
    return true;
  }
}

const existing = getApps().find((a) => a.name === NAME);
const app = existing ?? initializeApp(config, NAME);

// Only the chosen storage: given several, Firebase moves a tab-only session
// into lasting storage on load, which would quietly undo an unticked box.
export const auth = existing
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: keepPreference() ? indexedDBLocalPersistence : browserSessionPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
