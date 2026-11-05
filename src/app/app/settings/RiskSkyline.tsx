"use client";

import { useEffect, useRef } from "react";
import type p5 from "p5";
import { useP5 } from "@/lib/useP5";
import { prefersReducedMotion } from "@/lib/random";
import type { Risk } from "@/lib/app/types";

const LEVEL: Record<Risk, number> = { low: 1, medium: 2, high: 3 };

/**
 * p5 on the black card: one column per topic, in list order, built from
 * stacked blocks — white for low and medium (one and two), red for high (three).
 * Changing a topic's risk grows or settles its column; the hovered topic
 * stays bright while the others step back.
 */
export function RiskSkyline({ risks, hover }: { risks: Risk[]; hover: number }) {
  const props = useRef({ risks, hover });
  useEffect(() => {
    props.current = { risks, hover };
  }, [risks, hover]);

  const ref = useP5((p: p5, host: HTMLDivElement) => {
    const reduced = prefersReducedMotion();
    const shown: number[] = [];
    const fade: number[] = [];
    const GAP = 6;
    p.setup = () => {
      p.createCanvas(host.clientWidth, host.clientHeight);
      p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
      p.noStroke();
    };
    p.windowResized = () => p.resizeCanvas(host.clientWidth, host.clientHeight);
    p.draw = () => {
      const { risks: list, hover: h } = props.current;
      p.clear();
      const n = Math.max(1, list.length);
      const col = (p.width + GAP) / n;
      const w = col - GAP;
      const block = (p.height - 2 * 4) / 3;
      list.forEach((r, i) => {
        const goal = LEVEL[r];
        shown[i] = reduced ? goal : (shown[i] ?? 0) + (goal - (shown[i] ?? 0)) * 0.09;
        const focus = h < 0 || h === i;
        fade[i] = (fade[i] ?? 1) + ((focus ? 1 : 0.35) - (fade[i] ?? 1)) * 0.15;
        for (let k = 0; k < 3; k++) {
          // each block fills in as the column's height passes it
          const fill = Math.max(0, Math.min(1, shown[i] - k));
          if (fill <= 0) continue;
          const y = p.height - (k + 1) * block - k * 4;
          if (r === "high") p.fill(227, 6, 19, 255 * fade[i]);
          else p.fill(255, 255, 255, 255 * fade[i] * (r === "medium" ? 0.85 : 0.5));
          p.rect(i * col, y + block * (1 - fill), w, block * fill, 2);
        }
      });
    };
  });
  return <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0" />;
}
