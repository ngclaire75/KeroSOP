/**
 * Lets a finger do what the mouse does. On touch-only devices, every touch
 * and swipe is replayed as a bubbling `pointermove` at the finger, so the
 * dot fields, the eye and the proximity text follow it. The element under
 * the finger and its ancestors carry `data-hover`, which stands in for
 * `:hover` in CSS (`data-[hover]:…`). Lifting the finger lets go after a beat.
 * Mouse and trackpad visitors are never touched by this.
 */
export function installTouchHover() {
  if (!window.matchMedia("(hover: none)").matches) return () => {};

  let chain: Element[] = [];
  let release = 0;
  let last = { x: -1e4, y: -1e4 };

  const leave = (els: Element[]) =>
    els.forEach((el) => {
      el.removeAttribute("data-hover");
      el.dispatchEvent(
        new PointerEvent("pointerleave", {
          clientX: last.x,
          clientY: last.y,
          pointerType: "touch",
        }),
      );
    });

  const at = (t: Touch) => {
    window.clearTimeout(release);
    last = { x: t.clientX, y: t.clientY };
    const hit = document.elementFromPoint(t.clientX, t.clientY);
    if (!hit) return;
    const next: Element[] = [];
    for (let el: Element | null = hit; el && el !== document.documentElement; el = el.parentElement) next.push(el);
    leave(chain.filter((el) => !next.includes(el)));
    next.forEach((el) => el.hasAttribute("data-hover") || el.setAttribute("data-hover", ""));
    chain = next;
    hit.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: t.clientX,
        clientY: t.clientY,
        pointerType: "touch",
        isPrimary: true,
      }),
    );
  };

  const onTouch = (e: TouchEvent) => e.touches[0] && at(e.touches[0]);
  const onEnd = (e: TouchEvent) => {
    if (e.touches.length) return;
    release = window.setTimeout(() => {
      leave(chain);
      chain = [];
      document.documentElement.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "touch" }));
    }, 650);
  };

  window.addEventListener("touchstart", onTouch, { passive: true });
  window.addEventListener("touchmove", onTouch, { passive: true });
  window.addEventListener("touchend", onEnd, { passive: true });
  window.addEventListener("touchcancel", onEnd, { passive: true });
  return () => {
    window.clearTimeout(release);
    window.removeEventListener("touchstart", onTouch);
    window.removeEventListener("touchmove", onTouch);
    window.removeEventListener("touchend", onEnd);
    window.removeEventListener("touchcancel", onEnd);
  };
}
