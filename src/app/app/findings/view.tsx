"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CountUp } from "@/components/app/charts";
import { EvidenceCard } from "@/components/app/Evidence";
import { Icon } from "@/components/app/icons";
import { Actions, LifeTrack, Notes, RiskPill, StatusPill } from "@/components/app/finding";
import { Btn, Drawer, Empty, PageHeader, SearchInput, Select, ago, fmtDate, fmtDateTime, ListFooter, usePaged } from "@/components/app/ui";
import { IntegrityField } from "@/components/app/viz";
import { useWorkspace } from "@/lib/app/store";
import { prefersReducedMotion } from "@/lib/random";
import { RISK_NAME, STATUS_LABEL, TYPE_LABEL, type Finding, type FindingType, type Risk, type Status } from "@/lib/app/types";

const OPEN: Status[] = ["detected", "under_review", "confirmed", "assigned", "revision_proposed", "approved", "rejected", "rescanned"];
const RISKS: Risk[] = ["high", "medium", "low"];
const RISK_RANK: Record<Risk, number> = { high: 0, medium: 1, low: 2 };
const STATUSES = Object.keys(STATUS_LABEL) as Status[];

/** Same row look as the other library pages: white, hairline border, 10px corners. */
const ROW_STYLE: CSSProperties = { background: "#ffffff", border: "1px solid #e5e5e3", borderRadius: 7, color: "#171717" };
/** Desktop columns: finding, risk, status, owner, age, arrow. */
const COLS = "xl:grid xl:grid-cols-[minmax(0,1fr)_88px_152px_160px_64px_16px] xl:items-center xl:gap-x-6";
const SEL = "[&_button]:rounded-[6px] font-semibold";
type View = "open" | "review" | Status | "all";
type Sort = "risk" | "oldest" | "newest";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const days = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

const matchesView = (f: Finding, v: View) =>
  v === "all" ? true : v === "open" ? OPEN.includes(f.status) : v === "review" ? f.status === "detected" || f.status === "under_review" : f.status === v;

/* ---------- page ---------- */

export default function FindingsPage() {
  const { ws, me } = useWorkspace();
  const [view, setView] = useState<View>("open");
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState<Risk | "all">("all");
  const [type, setType] = useState<FindingType | "all">("all");
  const [dept, setDept] = useState("all");
  const [sort, setSort] = useState<Sort>("risk");
  const [openId, setOpenId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // deep links from Overview: ?tab=open|all|closed, ?risk=, ?type=, ?dept=, ?id=
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      const tab = p.get("tab");
      if (tab === "all" || tab === "closed" || tab === "open") setView(tab as View);
      if (p.get("risk")) setRisk(p.get("risk") as Risk);
      if (p.get("type")) setType(p.get("type") as FindingType);
      if (p.get("dept")) setDept(p.get("dept")!);
      if (p.get("id")) setOpenId(p.get("id"));
    });
  }, []);
  const openFinding = (id: string | null) => {
    setOpenId(id);
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    if (id) url.searchParams.set("id", id);
    window.history.replaceState(null, "", url);
  };

  const open = ws.findings.filter((f) => OPEN.includes(f.status));
  const byRisk = RISKS.map((r) => ({ r, n: open.filter((f) => f.risk === r).length }));
  const oldest = open.reduce((m, f) => Math.max(m, days(f.createdAt)), 0);
  const depts = useMemo(() => [...new Set(ws.findings.map((f) => f.department).filter(Boolean))].sort(), [ws.findings]);

  const can = (action: "review" | "propose" | "approve") =>
    ({ review: ["owner", "admin", "reviewer", "approver"], propose: ["owner", "admin", "editor", "reviewer"], approve: ["owner", "admin", "approver"] })[action].includes(me.role);
  const queue = [
    { label: "To review", hint: "Open or in review", view: "review" as View, n: ws.findings.filter((f) => matchesView(f, "review")).length, show: can("review") },
    { label: "To assign", hint: "Confirmed, no owner yet", view: "confirmed" as View, n: ws.findings.filter((f) => f.status === "confirmed" || f.status === "rejected").length, show: can("review") },
    { label: "Revisions to approve", hint: "New wording waiting", view: "revision_proposed" as View, n: ws.findings.filter((f) => f.status === "revision_proposed").length, show: can("approve") },
    { label: "Ready to re-scan", hint: "Revision approved", view: "approved" as View, n: ws.findings.filter((f) => f.status === "approved").length, show: true },
    { label: "Ready to close", hint: "Re-scanned", view: "rescanned" as View, n: ws.findings.filter((f) => f.status === "rescanned").length, show: can("review") },
  ].filter((x) => x.show);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ws.findings
      .filter(
        (f) =>
          matchesView(f, view) &&
          (risk === "all" || f.risk === risk) &&
          (type === "all" || f.type === type) &&
          (dept === "all" || f.department === dept) &&
          (!needle || [f.title, f.id, f.owner, f.department, f.explanation].some((s) => s?.toLowerCase().includes(needle))),
      )
      .sort((a, b) =>
        sort === "oldest"
          ? a.createdAt.localeCompare(b.createdAt)
          : sort === "newest"
            ? b.createdAt.localeCompare(a.createdAt)
            : RISK_RANK[a.risk] - RISK_RANK[b.risk] || a.createdAt.localeCompare(b.createdAt),
      );
  }, [ws.findings, view, risk, type, dept, q, sort]);
  const paged = usePaged(rows);

  // rows fade in, one after another, whenever the filter changes what is shown (no movement, so text never shifts)
  const signature = rows.map((f) => f.id).join();
  useEffect(() => {
    const el = listRef.current;
    if (!el || prefersReducedMotion()) return;
    import("animejs").then(({ animate, stagger }) => animate(el.children, { opacity: [0, 1], duration: 420, delay: stagger(35, { start: 40 }), ease: "outQuart" }));
  }, [signature]);

  const clear = () => {
    setView("open");
    setQ("");
    setRisk("all");
    setType("all");
    setDept("all");
  };
  const finding = ws.findings.find((f) => f.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Findings"
        intro={
          <>
            {plural(open.length, "open finding")} · {byRisk[0].n} high risk{open.length ? ` · Oldest open ${plural(oldest, "day")}` : ""}. Every finding quotes both sources word for word;
            nothing counts until a reviewer confirms it.
          </>
        }
      />

      {ws.findings.length === 0 ? (
        <div style={ROW_STYLE}>
          <Empty icon="alert" title="No findings yet" body="Run a scan and any conflicts between your documents appear here, with both clauses quoted." />
        </div>
      ) : (
        <>
          <div className="grid gap-4 pb-8 xl:grid-cols-12">
            {/* the open count, over KeroSOP on a phone, over a faint dot field */}
            <section className="on-dark relative min-h-[380px] overflow-hidden rounded-[9px] border border-[#37373b] bg-[linear-gradient(180deg,#212123_0%,#161617_55%,#0e0e0f_100%)] text-white sm:min-h-[340px] xl:col-span-7">
              <PhoneScene />
              <div className="pointer-events-none relative flex h-full flex-col gap-8 p-7 sm:justify-between">
                <p className="font-mono text-[11px] tracking-[0.14em] text-white/60 uppercase">Open findings · {plural(byRisk[0].n, "high risk", "high risk")}</p>
                <div>
                  <div className="flex items-end gap-4">
                    <p className="display text-[96px] leading-[0.82]">
                      <CountUp value={open.length} />
                    </p>
                    <p className="pb-1 text-[13px] leading-[1.45] text-white/70">
                      open
                      <br />
                      {open.length ? `oldest ${plural(oldest, "day")}` : "nothing waiting"}
                    </p>
                  </div>
                  <dl className="mt-7 flex gap-8">
                    {byRisk.map(({ r, n }) => (
                      <div key={r}>
                        <dt className="text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-white/60 uppercase">{RISK_NAME[r]}</dt>
                        <dd className="mt-1 text-[20px] font-semibold tabular-nums">{n}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {/* keeps the numbers where they sat when a two-line note filled the bottom */}
                <div aria-hidden="true" className="hidden h-[36px] sm:block" />
              </div>
            </section>

            {/* what is waiting on the signed-in member */}
            <section style={{ ...ROW_STYLE, borderRadius: 9 }} className="flex flex-col xl:col-span-5">
              <header className="flex items-start justify-between gap-3 px-5 pt-5">
                <div>
                  <h2 className="text-[15px] font-bold">Waiting on you</h2>
                  <p className="mt-0.5 text-[13px] leading-[1.45] text-mute">The next step for each finding your role can act on. Select one to filter.</p>
                </div>
                {view !== "open" && (
                  <button type="button" onClick={() => setView("open")} className="h-8 shrink-0 text-[13px] font-semibold hover:text-red">
                    Show open
                  </button>
                )}
              </header>
              <ul className="flex flex-col gap-2 px-5 pt-4 pb-5">
                {queue.map((x) => {
                  const on = view === x.view;
                  return (
                    <li key={x.label}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setView(on ? "open" : x.view)}
                        className={`flex h-14 w-full items-center gap-3 rounded-[7px] border px-4 text-left transition-colors ${on ? "border-ink" : "border-line hover:border-ink/40"}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[14px] font-semibold ${on ? "text-red" : ""}`}>{x.label}</span>
                          <span className="block truncate text-[12px] text-mute">{x.hint}</span>
                        </span>
                        <span className={`text-[20px] font-semibold tabular-nums ${x.n ? "" : "text-mute"}`}>
                          <CountUp value={x.n} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div className="grid grid-cols-2 gap-2 pb-5 xl:grid-cols-[minmax(180px,1fr)_160px_130px_190px_180px_170px]">
            <SearchInput value={q} onChange={setQ} placeholder="Search findings" className="col-span-2 xl:col-span-1 [&_input]:rounded-[6px]" />
            <Select
              aria-label="Status"
              value={view}
              onChange={(e) => setView(e.target.value as View)}
              options={[
                { value: "open", label: "All open" },
                { value: "review", label: "Needs review" },
                ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
                { value: "all", label: "All findings" },
              ]}
              className={SEL}
            />
            <Select aria-label="Risk" value={risk} onChange={(e) => setRisk(e.target.value as Risk | "all")} options={[{ value: "all", label: "All risks" }, ...RISKS.map((r) => ({ value: r, label: RISK_NAME[r] }))]} className={SEL} />
            <Select
              aria-label="Type"
              value={type}
              onChange={(e) => setType(e.target.value as FindingType | "all")}
              options={[{ value: "all", label: "All types" }, ...Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))]}
              className={SEL}
            />
            <Select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)} options={[{ value: "all", label: "All departments" }, ...depts]} className={SEL} />
            <Select
              aria-label="Sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              options={[
                { value: "risk", label: "Highest risk first" },
                { value: "oldest", label: "Oldest first" },
                { value: "newest", label: "Newest first" },
              ]}
              className={SEL}
            />
          </div>

          <div className={`hidden pr-5 pb-2.5 text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-mute uppercase ${COLS}`}>
            <span>Finding</span>
            <span>Risk</span>
            <span>Status</span>
            <span>Owner</span>
            <span>Age</span>
            <span />
          </div>

          {rows.length ? (
            <ul ref={listRef} className="flex flex-col gap-2">
              {paged.items.map((f) => (
                <FindingRow key={f.id} f={f} onOpen={() => openFinding(f.id)} />
              ))}
            </ul>
          ) : (
            <div style={ROW_STYLE}>
              <Empty icon="search" title="No findings match" body="Try another search or clear the filters." action={<Btn onClick={clear}>Clear filters</Btn>} />
            </div>
          )}
          <ListFooter paged={paged} />
        </>
      )}

      <FindingDrawer finding={finding} onClose={() => openFinding(null)} />
    </>
  );
}

/* ---------- phone scene ---------- */

/** Both layers fill the card the same way, so the cut-out phone sits exactly on the phone in the scene. */
const SCENE = "pointer-events-none absolute right-0 bottom-0 h-auto w-[68%] select-none sm:w-[68%]";
/** The scene's own backdrop fades into the card on its left and top edges. */
const FADE: CSSProperties = {
  maskImage: "linear-gradient(to right, transparent 0%, #000 22%), linear-gradient(to bottom, transparent 0%, #000 22%)",
  maskComposite: "intersect",
  WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 22%), linear-gradient(to bottom, transparent 0%, #000 22%)",
  WebkitMaskComposite: "source-in",
};

/**
 * KeroSOP on a phone: the full scene at the back, a faint dot field over its
 * backdrop, and the phone itself cut out on top so no dots cross it. The two
 * images fade in together with anime.js.
 */
function PhoneScene() {
  const scene = useRef<HTMLImageElement>(null);
  const phone = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!scene.current || !phone.current || prefersReducedMotion()) return;
    const els = [scene.current, phone.current];
    import("animejs").then(({ animate }) => animate(els, { opacity: [0, 1], duration: 800, ease: "outQuart" }));
  }, []);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed decorative layers that must align pixel for pixel */}
      <img ref={scene} src="/app/findings-scene.webp" alt="" aria-hidden="true" width={1318} height={949} draggable={false} className={SCENE} style={FADE} />
      <IntegrityField score={0} hot={0} warm={0} />
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed decorative layers that must align pixel for pixel */}
      <img ref={phone} src="/app/findings-phone.webp" alt="" aria-hidden="true" width={1318} height={949} draggable={false} className={SCENE} />
    </>
  );
}

/* ---------- one finding row ---------- */

function FindingRow({ f, onOpen }: { f: Finding; onOpen(): void }) {
  const age = days(f.createdAt);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        style={ROW_STYLE}
        className={`group flex w-full flex-col gap-3 px-5 py-4 text-left transition-[border-color] hover:!border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red xl:h-[76px] xl:py-0 ${COLS}`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold">{f.title}</span>
            <span className="mt-0.5 block truncate text-[12px] text-mute">
              {f.id} · {TYPE_LABEL[f.type]}
              {f.department ? ` · ${f.department}` : ""}
              {f.source === "ai" ? " · Found with AI" : ""}
            </span>
          </span>
          <Icon name="chevron" className="size-4 shrink-0 text-mute transition-colors group-hover:text-ink xl:hidden" />
        </span>

        <span className="hidden xl:block">
          <RiskPill risk={f.risk} />
        </span>
        <span className="hidden xl:block">
          <StatusPill status={f.status} />
        </span>
        <span className="hidden min-w-0 xl:block">
          <span className={`block truncate text-[13px] ${f.owner ? "" : "text-mute"}`}>{f.owner || "No owner"}</span>
          {f.dueDate && <span className="mt-0.5 block truncate text-[12px] text-mute">Due {fmtDate(f.dueDate)}</span>}
        </span>
        <span className={`hidden text-[13px] tabular-nums xl:block ${age > 30 && OPEN.includes(f.status) ? "font-semibold text-red" : ""}`}>{age} d</span>
        <Icon name="chevron" className="hidden size-4 text-mute transition-colors group-hover:text-ink xl:block" />

        <span className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-mute xl:hidden">
          <RiskPill risk={f.risk} />
          <StatusPill status={f.status} />
          <span>{f.owner || "No owner"}</span>
          <span className="tabular-nums">{age} d open</span>
        </span>
      </button>
    </li>
  );
}

/* ---------- details drawer ---------- */

function FindingDrawer({ finding, onClose }: { finding: Finding | null; onClose(): void }) {
  const { ws } = useWorkspace();
  if (!finding) return null;
  const f = finding;
  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span className="block min-w-0">
          <span className="block truncate">{f.title}</span>
          <span className="block truncate text-[12px] font-normal text-mute">
            {f.id} · {TYPE_LABEL[f.type]} · found {fmtDate(f.createdAt)}
          </span>
        </span>
      }
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-wrap items-center gap-2">
          <RiskPill risk={f.risk} />
          <StatusPill status={f.status} />
          <span className="text-[13px] text-mute">
            {f.source === "ai" ? "Proposed by AI, quotes verified" : "Found by the rules engine"} · updated {ago(f.updatedAt)}
          </span>
        </div>

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-[13px] font-bold">Progress</h3>
            {f.status === "dismissed" && <p className="text-[12px] font-semibold text-mute">Dismissed</p>}
          </div>
          <LifeTrack key={f.status} status={f.status} />
        </section>

        <Actions key={f.id + f.status} f={f} />

        <section className="flex flex-col gap-4 text-[14px] leading-[1.6]">
          <Block title="What conflicts">{f.explanation}</Block>
          {f.why && <Block title="Why it matters">{f.why}</Block>}
          {f.authority && <Block title="Which one governs">{f.authority}</Block>}
          {f.recommendation && <Block title="Suggested fix">{f.recommendation}</Block>}
        </section>

        <section>
          <h3 className="mb-3 text-[13px] font-bold">Evidence</h3>
          <div className="flex flex-col gap-3">
            {f.evidence.map((e, i) => (
              <EvidenceCard key={i} e={e} doc={ws.docs.find((d) => d.id === e.docId)} label={`Clause ${String.fromCharCode(65 + i)}`} context />
            ))}
          </div>
        </section>

        {f.source === "ai" && f.ai && (
          <section>
            <h3 className="mb-3 text-[13px] font-bold">AI review</h3>
            {f.ai.reasoning && <p className="text-[13px] leading-[1.6] text-mute">{f.ai.reasoning}</p>}
            <p className="mt-2 text-[12px] text-mute">
              {[f.ai.classification, f.ai.prompt, f.ai.digest && `model ${f.ai.digest}`].filter(Boolean).join(" · ")}
            </p>
          </section>
        )}

        {f.revision && (
          <section>
            <h3 className="mb-3 text-[13px] font-bold">Revision</h3>
            <div className="grid gap-2">
              <div className="rounded-[7px] border border-line px-4 py-3">
                <p className="text-[12px] text-mute">Current wording</p>
                <p className="mt-1 text-[14px] leading-[1.6] text-mute line-through decoration-red/60">{f.revision.current}</p>
              </div>
              <div className="rounded-[7px] border border-ink px-4 py-3">
                <p className="text-[12px] text-mute">
                  Proposed by {f.revision.by} · {fmtDateTime(f.revision.at)}
                </p>
                <p className="mt-1 text-[14px] leading-[1.6]">{f.revision.proposed}</p>
              </div>
              {f.revision.decision && (
                <p className="text-[12px] text-mute">
                  {f.revision.decision === "approved" ? "Approved" : "Rejected"} by {f.revision.decidedBy} · {fmtDateTime(f.revision.decidedAt)}
                  {f.revision.newVersion ? ` · published as v${f.revision.newVersion}` : ""}
                </p>
              )}
            </div>
          </section>
        )}

        <Notes f={f} />
      </div>
    </Drawer>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-[13px] font-bold">{title}</h3>
      <p>{children}</p>
    </div>
  );
}
