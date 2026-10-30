/**
 * The auth forms talk to the art around them through one window event:
 * keystrokes ripple the p5 dot field, a focused password darkens the cat's
 * lenses, and a successful submit sends a pulse through the three.js cloud.
 */
export const AUTH_EVENT = "kero:auth";

export type AuthSignal =
  | { type: "key"; x: number; y: number }
  | { type: "privacy"; on: boolean }
  | { type: "success" };

export function sendAuth(signal: AuthSignal) {
  window.dispatchEvent(new CustomEvent<AuthSignal>(AUTH_EVENT, { detail: signal }));
}

export function onAuth(handler: (signal: AuthSignal) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<AuthSignal>).detail);
  window.addEventListener(AUTH_EVENT, listener);
  return () => window.removeEventListener(AUTH_EVENT, listener);
}
