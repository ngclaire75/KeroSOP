"use client";

import type p5 from "p5";
import { useP5 } from "@/lib/useP5";
import { mulberry32, canvasDpr, prefersReducedMotion } from "@/lib/random";
import { SCAN_EVENT } from "@/lib/scan";

/** A scan line runs down the field this often, then hands over to the wordmark below. */
const SCAN_EVERY = 7;
const SCAN_TIME = 2;
const LEVELS = 8;
/** Length of the scan line's fading tail, in px. */
const TAIL = 360;

/**
 * Footer backdrop (p5.js): columns of red dots, each column a different
 * length, drifting on a slow Perlin current. Dots near the pointer swell,
 * brighten to white and lean out of its way. Every few seconds a scan line
 * runs down the field, lighting the dots it passes with a tail behind it,
 * and hands over to the wordmark's own scan when it reaches the bottom.
 */
export function FooterField({ className = "" }: { className?: string }) {
  const ref = useP5((p: p5, host) => {
    const reduced = prefersReducedMotion();
    const pointer = { x: -999, y: -999, k: 0, on: false };
    let dots: { x: number; y: number }[] = [];
    let gap = 24;

    const area = host.parentElement!;
    area.addEventListener("pointermove", (e) => {
      const r = host.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.on = true;
    });
    area.addEventListener("pointerleave", (e) => {
      // A swipe turning into a scroll makes the browser fire its own pointerleave
      // mid-gesture; on touch only touchHover's release (untrusted) lets go.
      if (e.isTrusted && e.pointerType === "touch") return;
      pointer.on = false;
    });

    const build = () => {
      const w = host.clientWidth;
      // Even columns edge to edge, with the outer two centred in the 16px side gutters,
      // so both sides of the contact card get a column on phones.
      const n = Math.max(1, Math.round((w - 16) / (w < 640 ? 20 : 24)));
      gap = (w - 16) / n;
      dots = [];
      const rnd = mulberry32(73);
      // Columns of different lengths: each column starts at the top and stops at its own point.
      for (let i = 0; i <= n; i++) {
        const x = 8 + i * gap;
        const end = host.clientHeight * (0.85 + rnd() * 0.15);
        for (let y = gap / 2; y < end; y += gap) dots.push({ x, y });
      }
    };

    p.setup = () => {
      p.createCanvas(host.clientWidth, host.clientHeight);
      p.pixelDensity(canvasDpr());
      p.frameRate(40);
      p.noStroke();
      host.querySelector("canvas")?.setAttribute("aria-hidden", "true");
      build();
      if (reduced) {
        host.dataset.static = "1";
        p.noLoop();
      }
      new ResizeObserver(() => {
        if (host.clientWidth === p.width && host.clientHeight === p.height) return;
        p.resizeCanvas(host.clientWidth, host.clientHeight);
        build();
        if (reduced) p.redraw();
      }).observe(host);
    };

    let lastScanY = -1e3;

    p.draw = () => {
      p.clear();
      const t = reduced ? 0 : p.millis() / 1000;
      const phase = reduced ? SCAN_TIME + 1 : (t + SCAN_EVERY - 2) % SCAN_EVERY;
      const scanning = phase < SCAN_TIME;
      const sp = phase / SCAN_TIME;
      // The line runs on past the bottom until its tail has faded out, so nothing blinks off at the end.
      const scanY = scanning ? sp * sp * (3 - 2 * sp) * (p.height + TAIL + 30) - 30 : -1e3;
      if (lastScanY < p.height && scanY >= p.height) window.dispatchEvent(new Event(SCAN_EVENT));
      lastScanY = scanY;
      pointer.k += ((pointer.on ? 1 : 0) - pointer.k) * 0.08;
      // On phones the card covers the middle, so a finger anywhere on it reaches the gutter dots.
      const reach = p.width < 640 ? 240 : 170;

      // Dots are binned by how hot they are, red through white, one path per bin.
      const ctx = p.drawingContext as CanvasRenderingContext2D;
      const bins = Array.from({ length: LEVELS + 1 }, () => new Path2D());
      for (const d of dots) {
        const n = p.noise(d.x * 0.006, d.y * 0.006, t * 0.12);
        const a = n * Math.PI * 4;
        let x = d.x + Math.cos(a) * 3;
        let y = d.y + Math.sin(a) * 3;
        let size = 2 + n * 1.4;
        let f = 0;
        if (pointer.k > 0.01) {
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < reach && dist > 0.01) {
            f = (1 - dist / reach) ** 2 * pointer.k;
            x += (dx / dist) * f * 14;
            y += (dy / dist) * f * 14;
            size += f * 4;
          }
        }
        if (scanning) {
          // A sharp leading edge with a tail fading up behind it.
          const off = y - scanY;
          const s = off > 0 ? Math.exp(-((off / 12) ** 2)) : Math.exp((off / TAIL) * 4.5) * 0.75;
          size += s * 2.6;
          f = Math.max(f, s);
        }
        const bin = Math.round(Math.min(1, f) * LEVELS);
        bins[bin].moveTo(x + size / 2, y);
        bins[bin].arc(x, y, size / 2, 0, Math.PI * 2);
      }
      bins.forEach((path, i) => {
        const k = i / LEVELS;
        ctx.fillStyle = `rgb(${(227 + 28 * k) | 0},${(6 + 249 * k) | 0},${(19 + 236 * k) | 0})`;
        ctx.fill(path);
      });
    };
  });

  return <div ref={ref} aria-hidden="true" className={className} />;
}
