"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FileLogo } from "@/components/app/FileLogo";
import { Icon } from "@/components/app/icons";
import { AppLink, Btn, Drawer, Empty, Input, Modal, PageHeader, SearchInput, Select, ago, fmtDateTime, useToast, ListFooter, usePaged } from "@/components/app/ui";
import { FLOW_STAGES, ScanFlow } from "@/components/app/viz";
import { api } from "@/lib/app/api";
import { useWorkspace } from "@/lib/app/store";
import { prefersReducedMotion } from "@/lib/random";
import { type Doc, type Scan, type ScanStage } from "@/lib/app/types";

/** Same row look as the Document Library: white, hairline border, 10px corners. */
const ROW_STYLE: CSSProperties = { background: "#ffffff", border: "1px solid #e5e5e3", borderRadius: 10, color: "#171717" };
/** Desktop columns: scan, documents, started, duration, result, status, arrow. */
const COLS = "xl:grid xl:grid-cols-[minmax(0,1fr)_104px_104px_72px_168px_124px_16px] xl:items-center xl:gap-x-6";
const SEL = "[&_select]:rounded-[8px] font-semibold";
const SCANNERS = ["owner", "admin", "editor", "reviewer", "approver"];

type State = "running" | "completed" | "partial" | "failed";
const STATE_LABEL: Record<State, string> = { running: "Running", completed: "Completed", partial: "Partly completed", failed: "Failed" };
const PILL = "inline-flex h-6 min-w-[84px] items-center justify-center rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap";
const STATE_LOOK: Record<State, string> = {
  running: "border border-red text-red",
  completed: "bg-ink text-paper",
  partial: "border border-ink/35 text-ink",
  failed: "bg-red text-white",
};

const stateOf = (s: Scan): State =>
  s.stage === "completed" ? "completed" : s.stage === "partially_completed" ? "partial" : s.stage === "failed" ? "failed" : "running";
/** Index into FLOW_STAGES (Parsing … Completed); queued sits before the first. */
const stageIndex = (stage: ScanStage) => (stage === "partially_completed" || stage === "failed" ? FLOW_STAGES.length - 1 : ["parsing", "extracting", "matching", "validating", "completed"].indexOf(stage));
const t = (iso?: string) => (iso ? new Date(iso).getTime() : 0);
function duration(s: Scan) {
  if (!s.finishedAt) return "—";
  const sec = Math.max(0, Math.round((t(s.finishedAt) - t(s.startedAt)) / 1000));
  return sec < 60 ? `${sec} s` : `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, "0")} s`;
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function StatePill({ scan }: { scan: Scan }) {
  const s = stateOf(scan);
  return <span className={`${PILL} ${STATE_LOOK[s]}`}>{STATE_LABEL[s]}</span>;
}

function result(s: Scan) {
  const st = stateOf(s);
  if (st === "running") return { text: "In progress", hot: false };
  if (st === "failed") return { text: s.error || "Could not finish", hot: true };
  if (s.reverify) return { text: `Re-verified ${s.reverify}`, hot: false };
  return s.newFindings.length ? { text: plural(s.newFindings.length, "new finding"), hot: true } : { text: "No new conflicts", hot: false };
}

type AiStatus = { enabled: boolean; reachable: boolean; ready?: boolean; reasoning?: string; embedding?: string; reason?: string };

/* ---------- page ---------- */

export default function ScanCenter() {
  const { ws, me, running } = useWorkspace();
  const [q, setQ] = useState("");
  const [state, setState] = useState<State | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [compose, setCompose] = useState<{ docIds?: string[]; name?: string } | null>(null);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const canScan = SCANNERS.includes(me.role);

  useEffect(() => {
    api<AiStatus>("/v1/ai/status")
      .then(setAi)
      .catch(() => setAi({ enabled: false, reachable: false, reason: "Could not check the model server." }));
  }, []);

  // deep links: ?new=1 opens the composer, ?scan=D207554 a scan's details
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      if (p.get("scan")) setOpenId(p.get("scan"));
      if (p.get("new") && canScan) setCompose({});
    });
  }, [canScan]);
  const setParam = (key: string, value: string | null) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    url.searchParams.delete("scan");
    if (value) url.searchParams.set(key, value);
    window.history.replaceState(null, "", url);
  };
  const openScan = (id: string | null) => {
    setOpenId(id);
    setParam("scan", id);
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ws.scans.filter(
      (s) => (state === "all" || stateOf(s) === state) && (!needle || [s.name, s.id, s.by].some((x) => x?.toLowerCase().includes(needle))),
    );
  }, [ws.scans, q, state]);
  const paged = usePaged(rows);

  const last = ws.scans.find((s) => stateOf(s) !== "running");
  const scan = ws.scans.find((s) => s.id === openId) ?? null;
  const aiLine = !ai ? "checking the model" : ai.enabled && ai.reachable && ai.ready ? `AI review on (${ai.reasoning})` : "";

  return (
    <>
      <PageHeader
        title="Document Scan"
        intro={
          <>
            {plural(ws.scans.length, "scan")}
            {last ? ` · Last finished ${ago(last.finishedAt ?? last.startedAt)}` : ""}{aiLine ? ` · ${aiLine}` : ""}. The rules engine compares every clause first; Qwen3 only reviews the pairs it cannot
            decide, and every quote is checked against the source before a finding exists.
          </>
        }
        actions={
          canScan && (
            <Btn variant="red" icon="scan" onClick={() => setCompose({})} disabled={!ws.docs.length}>
              New scan
            </Btn>
          )
        }
      />

      {running.length > 0 && (
        <div className="flex flex-col gap-3 pb-8">
          {running.map((s) => (
            <LiveScan key={s.id} scan={s} onOpen={() => openScan(s.id)} />
          ))}
        </div>
      )}

      {ws.scans.length === 0 ? (
        <div style={ROW_STYLE}>
          <Empty
            icon="scan"
            title="No scans yet"
            body={ws.docs.length ? "Choose a set of documents and KeroSOP checks them against each other." : "Upload documents first, then scan them for conflicts."}
            action={
              canScan &&
              (ws.docs.length ? (
                <Btn variant="red" icon="scan" onClick={() => setCompose({})}>
                  New scan
                </Btn>
              ) : (
                <AppLink href="/documents?upload=1" className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-red px-4.5 text-[14px] font-semibold text-white hover:bg-red-deep">
                  <Icon name="upload" className="size-4" /> Upload documents
                </AppLink>
              ))
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 pb-5 xl:grid-cols-[minmax(200px,1fr)_190px]">
            <SearchInput value={q} onChange={setQ} placeholder="Search scan name, code or person" className="col-span-2 xl:col-span-1 [&_input]:rounded-[8px]" />
            <Select
              aria-label="Status"
              value={state}
              onChange={(e) => setState(e.target.value as State | "all")}
              options={[{ value: "all", label: "All statuses" }, ...(Object.keys(STATE_LABEL) as State[]).map((value) => ({ value, label: STATE_LABEL[value] }))]}
              className={`col-span-2 sm:col-span-1 ${SEL}`}
            />
          </div>

          <div className={`hidden pr-5 pb-2.5 text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-mute uppercase ${COLS}`}>
            <span>Scan</span>
            <span>Documents</span>
            <span>Started</span>
            <span>Duration</span>
            <span>Result</span>
            <span>Status</span>
            <span />
          </div>

          {rows.length ? (
            <ul className="flex flex-col gap-2">
              {paged.items.map((s) => (
                <ScanRow key={s.id} scan={s} onOpen={() => openScan(s.id)} />
              ))}
            </ul>
          ) : (
            <div style={ROW_STYLE}>
              <Empty
                icon="search"
                title="No scans match"
                body="Try another search or status."
                action={
                  <Btn
                    onClick={() => {
                      setQ("");
                      setState("all");
                    }}
                  >
                    Clear filters
                  </Btn>
                }
              />
            </div>
          )}
          <ListFooter paged={paged} />
        </>
      )}

      <ScanDrawer
        scan={scan}
        canScan={canScan}
        onClose={() => openScan(null)}
        onRerun={(s) => setCompose({ docIds: s.docIds.filter(Boolean), name: `${s.name} (again)` })}
      />
      {compose && (
        <NewScan
          initial={compose}
          ai={ai}
          onClose={() => {
            setCompose(null);
            setParam("scan", openId);
          }}
          onStarted={(id) => {
            setCompose(null);
            openScan(id);
          }}
        />
      )}
    </>
  );
}

/* ---------- a running scan ---------- */

function LiveScan({ scan, onOpen }: { scan: Scan; onOpen(): void }) {
  const idx = Math.max(0, stageIndex(scan.stage));
  const c = scan.counts;
  return (
    <section style={ROW_STYLE} className="overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-bold">{scan.name}</h2>
          <p className="mt-0.5 text-[12px] text-mute">
            {scan.id} · {plural(scan.docIds.length, "document")} · started {ago(scan.startedAt)} by {scan.by}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatePill scan={scan} />
          <button type="button" onClick={onOpen} className="text-[13px] font-semibold underline-offset-4 hover:text-red hover:underline">
            Details
          </button>
        </div>
      </header>
      <div className="relative mx-5 mt-4 h-[112px]">
        <ScanFlow stage={idx} items={Math.max(24, (c.rules ?? 0) * 2)} findings={c.potential ?? 0} />
      </div>
      <ol className="grid grid-cols-5 ">
        {FLOW_STAGES.map((label, i) => (
          <li key={label} className={`relative px-3 py-3 text-[12px] sm:px-5 ${i < idx ? "text-ink" : i === idx ? "font-semibold text-red" : "text-mute"}`}>
            <span className={`absolute inset-x-0 top-0 h-0.5 ${i < idx ? "bg-ink" : i === idx ? "bg-red" : "bg-transparent"}`} />
            <span className="block truncate">{label}</span>
          </li>
        ))}
      </ol>
      <p className="flex flex-wrap gap-x-5 gap-y-1 px-5 py-3 text-[12px] text-mute tabular-nums">
        <span>{plural(c.rules ?? 0, "rule")} extracted</span>
        <span>{plural(c.candidates ?? 0, "pair")} compared</span>
        {scan.useAi && (
          <span>
            AI reviewed {c.ai_reviewed ?? 0} of {c.ai_total ?? 0}
          </span>
        )}
      </p>
    </section>
  );
}

/* ---------- one scan row ---------- */

function ScanRow({ scan, onOpen }: { scan: Scan; onOpen(): void }) {
  const r = result(scan);
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
            <span className="block truncate text-[14px] font-semibold">{scan.name}</span>
            <span className="mt-0.5 block truncate text-[12px] text-mute">
              {scan.id} · {scan.by}
              {scan.useAi ? " · AI review" : " · Rules only"}
            </span>
          </span>
          <Icon name="chevron" className="size-4 shrink-0 text-mute transition-colors group-hover:text-ink xl:hidden" />
        </span>

        <span className="hidden text-[13px] tabular-nums xl:block">{plural(scan.docIds.length, "document")}</span>
        <span className="hidden min-w-0 xl:block">
          <span className="block truncate text-[13px]">{ago(scan.startedAt)}</span>
          <span className="mt-0.5 block truncate text-[12px] text-mute">{fmtDateTime(scan.startedAt)}</span>
        </span>
        <span className="hidden text-[13px] tabular-nums xl:block">{duration(scan)}</span>
        <span className={`hidden truncate text-[13px] xl:block ${r.hot ? "font-semibold text-red" : ""}`}>{r.text}</span>
        <span className="hidden xl:block">
          <StatePill scan={scan} />
        </span>
        <Icon name="chevron" className="hidden size-4 text-mute transition-colors group-hover:text-ink xl:block" />

        <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-mute xl:hidden">
          <StatePill scan={scan} />
          <span>{plural(scan.docIds.length, "document")}</span>
          <span>{ago(scan.startedAt)}</span>
          <span className="tabular-nums">{duration(scan)}</span>
          <span className={r.hot ? "font-semibold text-red" : ""}>{r.text}</span>
        </span>
      </button>
    </li>
  );
}

/* ---------- details drawer ---------- */

function ScanDrawer({ scan, canScan, onClose, onRerun }: { scan: Scan | null; canScan: boolean; onClose(): void; onRerun(s: Scan): void }) {
  const { ws } = useWorkspace();
  if (!scan) return null;
  const c = scan.counts;
  const docs = scan.docIds.map((id) => ws.docs.find((d) => d.id === id)).filter(Boolean) as Doc[];
  const found = scan.newFindings.map((id) => ws.findings.find((f) => f.id === id)).filter(Boolean);
  const live = stateOf(scan) === "running";
  const stage = stageIndex(scan.stage);

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span className="block min-w-0">
          <span className="block truncate">{scan.name}</span>
          <span className="block truncate text-[12px] font-normal text-mute">
            {scan.id} · started {fmtDateTime(scan.startedAt)} by {scan.by}
          </span>
        </span>
      }
      footer={
        canScan &&
        !live && (
          <Btn variant="red" icon="refresh" onClick={() => onRerun(scan)} disabled={!docs.length}>
            Run again
          </Btn>
        )
      }
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatePill scan={scan} />
          <p className="text-[13px] text-mute">{live ? "Updating live" : `Took ${duration(scan)}`}</p>
        </div>

        {scan.error && <p className="rounded-[10px] border border-red/30 px-4 py-3 text-[13px] leading-[1.5] text-red">{scan.error}</p>}

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-[13px] font-bold">Stages</h3>
            <p className={`text-[12px] ${scan.stage === "failed" ? "font-semibold text-red" : "text-mute"}`}>
              {live ? `${FLOW_STAGES[Math.max(0, stage)]}…` : scan.stage === "failed" ? "Stopped before finishing" : "All stages finished"}
            </p>
          </div>
          <StageTrack key={scan.id} stage={stage} live={live} failed={scan.stage === "failed"} />
        </section>

        <section>
          <h3 className="mb-3 text-[13px] font-bold">Results</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-3">
            <Fact label="Rules extracted">{c.rules ?? 0}</Fact>
            <Fact label="Pairs compared">{c.candidates ?? 0}</Fact>
            <Fact label="New findings" hot={scan.newFindings.length > 0}>
              {scan.newFindings.length}
            </Fact>
            <Fact label="Possible contradictions">{c.potential ?? 0}</Fact>
            <Fact label="Compatible">{c.compatible ?? 0}</Fact>
            <Fact label="Valid exceptions">{c.exception ?? 0}</Fact>
            <Fact label="Superseded versions">{c.historical ?? 0}</Fact>
            <Fact label="Not enough information">{c.insufficient ?? 0}</Fact>
            <Fact label="Repeats suppressed">{c.suppressed ?? 0}</Fact>
          </dl>
        </section>

        <section>
          <h3 className="mb-3 text-[13px] font-bold">AI review</h3>
          {scan.useAi ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-3">
              <Fact label="Reviewed">
                {c.ai_reviewed ?? 0} of {c.ai_total ?? 0}
              </Fact>
              <Fact label="Flagged">{c.ai_flagged ?? 0}</Fact>
              <Fact label="Failed calls" hot={(c.ai_failed ?? 0) > 0}>
                {c.ai_failed ?? 0}
              </Fact>
              <Fact label="Reasoning model">{scan.model?.reasoning || "—"}</Fact>
              <Fact label="Embedding model">{scan.model?.embedding || "—"}</Fact>
              <Fact label="Prompt">{scan.model?.prompt || "—"}</Fact>
            </dl>
          ) : (
            <p className="text-[13px] leading-[1.5] text-mute">{scan.model?.unavailable || "This scan used the rules engine only."}</p>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-[13px] font-bold">Documents compared</h3>
          <ul className="flex flex-col gap-2">
            {docs.map((d) => (
              <li key={d.id}>
                <AppLink href={`/documents?doc=${d.id}`} className="flex h-14 items-center gap-3 rounded-[10px] border border-line px-3 transition-colors hover:border-ink/40">
                  <FileLogo kind={d.kind} className="size-8 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{d.title}</span>
                    <span className="block truncate text-[12px] text-mute">
                      {d.id} · v{d.versions[d.current]?.version ?? "—"}
                    </span>
                  </span>
                  <Icon name="chevron" className="size-4 text-mute" />
                </AppLink>
              </li>
            ))}
            {docs.length < scan.docIds.length && <li className="text-[12px] text-mute">{plural(scan.docIds.length - docs.length, "document")} since deleted.</li>}
          </ul>
        </section>

        {found.length > 0 && (
          <section>
            <h3 className="mb-3 text-[13px] font-bold">New findings</h3>
            <ul className="flex flex-col gap-2">
              {found.map((f) => (
                <li key={f!.id} className="flex h-14 items-center gap-3 rounded-[10px] border border-line px-3">
                  <span className="w-16 shrink-0 font-mono text-[12px] text-mute">{f!.id}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{f!.title}</span>
                  <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold capitalize ${f!.risk === "high" ? "bg-red text-white" : "border border-ink/35 text-ink"}`}>{f!.risk}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Drawer>
  );
}

function Fact({ label, hot, children }: { label: string; hot?: boolean; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-mute">{label}</dt>
      <dd className={`mt-0.5 truncate font-semibold tabular-nums ${hot ? "text-red" : ""}`}>{children}</dd>
    </div>
  );
}

/* ---------- stage track ---------- */

const STAGE_NOTE = ["Reads each file into numbered sections", "Turns sentences into typed rules", "Pairs rules on the same topic and scope", "Checks every quote against the source", "Findings saved and deduplicated"];

/** One red gradient runs across the whole track; each segment shows its slice of it. */
const GRADIENT: CSSProperties = {
  backgroundImage: "linear-gradient(90deg, #7a0009 0%, #b8000d 30%, #e30613 65%, #ff5547 100%)",
  backgroundSize: `${FLOW_STAGES.length * 100}% 100%`,
};

/** The five stages as one segmented track. Segments fill in order when shown; a running stage carries a slow red sweep. */
function StageTrack({ stage, live, failed }: { stage: number; live: boolean; failed: boolean }) {
  const ref = useRef<HTMLOListElement>(null);
  const doneAt = (i: number) => (live ? i < stage : !failed);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let stop = () => {};
    import("animejs").then(({ animate, stagger }) => {
      const fills = el.querySelectorAll<HTMLElement>("[data-fill]");
      const notes = el.querySelectorAll<HTMLElement>("[data-note]");
      const a = animate(fills, { scaleX: [0, 1], duration: 520, delay: stagger(110), ease: "outQuart" });
      const b = animate(notes, { opacity: [0, 1], duration: 420, delay: stagger(110, { start: 120 }), ease: "outQuart" });
      const sweep = el.querySelector<HTMLElement>("[data-sweep]");
      const c = sweep ? animate(sweep, { translateX: ["-100%", "250%"], duration: 1400, loop: true, ease: "inOutSine" }) : null;
      stop = () => {
        a.pause();
        b.pause();
        c?.pause();
      };
    });
    return () => stop();
  }, [stage, live, failed]);

  return (
    <ol ref={ref} className="grid grid-cols-5 gap-1">
      {FLOW_STAGES.map((label, i) => {
        const done = doneAt(i);
        const cur = live && i === stage;
        return (
          <li key={label} className="min-w-0">
            <span className={`relative block h-2 overflow-hidden ${i === 0 ? "rounded-l-full" : ""} ${i === FLOW_STAGES.length - 1 ? "rounded-r-full" : ""} bg-line`}>
              {(done || cur) && (
                <span
                  data-fill
                  className={`absolute inset-0 origin-left ${done ? "" : "bg-red/25"}`}
                  style={done ? { ...GRADIENT, backgroundPosition: `${(i / (FLOW_STAGES.length - 1)) * 100}% 0` } : undefined}
                />
              )}
              {cur && <span data-sweep className="absolute inset-y-0 left-0 w-2/5 bg-[linear-gradient(90deg,transparent,#e30613,transparent)]" />}
            </span>
            <span data-note className="mt-2.5 block">
              <span className={`block truncate text-[12px] font-semibold ${cur ? "text-red" : done ? "text-ink" : "text-mute"}`}>{label}</span>
              <span className="mt-0.5 hidden text-[11px] leading-[1.4] text-mute sm:block">{STAGE_NOTE[i]}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- new scan ---------- */

function NewScan({ initial, ai, onClose, onStarted }: { initial: { docIds?: string[]; name?: string }; ai: AiStatus | null; onClose(): void; onStarted(id: string): void }) {
  const { ws, runScan } = useWorkspace();
  const toast = useToast();
  const usable = ws.docs.filter((d) => d.approval !== "archived");
  const [name, setName] = useState(initial.name ?? `Scan ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initial.docIds ?? [])); // nothing ticked unless opened for particular documents
  const [q, setQ] = useState("");
  const aiReady = Boolean(ai?.enabled && ai.reachable && ai.ready);
  const [useAi, setUseAi] = useState(true);
  const [busy, setBusy] = useState(false);

  const list = usable.filter((d) => !q.trim() || [d.title, d.id, d.department].some((s) => s?.toLowerCase().includes(q.trim().toLowerCase())));
  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const n = picked.size;
  const pairs = (n * (n - 1)) / 2;

  const start = async () => {
    setBusy(true);
    try {
      const id = await runScan({ name: name.trim() || "Scan", docIds: [...picked], useAi: useAi && aiReady });
      toast(`${id} started`);
      onStarted(id);
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      wide
      fullOnMobile
      onClose={busy ? () => {} : onClose}
      title="New scan"
      footer={
        <>
          <p className="mr-auto self-center text-[13px] text-mute">
            {plural(n, "document")} · {plural(pairs, "document pair")}
          </p>
          <Btn onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
          <Btn variant="red" icon="scan" onClick={start} disabled={!n || busy}>
            {busy ? "Starting…" : "Start scan"}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} />

        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[13px] font-semibold">Documents</h3>
            <span className="flex gap-4 text-[13px] font-semibold">
              <button type="button" className="hover:text-red" onClick={() => setPicked(new Set(usable.filter((d) => d.approval === "approved").map((d) => d.id)))}>
                Approved only
              </button>
              <button type="button" className="hover:text-red" onClick={() => setPicked(new Set(usable.map((d) => d.id)))}>
                All
              </button>
              <button type="button" className="hover:text-red" onClick={() => setPicked(new Set())}>
                None
              </button>
            </span>
          </div>
          <SearchInput value={q} onChange={setQ} placeholder="Filter documents" className="mb-2 [&_input]:rounded-[8px]" />
          {/* on desktop at most four whole rows (4 × 56px, 3 gaps, 1px edges for the borders); scrolling snaps a row at a time so none is cut */}
          <ul className="flex flex-col gap-1.5 py-px pr-1 sm:max-h-[244px] sm:snap-y sm:snap-mandatory sm:scroll-py-px sm:overflow-y-auto">
            {list.map((d) => {
              const on = picked.has(d.id);
              return (
                <li key={d.id} className="snap-start">
                  <label className={`flex h-14 cursor-pointer items-center gap-3 rounded-[10px] border px-3 transition-colors ${on ? "border-ink" : "border-line hover:border-ink/40"}`}>
                    <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(d.id)} />
                    <span
                      aria-hidden="true"
                      className={`grid size-5 shrink-0 place-items-center rounded-[5px] border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-red ${on ? "border-ink bg-ink text-paper" : "border-ink/30"}`}
                    >
                      {on && (
                        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m3.5 8.5 3 3 6-7" />
                        </svg>
                      )}
                    </span>
                    <FileLogo kind={d.kind} className="size-8 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{d.title}</span>
                      <span className="block truncate text-[12px] text-mute">
                        {d.id} · {d.department || "No department"} · {d.approval === "approved" ? "Approved" : "Draft, checked but not governing"}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
            {!list.length && <li className="flex h-[242px] items-center justify-center text-[13px] text-mute">No documents match.</li>}
          </ul>
        </section>

        <section className="rounded-[10px] border border-line px-4 py-3.5">
          <label className={`flex items-start justify-between gap-4 ${aiReady ? "cursor-pointer" : "cursor-not-allowed"}`}>
            <span>
              <span className="block text-[14px] font-semibold">AI review with Qwen3</span>
              <span className="mt-0.5 block text-[13px] leading-[1.45] text-mute">
                {!ai
                  ? "Checking the model server…"
                  : aiReady
                    ? `${ai.reasoning} reviews the pairs the rules engine cannot decide. It can only propose findings, and each quote it cites is verified.`
                    : `Not available: ${ai.reason ?? "the models are not installed"} The scan runs on the rules engine only.`}
              </span>
            </span>
            <input type="checkbox" className="peer sr-only" checked={useAi && aiReady} disabled={!aiReady} onChange={(e) => setUseAi(e.target.checked)} />
            <span
              aria-hidden="true"
              className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-red ${useAi && aiReady ? "bg-ink" : "bg-line"}`}
            >
              <span className={`absolute top-0.5 size-5 rounded-full bg-paper shadow transition-transform ${useAi && aiReady ? "translate-x-[18px]" : "translate-x-0.5"}`} />
            </span>
          </label>
        </section>
      </div>
    </Modal>
  );
}
