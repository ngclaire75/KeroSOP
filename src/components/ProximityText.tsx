"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/random";

type Props = {
  text: string;
  className?: string;
  /** Weight at rest and right under the pointer (Archivo's wght axis: 100–900). */
  min?: number;
  max?: number;
  /** How far, in px, the pointer's pull reaches. */
  radius?: number;
  /** Width axis to keep while the weight changes (the condensed display cut). */
  wdth?: number;
};

/**
 * Letters sit thin and swell toward heavy as the pointer comes near, each
 * one easing on its own, so a wave of weight follows the cursor (or a finger
 * on touch screens). Reduced-motion visitors get a fixed bold weight instead.
 */
export function ProximityText({ text, className = "", min = 160, max = 900, radius = 260, wdth = 66 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const chars = Array.from(host.querySelectorAll<HTMLSpanElement>("[data-char]"));
    const set = (el: HTMLSpanElement, w: number) =>
      (el.style.fontVariationSettings = `"wdth" ${wdth}, "wght" ${w.toFixed(0)}`);

    if (prefersReducedMotion()) {
      chars.forEach((c) => set(c, 800));
      return;
    }

    // On touch screens, lock every letter to its heaviest width so the line
    // doesn't shuffle sideways as weights change under a moving finger.
    const touch = window.matchMedia("(hover: none)").matches;
    const lockWidths = () => {
      chars.forEach((c) => {
        c.style.width = "";
        set(c, max);
      });
      const widths = chars.map((c) => c.getBoundingClientRect().width);
      chars.forEach((c, i) => {
        c.style.width = `${widths[i]}px`;
        c.style.textAlign = "center";
        set(c, current[i]);
      });
    };

    const current = chars.map(() => min);
    chars.forEach((c) => set(c, min));
    let lockedFor = 0;
    const ro = new ResizeObserver(() => {
      if (!touch || window.innerWidth === lockedFor) return;
      lockedFor = window.innerWidth;
      lockWidths();
    });
    ro.observe(host);
    if (touch) document.fonts.ready.then(lockWidths);
    const pointer = { x: -1e4, y: -1e4 };
    let centres: { x: number; y: number }[] = [];
    let raf = 0;
    let visible = false;

    const measure = () => {
      centres = chars.map((c) => {
        const r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    };

    const tick = () => {
      raf = 0;
      measure();
      let moving = false;
      chars.forEach((c, i) => {
        const d = Math.hypot(centres[i].x - pointer.x, centres[i].y - pointer.y);
        const f = Math.max(0, 1 - d / radius);
        const target = min + (max - min) * f * f * (3 - 2 * f);
        const next = current[i] + (target - current[i]) * 0.16;
        if (Math.abs(next - current[i]) > 0.5) moving = true;
        current[i] = next;
        set(c, next);
      });
      if (moving && visible) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf && visible) raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      kick();
    };
    const onLeave = () => {
      pointer.x = pointer.y = -1e4;
      kick();
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) kick();
    });
    io.observe(host);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", kick, { passive: true });

    return () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", kick);
      cancelAnimationFrame(raf);
    };
  }, [min, max, radius, wdth]);

  return (
    <span ref={ref} className={className} aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <span key={i} data-char aria-hidden="true" className="inline-block">
          {ch}
        </span>
      ))}
    </span>
  );
}
