"use client";

import { useEffect, useRef } from "react";
import type p5 from "p5";
import { useP5 } from "@/lib/useP5";
import { canvasDpr, prefersReducedMotion } from "@/lib/random";

const GAP = 5; // px between dot centres
const RISE = 0.9; // seconds for the columns to grow in, left to right
const SWEEP = 4.5; // seconds between light sweeps

/**
 * A stat tile's trend drawn as a dot matrix (p5.js). Each column fills up to the
 * value at that point; dots fade towards the baseline and the top dot of each
 * column traces the line. The latest column is picked out in brand red. Columns
 * grow in on load and ease to new heights when the range changes; a soft light
 * sweeps across now and then. A mouse lights the column under it (no touch hover).
 */
export function SparkField({ values, accent = "#e30613", className = "" }: { values: number[]; accent?: string; className?: string }) {
  const data = useRef(values);
  const wake = useRef<() => void>(() => {});
  useEffect(() => {
    data.current = values;
    wake.current();
  }, [values]);

  const ref = useP5((p: p5, host) => {
    const reduced = prefersReducedMotion();
    let cols = 0, rows = 0, ox = 0, oy = 0;
    let shown: number[] = []; // eased height per column, in rows
    let born = 0;
    const pointer = { x: -1, on: false };

    const target = () => {
      const v = data.current;
      const max = Math.max(1, ...v);
      return Array.from({ length: cols }, (_, c) => {
        if (v.length < 2) return ((v[0] ?? 0) / max) * rows;
        const t = (c / Math.max(1, cols - 1)) * (v.length - 1);
        const i = Math.min(v.length - 2, Math.floor(t));
        const at = v[i] + (v[i + 1] - v[i]) * (t - i);
        return at > 0 ? Math.max(1, (at / max) * rows) : 0;
      });
    };

    const build = () => {
      cols = Math.max(2, Math.floor((host.clientWidth - 2) / GAP) + 1);
      rows = Math.max(2, Math.floor((host.clientHeight - 2) / GAP) + 1);
      ox = (host.clientWidth - (cols - 1) * GAP) / 2;
      oy = host.clientHeight - (host.clientHeight - (rows - 1) * GAP) / 2;
      const next = target();
      shown = reduced ? next : next.map((_, c) => shown[c] ?? 0);
    };

    const zone = host.closest(".surface") ?? host; // the whole tile, so hovering anywhere on it lights the chart
    const onMove = (e: Event) => {
      const ev = e as PointerEvent;
      if (ev.pointerType !== "mouse") return;
      pointer.x = ev.clientX - host.getBoundingClientRect().left;
      pointer.on = true;
      p.loop();
    };
    const onLeave = () => { pointer.on = false; p.loop(); };
    zone.addEventListener("pointermove", onMove);
    zone.addEventListener("pointerleave", onLeave);

    const ro = new ResizeObserver(() => {
      if (!p.width) return;
      if (host.clientWidth !== p.width || host.clientHeight !== p.height) p.resizeCanvas(host.clientWidth, host.clientHeight);
      build();
      p.redraw();
    });

    wake.current = () => {
      if (!p.width) return;
      if (!reduced) born = Math.min(born, p.millis() / 1000 - RISE); // ease to the new values, no replay of the intro
      build();
      p.loop();
    };

    p.setup = () => {
      p.createCanvas(host.clientWidth, host.clientHeight);
      p.pixelDensity(canvasDpr());
      p.frameRate(60);
      p.noStroke();
      red = p.color(accent);
      host.querySelector("canvas")?.setAttribute("aria-hidden", "true");
      born = p.millis() / 1000;
      build();
      ro.observe(host);
      if (reduced) p.noLoop();
    };

    let red: p5.Color;
    p.draw = () => {
      p.clear();
      const now = p.millis() / 1000;
      const want = target();
      let settling = false;
      const hoverCol = pointer.on ? Math.round((pointer.x - ox) / GAP) : -9;
      const sweep = reduced ? -99 : (((now - born - RISE) % SWEEP) / SWEEP) * (cols + 16) - 8;

      for (let c = 0; c < cols; c++) {
        // the intro grows each column a little after the one on its left
        const gate = reduced ? 1 : Math.min(1, Math.max(0, (now - born - (c / cols) * RISE * 0.6) / (RISE * 0.4)));
        const goal = want[c] * (1 - Math.pow(1 - gate, 3));
        shown[c] += (goal - shown[c]) * (reduced ? 1 : 0.18);
        if (Math.abs(goal - shown[c]) > 0.01 || gate < 1) settling = true;

        const h = shown[c];
        const full = Math.floor(h);
        const last = c === cols - 1;
        const near = Math.abs(c - hoverCol) <= 1 ? 1 - Math.abs(c - hoverCol) * 0.5 : 0;
        const glow = Math.max(0, 1 - Math.abs(c - sweep) / 4) * 0.35;
        const x = ox + c * GAP;

        // faint baseline row so empty stretches still read as a track
        p.fill(255, 255, 255, 64);
        p.circle(x, oy, 1.8);

        for (let r = 0; r < full; r++) {
          const depth = r / Math.max(1, full); // 0 at the baseline, 1 at the top
          const a = 85 + 165 * depth + 105 * (glow + near * 0.6);
          if (last) p.fill(p.red(red), p.green(red), p.blue(red), Math.min(255, a + 40));
          else p.fill(255, 255, 255, Math.min(255, a));
          p.circle(x, oy - r * GAP, 2.4 + 0.7 * depth);
        }
        // the top dot traces the line; its part-row height keeps the curve smooth
        if (h > 0.2) {
          const ty = oy - (h - 1) * GAP;
          if (last) p.fill(red);
          else p.fill(255, 255, 255, 215 + 40 * Math.max(near, glow * 2));
          p.circle(x, ty, (last ? 4.8 : 3.4) + near * 1.1);
        }
      }

      const busy = settling || pointer.on;
      if (!busy && (reduced || document.hidden)) p.noLoop();
    };

    // when the host leaves the page, p5 is removed by useP5; drop the listeners with it
    const stop = p.remove.bind(p);
    p.remove = () => {
      zone.removeEventListener("pointermove", onMove);
      zone.removeEventListener("pointerleave", onLeave);
      ro.disconnect();
      wake.current = () => {};
      stop();
    };
  });

  return <div ref={ref} aria-hidden="true" className={`h-16 w-full max-w-[220px] min-w-[120px] ${className}`} />;
}
