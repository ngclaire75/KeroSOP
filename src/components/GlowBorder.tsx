"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Wraps a card in the orbiting red outline (`.glow-border` in globals.css).
 * The orbit repaints every frame, so it only runs while the card is on screen.
 */
export function GlowBorder({ className = "", children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) el.dataset.live = "1";
      else delete el.dataset.live;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`glow-border ${className}`}>
      {children}
    </div>
  );
}
