"use client";

/**
 * Generative pieces for the dashboard:
 *  - IntegrityField (p5): the integrity score as a dot-matrix meter; open
 *    high-risk issues pulse red; the pointer sends a ripple through it.
 *  - ScanFlow (p5): clauses flowing through the scan pipeline stage by stage.
 */
import { useEffect, useRef } from "react";
import type p5 from "p5";
import { useP5 } from "@/lib/useP5";
import { mulberry32, prefersReducedMotion } from "@/lib/random";

/* ---------- IntegrityField ---------- */

export function IntegrityField({ score, hot, warm }: { score: number; hot: number; warm: number }) {
  const props = useRef({ score, hot, warm });
  useEffect(() => {
    props.current = { score, hot, warm };
  }, [score, hot, warm]);

  const ref = useP5((p: p5, host: HTMLDivElement) => {
    const GAP = 13;
    let cols = 0;
    let rows = 0;
    let ripple = { x: -999, y: -999, t: 99 };
    const layout = () => {
      cols = Math.ceil(host.clientWidth / GAP) + 1;
      rows = Math.ceil(host.clientHeight / GAP) + 1;
    };
    p.setup = () => {
      p.createCanvas(host.clientWidth, host.clientHeight);
      p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
      p.noStroke();
      layout();
    };
    p.windowResized = () => {
      p.resizeCanvas(host.clientWidth, host.clientHeight);
      layout();
    };
    host.onpointermove = (e) => {
      const r = host.getBoundingClientRect();
      if (ripple.t > 0.6) ripple = { x: e.clientX - r.left, y: e.clientY - r.top, t: 0 };
    };
    p.draw = () => {
      ripple.t += 0.016;
      p.clear();
      // one even field of faint dots across the whole card
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = c * GAP;
          const y = r * GAP;
          const d = Math.hypot(x - ripple.x, y - ripple.y);
          const wave = Math.max(0, 1 - Math.abs(d - ripple.t * 420) / 40) * Math.max(0, 1 - ripple.t);
          const size = 2.2 + wave * 4;
          p.fill(255, 255, 255, 46 + wave * 120);
          p.circle(x + 6, y + 6, size);
        }
      }
    };
  });
  return <div ref={ref} aria-hidden="true" className="absolute inset-0" />;
}

/* ---------- ScanFlow ---------- */

export const FLOW_STAGES = ["Parsing", "Extracting", "Matching", "Validating", "Completed"];

export function ScanFlow({ stage, items, findings }: { stage: number; items: number; findings: number }) {
  const props = useRef({ stage, items, findings });
  useEffect(() => {
    props.current = { stage, items, findings };
  }, [stage, items, findings]);

  const ref = useP5((p: p5, host: HTMLDivElement) => {
    type Dot = { x: number; y: number; lane: number; speed: number; red: boolean; jitter: number };
    let dots: Dot[] = [];
    const reduced = prefersReducedMotion();
    const make = () => {
      const rnd = mulberry32(3);
      const n = Math.max(18, Math.min(140, props.current.items));
      dots = Array.from({ length: n }, (_, i) => ({
        x: -rnd() * 160,
        y: 0,
        lane: rnd(),
        speed: 0.6 + rnd() * 1.6,
        red: i < Math.max(0, props.current.findings * 2),
        jitter: rnd() * 6.28,
      }));
    };
    p.setup = () => {
      p.createCanvas(host.clientWidth, host.clientHeight);
      p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
      p.noStroke();
      make();
    };
    p.windowResized = () => p.resizeCanvas(host.clientWidth, host.clientHeight);
    p.draw = () => {
      const { stage: s, findings: f } = props.current;
      const W = p.width;
      const H = p.height;
      const col = W / FLOW_STAGES.length;
      p.clear();
      // stage columns: done stages solid, current one pulsing
      for (let i = 0; i < FLOW_STAGES.length; i++) {
        const done = i < s;
        const cur = i === s;
        for (let yy = 10; yy < H - 6; yy += 12) {
          p.fill(0, 0, 0, done ? 70 : cur ? 40 + 30 * Math.sin(p.millis() / 180) : 18);
          p.circle(col * (i + 1) - 1, yy, 2.4);
        }
      }
      const limit = Math.min(W - 10, col * Math.min(FLOW_STAGES.length, s + 1) - 8);
      for (const d of dots) {
        if (!reduced) d.x += d.speed * (s >= FLOW_STAGES.length - 1 ? 0.6 : 1.6);
        if (d.x > limit) d.x = s >= FLOW_STAGES.length - 1 ? limit - d.speed * 30 * d.lane : Math.max(0, limit - 90 - d.lane * 120);
        if (reduced) d.x = limit * (0.3 + d.lane * 0.7);
        const y = 16 + d.lane * (H - 32) + Math.sin(p.millis() / 400 + d.jitter) * 3;
        const isRed = d.red && s >= 3 && f > 0;
        p.fill(isRed ? p.color(227, 6, 19) : p.color(0, 0, 0, 200));
        p.circle(Math.max(4, d.x), y, isRed ? 7 : 4.2);
      }
    };
  });
  return <div ref={ref} aria-hidden="true" className="absolute inset-0" />;
}

/* ---------- TopicTicks ---------- */

/** One tick per rule: "hot" is cited by an open finding, "old" comes from a superseded version. */
export type Tick = "hot" | "live" | "old";

/**
 * p5 strip behind a list of topic rows (each `row` px tall): one tick per
 * rule, growing in left to right. The selected or hovered row stays full
 * strength while the others step back. Ticks start at `x0` and stop `x1` px
 * from the right edge, leaving the row's label and count readable.
 */
export function TopicTicks({ rows, row, x0, x1, active, hover }: { rows: Tick[][]; row: number; x0: number; x1: number; active: number; hover: number }) {
  const props = useRef({ rows, active, hover });
  useEffect(() => {
    props.current = { rows, active, hover };
  }, [rows, active, hover]);

  const ref = useP5((p: p5, host: HTMLDivElement) => {
    const reduced = prefersReducedMotion();
    let grow = reduced ? 1 : 0;
    const fade: number[] = [];
    p.setup = () => {
      p.createCanvas(host.clientWidth, host.clientHeight);
      p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
      p.noStroke();
    };
    p.windowResized = () => p.resizeCanvas(host.clientWidth, host.clientHeight);
    p.draw = () => {
      const { rows: list, active: a, hover: h } = props.current;
      grow = Math.min(1, grow + 0.025);
      p.clear();
      const room = p.width - x0 - x1;
      list.forEach((ticks, r) => {
        const focus = h >= 0 ? h === r : a < 0 || a === r;
        fade[r] = (fade[r] ?? 1) + ((focus ? 1 : 0.28) - (fade[r] ?? 1)) * 0.15;
        const step = Math.min(9, room / Math.max(1, ticks.length));
        const tall = 18;
        const cy = r * row + row / 2;
        ticks.forEach((t, i) => {
          // each tick grows in turn, row after row
          const k = Math.max(0, Math.min(1, grow * (list.length + 6) - r * 0.6 - i * 0.12));
          const e = 1 - Math.pow(1 - k, 3);
          const hgt = tall * e;
          const alpha = 255 * fade[r] * (t === "old" ? 0.3 : 1);
          if (t === "hot") p.fill(227, 6, 19, alpha);
          else p.fill(23, 23, 23, alpha);
          p.rect(x0 + i * step, cy - hgt / 2, Math.max(2, Math.min(4, step - 3)), hgt, 1);
        });
      });
    };
  });
  return <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0" />;
}
