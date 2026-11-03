"use client";

/**
 * Charts for the Overview. One frame for every chart (title, legend, a table
 * view of the same numbers) and one tooltip, so each chart reads the same way.
 *
 * Risk is an ordered scale, so it is one red ramp, light to dark (validated:
 * monotone lightness, one hue, light end clears the surface). Closed work is
 * ink. Text never takes a series colour; a swatch beside it carries identity.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject, type PointerEvent as RPointerEvent } from "react";
import { RISK_NAME, type Risk } from "@/lib/app/types";
import { prefersReducedMotion } from "@/lib/random";
import { Icon } from "./icons";
import { AppLink, SURFACE_STYLE } from "./ui";

export const RISK_FILL: Record<Risk, string> = { high: "#e30613", medium: "#ec5e52", low: "#f2a097" };
export const RISK_ORDER: Risk[] = ["high", "medium", "low"];
export const RISK_LABEL: Record<Risk, string> = { high: "High risk", medium: "Medium risk", low: "Low risk" };
/* Neutral marks and grid lines on white cards. */
const INK = "#171717";
const GRID = "rgba(0,0,0,0.08)";

export type RiskCounts = Record<Risk, number>;
export const riskTotal = (r: RiskCounts) => r.high + r.medium + r.low;

/* ---------- plumbing ---------- */

function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
const useWidth = (ref: RefObject<HTMLElement | null>) => useSize(ref).w;

/** Bars and cells grow in once, then stay put (anime.js, skipped for reduced motion). */
function useGrow(ref: RefObject<HTMLElement | null>, sig: string, selector = "[data-grow]") {
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const targets = el.querySelectorAll(selector);
    if (!targets.length) return;
    let run: { cancel(): unknown } | undefined;
    import("animejs").then(({ animate, stagger }) => {
      run = animate(targets, { opacity: [0, 1], scale: [0.6, 1], duration: 520, delay: stagger(14), ease: "outQuart" });
    });
    return () => {
      run?.cancel();
    };
  }, [ref, sig, selector]);
}

/** Clean axis ticks: 0 and three steps of 1, 2, 5 × 10ⁿ. */
function ticks(max: number) {
  const raw = Math.max(1, max) / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  // counts are whole numbers, so a step is never below 1
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? pow * 10);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const out: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) out.push(Math.round(v));
  return out;
}

export const compact = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(0)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

/* ---------- tooltip ---------- */

type Tip = { x: number; y: number; body: ReactNode } | null;

function useTip() {
  const host = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);
  const at = (clientX: number, clientY: number, body: ReactNode) => {
    const r = host.current?.getBoundingClientRect();
    if (r) setTip({ x: clientX - r.left, y: clientY - r.top, body });
  };
  return {
    host,
    tip,
    hide: () => setTip(null),
    onPointer: (e: RPointerEvent, body: ReactNode) => at(e.clientX, e.clientY, body),
    /** Keyboard focus shows the same as hover, anchored to the mark. */
    onFocus: (el: Element, body: ReactNode) => {
      const b = el.getBoundingClientRect();
      at(b.left + b.width / 2, b.top, body);
    },
  };
}

function TipLayer({ tip, width }: { tip: Tip; width: number }) {
  if (!tip) return null;
  const flip = tip.x > width / 2;
  const left = tip.x + (flip ? -14 : 14);
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-20 w-max max-w-[220px] rounded-[12px] bg-ink px-3 py-2.5 text-[12px] leading-[1.45] text-paper"
      style={{ left, top: tip.y - 12, transform: flip ? "translate(-100%, -100%)" : "translateY(-100%)" }}
    >
      {tip.body}
    </div>
  );
}

/** Tooltip row: the value leads, the series name follows, keyed by a short line. */
function TipRow({ color, label, value }: { color: string; label: string; value: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-[2px] w-3 shrink-0 rounded-full" style={{ background: color === INK ? "#fff" : color }} />
      <b className="min-w-[1.5ch] text-right font-semibold tabular-nums">{value}</b>
      <span className="text-paper/70">{label}</span>
    </span>
  );
}

/* ---------- frame ---------- */

export type LegendItem = { label: string; color: string; shape?: "box" | "line" };

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-mute">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          <span className={`w-4 rounded-[1px] ${it.shape === "line" ? "h-[2px]" : "h-1"}`} style={{ background: it.color }} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * A dashboard card around one chart: title and a one-line reading guide on the
 * left, a chart/table switch on the right, the legend under the title.
 */
export function ChartCard({
  title,
  hint,
  legend,
  table,
  action,
  className = "",
  children,
}: {
  title: string;
  hint?: ReactNode;
  legend?: LegendItem[];
  table?: { head: string[]; rows: (string | number)[][] };
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className={`surface flex min-w-0 flex-col ${className}`} style={SURFACE_STYLE}>
      <header className="flex items-start justify-between gap-4 px-5 pt-5">
        <div className="min-w-0">
          <h2 className="text-[14px] leading-[1.3] font-semibold">{title}</h2>
          {hint && <p className="mt-1 text-[13px] leading-[1.45] text-mute">{hint}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {table && (
            <div role="group" aria-label={`${title}: view`} className="flex rounded-full bg-fog p-0.5">
              {(["chart", "table"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`h-7 rounded-full px-2.5 text-[12px] font-semibold capitalize transition-colors ${view === v ? "bg-paper text-ink" : "text-mute hover:text-ink"}`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      {legend && view === "chart" && (
        <div className="px-5 pt-3">
          <Legend items={legend} />
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col px-5 pt-4 pb-5">
        {view === "table" && table ? <DataTable head={table.head} rows={table.rows} /> : children}
      </div>
    </section>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="-mx-5 max-h-[320px] overflow-auto border-t border-line">
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 bg-paper">
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th key={h} scope="col" className={`px-5 py-2.5 text-[11px] font-semibold tracking-[0.06em] text-mute ${i ? "text-right" : "text-left"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={`px-5 py-2 ${j ? "text-right tabular-nums" : "font-medium"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChartEmpty({ children }: { children: ReactNode }) {
  return <p className="grid min-h-[160px] flex-1 place-items-center rounded-[10px] bg-fog px-6 text-center text-[13px] leading-[1.5] text-mute">{children}</p>;
}

/* ---------- stat tile ---------- */

export function Sparkline({ values, color = INK, className = "" }: { values: number[]; color?: string; className?: string }) {
  const W = 120;
  const H = 32;
  const max = Math.max(1, ...values);
  const x = (i: number) => 2 + (i / Math.max(1, values.length - 1)) * (W - 6);
  const y = (v: number) => H - 3 - (v / max) * (H - 8);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`h-8 w-[120px] overflow-visible ${className}`} aria-hidden="true">
      <path d={`${d}L${x(last)},${H}L${x(0)},${H}Z`} fill={color} opacity="0.08" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

/**
 * Label, value, change against the previous period of the same length, and a
 * sparkline over the selected range. `upIsGood` sets whether a rise is good news.
 */
export function StatTile({
  label,
  value,
  unit,
  prev,
  upIsGood,
  spark,
  foot,
  href,
}: {
  label: string;
  value: number | null;
  unit?: string;
  prev?: number | null;
  upIsGood?: boolean;
  spark?: number[];
  sparkColor?: string;
  foot: string;
  href?: string;
}) {
  const delta = value !== null && prev !== null && prev !== undefined ? value - prev : null;
  const good = delta === null || delta === 0 ? null : upIsGood ? delta > 0 : delta < 0;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[14px] font-bold text-mute">{label}</p>
        {href && <Icon name="arrow" className="size-4 text-mute opacity-0 transition-opacity group-hover:opacity-100" />}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-[32px] leading-none font-semibold tracking-[-0.035em] tabular-nums">
          {value === null ? "—" : Number.isInteger(value) ? compact(value) : value.toFixed(1)}
          {unit && value !== null && <span className="ml-1 text-[15px] font-semibold tracking-normal text-mute">{unit}</span>}
        </p>
        {spark && spark.some(Boolean) && <Sparkline values={spark} color="#ffffff" className="mb-1 shrink-0 [&_path[stroke]]:opacity-100" />}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        {delta !== null && (
          <span
            className={`inline-flex h-5 min-w-[42px] items-center justify-center gap-1 rounded-full px-3 font-semibold tabular-nums ${
              "bg-white text-black"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {Number.isInteger(delta) ? delta : delta.toFixed(1)}
            <span className="sr-only">{good === null ? "no change" : good ? "better" : "worse"}</span>
          </span>
        )}
        <span className="text-mute">{foot}</span>
      </div>
    </>
  );
  const statStyle = {
    ...SURFACE_STYLE,
    "--ink": "#ffffff",
    "--mute": "#ffffff",
    "--fog": "#2c2c30",
    background: "#000000",
    color: "#ffffff",
    border: "1px solid #37373b",
  } as CSSProperties;
  const cls = "surface on-dark group flex h-full min-w-0 flex-col justify-between p-5";
  return href ? (
    <AppLink href={href} className={`${cls} transition-shadow hover:ring-1 hover:ring-white/25`} style={statStyle}>
      {body}
    </AppLink>
  ) : (
    <div className={cls} style={statStyle}>
      {body}
    </div>
  );
}

/* ---------- risk mix: one stacked bar ---------- */

/** Part-to-whole of open findings by risk, on a dark or light surface. */
export function RiskBar({ counts, dark = false }: { counts: RiskCounts; dark?: boolean }) {
  const total = riskTotal(counts);
  return (
    <div>
      <div className={`flex h-3 gap-[2px] overflow-hidden rounded-[4px] ${dark ? "bg-paper/10" : "bg-fog"}`} role="img" aria-label={RISK_ORDER.map((r) => `${counts[r]} ${r}`).join(", ")}>
        {total > 0 &&
          RISK_ORDER.filter((r) => counts[r]).map((r) => (
            <span key={r} className="h-full transition-[flex-grow] duration-700" style={{ flexGrow: counts[r], background: RISK_FILL[r] }} />
          ))}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {RISK_ORDER.map((r) => (
          <li key={r} className="min-w-0">
            <p className={`flex items-center gap-1.5 text-[12px] ${dark ? "text-paper/65" : "text-mute"}`}>
              <span className="h-1 w-3 shrink-0 rounded-[1px]" style={{ background: RISK_FILL[r] }} />
              <span className="truncate">{RISK_LABEL[r]}</span>
            </p>
            <p className="mt-0.5 text-[20px] font-bold">{counts[r]}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- findings flow: stacked columns + closed line, one axis ---------- */

export type FlowPoint = { label: string; range: string; risk: RiskCounts; closed: number };

export function FlowChart({ points }: { points: FlowPoint[] }) {
  const { host, tip, hide, onPointer, onFocus } = useTip();
  // the plot fills whatever height the card has, so it lines up with its neighbour
  const { w: width, h: boxH } = useSize(host);
  const H = Math.max(240, boxH);
  const pad = { l: 28, r: 8, t: 12, b: 28 };
  const max = Math.max(1, ...points.map((p) => riskTotal(p.risk)));
  const tk = ticks(max);
  const top = tk[tk.length - 1];
  const innerW = Math.max(0, width - pad.l - pad.r);
  const band = points.length ? innerW / points.length : 0;
  const barW = Math.min(24, Math.max(4, band * 0.56));
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const cx = (i: number) => pad.l + band * i + band / 2;
  const every = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(innerW / 64))));
  useGrow(host, `${width}:${points.map((p) => riskTotal(p.risk)).join()}`);

  const body = (p: FlowPoint) => (
    <>
      <p className="mb-1.5 font-semibold">{p.range}</p>
      <span className="flex flex-col gap-1">
        {RISK_ORDER.map((r) => (
          <TipRow key={r} color={RISK_FILL[r]} label={`${RISK_NAME[r]} detected`} value={p.risk[r]} />
        ))}
        <TipRow color={INK} label="closed" value={p.closed} />
      </span>
    </>
  );

  return (
    <div ref={host} className="relative min-h-[240px] flex-1" onPointerLeave={hide}>
      <div className="absolute inset-0">
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label="Findings detected per period, by risk">
            {tk.map((v) => (
              <g key={v}>
                <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? "rgba(0,0,0,0.18)" : GRID} strokeWidth="1" />
                <text x={0} y={y(v)} dy="0.32em" textAnchor="start" className="fill-mute text-[11px] tabular-nums">
                  {compact(v)}
                </text>
              </g>
            ))}
            {points.map((p, i) => {
              let acc = 0;
              const segs = [...RISK_ORDER].reverse().filter((r) => p.risk[r]);
              return (
                <g key={i} data-grow style={{ transformOrigin: `${cx(i)}px ${y(0)}px`, transformBox: "view-box" }}>
                  {segs.map((r, k) => {
                    const v0 = acc;
                    acc += p.risk[r];
                    const yTop = y(acc);
                    const h = Math.max(0, y(v0) - yTop - (k ? 2 : 0));
                    const topMost = k === segs.length - 1;
                    const rr = topMost ? Math.min(4, h / 2, barW / 2) : 0;
                    const x0 = cx(i) - barW / 2;
                    const yb = yTop + h;
                    // rounded data-end on top, square at the baseline
                    const d = `M${x0},${yb}V${yTop + rr}Q${x0},${yTop} ${x0 + rr},${yTop}H${x0 + barW - rr}Q${x0 + barW},${yTop} ${x0 + barW},${yTop + rr}V${yb}Z`;
                    return <path key={r} d={d} fill={RISK_FILL[r]} />;
                  })}
                </g>
              );
            })}
            {points.map((p, i) =>
              i % every === 0 ? (
                <text key={i} x={cx(i)} y={H - 8} textAnchor="middle" className="fill-mute text-[11px]">
                  {p.label}
                </text>
              ) : null,
            )}
            {/* one hit band per period: the reader aims at a date, not at a 2px line */}
            {points.map((p, i) => (
              <rect
                key={i}
                x={pad.l + band * i}
                y={pad.t}
                width={band}
                height={H - pad.t - pad.b}
                fill="transparent"
                tabIndex={0}
                aria-label={`${p.range}: ${riskTotal(p.risk)} detected (${p.risk.high} high, ${p.risk.medium} medium, ${p.risk.low} low), ${p.closed} closed`}
                className="outline-none focus-visible:stroke-ink"
                onPointerMove={(e) => onPointer(e, body(p))}
                onFocus={(e) => onFocus(e.currentTarget, body(p))}
                onBlur={hide}
              />
            ))}
          </svg>
        )}
      </div>
      <TipLayer tip={tip} width={width} />
    </div>
  );
}

/* ---------- lifecycle pipeline: one series, the bottleneck emphasised ---------- */

export type Stage = { label: string; value: number; href: string };

export function Pipeline({ stages }: { stages: Stage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  const peak = stages.reduce((m, s, i) => (s.value > stages[m].value ? i : m), 0);
  const ref = useRef<HTMLDivElement>(null);
  useGrow(ref, stages.map((s) => s.value).join(), "[data-bar]");
  return (
    <div ref={ref}>
      <ol className="flex flex-col gap-1">
        {stages.map((s, i) => (
          <li key={s.label}>
            <AppLink href={s.href} className="group grid grid-cols-[18px_minmax(0,1fr)_32px] items-center gap-x-3 rounded-[10px] py-1.5">
              <span className="text-[11px] font-semibold text-mute tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{s.label}</span>
                <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-fog">
                  <span
                    data-bar
                    className="block h-full origin-left rounded-full"
                    style={{ width: `${(s.value / max) * 100}%`, background: i === peak && s.value ? RISK_FILL.high : INK }}
                  />
                </span>
              </span>
              <span className="text-right text-[14px] font-bold tabular-nums">{s.value}</span>
            </AppLink>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------- type × risk heatmap: one hue, light to dark ---------- */

export type HeatRow = { label: string; key: string; cells: RiskCounts };

export function RiskHeatmap({ rows }: { rows: HeatRow[] }) {
  const { host, tip, hide, onPointer, onFocus } = useTip();
  const width = useWidth(host);
  const max = Math.max(1, ...rows.flatMap((r) => RISK_ORDER.map((k) => r.cells[k])));
  useGrow(host, rows.map((r) => riskTotal(r.cells)).join(), "[data-cell]");
  const shade = (v: number) => (v ? 0.14 + 0.86 * (v / max) : 0);
  const body = (r: HeatRow, k: Risk) => (
    <>
      <p className="font-semibold">{r.label}</p>
      <p className="mt-0.5 text-paper/75">
        <b className="text-paper">{r.cells[k]}</b> {RISK_NAME[k]} risk
      </p>
    </>
  );
  return (
    <div ref={host} className="relative" onPointerLeave={hide}>
      <div>
        <div className="grid grid-cols-[minmax(90px,1fr)_repeat(3,minmax(0,36px))] items-center gap-1">
          <span />
          {RISK_ORDER.map((k) => (
            <span key={k} className="pb-1.5 text-center text-[11px] font-semibold tracking-[0.06em] text-mute">
              {k === "medium" ? "Med" : RISK_NAME[k]}
            </span>
          ))}
          {rows.map((r) => (
            <div key={r.key} className="contents">
              <span className="pr-3 text-[13px] leading-snug">{r.label}</span>
              {RISK_ORDER.map((k) => {
                const v = r.cells[k];
                const a = shade(v);
                return (
                  <AppLink
                    key={k}
                    href={`/findings?tab=open&type=${r.key}&risk=${k}`}
                    data-cell
                    aria-label={`${r.label}: ${v} ${RISK_NAME[k]} risk`}
                    onPointerMove={(e) => onPointer(e, body(r, k))}
                    onFocus={(e) => onFocus(e.currentTarget, body(r, k))}
                    onPointerLeave={hide}
                    onBlur={hide}
                    className="block aspect-square w-full outline-offset-2 transition-[filter] hover:brightness-95"
                    style={{ background: v ? `rgba(227,6,19,${(0.25 + 0.75 * a).toFixed(3)})` : "#f5f5f4", color: v ? (a > 0.55 ? "#fff" : "#761019") : "#62625f" }}
                  >
                  </AppLink>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-[12px] text-mute" aria-hidden="true">
          Fewer
          {[0.14, 0.35, 0.57, 0.78, 1].map((a) => (
            <span key={a} className="h-2.5 w-[18px] rounded-[2px]" style={{ background: `rgba(227,6,19,${a})` }} />
          ))}
          More
        </div>
      </div>
      <TipLayer tip={tip} width={width} />
    </div>
  );
}

/* ---------- horizontal bars stacked by risk ---------- */

export type StackRow = { label: string; risk: RiskCounts; href?: string; sub?: string };

export function RiskBars({ rows }: { rows: StackRow[] }) {
  const { host, tip, hide, onPointer, onFocus } = useTip();
  const width = useWidth(host);
  const max = Math.max(1, ...rows.map((r) => riskTotal(r.risk)));
  useGrow(host, rows.map((r) => riskTotal(r.risk)).join(), "[data-bar]");
  const body = (r: StackRow) => (
    <>
      <p className="mb-1.5 font-semibold">{r.label}</p>
      <span className="flex flex-col gap-1">
        {RISK_ORDER.map((k) => (
          <TipRow key={k} color={RISK_FILL[k]} label={`${RISK_NAME[k]} risk`} value={r.risk[k]} />
        ))}
      </span>
    </>
  );
  return (
    <div ref={host} className="relative" onPointerLeave={hide}>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => {
          const t = riskTotal(r.risk);
          const inner = (
            <>
              <span className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate font-medium">{r.label}</span>
                {r.sub && <span className="shrink-0 text-[12px] text-mute">{r.sub}</span>}
              </span>
              <span className="mt-1.5 flex items-center gap-2.5">
                <span className="flex h-3 min-w-0 flex-1">
                  <span data-bar className="flex h-full origin-left gap-[2px] overflow-hidden rounded-full" style={{ width: `${(t / max) * 100}%` }}>
                    {RISK_ORDER.filter((k) => r.risk[k]).map((k) => (
                      <span key={k} className="h-full" style={{ flexGrow: r.risk[k], background: RISK_FILL[k] }} />
                    ))}
                  </span>
                </span>
                <span className="w-7 shrink-0 text-right text-[13px] font-bold tabular-nums">{t}</span>
              </span>
            </>
          );
          const handlers = {
            onPointerMove: (e: RPointerEvent) => onPointer(e, body(r)),
            onFocus: (e: { currentTarget: Element }) => onFocus(e.currentTarget, body(r)),
            onBlur: hide,
            "aria-label": `${r.label}: ${t} open (${r.risk.high} high, ${r.risk.medium} medium, ${r.risk.low} low)`,
          };
          return (
            <li key={r.label}>
              {r.href ? (
                <AppLink href={r.href} className="-mx-1.5 block rounded-[10px] px-1.5 py-1" {...handlers}>
                  {inner}
                </AppLink>
              ) : (
                <div tabIndex={0} className="-mx-1.5 block rounded-[10px] px-1.5 py-1" {...handlers}>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <TipLayer tip={tip} width={width} />
    </div>
  );
}

/* ---------- aging histogram: ordered buckets, single series ---------- */

export type Bucket = { label: string; value: number; tone: "ink" | "red" };

export function AgingColumns({ buckets }: { buckets: Bucket[] }) {
  const { host, tip, hide, onPointer, onFocus } = useTip();
  const width = useWidth(host);
  const max = Math.max(1, ...buckets.map((b) => b.value));
  useGrow(host, buckets.map((b) => b.value).join(), "[data-bar]");
  const H = 168;
  return (
    <div ref={host} className="relative flex flex-1 flex-col justify-end" onPointerLeave={hide}>
      <div className="grid items-end gap-3" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0,1fr))` }}>
        {buckets.map((b) => {
          const body = (
            <>
              <p className="font-semibold">{b.label}</p>
              <p className="mt-0.5 text-paper/75">
                <b className="text-paper">{b.value}</b> open finding{b.value === 1 ? "" : "s"}
              </p>
            </>
          );
          return (
            <div
              key={b.label}
              tabIndex={0}
              aria-label={`${b.label}: ${b.value} open`}
              onPointerMove={(e) => onPointer(e, body)}
              onFocus={(e) => onFocus(e.currentTarget, body)}
              onBlur={hide}
              className="flex flex-col items-center rounded-[8px] outline-offset-2"
            >
              <span className="flex w-full justify-center border-b border-line" style={{ height: H }}>
                <span
                  data-bar
                  className="mt-auto block w-full max-w-[40px] origin-bottom rounded-t-[4px]"
                  style={{ height: `${Math.max(b.value ? 3 : 0, (b.value / max) * 100)}%`, background: b.tone === "red" ? RISK_FILL.high : INK }}
                />
              </span>
              <span className="mt-2 text-center text-[11px] leading-[1.3] text-mute">{b.label}</span>
            </div>
          );
        })}
      </div>
      <TipLayer tip={tip} width={width} />
    </div>
  );
}

/* ---------- segmented control for the filter row ---------- */

export function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange(v: NoInfer<T>): void; options: readonly { id: NoInfer<T>; label: string }[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-10 items-center rounded-[8px] border border-line bg-paper p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`h-full rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${value === o.id ? "bg-black text-white" : "text-mute hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
