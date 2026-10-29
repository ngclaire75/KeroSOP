"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/random";

/** The poster eye. Its pupil follows the pointer, or a finger on touch screens, within the iris. */
export function Eye({ className = "" }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pupilRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const svg = svgRef.current;
    const pupil = pupilRef.current;
    if (!svg || !pupil) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;

    const aim = (dx: number, dy: number, reach: number) => {
      const len = Math.hypot(dx, dy) || 1;
      const pull = Math.min(1, len / reach);
      tx = (dx / len) * 26 * pull;
      ty = (dy / len) * 26 * pull;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const box = svg.getBoundingClientRect();
      // Iris centre sits at (330, 150) of a 460×300 viewBox.
      const cx = box.left + (330 / 460) * box.width;
      const cy = box.top + (150 / 300) * box.height;
      // Full swing a little past the eye's own width, so a phone-sized eye still looks all the way round.
      aim(e.clientX - cx, e.clientY - cy, Math.min(500, box.width * 1.1));
    };
    // touchHover sends this once the finger has lifted for a beat: look back to the middle.
    // (The browser's own pointerleave fires as soon as a swipe turns into a scroll, so skip it.)
    const onRelease = (e: PointerEvent) => !e.isTrusted && e.pointerType === "touch" && aim(0, 0, 1);

    const tick = () => {
      x += (tx - x) * 0.14;
      y += (ty - y) * 0.14;
      pupil.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.05 ? requestAnimationFrame(tick) : 0;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onRelease);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onRelease);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <svg ref={svgRef} data-eye viewBox="0 0 460 300" className={className} aria-hidden="true">
      <g className="blink">
        <path d="M8 150 C 120 70, 230 18, 330 18 C 380 18, 425 32, 460 55 L 460 245 C 425 268, 380 282, 330 282 C 230 282, 120 230, 8 150 Z" fill="var(--ink)" />
        <circle cx="330" cy="150" r="112" fill="var(--paper)" />
        <g ref={pupilRef}>
          <circle cx="330" cy="150" r="78" fill="var(--ink)" />
          <circle cx="300" cy="118" r="16" fill="var(--paper)" />
        </g>
      </g>
    </svg>
  );
}
