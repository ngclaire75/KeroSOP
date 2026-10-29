"use client";

import type p5 from "p5";
import { useP5 } from "@/lib/useP5";
import { mulberry32, canvasDpr, prefersReducedMotion } from "@/lib/random";

type Dot = { hx: number; hy: number; x: number; y: number; vx: number; vy: number; edge: number; seed: number };

/**
 * The poster "molecule": a solid mass of black dots breaking apart toward the
 * corner. Loose dots drift on Perlin noise; the pointer scatters them. p5.js.
 */
export function MoleculeField({ className = "" }: { className?: string }) {
  const ref = useP5((p: p5, host) => {
    let solid: Dot[] = [];
    let cell = 16;
    const pointer = { x: -999, y: -999, active: false };
    const reduced = prefersReducedMotion();

    host.addEventListener("pointermove", (e) => {
      const r = host.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.active = true;
    });
    host.addEventListener("pointerleave", () => (pointer.active = false));

    const build = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      cell = w < 400 ? 13 : 16;
      const cols = Math.floor(w / cell);
      const rows = Math.floor(h / cell);
      const ox = w - cols * cell + cell / 2;
      const oy = h - rows * cell + cell / 2;
      const rnd = mulberry32(5);
      solid = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const d = ((cols - 1 - c) / Math.max(1, cols - 1) + (rows - 1 - r) / Math.max(1, rows - 1)) / 2;
          const reach = 0.62;
          const chance = Math.min(1, Math.max(0, (reach - d) / (reach * 0.55)));
          const x = ox + c * cell;
          const y = oy + r * cell;
          if (rnd() < chance) {
            solid.push({ hx: x, hy: y, x, y, vx: 0, vy: 0, edge: 1 - chance, seed: rnd() * 1000 });
          }
        }
    };

    p.setup = () => {
      p.createCanvas(host.clientWidth, host.clientHeight);
      p.pixelDensity(canvasDpr());
      p.frameRate(45);
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
      const r = cell * 0.36;
      const t = p.millis() / 1000;

      // Every dot is the same black: build one path and fill it once.
      const ctx = p.drawingContext as CanvasRenderingContext2D;
      const path = new Path2D();
      const rr = r * 1.075;
      const reach = cell * 5;
      for (const d of solid) {
        if (!reduced) {
          // Dots near the broken edge wander further on the noise field.
          const amp = cell * 0.9 * d.edge * d.edge;
          const tx = d.hx + (p.noise(d.seed, t * 0.35) - 0.5) * 2 * amp;
          const ty = d.hy + (p.noise(d.seed + 99, t * 0.35) - 0.5) * 2 * amp;
          if (pointer.active) {
            const dx = d.x - pointer.x;
            const dy = d.y - pointer.y;
            const dist = Math.hypot(dx, dy);
            if (dist < reach && dist > 0.01) {
              const f = (1 - dist / reach) ** 2 * 3;
              d.vx += (dx / dist) * f;
              d.vy += (dy / dist) * f;
            }
          }
          d.vx = (d.vx + (tx - d.x) * 0.06) * 0.8;
          d.vy = (d.vy + (ty - d.y) * 0.06) * 0.8;
          d.x += d.vx;
          d.y += d.vy;
        }
        path.moveTo(d.x + rr, d.y);
        path.arc(d.x, d.y, rr, 0, Math.PI * 2);
      }
      ctx.fillStyle = "#000";
      ctx.fill(path);
    };
  });

  return <div ref={ref} className={className} />;
}
