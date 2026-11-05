"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { animate } from "animejs";
import type { Doc } from "@/lib/app/types";
import { AUTHORITY_LABEL } from "@/lib/app/types";
import { prefersReducedMotion } from "@/lib/random";
import type { PolicyLink } from "./model";

type Props = { docs: Doc[]; links: PolicyLink[]; selected: string | null; onSelect(id: string): void };
type View = { z: number; x: number; y: number };

const MAX_ZOOM = 4;
const HOME: View = { z: 1, x: 0, y: 0 };
const CARD_W = 96; // room kept for a node: its dot and document ID
const CARD_H = 40;
const GAP = 18;
const PAD = 40;

/** Rings sized to how many cards fit around them, then a separation pass so no two cards
 * ever overlap, whatever the document count. The canvas grows to fit the result. */
function layout(ids: string[]) {
  const pts: { id: string; x: number; y: number }[] = [];
  const stretch = 1.5; // wider than tall to suit the panel
  // Rings step far enough apart that cards on neighbouring rings clear each other at the
  // top (vertically) and at the sides (horizontally); each ring's angular spacing does the same.
  const step = Math.max(CARD_H + GAP, (CARD_W + GAP) / stretch) + 56; // generous: small nodes need room for their lines
  let radius = step * 1.15, i = 0;
  while (i < ids.length) {
    const rx = radius * stretch, ry = radius;
    const capacity = Math.max(1, Math.floor(Math.PI * 2 / Math.max((CARD_W + GAP + 60) / rx, (CARD_H + GAP + 30) / ry)));
    const count = Math.min(capacity, ids.length - i);
    // Balance the last ring instead of crowding one side.
    const offset = (pts.length % 2) * Math.PI / count;
    for (let k = 0; k < count; k++, i++) {
      const angle = -Math.PI / 2 + offset + k * Math.PI * 2 / count;
      pts.push({ id: ids[i], x: Math.cos(angle) * rx, y: Math.sin(angle) * ry });
    }
    radius += step;
  }
  if (pts.length === 1) pts[0].x = pts[0].y = 0;
  const minX = CARD_W + GAP, minY = CARD_H + GAP;
  for (let pass = 0; pass < 400; pass++) {
    let moved = false;
    for (let a = 0; a < pts.length; a++) {
      for (let b = a + 1; b < pts.length; b++) {
        const p = pts[a], q = pts[b];
        const dx = q.x - p.x, dy = q.y - p.y;
        const ox = minX - Math.abs(dx), oy = minY - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        // Push apart along the axis that needs the smaller move.
        if (ox / CARD_W < oy / CARD_H) { const m = (ox / 2 + .5) * (dx < 0 ? -1 : 1); p.x -= m; q.x += m; }
        else { const m = (oy / 2 + .5) * (dy < 0 ? -1 : 1); p.y -= m; q.y += m; }
      }
    }
    if (!moved) break;
  }
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const left = Math.min(0, ...xs) - CARD_W / 2 - PAD, top = Math.min(0, ...ys) - CARD_H / 2 - PAD;
  const right = Math.max(0, ...xs) + CARD_W / 2 + PAD, bottom = Math.max(0, ...ys) + CARD_H / 2 + PAD;
  const width = Math.max(1040, right - left), height = Math.max(560, bottom - top);
  const shiftX = (width - (right - left)) / 2 - left, shiftY = (height - (bottom - top)) / 2 - top;
  return { width, height, positions: pts.map((p) => ({ id: p.id, x: p.x + shiftX, y: p.y + shiftY })) };
}

type Pt = { x: number; y: number };
type Size = { w: number; h: number };
const LINE_GAP = 2; // space kept between a line and an ID it would otherwise cross
const DOT_SLOT = 14; // the dot sits centred in this square, exactly on the node's position
const LABEL_TOP = DOT_SLOT / 2 + 4; // the ID starts this far below the node's position

const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const along = (p: Pt[], t: number): Pt => {
  const [a, b, c] = [lerp(p[0], p[1], t), lerp(p[1], p[2], t), lerp(p[2], p[3], t)];
  return lerp(lerp(a, b, t), lerp(b, c, t), t);
};
/** The part of a cubic Bézier between t0 and t1, as its own four control points (de Casteljau). */
function slice(p: Pt[], t0: number, t1: number): Pt[] {
  const split = (q: Pt[], t: number) => {
    const [a, b, c] = [lerp(q[0], q[1], t), lerp(q[1], q[2], t), lerp(q[2], q[3], t)];
    const [d, e] = [lerp(a, b, t), lerp(b, c, t)];
    const m = lerp(d, e, t);
    return { left: [q[0], a, d, m], right: [m, e, c, q[3]] };
  };
  return split(split(p, t1).left, t1 ? t0 / t1 : 0).right;
}
/** Where the curve leaves (from 0) or reaches (from 1) a node: it runs right up to the dot's edge,
 * but stops LINE_GAP short of the ID if it would reach the ID first. Dot and ID are separate shapes,
 * so a line coming from the side never stops in the empty corner of a combined box. */
function edge(p: Pt[], n: Pt, r: number, label: Size, from: 0 | 1) {
  const inside = (t: number) => {
    const q = along(p, t);
    if (Math.hypot(q.x - n.x, q.y - n.y) <= r) return true;
    return Math.abs(q.x - n.x) <= label.w / 2 + LINE_GAP && q.y >= n.y + LABEL_TOP - LINE_GAP && q.y <= n.y + LABEL_TOP + label.h + LINE_GAP;
  };
  let lo: number = from, hi = 0.5;
  if (inside(hi)) return hi;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (inside(mid)) lo = mid; else hi = mid; }
  return hi;
}

export default function PolicyGraph({ docs, links, selected, onSelect }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const motionLayer = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const key = docs.map((d) => d.id).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { width, height, positions } = useMemo(() => layout(docs.map((d) => d.id)), [key]);
  // Each node's rendered box (layout px, unaffected by zoom), so lines can stop just outside it.
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  useLayoutEffect(() => {
    const el = scene.current;
    if (!el) return;
    const measure = () => {
      const next: Record<string, Size> = {};
      el.querySelectorAll<HTMLElement>("[data-label]").forEach((n) => { next[n.dataset.label!] = { w: n.offsetWidth, h: n.offsetHeight }; });
      setSizes((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    measure();
    document.fonts?.ready.then(measure);
  }, [key]);
  const fit = availableWidth ? Math.min(1, Math.max(1, availableWidth - 32) / width) : 1;
  const [view, setView] = useState<View>(HOME);
  const viewRef = useRef(view);
  const dragged = useRef(false);
  const boxW = width * fit, boxH = height * fit;

  // A new layout or size starts back at normal zoom.
  const layoutKey = `${boxW}|${boxH}|${key}`;
  const [viewFor, setViewFor] = useState(layoutKey);
  if (viewFor !== layoutKey) { setViewFor(layoutKey); setView(HOME); }
  useEffect(() => { viewRef.current = view; }, [view]);

  // Pinch (trackpad or touch) zooms toward the fingers. Panning only kicks in once zoomed,
  // so at normal size the page scrolls past the map exactly as before.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const clamp = (v: View): View => {
      const z = Math.min(MAX_ZOOM, Math.max(1, v.z));
      return { z, x: Math.min(0, Math.max(boxW - boxW * z, v.x)), y: Math.min(0, Math.max(boxH - boxH * z, v.y)) };
    };
    const commit = (v: View) => { const next = clamp(v); viewRef.current = next; setView(next); return next; };
    const local = (clientX: number, clientY: number) => { const r = el.getBoundingClientRect(); return { x: clientX - r.left, y: clientY - r.top }; };
    const zoomAt = (px: number, py: number, nz: number, base = viewRef.current) => {
      const z = Math.min(MAX_ZOOM, Math.max(1, nz)), k = z / base.z;
      return commit({ z, x: px - (px - base.x) * k, y: py - (py - base.y) * k });
    };
    const pan = (dx: number, dy: number) => {
      const v = viewRef.current, next = clamp({ ...v, x: v.x + dx, y: v.y + dy });
      if (next.x === v.x && next.y === v.y) return false;
      commit(next);
      return true;
    };

    // Chrome and Firefox report a trackpad pinch as a wheel event with ctrlKey.
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const p = local(e.clientX, e.clientY);
        zoomAt(p.x, p.y, viewRef.current.z * Math.exp(-e.deltaY * .01));
      } else if (viewRef.current.z > 1 && pan(-e.deltaX, -e.deltaY)) e.preventDefault();
    };

    // Safari reports a trackpad pinch as gesture events instead.
    let gestureBase: View | null = null, gesturePoint = { x: 0, y: 0 };
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      const g = e as Event & { clientX: number; clientY: number };
      gestureBase = viewRef.current;
      gesturePoint = local(g.clientX, g.clientY);
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      if (gestureBase) zoomAt(gesturePoint.x, gesturePoint.y, gestureBase.z * (e as Event & { scale: number }).scale, gestureBase);
    };
    const onGestureEnd = (e: Event) => { e.preventDefault(); gestureBase = null; };

    // Touch: two fingers pinch and pan together; one finger pans once zoomed.
    let pinch: { dist: number; mid: { x: number; y: number }; base: View } | null = null;
    let drag: { x: number; y: number } | null = null;
    const spread = (t: TouchList) => {
      const a = local(t[0].clientX, t[0].clientY), b = local(t[1].clientX, t[1].clientY);
      return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) { pinch = { ...spread(e.touches), base: viewRef.current }; drag = null; }
      else if (e.touches.length === 1 && viewRef.current.z > 1) { drag = { x: e.touches[0].clientX, y: e.touches[0].clientY }; dragged.current = false; }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        const now = spread(e.touches), b = pinch.base;
        const z = Math.min(MAX_ZOOM, Math.max(1, b.z * now.dist / pinch.dist)), k = z / b.z;
        commit({ z, x: now.mid.x - (pinch.mid.x - b.x) * k, y: now.mid.y - (pinch.mid.y - b.y) * k });
        dragged.current = true;
      } else if (drag && e.touches.length === 1) {
        const t = e.touches[0];
        if (pan(t.clientX - drag.x, t.clientY - drag.y)) e.preventDefault();
        if (Math.abs(t.clientX - drag.x) + Math.abs(t.clientY - drag.y) > 2) dragged.current = true;
        drag = { x: t.clientX, y: t.clientY };
      }
    };
    const onTouchEnd = (e: TouchEvent) => { if (e.touches.length < 2) pinch = null; if (!e.touches.length) drag = null; };

    // Mouse: click and drag to move around once zoomed.
    let mouse: { x: number; y: number; moved: number } | null = null;
    const onMouseDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || viewRef.current.z <= 1) return;
      mouse = { x: e.clientX, y: e.clientY, moved: 0 };
      dragged.current = false;
    };
    const onMouseMove = (e: PointerEvent) => {
      if (!mouse) return;
      pan(e.clientX - mouse.x, e.clientY - mouse.y);
      mouse.moved += Math.abs(e.clientX - mouse.x) + Math.abs(e.clientY - mouse.y);
      if (mouse.moved > 4) dragged.current = true;
      mouse = { ...mouse, x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { mouse = null; };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    el.addEventListener("gestureend", onGestureEnd);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    el.addEventListener("pointerdown", onMouseDown);
    window.addEventListener("pointermove", onMouseMove);
    window.addEventListener("pointerup", onMouseUp);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      el.removeEventListener("gestureend", onGestureEnd);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("pointerdown", onMouseDown);
      window.removeEventListener("pointermove", onMouseMove);
      window.removeEventListener("pointerup", onMouseUp);
    };
  }, [boxW, boxH]);

  // A pan or pinch that ends on a card shouldn't also select it.
  const swallowDragClick = (e: ReactMouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.stopPropagation();
    e.preventDefault();
  };
  const zoomed = view.z > 1.001;

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const resize = () => setAvailableWidth(el.clientWidth);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!scene.current || prefersReducedMotion()) return;
    const motion = animate(scene.current.querySelectorAll("button"), { scale: [.95, 1], duration: 400, delay: (_, i) => (i ?? 0) * 25, ease: "outCubic" });
    return () => { motion.revert(); };
  }, [key]);

  useEffect(() => {
    const layer = motionLayer.current;
    const el = viewport.current;
    if (!layer || !el) return;
    let visible = true;
    const update = () => { layer.dataset.paused = String(!visible || document.hidden); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(el);
    document.addEventListener("visibilitychange", update);
    update();
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);

  // Lines run node to node, trimmed where they meet each node's box so they never cross its ID.
  const curve = (link: PolicyLink) => {
    const a = positions.find((n) => n.id === link.a), b = positions.find((n) => n.id === link.b);
    if (!a || !b) return null;
    // Every link bends: both control points sit off the straight line by a share of its length,
    // towards the middle of the map (or a fixed side when the link already runs through it).
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const toward = (width / 2 - (a.x + b.x) / 2) * nx + (height / 2 - (a.y + b.y) / 2) * ny;
    const bend = (Math.abs(toward) < 1 ? 1 : Math.sign(toward)) * Math.max(24, len * .22);
    const full = [a, { x: a.x + dx * .25 + nx * bend, y: a.y + dy * .25 + ny * bend }, { x: a.x + dx * .75 + nx * bend, y: a.y + dy * .75 + ny * bend }, b];
    const radius = (id: string) => (id === selected ? 7 : 5);
    const label = (id: string) => sizes[id] ?? { w: 64, h: 18 };
    const t0 = edge(full, a, radius(a.id), label(a.id), 0), t1 = edge(full, b, radius(b.id), label(b.id), 1);
    if (t1 - t0 < 0.02) return null;
    const [p0, p1, p2, p3] = slice(full, t0, t1);
    return `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;
  };
  // Finding links draw last so they sit on top of topic links.
  const ordered = [...links.filter((l) => !l.findings.length), ...links.filter((l) => l.findings.length)];

  const dots = links.filter((l) => l.findings.length && (!selected || l.a === selected || l.b === selected)).slice(0, 32).flatMap((link) => {
    const path = curve(link);
    return path ? [{ id: link.id, path }] : [];
  });

  const flagged = new Set(links.filter((l) => l.findings.length).flatMap((l) => [l.a, l.b]));
  const neighbors = new Set(links.filter((l) => l.a === selected || l.b === selected).flatMap((l) => [l.a, l.b]));
  return (
    <div ref={viewport} className="w-full py-4" role="region" aria-label="Policy relationship map. Select a document for its connections.">
      <div ref={frame} onClickCapture={swallowDragClick} className={`relative mx-auto overflow-hidden rounded-[7px] ${zoomed ? "cursor-grab active:cursor-grabbing" : ""}`} style={{ width: boxW, height: boxH, touchAction: zoomed ? "none" : "pan-x pan-y" }}>
        <div ref={scene} className="absolute top-0 left-0 origin-top-left" style={{ width, height, transform: `translate(${view.x}px, ${view.y}px) scale(${fit * view.z})` }}>
          <div ref={motionLayer} aria-hidden="true" className={`map-motion pointer-events-none absolute inset-0`}>
            <svg width={width} height={height} className="absolute inset-0" fill="none" strokeLinecap="round">{ordered.map((l) => {
              const d = curve(l);
              if (!d) return null;
              const hot = l.findings.length > 0;
              const active = !selected || l.a === selected || l.b === selected;
              return <path key={l.id} d={d} className={`transition-opacity duration-300 ${hot ? "map-line-hot" : ""}`} stroke={hot ? "#e30613" : "#646462"} strokeWidth={hot ? 1.6 : .75} style={{ opacity: active ? (hot ? .75 : .35) : .07 }} />;
            })}</svg>
            {dots.map((dot, i) => <span key={dot.id} className="map-runner" style={{ offsetPath: `path("${dot.path}")`, animationDelay: `${-i * .73}s` }} />)}
          </div>
          {docs.map((doc, i) => {
            const point = positions[i];
            const on = selected === doc.id;
            const hot = flagged.has(doc.id);
            // A node: a dot with the document ID under it. The full name shows on hover and in the details panel.
            return <button key={doc.id} data-node={doc.id} type="button" aria-pressed={on} aria-label={`${doc.title} (${doc.id}), ${AUTHORITY_LABEL[doc.authority]}`} title={doc.title} onClick={() => onSelect(doc.id)}
              className="group absolute isolate z-10 flex -translate-x-1/2 flex-col items-center gap-1 rounded-[5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              style={{ left: point.x, top: point.y - DOT_SLOT / 2, opacity: selected && !on && !neighbors.has(doc.id) ? .3 : 1, transition: "opacity .3s" }}>
              <span aria-hidden="true" className="grid place-items-center" style={{ width: DOT_SLOT, height: DOT_SLOT }}>
                <span className={`block rounded-full transition-colors duration-200 ${on ? "size-3.5 bg-red" : hot ? "size-2.5 bg-red" : "size-2.5 bg-ink"}`} />
              </span>
              <span data-label={doc.id} className={`rounded-[4px] px-1.5 text-[14px] leading-[1.3] font-semibold text-white tabular-nums transition-colors ${on ? "bg-red" : "bg-black group-hover:bg-red"}`}>{doc.id}</span>
            </button>;
          })}
        </div>
      </div>
    </div>
  );
}
