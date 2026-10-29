"use client";

import { useEffect, useRef, useState } from "react";
import { useOnView } from "@/lib/anim";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/random";

/* ------------------------------------------------------------------ */
/* Stage tracker: as you scroll, a finding moves through eight stages. */
/* GSAP drives one progress value that fills a segmented bar; the big  */
/* stage name swaps with a blur focus-in (anime.js) when a stage ends. */
/* ------------------------------------------------------------------ */

export function LifecycleTrack({ stages }: { stages: string[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const wordRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);
  const n = stages.length;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (prefersReducedMotion()) {
      fillRefs.current.forEach((f) => f && (f.style.transform = "scaleX(1)"));
      const id = requestAnimationFrame(() => {
        setActive(n - 1);
        setStarted(true);
      });
      return () => cancelAnimationFrame(id);
    }

    const setters = fillRefs.current.map((f) => (f ? gsap.quickSetter(f, "scaleX") : () => {}));
    const proxy = { p: 0 };
    let last = -1;
    let wasStarted = false;
    const apply = () => {
      const x = proxy.p * n;
      setters.forEach((set, i) => set(Math.min(1, Math.max(0, x - i))));
      const idx = Math.min(n - 1, Math.floor(x));
      if (idx !== last) {
        last = idx;
        setActive(idx);
      }
      const isStarted = proxy.p > 0.001;
      if (isStarted !== wasStarted) {
        wasStarted = isStarted;
        setStarted(isStarted);
      }
    };

    const ctx = gsap.context(() => {
      gsap.to(proxy, {
        p: 1,
        ease: "none",
        onUpdate: apply,
        scrollTrigger: {
          trigger: wrap,
          start: "top 38%",
          end: () => `+=${Math.max(800, window.innerHeight * 1.4)}`,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          scrub: true,
          invalidateOnRefresh: true,
        },
      });
    }, wrap);
    return () => ctx.revert();
  }, [n]);

  // Swap the big stage name with a quick focus-in whenever the stage changes.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const el = wordRef.current;
    if (!el || prefersReducedMotion()) return;
    import("animejs").then(({ animate }) => {
      animate(el, {
        opacity: { from: 0, to: 1 },
        // No blur on touch screens: iOS Safari leaves artifacts around blurred text.
        ...(window.matchMedia("(hover: none)").matches ? {} : { filter: { from: "blur(10px)", to: "blur(0px)" } }),
        translateY: { from: "0.12em", to: "0em" },
        duration: 450,
        ease: "outQuart",
        onComplete: () => {
          el.style.filter = "";
          el.style.transform = "";
        },
      });
    });
  }, [active]);

  const pad = (v: number) => String(v).padStart(2, "0");

  return (
    <div ref={wrapRef} className="mt-12 lg:mt-16">
      <div className="flex items-end justify-between gap-6">
        <p className="display min-h-[1.8em] text-[clamp(2.5rem,7vw,6rem)] leading-[0.9]" aria-live="polite">
          <span ref={wordRef} className={`inline-block ${active === n - 1 && started ? "text-red" : ""}`}>
            {stages[active]}
          </span>
        </p>
        <p className="shrink-0 pb-1 text-right text-sm text-mute tabular-nums">
          <span className="display block text-[clamp(1.75rem,3vw,2.5rem)] leading-none text-ink">
            {pad(active + 1)}
            <span className="text-ink/25"> / {pad(n)}</span>
          </span>
          Following SOP-001
        </p>
      </div>

      <ol className="mt-8 grid grid-cols-8 gap-1.5" aria-label="Finding lifecycle">
        {stages.map((stage, i) => {
          const done = started && i < active;
          const current = started && i === active;
          return (
            <li key={stage} aria-current={current ? "step" : undefined}>
              <span className="relative block h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
                <span
                  ref={(el) => {
                    fillRefs.current[i] = el;
                  }}
                  className="absolute inset-0 origin-left rounded-full bg-red will-change-transform"
                  style={{ transform: "scaleX(0)" }}
                />
              </span>
              <span className="sr-only">
                {stage}
                {current ? ", current stage" : done ? ", done" : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Role cards: rise in, then their permission chips pop in (anime.js). */
/* ------------------------------------------------------------------ */

const roles = [
  {
    role: "Reviewer",
    does: "Confirms findings, dismisses false alarms, asks for changes.",
    can: ["Confirm", "Dismiss", "Request changes"],
  },
  {
    role: "Approver",
    does: "Approves revised documents before they become the active version.",
    can: ["Approve revision", "Set active version"],
  },
  {
    role: "Auditor",
    does: "Reads findings, sources and reports. Changes nothing.",
    can: ["Read only"],
  },
];

export function RoleCards() {
  const ref = useOnView<HTMLUListElement>(({ animate, stagger }, el) => {
    const cards = Array.from(el.children) as HTMLElement[];
    cards.forEach((c) => (c.style.opacity = "0"));
    animate(cards, {
      opacity: { from: 0, to: 1 },
      translateY: { from: 30, to: 0 },
      duration: 900,
      delay: stagger(120),
      ease: "outExpo",
    });
    const chips = el.querySelectorAll<HTMLElement>("[data-chip]");
    chips.forEach((c) => (c.style.opacity = "0"));
    animate(chips, {
      opacity: { from: 0, to: 1 },
      scale: { from: 0.8, to: 1 },
      duration: 600,
      delay: stagger(60, { start: 450 }),
      ease: "outBack",
    });
  });

  return (
    <ul ref={ref} data-stagger className="mt-10 grid gap-3 md:grid-cols-3">
      {roles.map((r) => (
        <li key={r.role} className="flex flex-col rounded-[22px] bg-ink p-6 text-paper sm:p-7">
          <h3 className="text-2xl font-bold">{r.role}</h3>
          <p className="mt-2 leading-[1.55] text-paper/65">{r.does}</p>
          <ul className="mt-auto flex flex-wrap gap-2 pt-6">
            {r.can.map((c) => (
              <li key={c} data-chip className="rounded-full bg-red px-3 py-1 text-xs font-semibold">
                {c}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
