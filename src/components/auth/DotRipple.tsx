"use client";

import type p5 from "p5";
import { useP5 } from "@/lib/useP5";
import { canvasDpr, prefersReducedMotion } from "@/lib/random";
import { onAuth } from "@/lib/authEvents";

type Ripple = { x: number; y: number; born: number };

const SPEED = 560; // px per second
const LIFE = 1.5; // seconds
const BAND = 30; // ring thickness, px

/**
 * Faint dot grid behind the form (p5.js). Every keystroke sends a ring out
 * from the caret: dots in the ring swell and blush red as it passes. Dots
 * also swell a little under the pointer.
 */
export function DotRipple({ className = "" }: { className?: string }) {
  const ref = useP5((p: p5, host) => {
    const reduced = prefersReducedMotion();
    const ripples: Ripple[] = [];
    const pointer = { x: -999, y: -999, k: 0, on: false };
    let dots: { x: number; y: number }[] = [];
    let idle = 0;

    const wake = () => {
      idle = 0;
      if (!reduced) p.loop();
    };

    const off = onAuth((s) => {
      if (s.type !== "key" || reduced) return;
      const r = host.getBoundingClientRect();
      ripples.push({ x: s.x - r.left, y: s.y - r.top, born: p.millis() / 1000 });
      if (ripples.length > 12) ripples.shift();
      wake();
    });
    const zone = host.parentElement!;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = host.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.on = true;
      wake();
    };
    const onLeave = () => (pointer.on = false);
    zone.addEventListener("pointermove", onMove);
    zone.addEventListener("pointerleave", onLeave);

    const build = () => {
      const gap = host.clientWidth < 640 ? 18 : 22;
      dots = [];
      for (let y = gap / 2; y < host.clientHeight + gap; y += gap)
        for (let x = gap / 2; x < host.clientWidth + gap; x += gap) dots.push({ x, y });
    };

    const ro = new ResizeObserver(() => {
      if (!p.width) return;
      if (host.clientWidth !== p.width || host.clientHeight !== p.height) p.resizeCanvas(host.clientWidth, host.clientHeight);
      build();
      p.redraw();
    });

    p.setup = () => {
      p.createCanvas(host.clientWidth, host.clientHeight);
      p.pixelDensity(canvasDpr());
      p.frameRate(60);
      host.querySelector("canvas")?.setAttribute("aria-hidden", "true");
      build();
      ro.observe(host);
    };

    const LEVELS = 16;
    p.draw = () => {
      p.clear();
      const now = p.millis() / 1000;
      while (ripples.length && now - ripples[0].born > LIFE) ripples.shift();
      pointer.k += ((pointer.on ? 1 : 0) - pointer.k) * 0.12;

      const ctx = p.drawingContext as CanvasRenderingContext2D;
      const ink = Array.from({ length: LEVELS }, () => new Path2D());
      const red = Array.from({ length: LEVELS }, () => new Path2D());
      const reach = 120;
      for (const d of dots) {
        let size = 1.7;
        let heat = 0;
        for (const r of ripples) {
          const age = now - r.born;
          const off = Math.abs(Math.hypot(d.x - r.x, d.y - r.y) - age * SPEED);
          if (off < BAND) heat = Math.max(heat, (1 - off / BAND) ** 2 * (1 - age / LIFE));
        }
        let lift = 0;
        if (pointer.k > 0.01) {
          const dist = Math.hypot(d.x - pointer.x, d.y - pointer.y);
          if (dist < reach) lift = (1 - dist / reach) ** 2 * pointer.k;
        }
        size += heat * 3.2 + lift * 1.8;
        if (heat > 0.08) {
          const lvl = Math.min(LEVELS - 1, Math.round(heat * (LEVELS - 1)));
          red[lvl].moveTo(d.x + size / 2, d.y);
          red[lvl].arc(d.x, d.y, size / 2, 0, Math.PI * 2);
        } else {
          const a = 0.11 + lift * 0.3;
          const lvl = Math.min(LEVELS - 1, Math.round(a * (LEVELS - 1)));
          ink[lvl].moveTo(d.x + size / 2, d.y);
          ink[lvl].arc(d.x, d.y, size / 2, 0, Math.PI * 2);
        }
      }
      ink.forEach((path, l) => {
        if (!l) return;
        ctx.fillStyle = `rgba(0,0,0,${l / (LEVELS - 1)})`;
        ctx.fill(path);
      });
      red.forEach((path, l) => {
        ctx.fillStyle = `rgba(227,6,19,${0.25 + 0.75 * (l / (LEVELS - 1))})`;
        ctx.fill(path);
      });

      // Nothing moving: stop the loop until the next keystroke or pointer move.
      if (!ripples.length && pointer.k < 0.01) {
        if (++idle > 10) p.noLoop();
      }
    };

    const remove = p.remove.bind(p);
    p.remove = () => {
      off();
      ro.disconnect();
      zone.removeEventListener("pointermove", onMove);
      zone.removeEventListener("pointerleave", onLeave);
      remove();
    };
  });

  return <div ref={ref} aria-hidden="true" className={className} />;
}
