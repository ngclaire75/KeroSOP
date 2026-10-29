"use client";

import type p5 from "p5";
import { useP5 } from "@/lib/useP5";
import { mulberry32, canvasDpr, prefersReducedMotion } from "@/lib/random";

/**
 * Footer backdrop (p5.js): columns of red dots, each column a different
 * length, drifting on a slow Perlin current. Dots near
 * the pointer swell and brighten to white.
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
    area.addEventListener("pointerleave", () => (pointer.on = false));

    const build = () => {
      gap = host.clientWidth < 640 ? 20 : 24;
      dots = [];
      const rnd = mulberry32(73);
      // Columns of different lengths: each column starts at the top and stops at its own point.
      for (let x = gap / 2; x < host.clientWidth; x += gap) {
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

    p.draw = () => {
      p.clear();
      const t = reduced ? 0 : p.millis() / 1000;
      pointer.k += ((pointer.on ? 1 : 0) - pointer.k) * 0.08;
      const reach = 170;

      for (const d of dots) {
        const n = p.noise(d.x * 0.006, d.y * 0.006, t * 0.12);
        const a = n * Math.PI * 4;
        const x = d.x + Math.cos(a) * 3;
        const y = d.y + Math.sin(a) * 3;
        let size = 2 + n * 1.4;
        let r = 227;
        let g = 6;
        let b = 19;
        if (pointer.k > 0.01) {
          const dist = Math.hypot(x - pointer.x, y - pointer.y);
          if (dist < reach) {
            const f = (1 - dist / reach) ** 2 * pointer.k;
            size += f * 4;
            r += (255 - r) * f;
            g += (255 - g) * f;
            b += (255 - b) * f;
          }
        }
        p.fill(r, g, b);
        p.circle(x, y, size);
      }
    };
  });

  return <div ref={ref} aria-hidden="true" className={className} />;
}
