"use client";

/**
 * Workspace state for the dashboard, loaded from the KeroSOP API. Actions
 * call the API (which enforces roles, the finding state machine and the audit
 * trail) and then reload. While a scan runs the workspace is polled so the
 * stages and counts update live.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setOrg } from "./api";
import type { Authority, Approval, Baseline, Me, Member, Org, Role, Scan, Settings, Status, Workspace } from "./types";

export type UploadMeta = {
  title?: string;
  owner?: string;
  department?: string;
  authority?: Authority;
  approval?: Approval;
  language?: string;
  scope?: string;
  effectiveDate?: string;
  note?: string;
  versionOf?: string;
};

export type UploadResult = { id: string; version: string; sections: number; issue: string | null };

type Store = {
  ws: Workspace;
  me: Member;
  meInfo: Me;
  org: Org;
  orgs: Org[];
  isAdmin: boolean;
  running: Scan[];
  refresh(): Promise<void>;
  switchOrg(id: string): void;
  upload(file: File, meta: UploadMeta): Promise<UploadResult>;
  importUrl(url: string, meta: UploadMeta): Promise<UploadResult>;
  updateDocument(id: string, patch: Partial<Record<"title" | "owner" | "department" | "authority" | "approval" | "language" | "scope", string>>): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  runScan(req: { name: string; docIds: string[]; useAi: boolean }): Promise<string>;
  setStatus(id: string, status: Status, note?: string): Promise<void>;
  assign(id: string, owner: string, dueDate?: string): Promise<void>;
  addNote(id: string, text: string): Promise<void>;
  proposeRevision(id: string, docId: string, sectionId: string, current: string, proposed: string): Promise<void>;
  decideRevision(id: string, approve: boolean, note?: string): Promise<string | null>;
  reverify(id: string): Promise<string>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  setBaselines(b: Baseline[]): Promise<void>;
  invite(m: { name: string; email: string; role: Role; department: string }): Promise<void>;
  setRole(id: string, role: Role): Promise<void>;
  removeMember(id: string): Promise<void>;
  markRead(id?: string): Promise<void>;
  logExport(kind: string): Promise<void>;
  deleteWorkspace(): Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export function useWorkspace() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace outside WorkspaceProvider");
  return v;
}

const isRunning = (s: Scan) => !["completed", "partially_completed", "failed"].includes(s.stage);

export function WorkspaceProvider({ meInfo, children, fallback, onError }: { meInfo: Me; children: ReactNode; fallback: ReactNode; onError(msg: string): ReactNode }) {
  const [orgId, setOrgId] = useState(() => {
    let saved = "";
    try {
      saved = localStorage.getItem("kerosop:org") ?? "";
    } catch {}
    const id = meInfo.orgs.find((o) => o.id === saved)?.id ?? meInfo.orgs[0]?.id ?? "";
    setOrg(id);
    return id;
  });
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setWs(await api<Workspace>("/v1/workspace"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    let live = true;
    api<Workspace>("/v1/workspace")
      .then((w) => live && setWs(w))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [orgId]);

  // live progress while scans run; otherwise pick up new notifications now and then
  const busy = ws?.scans.some(isRunning) ?? false;
  useEffect(() => {
    const t = window.setInterval(refresh, busy ? 1200 : 30000);
    return () => clearInterval(t);
  }, [busy, refresh]);

  const store = useMemo<Store | null>(() => {
    if (!ws) return null;
    const org = meInfo.orgs.find((o) => o.id === orgId)!;
    const me: Member = { id: ws.me.id, name: ws.me.name, email: ws.me.email, role: ws.me.role, department: "" };
    const act = async <T,>(p: Promise<T>) => {
      const r = await p;
      await refresh();
      return r;
    };
    const post = (path: string, json?: unknown) => api(path, { method: "POST", json: json ?? {} });
    return {
      ws,
      me,
      meInfo,
      org,
      orgs: meInfo.orgs,
      isAdmin: meInfo.isAdmin,
      running: ws.scans.filter(isRunning),
      refresh,
      switchOrg: (id) => {
        setOrg(id);
        setWs(null);
        setOrgId(id);
      },
      upload: (file, meta) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("meta", JSON.stringify(meta));
        return act(api<UploadResult>("/v1/documents", { method: "POST", body: fd }));
      },
      importUrl: (url, meta) => act(api<UploadResult>("/v1/import/url", { method: "POST", json: { url, meta } })),
      updateDocument: (id, patch) => act(api(`/v1/documents/${id}`, { method: "PATCH", json: patch })).then(() => {}),
      deleteDocument: (id) => act(api(`/v1/documents/${id}`, { method: "DELETE" })).then(() => {}),
      runScan: (req) => act(api<{ id: string }>("/v1/scans", { method: "POST", json: req })).then((r) => r.id),
      setStatus: (id, status, note) => act(post(`/v1/findings/${id}/status`, { status, note })).then(() => {}),
      assign: (id, owner, dueDate) => act(post(`/v1/findings/${id}/assign`, { owner, dueDate: dueDate || null })).then(() => {}),
      addNote: (id, text) => act(post(`/v1/findings/${id}/comments`, { text })).then(() => {}),
      proposeRevision: (id, docId, sectionId, current, proposed) =>
        act(post(`/v1/findings/${id}/revisions`, { docId, sectionId, current, proposed })).then(() => {}),
      decideRevision: (id, approve, note) => act(api<{ version: string | null }>(`/v1/findings/${id}/revisions/decide`, { method: "POST", json: { approve, note } })).then((r) => r.version),
      reverify: (id) => act(api<{ id: string }>(`/v1/findings/${id}/reverify`, { method: "POST" })).then((r) => r.id),
      updateSettings: (patch) => act(api("/v1/settings", { method: "PATCH", json: patch })).then(() => {}),
      setBaselines: (b) => act(api("/v1/baselines", { method: "PUT", json: b })).then(() => {}),
      invite: (m) => act(post("/v1/members", m)).then(() => {}),
      setRole: (id, role) => act(api(`/v1/members/${id}`, { method: "PATCH", json: { role } })).then(() => {}),
      removeMember: (id) => act(api(`/v1/members/${id}`, { method: "DELETE" })).then(() => {}),
      markRead: (id) => act(post("/v1/notifications/read", { id: id ?? null })).then(() => {}),
      logExport: (kind) => act(post("/v1/audit/exports", { kind })).then(() => {}),
      deleteWorkspace: () => api("/v1/workspace", { method: "DELETE" }).then(() => {}),
    };
  }, [ws, meInfo, orgId, refresh]);

  if (error && !ws) return <>{onError(error)}</>;
  if (!store) return <>{fallback}</>;
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
