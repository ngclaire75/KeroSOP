"use client";

import { useMemo, useState } from "react";
import { IntegrityField } from "@/components/app/viz";
import { CountUp } from "@/components/app/charts";
import {
  AgingColumns,
  ChartCard,
  ChartEmpty,
  FlowChart,
  Pipeline,
  RISK_FILL,
  RISK_ORDER,
  RiskBar,
  RiskBars,
  RiskHeatmap,
  StatTile,
  riskTotal,
  type FlowPoint,
  type RiskCounts,
} from "@/components/app/dash";
import { AppLink, BtnLink, Empty, PageHeader, RiskBadge, Select, StatusBadge, ago, orgName, TILE_STYLE, STATUS_PILL } from "@/components/app/ui";
import { useWorkspace } from "@/lib/app/store";
import { AUTHORITY_LABEL, STATUS_LABEL, TYPE_LABEL, type Finding, type FindingType, type Scan, type Status } from "@/lib/app/types";

const OPEN: Status[] = ["detected", "under_review", "confirmed", "assigned", "revision_proposed", "approved", "rejected", "rescanned"];
const DAY = 86400000;
const RANGES = [
  { id: "4w", label: "4 weeks" },
  { id: "12w", label: "12 weeks" },
  { id: "12m", label: "12 months" },
  { id: "all", label: "All time" },
] as const;
type Range = (typeof RANGES)[number]["id"];

type Bucket = { from: number; to: number; label: string; range: string };

const dm = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Days for 4 weeks, weeks for 12 weeks, months for longer. The last bucket ends today. */
function makeBuckets(range: Range, now: number, earliest: number): { list: Bucket[]; unit: "day" | "week" | "month" } {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const end = today.getTime() + DAY;
  if (range === "4w" || range === "12w") {
    const step = range === "4w" ? DAY : 7 * DAY;
    const n = range === "4w" ? 28 : 12;
    return {
      unit: range === "4w" ? "day" : "week",
      list: Array.from({ length: n }, (_, i) => {
        const from = end - (n - i) * step;
        return { from, to: from + step, label: dm(from), range: range === "4w" ? new Date(from).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : `Week of ${dm(from)}` };
      }),
    };
  }
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  let months = 12;
  if (range === "all") {
    const e = new Date(earliest);
    months = Math.min(36, Math.max(6, (first.getFullYear() - e.getFullYear()) * 12 + first.getMonth() - e.getMonth() + 1));
  }
  return {
    unit: "month",
    list: Array.from({ length: months }, (_, i) => {
      const a = new Date(first.getFullYear(), first.getMonth() - (months - 1 - i), 1);
      const b = new Date(a.getFullYear(), a.getMonth() + 1, 1);
      return { from: a.getTime(), to: i === months - 1 ? end : b.getTime(), label: a.toLocaleDateString("en-GB", { month: "short" }), range: a.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) };
    }),
  };
}

const t = (iso?: string | null) => (iso ? new Date(iso).getTime() : NaN);
const zero = (): RiskCounts => ({ high: 0, medium: 0, low: 0 });
const countRisk = (fs: Finding[]) => fs.reduce((acc, f) => (acc[f.risk]++, acc), zero());
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** Open at a moment: detected before it, and not closed or dismissed before it. */
const openAt = (f: Finding, at: number) => t(f.createdAt) < at && !((f.status === "closed" || f.status === "dismissed") && t(f.updatedAt) < at);
const closedIn = (f: Finding, a: number, b: number) => f.status === "closed" && t(f.updatedAt) >= a && t(f.updatedAt) < b;
const daysToClose = (f: Finding) => (t(f.updatedAt) - t(f.createdAt)) / DAY;

function duration(s: Scan) {
  if (!s.finishedAt) return "—";
  const sec = Math.max(0, Math.round((t(s.finishedAt) - t(s.startedAt)) / 1000));
  return sec < 60 ? `${sec} s` : `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, "0")} s`;
}

const SCAN_STATE: Record<string, string> = { completed: "Completed", partially_completed: "Partly completed", failed: "Failed" };

export default function Overview() {
  const { ws, running } = useWorkspace();
  const [now] = useState(() => Date.now());
  const [range, setRange] = useState<Range>("12w");
  const [dept, setDept] = useState("all");

  const depts = useMemo(() => [...new Set([...ws.findings.map((f) => f.department), ...ws.docs.map((d) => d.department)].filter(Boolean))].sort(), [ws]);

  const d = useMemo(() => {
    const all = ws.findings.filter((f) => dept === "all" || f.department === dept);
    const earliest = Math.min(now, t(ws.createdAt) || now, ...all.map((f) => t(f.createdAt)).filter(Number.isFinite));
    const { list: buckets, unit } = makeBuckets(range, now, earliest);
    const from = buckets[0].from;
    const to = buckets[buckets.length - 1].to;
    const pFrom = from - (to - from);
    const inR = (iso: string, a: number, b: number) => t(iso) >= a && t(iso) < b;

    const open = all.filter((f) => OPEN.includes(f.status));
    const risk = countRisk(open);
    const pending = open.filter((f) => f.status === "detected" || f.status === "under_review");

    const detected = all.filter((f) => inR(f.createdAt, from, to));
    const detectedPrev = all.filter((f) => inR(f.createdAt, pFrom, from));
    const closed = all.filter((f) => closedIn(f, from, to));
    const closedPrev = all.filter((f) => closedIn(f, pFrom, from));
    const dismissed = all.filter((f) => f.status === "dismissed" && inR(f.updatedAt, from, to));

    const flow: FlowPoint[] = buckets.map((b) => ({
      label: b.label,
      range: b.range,
      risk: countRisk(all.filter((f) => inR(f.createdAt, b.from, b.to))),
      closed: all.filter((f) => closedIn(f, b.from, b.to)).length,
    }));
    const busiest = flow.reduce((m, p, i) => (riskTotal(p.risk) > riskTotal(flow[m].risk) ? i : m), 0);

    const highOpenAt = (at: number) => all.filter((f) => f.risk === "high" && openAt(f, at)).length;

    const types = (Object.keys(TYPE_LABEL) as FindingType[])
      .map((k) => ({ key: k, label: TYPE_LABEL[k], cells: countRisk(open.filter((f) => f.type === k)) }))
      .filter((r) => riskTotal(r.cells));

    const teams = Object.entries(Object.groupBy(open, (f) => f.department || "Unassigned"))
      .map(([label, fs]) => {
        const docsIn = ws.docs.filter((x) => (x.department || "Unassigned") === label).length;
        return { label, risk: countRisk(fs ?? []), href: label === "Unassigned" ? "/findings?tab=open" : `/findings?tab=open&dept=${encodeURIComponent(label)}`, sub: `${docsIn} document${docsIn === 1 ? "" : "s"}` };
      })
      .sort((a, b) => riskTotal(b.risk) - riskTotal(a.risk))
      .slice(0, 8);

    const hot = ws.docs
      .map((doc) => ({ doc, risk: countRisk(open.filter((f) => f.evidence.some((e) => e.docId === doc.id))) }))
      .filter((x) => riskTotal(x.risk))
      .sort((a, b) => riskTotal(b.risk) - riskTotal(a.risk) || b.risk.high - a.risk.high)
      .slice(0, 6);

    const age = (f: Finding) => (now - t(f.createdAt)) / DAY;
    const aging = [
      { label: "0–7 days", value: open.filter((f) => age(f) <= 7).length, tone: "ink" as const },
      { label: "8–30 days", value: open.filter((f) => age(f) > 7 && age(f) <= 30).length, tone: "ink" as const },
      { label: "31–90 days", value: open.filter((f) => age(f) > 30 && age(f) <= 90).length, tone: "red" as const },
      { label: "Over 90 days", value: open.filter((f) => age(f) > 90).length, tone: "red" as const },
    ];

    const attention = [...open].sort((a, b) => RISK_ORDER.indexOf(a.risk) - RISK_ORDER.indexOf(b.risk) || t(a.createdAt) - t(b.createdAt)).slice(0, 6);

    return {
      unit,
      from,
      to,
      open,
      risk,
      pending,
      detected,
      detectedPrev,
      closed,
      closedPrev,
      dismissed,
      flow,
      busiest,
      high: { now: risk.high, start: highOpenAt(from), spark: buckets.map((b) => highOpenAt(b.to)) },
      med: { now: median(closed.map(daysToClose)), prev: median(closedPrev.map(daysToClose)), spark: buckets.map((b) => median(all.filter((f) => closedIn(f, b.from, b.to)).map(daysToClose)) ?? 0) },
      types,
      teams,
      hot,
      aging,
      attention,
      age,
    };
  }, [ws, dept, range, now]);

  const eligible = ws.docs.filter((x) => x.approval === "approved");
  const score = d.open.length ? Math.max(4, 100 - Math.min(96, d.risk.high * 14 + d.risk.medium * 6 + d.open.length * 2)) : 100;
  const lastScan = ws.scans.find((x) => x.stage === "completed" || x.stage === "partially_completed");
  const stages = OPEN.map((s) => ({ label: s === "detected" ? "Open, not reviewed" : s === "assigned" ? "Assigned to an owner" : STATUS_LABEL[s], value: d.open.filter((f) => f.status === s).length, href: "/findings?tab=open" }));
  const unitWord = d.unit === "day" ? "a day" : d.unit === "week" ? "a week" : "a month";
  const periods = d.flow.length;
  const rangeName = RANGES.find((r) => r.id === range)!.label;
  const rangeLabel = `${new Date(d.from).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(d.to - 1).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  const prevLabel = range === "all" ? "" : `vs previous ${rangeName}`;
  const overdue = d.aging[2].value + d.aging[3].value;
  const hasFlow = d.flow.some((p) => riskTotal(p.risk) || p.closed);
  const pill = "pointer-events-auto inline-flex w-fit items-center gap-2 rounded-full bg-paper px-4 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:bg-red hover:text-paper";

  return (
    <>
      <PageHeader
        title="Overview"
        intro={
          <>
            {orgName(ws.settings.company)} · {ws.docs.length} document{ws.docs.length === 1 ? "" : "s"}
            {lastScan ? ` · last scan ${ago(lastScan.finishedAt ?? lastScan.startedAt)}` : " · no scan yet"}
          </>
        }
        actions={
          <>
            <BtnLink href="/documents?upload=1" icon="upload">
              Upload documents
            </BtnLink>
            <BtnLink href="/scans?new=1" variant="red">
              Run a scan
            </BtnLink>
          </>
        }
      />

      {/* one filter row; it scopes every chart below */}
      <div className="mb-3 flex flex-col gap-3 pt-4 pb-1 sm:mb-6 sm:pb-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Time range" value={range} onChange={(e) => setRange(e.target.value as Range)} options={RANGES.map((r) => ({ value: r.id, label: r.label }))} className="w-[160px] [&_select]:rounded-[8px] font-semibold" />
          <Select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)} options={[{ value: "all", label: "All departments" }, ...depts]} className="w-[200px] [&_select]:rounded-[8px] font-semibold" />
        </div>
        <p className="text-[13px] text-mute lg:ml-auto">
          {rangeLabel}
          {prevLabel && ` · Compared with the ${rangeName} before`}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* status: the one number, then four KPIs */}
        <div className="grid gap-4 xl:grid-cols-12">
          <section className="on-dark relative min-h-[316px] overflow-hidden rounded-[12px] bg-ink text-paper xl:col-span-5">
            <IntegrityField score={score} hot={d.risk.high} warm={d.risk.medium} />
            <div className="pointer-events-none relative flex h-full flex-col justify-between gap-6 p-7">
              <p className="font-mono text-[11px] tracking-[0.14em] text-paper/60 uppercase">
                Open findings · {eligible.length} approved document{eligible.length === 1 ? "" : "s"}
              </p>
              <div className="flex items-end gap-4">
                <p className="display text-[96px] leading-[0.82]">
                  <CountUp value={d.open.length} />
                </p>
                <div className="pb-1">
                  <p className="text-[15px] font-semibold">open</p>
                  <p className="text-[13px] text-paper/70">
                    {d.open.length ? `${d.pending.length} waiting for a reviewer` : ws.findings.length ? "Everything is resolved or dismissed." : "Run a scan to look for conflicts."}
                  </p>
                </div>
              </div>
              <RiskBar counts={d.risk} dark />
              <AppLink href={d.risk.high > 0 ? "/findings?tab=open&risk=high" : "/scans?new=1"} className={pill}>
                {d.risk.high > 0 ? "Review high-risk findings" : "Run a scan"}
              </AppLink>
            </div>
          </section>
          <div className="grid gap-4 sm:grid-cols-2 xl:col-span-7">
            <StatTile label="Detected" value={d.detected.length} prev={range === "all" ? null : d.detectedPrev.length} upIsGood={false} spark={d.flow.map((p) => riskTotal(p.risk))} sparkColor={RISK_FILL.high} foot={prevLabel || "since the first scan"} href="/findings?tab=all" />
            <StatTile label="Closed" value={d.closed.length} prev={range === "all" ? null : d.closedPrev.length} upIsGood spark={d.flow.map((p) => p.closed)} foot={prevLabel || "since the first scan"} href="/findings?tab=closed" />
            <StatTile
              label="High risk still open"
              value={d.high.now}
              prev={range === "all" ? null : d.high.start}
              upIsGood={false}
              spark={d.high.spark}
              sparkColor={RISK_FILL.high}
              foot={range === "all" ? "open right now" : `since ${new Date(d.from).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
              href="/findings?tab=open&risk=high"
            />
            <StatTile label="Median days to close" value={d.med.now} unit="days" prev={range === "all" ? null : d.med.prev} upIsGood={false} spark={d.med.spark} foot="for findings closed in range" />
          </div>
        </div>

        {/* flow over time + where open work waits */}
        <div className="grid gap-4 xl:grid-cols-12">
          <ChartCard
            className="xl:col-span-8"
            title={`Findings detected per ${d.unit}`}
            hint="New findings by severity over the selected period."
            legend={RISK_ORDER.map((r) => ({ label: `${r[0].toUpperCase()}${r.slice(1)} risk`, color: RISK_FILL[r] }))}
          >
            {hasFlow ? <FlowChart points={d.flow} /> : <ChartEmpty>Nothing was detected or closed in this range. Try a longer range or run a scan.</ChartEmpty>}
            <dl className="mt-4 grid shrink-0 grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-4 sm:grid-cols-4">
              {[
                ["Detected", String(d.detected.length), `${(d.detected.length / periods).toFixed(1)} ${unitWord}`],
                ["Closed", String(d.closed.length), `${(d.closed.length / periods).toFixed(1)} ${unitWord}`],
                ["Net change", `${d.detected.length - d.closed.length > 0 ? "+" : ""}${d.detected.length - d.closed.length}`, d.detected.length >= d.closed.length ? "more open than at the start" : "fewer open than at the start"],
                [`Busiest ${d.unit}`, hasFlow ? d.flow[d.busiest].label : "—", hasFlow ? `${riskTotal(d.flow[d.busiest].risk)} detected` : "nothing detected"],
              ].map(([k, v, sub]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[12px] text-mute">{k}</dt>
                  <dd className="mt-1 text-[20px] leading-none font-bold">{v}</dd>
                  <dd className="mt-1.5 truncate text-[12px] text-mute">{sub}</dd>
                </div>
              ))}
            </dl>
          </ChartCard>
          <ChartCard className="xl:col-span-4" title="Review pipeline" hint="Open findings at each stage of review.">
            {d.open.length ? <Pipeline stages={stages} /> : <ChartEmpty>No open findings.</ChartEmpty>}
            <p className="mt-auto pt-4 text-[12px] text-mute">
              {d.closed.length} closed and {d.dismissed.length} dismissed in this range
            </p>
          </ChartCard>
        </div>

        {/* what kind, and who */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Conflicts by type"
            hint="Darker cells indicate more findings. Select a cell to inspect."
          >
            {d.types.length ? <RiskHeatmap rows={d.types} /> : <ChartEmpty>No open findings to break down.</ChartEmpty>}
          </ChartCard>
          <ChartCard
            title="Teams affected"
            hint="Open findings by the department that owns them, stacked by risk."
            legend={RISK_ORDER.map((r) => ({ label: `${r[0].toUpperCase()}${r.slice(1)} risk`, color: RISK_FILL[r] }))}
          >
            {d.teams.length ? <RiskBars rows={d.teams} /> : <ChartEmpty>No open findings.</ChartEmpty>}
          </ChartCard>
        </div>

        {/* documents + aging */}
        <div className="grid gap-4 xl:grid-cols-12">
          <ChartCard className="xl:col-span-8" title="Documents at risk" hint="A finding counts against every document it quotes. Bars are stacked by risk."
            legend={RISK_ORDER.map((r) => ({ label: `${r[0].toUpperCase()}${r.slice(1)} risk`, color: RISK_FILL[r] }))}>
            {d.hot.length ? <RiskBars rows={d.hot.map(({ doc, risk }) => ({ label: doc.title, risk, href: `/documents?doc=${doc.id}`, sub: `${AUTHORITY_LABEL[doc.authority]} · ${LANG_LABEL[doc.language]} · v${doc.versions[doc.current]?.version ?? "—"}` }))} /> : <ChartEmpty>No document has an open finding.</ChartEmpty>}
          </ChartCard>
          <ChartCard
            className="xl:col-span-4"
            title="Age of open findings"
            hint="Open findings by days since detection. Red is past the 30-day review target."
          >
            {d.open.length ? <AgingColumns buckets={d.aging} /> : <ChartEmpty>No open findings.</ChartEmpty>}
            <p className="mt-4 border-t border-line pt-3.5 text-[12px] text-mute">
              {overdue} of {d.open.length} open finding{d.open.length === 1 ? " is" : "s are"} past the 30-day target
            </p>
          </ChartCard>
        </div>

        {/* the work itself */}
        <div className="grid gap-4 xl:grid-cols-12">
          <ChartCard
            className="xl:col-span-8"
            title="Needs attention"
            hint="Open findings, highest risk first, then oldest."
            action={
              <AppLink href="/findings?tab=open" className="text-[13px] font-semibold text-mute hover:text-ink">
                All open
              </AppLink>
            }
          >
            {d.attention.length === 0 ? (
              <Empty icon="check" title="Nothing open" body="New findings appear here after each scan." />
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {d.attention.map((f) => (
                  <li key={f.id} style={TILE_STYLE}>
                    <AppLink href={`/findings/${f.id}`} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 md:grid-cols-[64px_minmax(0,1fr)_auto_36px_60px]">
                      <span className="hidden font-mono text-[12px] text-mute md:block">{f.id}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold underline-offset-4 group-hover:underline">{f.title}</span>
                        <span className="mt-0.5 block truncate text-[12px] text-mute">
                          <span className="font-mono md:hidden">{f.id} · </span>
                          {TYPE_LABEL[f.type]} · {f.owner || "No owner yet"}
                        </span>
                      </span>
                      <span className="hidden justify-self-end md:block">
                        <StatusBadge status={f.status} />
                      </span>
                      <span className="hidden text-right text-[13px] text-mute tabular-nums md:block">{Math.max(0, Math.floor(d.age(f)))} d</span>
                      <span className="flex justify-end">
                        <RiskBadge risk={f.risk} />
                      </span>
                    </AppLink>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
          <ChartCard
            className="xl:col-span-4"
            title="Recent activity"
            hint="Every decision is kept in Audit History."
            action={
              <AppLink href="/audit" className="text-[13px] font-semibold text-mute hover:text-ink">
                History
              </AppLink>
            }
          >
            {ws.audit.length === 0 ? (
              <ChartEmpty>Nothing has happened yet.</ChartEmpty>
            ) : (
              <ol className="flex flex-col divide-y divide-line">
                {ws.audit.slice(0, 6).map((a) => (
                  <li key={a.id} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-2.5" style={TILE_STYLE}>
                    <span className="pt-px text-[12px] text-mute tabular-nums">{ago(a.at)}</span>
                    <p className="min-w-0 text-[13px] leading-[1.45]">
                      <b>{a.actor}</b> {a.action}{" "}
                      {a.href ? (
                        <AppLink href={a.href} className="font-semibold underline decoration-ink/25 underline-offset-2 hover:decoration-ink">
                          {a.target}
                        </AppLink>
                      ) : (
                        <b className="font-semibold">{a.target}</b>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </ChartCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-12">
          <ChartCard
            className="xl:col-span-12"
            title="Recent scans"
            hint="Each scan compares the documents you choose and verifies every quote."
            action={
              <AppLink href="/scans" className="text-[13px] font-semibold text-mute hover:text-ink">
                Document Scan
              </AppLink>
            }
          >
            {ws.scans.length === 0 ? (
              <Empty
                icon="scan"
                title="No scans yet"
                body="Choose a set of documents and KeroSOP checks them against each other."
                action={
                  <BtnLink href="/scans?new=1" variant="red">
                    Run a scan
                  </BtnLink>
                }
              />
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {ws.scans.slice(0, 5).map((s) => {
                  const live = running.some((r) => r.id === s.id);
                  const label = live ? "Running" : (SCAN_STATE[s.stage] ?? "Queued");
                  const result = live ? "In progress" : s.stage === "failed" ? s.error || "Could not finish" : s.reverify ? `Re-verified ${s.reverify}` : s.newFindings.length ? `${s.newFindings.length} new` : "No new conflicts";
                  return (
                    <li key={s.id} style={TILE_STYLE}>
                      <AppLink href="/scans" className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3 md:grid-cols-[minmax(0,1fr)_150px_170px_80px]">
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold underline-offset-4 group-hover:underline">{s.name}</span>
                          <span className="mt-0.5 block truncate text-[12px] text-mute">
                            {s.docIds.length} document{s.docIds.length === 1 ? "" : "s"} · {ago(s.startedAt)}
                          </span>
                        </span>
                        <span>
                          <span className={STATUS_PILL}>{label}</span>
                        </span>
                        <span className="hidden truncate text-[13px] font-medium md:block">{result}</span>
                        <span className="hidden text-right text-[13px] text-mute tabular-nums md:block">{duration(s)}</span>
                      </AppLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </ChartCard>
        </div>
      </div>
    </>
  );
}

const LANG_LABEL = { en: "EN", zh: "中文", mixed: "EN + 中文" };
