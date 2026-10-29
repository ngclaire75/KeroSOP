"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Container } from "@/components/ui";
import { Heading } from "@/components/Heading";
import { prefersReducedMotion } from "@/lib/random";
import { BlurText } from "@/components/BlurText";

type Segment = string | { hl: string };

type Evidence = {
  doc: string;
  ref: string;
  quote: Segment[];
  zh?: boolean;
};

type Case = {
  id: string;
  tab: string;
  docs: string;
  verdict: string;
  tone: "conflict" | "clear" | "exception";
  a: Evidence;
  b: Evidence;
  why: string;
  next: string;
};

const policy: Evidence = {
  doc: "Refund Policy.pdf",
  ref: "v2.0, Section 3.1, p. 4",
  quote: ["Customers may submit new refund requests within ", { hl: "7 calendar days" }, " of delivery."],
};

const cases: Case[] = [
  {
    id: "conflict",
    tab: "7 days or 14 days",
    docs: "Refund Policy vs 客服操作规程",
    verdict: "Potential contradiction",
    tone: "conflict",
    a: policy,
    b: {
      doc: "客服操作规程.docx",
      ref: "v1.4, Section 2.3, p. 2",
      quote: ["客服人员可受理发货后", { hl: "14个自然日" }, "内提交的新退款申请。"],
      zh: true,
    },
    why: "Same event (a new request), same stores, both documents active. The languages differ; the rules still clash.",
    next: "Refund Policy is set as the governing document. Ask the support SOP owner to align Section 2.3.",
  },
  {
    id: "events",
    tab: "Submit or approve",
    docs: "Refund Policy vs Finance Procedure",
    verdict: "Compatible",
    tone: "clear",
    a: policy,
    b: {
      doc: "Finance Procedure.docx",
      ref: "v3.2, Section 4.2, p. 6",
      quote: ["Finance must pay out approved refunds within ", { hl: "14 calendar days" }, " of approval."],
    },
    why: "Different events. One limits when customers can ask, the other limits how long Finance has to pay. Both can be followed.",
    next: "No action needed.",
  },
  {
    id: "exception",
    tab: "Premium members",
    docs: "Two clauses in Refund Policy",
    verdict: "Valid exception",
    tone: "exception",
    a: policy,
    b: {
      doc: "Refund Policy.pdf",
      ref: "v2.0, Section 3.4, p. 5",
      quote: ["Premium members may submit refund requests within ", { hl: "30 calendar days" }, " of delivery."],
    },
    why: "The same approved policy sets a narrower rule for Premium members. The 7-day rule still applies to everyone else.",
    next: "Recorded as an exception so it isn’t raised again.",
  },
];

/**
 * Marker swipe (anime.js): a bar (dark red, or black) slides in from the left
 * and the words are uncovered right behind it. When the verdict wraps (on
 * phones), every line gets its own bar and they sweep in one after another,
 * top to bottom. Plays every time the panel scrolls into view, and each time
 * this example is selected.
 */
function MarkedVerdict({
  children,
  tone = "red",
  active = true,
}: {
  children: string;
  tone?: "red" | "ink";
  active?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const sync = useRef<(active: boolean) => void>(() => {});

  // Plays whenever the verdict is both on screen and the selected example;
  // resets when it scrolls fully away or another example is selected.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.querySelector<HTMLElement>("[data-lines]")!;
    const barClass = `absolute inset-0 origin-left ${tone === "red" ? "bg-[#a51c1c]" : "bg-ink"}`;
    const reduced = prefersReducedMotion();
    let parts: { bar: HTMLElement; text: HTMLElement }[] = [];
    let anime: Promise<typeof import("animejs")> | null = null;
    let runs: { pause: () => unknown }[] = [];
    let inView = false;
    let selected = active;
    let hidden = false;
    let width = 0;

    // Find where the words wrap, then rebuild the verdict as one marked span per line.
    const layout = () => {
      box.textContent = "";
      box.style.paddingInline = "0.1em";
      const words = children.split(" ").map((w, i, all) => {
        const s = document.createElement("span");
        s.textContent = w;
        box.append(s);
        if (i < all.length - 1) box.append(" ");
        return s;
      });
      const lines: string[][] = [];
      let top = -1e4;
      words.forEach((s) => {
        if (Math.abs(s.offsetTop - top) > 2) {
          lines.push([]);
          top = s.offsetTop;
        }
        lines[lines.length - 1].push(s.textContent!);
      });
      box.textContent = "";
      box.style.paddingInline = "";
      parts = lines.map((ws, i) => {
        const line = document.createElement("span");
        line.className = "relative inline-block px-[0.1em] pt-[0.08em] pb-[0.02em]";
        const bar = document.createElement("span");
        bar.className = barClass;
        const text = document.createElement("span");
        text.className = "relative";
        text.textContent = ws.join(" ");
        line.append(bar, text);
        box.append(line);
        if (i < lines.length - 1) box.append(document.createElement("br"));
        return { bar, text };
      });
    };

    const reset = () => {
      runs.forEach((r) => r.pause());
      runs = [];
      hidden = true;
      parts.forEach(({ bar, text }) => {
        bar.style.transform = "scaleX(0)";
        text.style.clipPath = "inset(0% 100% 0% 0%)";
      });
    };
    const play = async () => {
      anime ??= import("animejs");
      const { animate } = await anime;
      if (!inView || !selected) return;
      reset();
      hidden = false;
      runs = parts.flatMap(({ bar, text }, i) => [
        animate(bar, { scaleX: { to: 1 }, duration: 900, delay: i * 650, ease: "inOutQuart" }),
        animate(text, {
          clipPath: { from: "inset(0% 100% 0% 0%)", to: "inset(0% 0% 0% 0%)" },
          duration: 900,
          delay: i * 650 + 120,
          ease: "inOutQuart",
          onComplete: () => (text.style.clipPath = ""),
        }),
      ]);
    };

    layout();
    width = box.parentElement!.clientWidth;
    // Re-wrap when the width changes (rotation, resize).
    const ro = new ResizeObserver(() => {
      const w = box.parentElement!.clientWidth;
      if (w === width) return;
      width = w;
      const wasHidden = hidden;
      runs.forEach((r) => r.pause());
      runs = [];
      layout();
      if (wasHidden) reset();
      if (inView && selected) play();
    });
    ro.observe(box.parentElement!);
    if (reduced) return () => ro.disconnect();

    reset();
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (!inView) {
            inView = true;
            if (selected) play();
          }
        } else if (!entry.isIntersecting && inView) {
          inView = false;
          reset();
        }
      },
      { threshold: [0, 0.6] },
    );
    io.observe(el);
    sync.current = (next) => {
      if (next === selected) return;
      selected = next;
      if (selected && inView) play();
      else if (!selected) reset();
    };
    return () => {
      io.disconnect();
      ro.disconnect();
      runs.forEach((r) => r.pause());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => sync.current(active), [active]);

  return (
    <span ref={ref} className="block text-paper">
      <span className="sr-only">{children}</span>
      {/* Plain text until the effect splits it into marked lines, so it never renders blank. */}
      <span data-lines aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

function Quote({ e, label }: { e: Evidence; label: string }) {
  return (
    <figure className="flex h-full flex-col rounded-[16px] border border-paper/10 bg-[#242424] p-5 text-paper sm:p-6">
      <figcaption className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3">
        <span className="display text-3xl leading-none text-red">{label}</span>
        <span className="truncate leading-none font-semibold">{e.doc}</span>
        <span className="col-span-2 mt-1.5 text-sm text-paper/55">{e.ref}</span>
      </figcaption>
      <blockquote
        lang={e.zh ? "zh-Hans" : undefined}
        className={`mt-5 ${e.zh ? "text-[1.25rem] leading-[1.6]" : "text-lg leading-[1.45]"}`}
      >
        “
        {e.quote.map((seg, i) =>
          typeof seg === "string" ? (
            seg
          ) : (
            <mark key={i} className="bg-red/20 px-0.5 font-semibold text-[#ff5a63]">
              {seg.hl}
            </mark>
          ),
        )}
        ”
      </blockquote>
    </figure>
  );
}

export function Example() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (active + step + cases.length) % cases.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <section id="example" className="on-dark bg-ink py-20 text-paper lg:py-28">
      <Container>
        <div className="flex flex-col gap-6">
          <Heading className="text-[3.4rem] sm:text-[clamp(2.6rem,6vw,5.25rem)]" lines={["One refund.", "Three documents."]} />
          <BlurText className="max-w-[30rem] text-lg leading-[1.55] text-paper/70">
            These three look like they disagree. Only one does. KeroSOP checks who acts, what starts the clock and where
            the rule applies before it calls anything a conflict.
          </BlurText>
        </div>

        <div className="mt-12 flex flex-col gap-4 lg:mt-16">
          <div
            role="tablist"
            aria-label="Example comparisons"
            aria-orientation="vertical"
            className="grid gap-2 md:grid-cols-3"
            onKeyDown={onKey}
          >
            {cases.map((item, i) => {
              const selected = i === active;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  role="tab"
                  id={`tab-${item.id}`}
                  aria-selected={selected}
                  aria-controls={`panel-${item.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(i)}
                  className={`flex items-center justify-between gap-4 rounded-[16px] px-5 py-4 text-left ${
                    selected
                      ? "border border-paper bg-paper text-ink"
                      : "border border-paper/15 bg-white/[0.04] text-paper hover:border-paper/40 data-[hover]:border-paper/40"
                  }`}
                >
                  <span>
                    <span className="block text-lg font-semibold">{item.tab}</span>
                    <span className={`block text-sm ${selected ? "text-mute" : "text-paper/55"}`}>{item.docs}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`size-3 shrink-0 rounded-full ${
                      item.tone === "conflict"
                        ? "bg-red"
                        : selected
                          ? "border-2 border-ink"
                          : "border-2 border-paper/50"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* All panels share one grid cell, so the area keeps the height of the
              tallest example and switching is a pure crossfade: nothing below moves. */}
          <div className="grid">
            {cases.map((item, i) => {
              const shown = i === active;
              return (
                <div
                  key={item.id}
                  role="tabpanel"
                  id={`panel-${item.id}`}
                  aria-labelledby={`tab-${item.id}`}
                  aria-hidden={!shown}
                  inert={!shown}
                  className={`flex flex-col gap-4 [grid-area:1/1] ${
                    shown ? "opacity-100" : "pointer-events-none invisible opacity-0"
                  }`}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Quote e={item.a} label="A" />
                    <Quote e={item.b} label="B" />
                  </div>

                  <div className="flex-1 rounded-[16px] border-2 border-paper bg-paper p-5 text-ink sm:p-6">
                    <p className="display text-[clamp(2.25rem,4vw,3.25rem)]">
                      <MarkedVerdict tone={item.tone === "conflict" ? "red" : "ink"} active={shown}>
                        {item.verdict}
                      </MarkedVerdict>
                    </p>
                    <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm font-semibold text-ink">Why</dt>
                        <dd className="mt-1 leading-[1.5]">{item.why}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-semibold text-ink">Next step</dt>
                        <dd className="mt-1 leading-[1.5]">{item.next}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
