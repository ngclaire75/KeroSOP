"use client";

import { useEffect, useRef, type RefObject } from "react";
import { prefersReducedMotion } from "@/lib/random";

type Anime = typeof import("animejs");

/**
 * Runs `play` once, the first time the element scrolls into view, with
 * anime.js loaded on demand. With reduced motion `play` is skipped and
 * `settle` (if given) puts the element in its final state.
 */
export function useOnView<E extends HTMLElement>(
  play: (anime: Anime, el: E) => void,
  { threshold = 0.25, immediate = false }: { threshold?: number; immediate?: boolean } = {},
): RefObject<E | null> {
  const ref = useRef<E>(null);
  const playRef = useRef(play);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.dataset.revealed = "1";
      return;
    }
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      import("animejs").then((anime) => {
        playRef.current(anime, el);
        el.dataset.revealed = "1";
      });
    };
    if (immediate) {
      run();
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [immediate, threshold]);

  return ref;
}
