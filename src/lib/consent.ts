"use client";

import { useSyncExternalStore } from "react";

/** Optional-cookie choice: unset until the visitor picks, then "granted" or "denied". */
export type Consent = "granted" | "denied" | null;

const KEY = "kerosop:consent";
const EVENT = "kerosop:consent";
/** Bump to ask everyone again when what we collect changes. */
const VERSION = 1;

/** Footer links with this href reopen the banner. */
export const SETTINGS_HREF = "#cookie-settings";

function read(): Consent {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { v?: number; analytics?: boolean };
    if (v.v !== VERSION) return null;
    return v.analytics ? "granted" : "denied";
  } catch {
    return null;
  }
}

export function setConsent(analytics: boolean) {
  const was = read();
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, analytics, at: new Date().toISOString() }));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
  // Scripts already running can't be unloaded: clear what they set and start clean.
  if (was === "granted" && !analytics) {
    for (const c of document.cookie.split(";")) {
      const name = c.split("=")[0].trim();
      if (!/^_ga|^_gid/.test(name)) continue;
      const host = location.hostname;
      for (const domain of ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`]) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
      }
    }
    location.reload();
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** `undefined` during server render and hydration, so nothing flashes before storage is read. */
export function useConsent(): Consent | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}
