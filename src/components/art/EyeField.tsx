"use client";

import type p5 from "p5";
import { useP5 } from "@/lib/useP5";
import { canvasDpr, prefersReducedMotion } from "@/lib/random";

/**
 * Dark grey dot field behind the poster eye (p5.js). Rings pulse out from the
 * pupil like a slow sonar sweep, and dots swell under the pointer.
 * Expects to sit inside the tile that also holds the eye's <svg data-eye>.
 */
export function EyeField({ className = "" }: { className?: string }) {
  const ref = useP5((p: p5, host) => {
    const reduced = prefersReducedMotion();
    const pointer = { x: -999, y: -999, k: 0, active: false };
    let gap = 18;
    let dots: { x: number; y: number; d: number }[] = [];
    let origin = { x: 0, y: 0 };

    const tile = host.parentElement!;
    tile.addEventListener("pointermove", (e) => {
      const r = host.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.active = true;
    });
    tile.addEventListener("pointerleave", () => (pointer.active = false));

    const build = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      gap = w < 640 ? 15 : 18;
      // Rings start at the pupil: (330, 150) in the eye's 460×300 viewBox.
      const eye = tile.querySelector<SVGSVGElement>("svg[data-eye]");
      const hr = host.getBoundingClientRect();
      if (eye) {
        const er = eye.getBoundingClientRect();
        origin = { x: er.left - hr.left + (330 / 460) * er.width, y: er.top - hr.top + (150 / 300) * er.height };
      } else origin = { x: w * 0.75, y: h * 0.6 };
      dots = [];
      const cols = Math.ceil(w / gap) + 1;
      const rows = Math.ceil(h / gap) + 1;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const x = c * gap + gap / 2;
          const y = r * gap + gap / 2;
          dots.push({ x, y, d: Math.hypot(x - origin.x, y - origin.y) });
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
        if (host.clientWidth !== p.width || host.clientHeight !== p.height)
          p.resizeCanvas(host.clientWidth, host.clientHeight);
        build();
        if (reduced) p.redraw();
      }).observe(host);
    };

    p.draw = () => {
      p.clear();
      const t = reduced ? 0 : p.millis() / 1000;
      pointer.k += ((pointer.active ? 1 : 0) - pointer.k) * 0.1;
      const maxD = Math.hypot(p.width, p.height);
      const reach = 150;

      for (const dot of dots) {
        // Sonar: a band travelling outward from the pupil, fading with distance.
        const phase = dot.d * 0.02 - t * 1.6;
        const ring = Math.pow(Math.max(0, Math.sin(phase)), 6) * (1 - dot.d / maxD);
        let size = 2.2 + ring * 5.5;
        let alpha = 95 + ring * 160;

        if (pointer.k > 0.01) {
          const dist = Math.hypot(dot.x - pointer.x, dot.y - pointer.y);
          if (dist < reach) {
            const f = (1 - dist / reach) ** 2 * pointer.k;
            size += f * 4;
            alpha += f * 120;
          }
        }
        p.fill(38, 38, 38, Math.min(255, alpha));
        p.circle(dot.x, dot.y, size);
      }
    };
  });

  return <div ref={ref} aria-hidden="true" className={className} />;
}
