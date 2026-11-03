"use client";

/**
 * Client for the KeroSOP API (backend/). Every call carries the Firebase ID
 * token; workspace calls also name the organisation (X-Org-Id), which the API
 * checks against membership and the database scopes with row-level security.
 */
export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * Local QA only: in a development build, a "test:<uid>:<email>" token saved in
 * localStorage stands in for Firebase. Production builds drop this branch, and
 * the API refuses such tokens unless started with KEROSOP_ALLOW_TEST_TOKENS=1.
 */
export function devToken() {
  if (process.env.NODE_ENV === "production") return null;
  try {
    return localStorage.getItem("kerosop:dev-token");
  } catch {
    return null;
  }
}

async function token() {
  const dev = devToken();
  if (dev) return dev;
  const [{ auth }] = await Promise.all([import("@/lib/firebase")]);
  await auth.authStateReady();
  const t = await auth.currentUser?.getIdToken();
  if (!t) throw new ApiError("Log in to continue.", 401);
  return t;
}

let currentOrg = "";
export const setOrg = (id: string) => {
  currentOrg = id;
  try {
    localStorage.setItem("kerosop:org", id);
  } catch {}
};
export const savedOrg = () => {
  try {
    return localStorage.getItem("kerosop:org") ?? "";
  } catch {
    return "";
  }
};

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${await token()}` };
  if (currentOrg) headers["X-Org-Id"] = currentOrg;
  let body = init.body;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...init, body, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  } catch {
    throw new ApiError("Can’t reach the KeroSOP service. Check your connection and try again.", 0);
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError((data as { error?: string })?.error ?? `Request failed (${res.status}).`, res.status);
  return data as T;
}

export async function download(path: string, name: string) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await token()}`, "X-Org-Id": currentOrg } });
  if (!res.ok) throw new ApiError("The original file is not available.", res.status);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
