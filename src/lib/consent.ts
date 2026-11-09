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

/** Read at send time by analytics that are already running, so a change applies without a reload. */
export const analyticsAllowed = () => read() === "granted";

export function setConsent(analytics: boolean) {
  const was = read();
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, analytics, at: new Date().toISOString() }));
  } catch {}
  // Google's own opt-out flag: a loaded gtag stops sending while it is set.
  const ga = process.env.NEXT_PUBLIC_GA_ID;
  if (ga) (window as unknown as Record<string, boolean>)[`ga-disable-${ga}`] = !analytics;
  window.dispatchEvent(new Event(EVENT));
  // Scripts already loaded can't be unloaded, but they now send nothing; clear what they set.
  if (was === "granted" && !analytics) {
    for (const c of document.cookie.split(";")) {
      const name = c.split("=")[0].trim();
      if (!/^_ga|^_gid/.test(name)) continue;
      const host = location.hostname;
      for (const domain of ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`]) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
      }
    }
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
