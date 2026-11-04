"use client";

import { useEffect, useState } from "react";

/**
 * The dashboard lives on app.kerosop.site (like app.vanta.com). There the
 * proxy maps "/findings" to the internal "/app/findings" route; on any other
 * host (local dev, previews) the dashboard is reached at "/app/…" directly.
 */
export const onAppHost = () => typeof window !== "undefined" && window.location.hostname.startsWith("app.");
export const appBase = () => (onAppHost() ? "" : "/app");

export function appHref(path: string) {
  const base = appBase();
  if (path === "/" || path === "") return base || "/";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Strips the base so the active nav item can be matched. */
export function appPath(pathname: string) {
  const base = appBase();
  const p = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  return p || "/";
}

/** Only completed dashboard pages are currently available. */
export function isAppPageEnabled(href: string) {
  const path = href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  return ["/", "/documents", "/scans", "/rules", "/findings", "/evidence", "/map", "/reports", "/integrations"].includes(path);
}

export type NavItem = { href: string; label: string; icon: string; hint: string };
export type NavGroup = { label: string; step?: string; items: NavItem[] };

/** Ordered the way the work flows: add documents, review what was found, fix it. */
export const NAV: NavGroup[] = [
  { label: "", items: [{ href: "/", label: "Overview", icon: "home", hint: "Open issues, progress and recent activity" }] },
  {
    label: "Documents",
    step: "1",
    items: [
      { href: "/documents", label: "Document Library", icon: "doc", hint: "Upload, version and tag source documents" },
      { href: "/scans", label: "Document Scan", icon: "scan", hint: "Check a set of documents for conflicts" },
      { href: "/rules", label: "Rule Registry", icon: "rules", hint: "Every instruction extracted, with its source" },
    ],
  },
  {
    label: "Review",
    step: "2",
    items: [
      { href: "/findings", label: "Findings", icon: "alert", hint: "Possible conflicts to confirm or dismiss" },
      { href: "/evidence", label: "Evidence Comparison", icon: "split", hint: "Two clauses side by side" },
      { href: "/map", label: "Policy Map", icon: "graph", hint: "How documents and rules connect" },
    ],
  },
  {
    label: "Resolve",
    step: "3",
    items: [
      { href: "/reports", label: "Reports", icon: "report", hint: "Audit and executive PDFs, CSV exports" },
      { href: "/audit", label: "Audit History", icon: "clock", hint: "Every decision, with who and when" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/integrations", label: "Integrations", icon: "plug", hint: "Import from GitHub, alerts to Slack" },
      { href: "/settings", label: "Settings", icon: "gear", hint: "Members, roles, authority and risk rules" },
    ],
  },
];

export type AuthUser = { uid: string; name: string; email: string; photo?: string };

/** Firebase session for the dashboard: undefined while loading, null when signed out. */
export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  useEffect(() => {
    let off = () => {};
    let live = true;
    if (process.env.NODE_ENV !== "production") {
      const dev = (() => {
        try {
          return localStorage.getItem("kerosop:dev-token");
        } catch {
          return null;
        }
      })();
      if (dev) {
        const [, uid, email] = dev.split(":");
        queueMicrotask(() => setUser({ uid, name: email.split("@")[0], email }));
        return;
      }
    }
    Promise.all([import("@/lib/firebase"), import("firebase/auth")]).then(([{ auth }, { onAuthStateChanged }]) => {
      if (!live) return;
      off = onAuthStateChanged(auth, (u) => {
        const password = u?.providerData.some((p) => p.providerId === "password");
        // email accounts count only once the address is confirmed (login enforces the same)
        if (!u || (password && !u.emailVerified)) return setUser(null);
        setUser({
          uid: u.uid,
          name: u.displayName || u.email?.split("@")[0] || "You",
          email: u.email ?? "",
          photo: u.photoURL ?? undefined,
        });
      });
    });
    return () => {
      live = false;
      off();
    };
  }, []);
  return user;
}
