"use client";

import { useEffect, useRef } from "react";
import type p5 from "p5";
import { useP5 } from "@/lib/useP5";
import { prefersReducedMotion } from "@/lib/random";
import type { Day } from "./model";

/** Space between day columns, in px. The last column ends flush with the right edge. */
export const STRIP_GAP = 3;

/**
 * p5: one solid bar per day rising from the baseline, decisions (red)
 * at the bottom. Days with nothing logged keep a hairline
 * so the calendar reads as continuous. The selected or hovered day stays
 * full strength while the others step back.
 */
export function ActivityStrip({ days, active, hover }: { days: Day[]; active: number; hover: number }) {
  const props = useRef({ days, active, hover });
  useEffect(() => {
    props.current = { days, active, hover };
  }, [days, active, hover]);

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
      const { days: list, active: a, hover: h } = props.current;
      grow = Math.min(1, grow + 0.02);
      p.clear();
      const n = list.length;
      const col = (p.width + STRIP_GAP) / Math.max(1, n);
      const w = Math.max(2, col - STRIP_GAP);
      const most = Math.max(4, ...list.map((d) => d.n));
      // one solid bar per day, scaled so the busiest day fills the strip
      const unit = (p.height - 2) / most;
      list.forEach((d, i) => {
        const focus = h >= 0 ? h === i : a < 0 || a === i;
        fade[i] = (fade[i] ?? 1) + ((focus ? 1 : 0.25) - (fade[i] ?? 1)) * 0.15;
        const x = i * col;
        // baseline hairline for every day
        p.fill(23, 23, 23, 40 * fade[i]);
        p.rect(x, p.height - 1, w, 1);
        if (!d.n) return;
        // bars rise left to right
        const e = Math.max(0, Math.min(1, grow * (n * 0.5 + 8) - i * 0.5));
        const t = 1 - Math.pow(1 - e, 3);
        const base = p.height - 2;
        const total = Math.max(2, d.n * unit) * t;
        const red = total * (d.decisions / d.n);
        p.fill(23, 23, 23, 255 * fade[i]);
        if (total > red) p.rect(x, base - total, w, total - red, 1, 1, 0, 0);
        p.fill(227, 6, 19, 255 * fade[i]);
        if (red > 0) p.rect(x, base - red, w, red, total > red ? 0 : 1, total > red ? 0 : 1, 0, 0);
      });
    };
  });
  return <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" />;
}
