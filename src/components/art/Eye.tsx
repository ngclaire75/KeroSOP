"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/random";

/** The poster eye. Its pupil follows the pointer within the iris. */
export function Eye({ className = "" }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pupilRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;
    const svg = svgRef.current;
    const pupil = pupilRef.current;
    if (!svg || !pupil) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;

    const onMove = (e: PointerEvent) => {
      const box = svg.getBoundingClientRect();
      // Iris centre sits at (330, 150) of a 460×300 viewBox.
      const cx = box.left + (330 / 460) * box.width;
      const cy = box.top + (150 / 300) * box.height;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const len = Math.hypot(dx, dy) || 1;
      const pull = Math.min(1, len / 500);
      tx = (dx / len) * 26 * pull;
      ty = (dy / len) * 26 * pull;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const tick = () => {
      x += (tx - x) * 0.14;
      y += (ty - y) * 0.14;
      pupil.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.05 ? requestAnimationFrame(tick) : 0;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
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
