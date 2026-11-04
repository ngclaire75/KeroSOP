"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import type p5 from "p5";
import type { Doc } from "@/lib/app/types";
import { AUTHORITY_LABEL } from "@/lib/app/types";
import { canvasDpr, prefersReducedMotion } from "@/lib/random";
import type { PolicyLink } from "./model";

type Props = { docs: Doc[]; links: PolicyLink[]; selected: string | null; onSelect(id: string): void; zoom: number; issueCounts: Record<string, number> };

export default function PolicyGraph({ docs, links, selected, onSelect, zoom, issueCounts }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  const width = Math.max(920, docs.length * 42);
  const height = Math.max(620, docs.length * 25);
  const positions = docs.map((d, i) => {
    const angle = -Math.PI / 2 + i * Math.PI * 2 / docs.length;
    return { id: d.id, x: width / 2 + Math.cos(angle) * (width / 2 - 115), y: height / 2 + Math.sin(angle) * (height / 2 - 65) };
  });
  const data = useRef({ positions, links, selected });
  useEffect(() => { data.current = { positions, links, selected }; });
  const key = docs.map((d) => d.id).join("|");

  useEffect(() => {
    const el = viewport.current;
    if (el) el.scrollLeft = Math.max(0, (width * zoom - el.clientWidth) / 2);
  }, [key, width, zoom]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let instance: p5 | undefined;
    let observer: IntersectionObserver | undefined;
    import("p5").then(({ default: P5 }) => {
      if (cancelled) return;
      try {
        instance = new P5((p) => {
          let visible = true;
          p.setup = () => {
            p.pixelDensity(canvasDpr(1.5));
            try {
              p.createCanvas(width, height, p.WEBGL).attribute("aria-hidden", "true");
            } catch {
              setFallback(true);
              p.noLoop();
              return;
            }
            p.frameRate(prefersReducedMotion() ? 1 : 24);
            observer = new IntersectionObserver(([entry]) => {
              visible = entry.isIntersecting;
              if (visible) p.loop(); else p.noLoop();
            });
            observer.observe(el);
          };
          p.draw = () => {
            if (!visible) return;
            p.clear();
            p.translate(-width / 2, -height / 2);
            const { positions: points, links: edges, selected: focus } = data.current;
            const at = new Map(points.map((n) => [n.id, n]));
            p.strokeWeight(1);
            p.stroke(229, 229, 227);
            for (let x = 20; x < width; x += 24) for (let y = 20; y < height; y += 24) p.point(x, y);
            const drawLink = (link: PolicyLink, hot: boolean) => {
              const a = at.get(link.a), b = at.get(link.b);
              if (!a || !b) return;
              const active = !focus || link.a === focus || link.b === focus;
              const alpha = active ? (hot ? 190 : 90) : 18;
              p.noFill();
              p.stroke(hot ? 227 : 100, hot ? 6 : 100, hot ? 19 : 98, alpha);
              p.strokeWeight(hot ? 1.8 : 1);
              const cx = (a.x + b.x) / 2;
              const c1 = { x: a.x * .55 + cx * .45, y: a.y * .55 + height / 2 * .45 };
              const c2 = { x: b.x * .55 + cx * .45, y: b.y * .55 + height / 2 * .45 };
              p.bezier(a.x, a.y, c1.x, c1.y, c2.x, c2.y, b.x, b.y);
              if (hot && active && !prefersReducedMotion()) {
                const t = (p.millis() / 5500 + edges.indexOf(link) * .17) % 1;
                const x = p.bezierPoint(a.x, c1.x, c2.x, b.x, t);
                const y = p.bezierPoint(a.y, c1.y, c2.y, b.y, t);
                p.noStroke(); p.fill(227, 6, 19); p.circle(x, y, 4);
              }
            };
            edges.filter((l) => !l.findings.length).forEach((l) => drawLink(l, false));
            edges.filter((l) => l.findings.length).forEach((l) => drawLink(l, true));
          };
        }, el);
      } catch { if (!cancelled) setFallback(true); }
    }).catch(() => { if (!cancelled) setFallback(true); });
    return () => { cancelled = true; observer?.disconnect(); instance?.remove(); };
  }, [width, height]);

  useEffect(() => {
    if (!scene.current || prefersReducedMotion()) return;
    const motion = animate(scene.current.querySelectorAll("button"), { scale: [.95, 1], duration: 400, delay: (_, i) => (i ?? 0) * 25, ease: "outCubic" });
    return () => { motion.revert(); };
  }, [key]);

  const neighbors = new Set(links.filter((l) => l.a === selected || l.b === selected).flatMap((l) => [l.a, l.b]));
  return (
    <div ref={viewport} className="overflow-auto overscroll-contain" style={{ maxHeight: 660 }} tabIndex={0} role="region" aria-label="Policy relationship map. Scroll to explore; select a document for its connections.">
      {fallback && <p role="status" className="px-5 py-3 text-[13px] text-mute">WebGL unavailable. Use the document nodes or list view to explore every connection.</p>}
      <div style={{ width: width * zoom, height: height * zoom, position: "relative", margin: "auto" }}>
        <div ref={scene} className="absolute top-0 left-0 origin-top-left" style={{ width, height, transform: `scale(${zoom})` }}>
          <div ref={host} aria-hidden="true" className="pointer-events-none absolute inset-0" />
          {fallback && <svg width={width} height={height} aria-hidden="true" className="absolute inset-0">{links.map((l) => {
            const a = positions.find((n) => n.id === l.a)!, b = positions.find((n) => n.id === l.b)!;
            return <line key={l.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={l.findings.length ? "#e30613" : "#b6b6b3"} />;
          })}</svg>}
          {docs.map((doc, i) => {
            const point = positions[i];
            const findings = issueCounts[doc.id] ?? 0;
            return <button key={doc.id} type="button" aria-pressed={selected === doc.id} onClick={() => onSelect(doc.id)} className="absolute flex w-[174px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[10px] border bg-white px-3.5 py-3 text-left shadow-[0_2px_8px_#00000006] transition-[border-color,box-shadow] hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" style={{ left: point.x, top: point.y, borderColor: selected === doc.id ? "#171717" : "#e5e5e3", opacity: selected && selected !== doc.id && !neighbors.has(doc.id) ? .4 : 1, boxShadow: selected === doc.id ? "0 0 0 2px #171717" : undefined }}>
              <span className="mb-1 flex w-full items-center justify-between gap-2 text-[10px] font-semibold text-mute"><span>{doc.id}</span>{findings > 0 && <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-red" />{findings} open</span>}</span>
              <span className="line-clamp-2 text-[13px] leading-[1.3] font-bold">{doc.title}</span>
              <span className="mt-1 truncate text-[10px] text-mute">{AUTHORITY_LABEL[doc.authority]}</span>
            </button>;
          })}
        </div>
      </div>
    </div>
  );
}
