"use client";

import { useEffect, useRef } from "react";
import type p5 from "p5";

type Sketch = (p: p5, host: HTMLDivElement) => void;

/**
 * Mounts a p5 instance-mode sketch into the returned ref. p5 is imported
 * lazily so it never runs on the server, and the sketch only loops while
 * its host is on screen.
 */
export function useP5(sketch: Sketch) {
  const ref = useRef<HTMLDivElement>(null);
  const sketchRef = useRef(sketch);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    let instance: p5 | undefined;
    let cancelled = false;
    let visible = true;

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (!instance) return;
        if (visible && !host.dataset.static) instance.loop();
        else instance.noLoop();
      },
      { rootMargin: "120px" },
    );
    io.observe(host);

    import("p5").then(({ default: P5 }) => {
      if (cancelled) return;
      instance = new P5((p) => sketchRef.current(p, host), host);
      if (!visible) instance.noLoop();
    });

    return () => {
      cancelled = true;
      io.disconnect();
      instance?.remove();
    };
  }, []);

  return ref;
}
