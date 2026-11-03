"use client";

/**
 * Dot-matrix charts in the KeroSOP poster style, animated with anime.js.
 * Each dot is one item (a finding, a document), so the charts can be read
 * exactly, not just compared.
 */
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/random";

const anime = () => import("animejs");

export function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.textContent = String(value);
      shown.current = value;
      return;
    }
    const obj = { v: shown.current };
    let run: { cancel(): unknown } | undefined;
    anime().then(({ animate }) => {
      run = animate(obj, {
        v: value,
        duration: 1100,
        ease: "outExpo",
        onUpdate: () => {
          el.textContent = String(Math.round(obj.v));
        },
        onComplete: () => {
          shown.current = value;
        },
      });
    });
    return () => {
      run?.cancel();
    };
  }, [value]);
  return (
    <span ref={ref} className={className}>
      0
    </span>
  );
}

function useDotsIn(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const dots = el.querySelectorAll("[data-dot]");
    if (!dots.length) return;
    let run: { cancel(): unknown } | undefined;
    anime().then(({ animate, stagger }) => {
      run = animate(dots, { scale: [0, 1], opacity: [0, 1], duration: 520, delay: stagger(18, { start: 80 }), ease: "outBack(1.8)" });
    });
    return () => {
      run?.cancel();
    };
  }, [dep]);
  return ref;
}

export type DotRow = { label: string; dots: { tone: "red" | "ink" | "line" | "green"; title: string; href?: string }[] };

const TONE = { red: "bg-red", ink: "bg-ink", line: "bg-[#c9c9c4]", green: "bg-[#1f8a4c]" };

/** One row per category, one dot per item. */
export function DotBars({ rows, onPick }: { rows: DotRow[]; onPick?: (href: string) => void }) {
  const ref = useDotsIn(rows.map((r) => r.dots.length).join());
  const max = Math.max(1, ...rows.map((r) => r.dots.length));
  return (
    <div ref={ref} className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(0,150px)_1fr_auto] items-center gap-3">
          <span className="truncate text-[13px] text-mute">{r.label}</span>
          <div className="flex min-h-4 flex-wrap gap-1.5" style={{ maxWidth: `${Math.max(12, (r.dots.length / max) * 100)}%` }}>
            {r.dots.length === 0 && <span className="text-[12px] text-mute/60">—</span>}
            {r.dots.map((d, i) => (
              <button
                key={i}
                data-dot
                type="button"
                title={d.title}
                aria-label={d.title}
                onClick={() => d.href && onPick?.(d.href)}
                className={`size-3.5 rounded-full transition-transform hover:scale-125 ${TONE[d.tone]}`}
              />
            ))}
          </div>
          <span className="w-6 text-right text-[13px] font-semibold tabular-nums">{r.dots.length}</span>
        </div>
      ))}
    </div>
  );
}

/** A ring of dots split into segments, with the total in the middle. */
export function DotRing({ segments, label }: { segments: { label: string; value: number; tone: keyof typeof TONE }[]; label: string }) {
  const ref = useDotsIn(segments.map((s) => s.value).join());
  const total = segments.reduce((a, s) => a + s.value, 0);
  const N = 48;
  const tones: (keyof typeof TONE)[] = [];
  segments.forEach((s) => {
    const n = total ? Math.round((s.value / total) * N) : 0;
    for (let i = 0; i < n; i++) tones.push(s.tone);
  });
  while (tones.length < N) tones.push(total ? (tones[tones.length - 1] ?? "line") : "line");
  tones.length = N;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div ref={ref} className="relative size-[168px] shrink-0">
        {tones.map((t, i) => {
          const a = (i / N) * Math.PI * 2 - Math.PI / 2;
          return (
            <span
              key={i}
              data-dot
              className={`absolute size-[9px] rounded-full ${TONE[t]}`}
              style={{ left: `calc(50% + ${Math.cos(a) * 74}px - 4.5px)`, top: `calc(50% + ${Math.sin(a) * 74}px - 4.5px)` }}
            />
          );
        })}
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="display text-[46px]">
              <CountUp value={total} />
            </p>
            <p className="text-[12px] text-mute">{label}</p>
          </div>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-[13px]">
            <span className={`size-2.5 rounded-full ${TONE[s.tone]}`} />
            <span className="flex-1 text-mute">{s.label}</span>
            <span className="font-semibold tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars with a label and value; widths grow in with anime.js. */
export function BarList({ items, tone = "ink" }: { items: { label: string; value: number; sub?: string }[]; tone?: "ink" | "red" }) {
  const ref = useRef<HTMLUListElement>(null);
  const max = Math.max(1, ...items.map((i) => i.value));
  const sig = items.map((i) => i.value).join();
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let run: { cancel(): unknown } | undefined;
    anime().then(({ animate, stagger }) => {
      run = animate(el.querySelectorAll("[data-bar]"), { scaleX: [0, 1], duration: 900, delay: stagger(70), ease: "outExpo" });
    });
    return () => {
      run?.cancel();
    };
  }, [sig]);
  return (
    <ul ref={ref} className="flex flex-col gap-3.5">
      {items.map((it) => (
        <li key={it.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate font-medium">{it.label}</span>
            <span className="shrink-0 text-mute tabular-nums">
              {it.value}
              {it.sub ? ` · ${it.sub}` : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-fog">
            <div data-bar className={`h-full origin-left rounded-full ${tone === "red" ? "bg-red" : "bg-ink"}`} style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Two series over time (detected vs closed); lines draw in with anime.js. */
export function Trend({ points, labels }: { points: { a: number; b: number }[]; labels: string[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const W = 560;
  const H = 180;
  const pad = 24;
  const max = Math.max(1, ...points.flatMap((p) => [p.a, p.b]));
  const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const path = (k: "a" | "b") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  const sig = points.map((p) => `${p.a}-${p.b}`).join();
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let run: { cancel(): unknown } | undefined;
    anime().then(({ animate, svg, stagger }) => {
      run = animate(svg.createDrawable(el.querySelectorAll("[data-line]")), { draw: ["0 0", "0 1"], duration: 1400, delay: stagger(200), ease: "inOutQuart" });
    });
    return () => {
      run?.cancel();
    };
  }, [sig]);
  return (
    <div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Findings detected and closed per week">
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={pad} x2={W - pad} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" strokeDasharray="2 5" />
        ))}
        <path data-line d={path("a")} fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path data-line d={path("b")} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.a)} r="3.5" fill="var(--red)">
              <title>{`${labels[i]}: ${p.a} detected`}</title>
            </circle>
            <circle cx={x(i)} cy={y(p.b)} r="3.5" fill="var(--ink)">
              <title>{`${labels[i]}: ${p.b} closed`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-1 text-[11px] text-mute">
        {labels.map((l, i) => (
          <span key={i} className={i % 2 && labels.length > 6 ? "hidden sm:inline" : ""}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
