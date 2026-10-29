/** Small seeded PRNG so dot art renders identically on server and client. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Pixel ratio for canvases: up to 2x, or 1.5x on touch devices, where phone
 * screens are 3x and the extra pixels cost far more than they show.
 */
export function canvasDpr(cap = 2) {
  const limit = window.matchMedia("(hover: none)").matches ? Math.min(cap, 1.5) : cap;
  return Math.min(limit, window.devicePixelRatio || 1);
}
