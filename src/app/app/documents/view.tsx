"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { FileLogo } from "@/components/app/FileLogo";
import { Icon } from "@/components/app/icons";
import { Btn, Drawer, Empty, Input, Modal, PageHeader, SearchInput, Select, Textarea, ago, fmtDate, orgName, useToast } from "@/components/app/ui";
import { download } from "@/lib/app/api";
import { useWorkspace, type UploadMeta } from "@/lib/app/store";
import { AUTHORITY_LABEL, type Approval, type Authority, type Doc, type FileKind, type Lang, type Status } from "@/lib/app/types";

const OPEN: Status[] = ["detected", "under_review", "confirmed", "assigned", "revision_proposed", "approved", "rejected", "rescanned"];
const LANG: Record<Lang, string> = { en: "English", zh: "中文", mixed: "English + 中文" };
const KIND: Record<FileKind, string> = { pdf: "PDF", docx: "Word", md: "Markdown", txt: "Text" };
const KINDS = Object.keys(KIND) as FileKind[];
const ACCEPT = ".pdf,.docx,.md,.markdown,.txt";
const APPROVAL: Record<Approval, string> = { approved: "Approved", draft: "Draft", archived: "Archived" };

type Tab = Approval | "all";
type Sort = "recent" | "name" | "findings";

/** Each document is its own white row: hairline border, 10px corners, like the dashboard's light surfaces. */
const ROW_STYLE: CSSProperties = { background: "#ffffff", border: "1px solid #e5e5e3", borderRadius: 10, color: "#171717" };
/** Desktop columns: document, department, version, status, rules, open findings, arrow. */
const COLS = "xl:grid xl:grid-cols-[minmax(0,1fr)_176px_112px_112px_56px_112px_16px] xl:items-center xl:gap-x-5";

const kindOf = (name: string): FileKind | null => {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return ext === "pdf" ? "pdf" : ext === "docx" ? "docx" : ext === "md" || ext === "markdown" ? "md" : ext === "txt" ? "txt" : null;
};
const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const current = (d: Doc) => d.versions[d.current] ?? d.versions[d.versions.length - 1];
const needsReview = (d: Doc) => Boolean(d.parseIssue) || current(d)?.status === "needs_ocr" || current(d)?.status === "failed";

function StatusPill({ doc }: { doc: Doc }) {
  const base = "inline-flex h-6 min-w-[84px] items-center justify-center rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap";
  if (needsReview(doc)) return <span className={`${base} bg-red text-white`}>Needs review</span>;
  const look: Record<Approval, string> = { approved: "bg-ink text-paper", draft: "border border-ink/35 text-ink", archived: "border border-line text-mute" };
  return <span className={`${base} ${look[doc.approval]}`}>{APPROVAL[doc.approval]}</span>;
}

/* ---------- page ---------- */

export default function DocumentsPage() {
  const { ws, me } = useWorkspace();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [authority, setAuthority] = useState<Authority | "all">("all");
  const [kind, setKind] = useState<FileKind | "all">("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [openId, setOpenId] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ versionOf?: Doc } | null>(null);
  const canEdit = ["owner", "admin", "editor"].includes(me.role);

  // deep links from Overview and search: ?upload=1 and ?doc=D-001
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      if (p.get("doc")) setOpenId(p.get("doc"));
      if (p.get("upload") && canEdit) setUpload({});
    });
  }, [canEdit]);
  const setParam = (key: string, value: string | null) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("upload");
    url.searchParams.delete("doc");
    if (value) url.searchParams.set(key, value);
    window.history.replaceState(null, "", url);
  };
  const openDoc = (id: string | null) => {
    setOpenId(id);
    setParam("doc", id);
  };

  const stats = useMemo(() => {
    const rules = new Map<string, number>();
    for (const r of ws.rules) if (!r.historical) rules.set(r.docId, (rules.get(r.docId) ?? 0) + 1);
    const open = new Map<string, number>();
    for (const f of ws.findings) {
      if (!OPEN.includes(f.status)) continue;
      for (const id of new Set(f.evidence.map((e) => e.docId))) open.set(id, (open.get(id) ?? 0) + 1);
    }
    return { rules, open };
  }, [ws.rules, ws.findings]);

  const depts = useMemo(() => [...new Set([...ws.settings.departments, ...ws.docs.map((d) => d.department)].filter(Boolean))].sort(), [ws.docs, ws.settings.departments]);
  const lastUpload = useMemo(() => ws.docs.flatMap((d) => d.versions.map((v) => v.uploadedAt)).sort().at(-1), [ws.docs]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = ws.docs.filter(
      (d) =>
        (tab === "all" || d.approval === tab) &&
        (dept === "all" || d.department === dept) &&
        (authority === "all" || d.authority === authority) &&
        (kind === "all" || d.kind === kind) &&
        (!needle || [d.title, d.id, d.fileName, d.owner, d.department].some((s) => s?.toLowerCase().includes(needle))),
    );
    const updated = (d: Doc) => current(d)?.uploadedAt ?? "";
    return list.sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title)
        : sort === "findings"
          ? (stats.open.get(b.id) ?? 0) - (stats.open.get(a.id) ?? 0) || a.title.localeCompare(b.title)
          : updated(b).localeCompare(updated(a)),
    );
  }, [ws.docs, tab, dept, authority, kind, q, sort, stats.open]);

  const filtered = tab !== "all" || q || dept !== "all" || authority !== "all" || kind !== "all";
  const clear = () => {
    setTab("all");
    setQ("");
    setDept("all");
    setAuthority("all");
    setKind("all");
  };
  const doc = ws.docs.find((d) => d.id === openId) ?? null;
  const totalRules = [...stats.rules.values()].reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Document Library"
        intro={
          <>
            {orgName(ws.settings.company)} · {ws.docs.length} document{ws.docs.length === 1 ? "" : "s"} · {totalRules} rule{totalRules === 1 ? "" : "s"} extracted
            {lastUpload ? ` · last upload ${ago(lastUpload)}` : ""}. Only approved documents count as company rules; drafts are checked but never treated as governing.
          </>
        }
        actions={
          canEdit && (
            <Btn variant="red" icon="upload" onClick={() => setUpload({})}>
              Upload documents
            </Btn>
          )
        }
      />

      {ws.docs.length === 0 ? (
        <div style={ROW_STYLE}>
          <Empty
            title="No documents yet"
            body="Upload your policies, SOPs and training guides. KeroSOP reads each section, extracts the rules and keeps every version."
            action={canEdit && <Btn variant="red" icon="upload" onClick={() => setUpload({})}>Upload documents</Btn>}
          />
        </div>
      ) : (
        <>
          <div className="pb-5">
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-[minmax(200px,1fr)_150px_170px_180px_140px_170px]">
              <SearchInput value={q} onChange={setQ} placeholder="Search title, code, file or owner" className="col-span-2 xl:col-span-1 [&_input]:rounded-[8px]" />
              <Select
                aria-label="Status"
                value={tab}
                onChange={(e) => setTab(e.target.value as Tab)}
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "approved", label: "Approved" },
                  { value: "draft", label: "Drafts" },
                  { value: "archived", label: "Archived" },
                ]}
                className={SEL}
              />
              <Select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)} options={[{ value: "all", label: "All departments" }, ...depts]} className={SEL} />
              <Select
                aria-label="Authority"
                value={authority}
                onChange={(e) => setAuthority(e.target.value as Authority | "all")}
                options={[{ value: "all", label: "All authority levels" }, ...Object.entries(AUTHORITY_LABEL).map(([value, label]) => ({ value, label }))]}
                className={SEL}
              />
              <Select aria-label="File type" value={kind} onChange={(e) => setKind(e.target.value as FileKind | "all")} options={[{ value: "all", label: "All file types" }, ...KINDS.map((k) => ({ value: k, label: KIND[k] }))]} className={SEL} />
              <Select
                aria-label="Sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                options={[
                  { value: "recent", label: "Recently updated" },
                  { value: "name", label: "Name, A to Z" },
                  { value: "findings", label: "Most open findings" },
                ]}
                className={`col-span-2 xl:col-span-1 ${SEL}`}
              />
            </div>
          </div>

          <div className={`hidden pr-5 pb-2.5 text-[11px] font-semibold tracking-[0.08em] text-mute uppercase whitespace-nowrap ${COLS}`}>
            <span>Document</span>
            <span>Department</span>
            <span>Version</span>
            <span>Status</span>
            <span className="text-right">Rules</span>
            <span className="text-right">Open findings</span>
            <span />
          </div>

          {rows.length ? (
            <ul className="flex flex-col gap-2">
              {rows.map((d) => (
                <DocRow key={d.id} doc={d} rules={stats.rules.get(d.id) ?? 0} open={stats.open.get(d.id) ?? 0} onOpen={() => openDoc(d.id)} />
              ))}
            </ul>
          ) : (
            <div style={ROW_STYLE}>
              <Empty icon="search" title="No documents match" body="Try another search or clear the filters." action={filtered && <Btn onClick={clear}>Clear filters</Btn>} />
            </div>
          )}
          <p className="pt-4 text-[12px] text-mute">
            Showing {rows.length} of {ws.docs.length}
          </p>
        </>
      )}

      <DocDrawer
        doc={doc}
        rules={doc ? (stats.rules.get(doc.id) ?? 0) : 0}
        open={doc ? (stats.open.get(doc.id) ?? 0) : 0}
        depts={depts}
        onClose={() => openDoc(null)}
        onNewVersion={(d) => setUpload({ versionOf: d })}
      />
      {upload && (
        <UploadModal
          versionOf={upload.versionOf}
          depts={depts}
          onClose={() => {
            setUpload(null);
            setParam("doc", openId);
          }}
        />
      )}
    </>
  );
}

const SEL = "[&_select]:rounded-[8px] font-semibold";

/* ---------- one document row ---------- */

function DocRow({ doc, rules, open, onOpen }: { doc: Doc; rules: number; open: number; onOpen(): void }) {
  const v = current(doc);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        style={ROW_STYLE}
        className={`group flex w-full flex-col gap-3 px-5 py-4 text-left transition-[border-color] hover:!border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red xl:h-[76px] xl:py-0 ${COLS}`}
      >
        <span className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-10 shrink-0 place-items-center">
            <FileLogo kind={doc.kind} className="size-9" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold">{doc.title}</span>
            <span className="mt-0.5 block truncate text-[12px] text-mute">
              {doc.id} · {AUTHORITY_LABEL[doc.authority]} · {LANG[doc.language]}
            </span>
          </span>
          <Icon name="chevron" className="size-4 shrink-0 text-mute transition-colors group-hover:text-ink xl:hidden" />
        </span>

        {/* desktop cells */}
        <span className="hidden min-w-0 xl:block">
          <span className="block truncate text-[13px]">{doc.department || "No department"}</span>
          <span className="mt-0.5 block truncate text-[12px] text-mute">{doc.owner || "No owner"}</span>
        </span>
        <span className="hidden min-w-0 xl:block">
          <span className="block text-[13px] tabular-nums">v{v?.version ?? "—"}</span>
          <span className="mt-0.5 block truncate text-[12px] text-mute">{fmtDate(v?.uploadedAt)}</span>
        </span>
        <span className="hidden xl:block">
          <StatusPill doc={doc} />
        </span>
        <span className="hidden text-right text-[14px] tabular-nums xl:block">{rules}</span>
        <span className={`hidden text-right text-[14px] tabular-nums xl:block ${open ? "font-semibold text-red" : "text-mute"}`}>{open}</span>
        <Icon name="chevron" className="hidden size-4 text-mute transition-colors group-hover:text-ink xl:block" />

        {/* compact layout below xl */}
        <span className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-[54px] text-[12px] text-mute xl:hidden">
          <StatusPill doc={doc} />
          <span className="tabular-nums">
            v{v?.version ?? "—"} · {fmtDate(v?.uploadedAt)}
          </span>
          {doc.department && <span>{doc.department}</span>}
          <span className="tabular-nums">
            {rules} rule{rules === 1 ? "" : "s"}
          </span>
          <span className={`tabular-nums ${open ? "font-semibold text-red" : ""}`}>
            {open} open finding{open === 1 ? "" : "s"}
          </span>
        </span>
      </button>
    </li>
  );
}

/* ---------- details drawer ---------- */

function DocDrawer({ doc, rules, open, depts, onClose, onNewVersion }: { doc: Doc | null; rules: number; open: number; depts: string[]; onClose(): void; onNewVersion(d: Doc): void }) {
  const { me, updateDocument, deleteDocument } = useWorkspace();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const canEdit = ["owner", "admin", "editor"].includes(me.role);
  const admin = ["owner", "admin"].includes(me.role);
  if (!doc) return null;
  const v = current(doc);
  const versions = [...doc.versions].reverse();

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={() => {
        setEditing(false);
        onClose();
      }}
      title={
        <span className="flex min-w-0 items-center gap-3">
          <FileLogo kind={doc.kind} className="size-9 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate">{doc.title}</span>
            <span className="block truncate text-[12px] font-normal text-mute">
              {doc.id} · {doc.fileName}
            </span>
          </span>
        </span>
      }
      footer={
        <>
          {admin && (
            <Btn
              variant="danger"
              icon="trash"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm(`Delete ${doc.title}? This removes every version.`)) return;
                if (await run(() => deleteDocument(doc.id), `${doc.title} deleted`)) onClose();
              }}
              className="mr-auto"
            >
              Delete
            </Btn>
          )}
          {canEdit && (
            <Btn icon="upload" onClick={() => onNewVersion(doc)}>
              Upload new version
            </Btn>
          )}
          {v && (
            <Btn variant="ink" icon="download" onClick={() => download(`/v1/documents/${doc.id}/versions/${v.version}/file`, doc.fileName).catch((e) => toast((e as Error).message, "error"))}>
              Download
            </Btn>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {canEdit ? (
            <Select
              aria-label="Status"
              value={doc.approval}
              disabled={busy}
              onChange={(e) => {
                const a = e.target.value as Approval;
                if (a !== doc.approval) run(() => updateDocument(doc.id, { approval: a }), `Marked ${APPROVAL[a].toLowerCase()}`);
              }}
              options={(Object.keys(APPROVAL) as Approval[]).map((value) => ({ value, label: APPROVAL[value] }))}
              className={`w-[180px] ${SEL}`}
            />
          ) : (
            <StatusPill doc={doc} />
          )}
          <p className="text-[13px] text-mute">
            {rules} rule{rules === 1 ? "" : "s"} · <span className={open ? "font-semibold text-red" : ""}>{open} open finding{open === 1 ? "" : "s"}</span>
          </p>
        </div>

        {needsReview(doc) && (
          <p className="rounded-[10px] border border-red/30 px-4 py-3 text-[13px] leading-[1.5] text-red">
            {doc.parseIssue || "Some pages have no readable text."} Nothing on those pages is guessed; upload a text-based copy to include them.
          </p>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-bold">Details</h3>
            {canEdit && !editing && (
              <button type="button" onClick={() => setEditing(true)} className="inline-flex h-8 items-center gap-1.5 text-[13px] leading-none font-semibold transition-colors hover:text-red">
                <Icon name="edit" className="size-4 -translate-y-0.5" />
                <span className="underline-offset-4 [button:hover>&]:underline">Edit</span>
              </button>
            )}
          </div>
          {editing ? (
            <EditForm
              doc={doc}
              depts={depts}
              busy={busy}
              onCancel={() => setEditing(false)}
              onSave={async (patch) => {
                if (await run(() => updateDocument(doc.id, patch), "Details saved")) setEditing(false);
              }}
            />
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
              <Fact label="Authority">{AUTHORITY_LABEL[doc.authority]}</Fact>
              <Fact label="Department">{doc.department || "—"}</Fact>
              <Fact label="Owner">{doc.owner || "—"}</Fact>
              <Fact label="Language">{LANG[doc.language]}</Fact>
              <Fact label="Applies to">{doc.scope || "All regions"}</Fact>
              <Fact label="Effective">{fmtDate(v?.effectiveDate)}</Fact>
              <Fact label="File">
                {KIND[doc.kind]} · {v ? fmtSize(v.size) : "—"}
              </Fact>
              <Fact label="Pages">{v?.pages ?? "—"}</Fact>
            </dl>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-[13px] font-bold">Versions</h3>
          <ol className="flex flex-col gap-2">
            {versions.map((ver) => {
              const isCurrent = ver.version === v?.version;
              return (
                <li key={ver.version} className={`flex items-start gap-4 rounded-[10px] border px-4 py-3 ${isCurrent ? "border-ink" : "border-line"}`}>
                  <span className="w-12 shrink-0 pt-px text-[14px] font-bold tabular-nums">v{ver.version}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px]">
                      {fmtDate(ver.uploadedAt)} · {ver.uploadedBy}
                      {isCurrent && <span className="ml-2 inline-flex h-5 items-center rounded-full bg-ink px-2 text-[11px] font-semibold text-paper">In force</span>}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-mute">
                      {ver.sections.length} section{ver.sections.length === 1 ? "" : "s"}
                      {ver.pages ? ` · ${ver.pages} page${ver.pages === 1 ? "" : "s"}` : ""} · {fmtSize(ver.size)}
                    </span>
                    {ver.note && <span className="mt-1 block text-[12px] leading-[1.5] text-mute">{ver.note}</span>}
                  </span>
                  <button
                    type="button"
                    aria-label={`Download v${ver.version}`}
                    title={`Download v${ver.version}`}
                    onClick={() => download(`/v1/documents/${doc.id}/versions/${ver.version}/file`, doc.fileName).catch((e) => toast((e as Error).message, "error"))}
                    className="grid size-8 shrink-0 place-items-center rounded-[8px] border border-line text-ink transition-colors hover:border-ink"
                  >
                    <Icon name="download" className="size-4" />
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </Drawer>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-mute">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold">{children}</dd>
    </div>
  );
}

type Patch = { title: string; owner: string; department: string; authority: Authority; language: Lang; scope: string };

function EditForm({ doc, depts, busy, onCancel, onSave }: { doc: Doc; depts: string[]; busy: boolean; onCancel(): void; onSave(p: Patch): void }) {
  const [p, setP] = useState<Patch>({ title: doc.title, owner: doc.owner, department: doc.department, authority: doc.authority, language: doc.language, scope: doc.scope || "All regions" });
  const set = (k: keyof Patch) => (e: { target: { value: string } }) => setP((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...p, title: p.title.trim() || doc.title });
      }}
    >
      <Input label="Title" value={p.title} onChange={set("title")} className="sm:col-span-2" />
      <Select label="Department" value={p.department} onChange={set("department")} options={[{ value: "", label: "No department" }, ...depts]} />
      <Input label="Owner" value={p.owner} onChange={set("owner")} />
      <Select label="Authority" value={p.authority} onChange={set("authority")} options={Object.entries(AUTHORITY_LABEL).map(([value, label]) => ({ value, label }))} />
      <Select label="Language" value={p.language} onChange={set("language")} options={(Object.keys(LANG) as Lang[]).map((value) => ({ value, label: LANG[value] }))} />
      <Input label="Applies to" value={p.scope} onChange={set("scope")} className="sm:col-span-2" />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Btn onClick={onCancel}>Cancel</Btn>
        <Btn type="submit" variant="ink" disabled={busy}>
          Save details
        </Btn>
      </div>
    </form>
  );
}

/* ---------- upload ---------- */

function UploadModal({ versionOf, depts, onClose }: { versionOf?: Doc; depts: string[]; onClose(): void }) {
  const { upload } = useWorkspace();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState({ title: "", department: "", owner: "", authority: "department_sop" as Authority, approval: "draft" as Approval, language: "", effectiveDate: "", note: "" });
  const set = (k: keyof typeof meta) => (e: { target: { value: string } }) => setMeta((m) => ({ ...m, [k]: e.target.value }));

  const add = (list: FileList | null) => {
    if (!list) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      if (!kindOf(f.name)) toast(`${f.name}: use PDF, Word (.docx), Markdown or plain text`, "error");
      else if (f.size > 20 * 1024 * 1024) toast(`${f.name} is over 20 MB`, "error");
      else ok.push(f);
    }
    setFiles((cur) => (versionOf ? ok.slice(0, 1) : [...cur, ...ok.filter((f) => !cur.some((c) => c.name === f.name && c.size === f.size))]));
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    add(e.dataTransfer.files);
  };

  const submit = async () => {
    setBusy(true);
    let done = 0;
    for (const f of files) {
      const m: UploadMeta = versionOf
        ? { versionOf: versionOf.id, note: meta.note || undefined, effectiveDate: meta.effectiveDate || undefined }
        : {
            title: files.length === 1 && meta.title.trim() ? meta.title.trim() : undefined,
            department: meta.department || undefined,
            owner: meta.owner.trim() || undefined,
            authority: meta.authority,
            approval: meta.approval,
            language: meta.language || undefined,
            effectiveDate: meta.effectiveDate || undefined,
            note: meta.note || undefined,
          };
      try {
        const r = await upload(f, m);
        done++;
        setFiles((cur) => cur.filter((c) => c !== f));
        if (r.issue) toast(`${r.id} v${r.version}: ${r.issue}`, "error");
      } catch (e) {
        toast(`${f.name}: ${(e as Error).message}`, "error");
      }
    }
    setBusy(false);
    if (done) {
      toast(versionOf ? `New version of ${versionOf.title} uploaded` : `${done} document${done === 1 ? "" : "s"} uploaded`);
      if (done === files.length) onClose();
    }
  };

  return (
    <Modal
      open
      wide
      onClose={busy ? () => {} : onClose}
      title={versionOf ? `New version of ${versionOf.title}` : "Upload documents"}
      footer={
        <>
          <Btn onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
          <Btn variant="red" icon="upload" disabled={!files.length || busy} onClick={submit}>
            {busy ? "Uploading…" : versionOf ? "Upload version" : `Upload ${files.length || ""} ${files.length === 1 ? "document" : "documents"}`.replace("  ", " ")}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={`on-dark flex flex-col items-center gap-4 rounded-[12px] bg-black px-6 py-8 text-center text-white transition-shadow ${over ? "ring-2 ring-red ring-offset-2" : ""}`}
        >
          <div className="flex items-center gap-3" aria-hidden="true">
            {KINDS.map((k) => (
              <FileLogo key={k} kind={k} className="size-10" />
            ))}
          </div>
          <div>
            <p className="text-[15px] font-semibold">
              Drop {versionOf ? "the new file" : "files"} here or{" "}
              <button type="button" onClick={() => input.current?.click()} className="text-white underline underline-offset-4 hover:text-white/75">
                browse
              </button>
            </p>
            <p className="mt-1 text-[13px] text-white/70">PDF, Word (.docx), Markdown or plain text · up to 20 MB each</p>
          </div>
          <input ref={input} type="file" accept={ACCEPT} multiple={!versionOf} className="sr-only" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
        </div>

        {files.length > 0 && (
          <ul className="flex flex-col gap-2">
            {files.map((f) => (
              <li key={f.name + f.size} className="flex h-14 items-center gap-3 rounded-[10px] border border-line px-3">
                <FileLogo kind={kindOf(f.name)!} className="size-8 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{f.name}</span>
                  <span className="block text-[12px] text-mute">
                    {KIND[kindOf(f.name)!]} · {fmtSize(f.size)}
                  </span>
                </span>
                <button type="button" aria-label={`Remove ${f.name}`} disabled={busy} onClick={() => setFiles((cur) => cur.filter((c) => c !== f))} className="grid size-8 place-items-center rounded-[8px] text-mute hover:text-red">
                  <Icon name="x" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {!versionOf && (
            <>
              <Input label="Title" hint={files.length > 1 ? "Uses each file name" : "Optional"} value={meta.title} onChange={set("title")} disabled={files.length > 1} placeholder="Taken from the file name" className="sm:col-span-2" />
              <Select label="Department" value={meta.department} onChange={set("department")} options={[{ value: "", label: "No department" }, ...depts]} />
              <Input label="Owner" value={meta.owner} onChange={set("owner")} placeholder="Who maintains it" />
              <Select label="Authority" value={meta.authority} onChange={set("authority")} options={Object.entries(AUTHORITY_LABEL).map(([value, label]) => ({ value, label }))} />
              <Select
                label="Status"
                value={meta.approval}
                onChange={set("approval")}
                options={[
                  { value: "draft", label: "Draft, checked but not governing" },
                  { value: "approved", label: "Approved, counts as a company rule" },
                ]}
              />
              <Select label="Language" value={meta.language} onChange={set("language")} options={[{ value: "", label: "Detect automatically" }, ...(Object.keys(LANG) as Lang[]).map((value) => ({ value, label: LANG[value] }))]} />
            </>
          )}
          <Input label="Effective date" type="date" value={meta.effectiveDate} onChange={set("effectiveDate")} />
          <Textarea label="Version note" hint="Optional" value={meta.note} onChange={set("note")} placeholder={versionOf ? "What changed in this version" : "Where it came from, or what changed"} className="sm:col-span-2" />
        </div>
      </div>
    </Modal>
  );
}
