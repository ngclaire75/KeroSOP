"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Container } from "@/components/ui";
import { Heading } from "@/components/Heading";
import { BlurText } from "@/components/BlurText";
import { prefersReducedMotion } from "@/lib/random";

const checks = [
  {
    name: "Direct contradiction",
    what: "Two instructions that can’t both be followed under the same conditions.",
    example: "Refund window is 7 days in the policy and 14 days in the support SOP.",
  },
  {
    name: "Allowed in one, forbidden in another",
    what: "One approved document permits an action that another one prohibits.",
    example: "Agents may issue refunds. Elsewhere: agents must not refund orders above the store limit.",
  },
  {
    name: "Outdated instruction",
    what: "An active guide still repeats a rule that a newer version replaced.",
    example: "The onboarding deck still lists last year’s leave allowance.",
  },
  {
    name: "Missing step",
    what: "An SOP skips a step that your approved reference workflow requires.",
    example: "The purchasing SOP goes from quote to payment with no manager approval.",
  },
  {
    name: "Unclear ownership",
    what: "Different documents give the same approval or task to different roles.",
    example: "Store manager in one guide, area director in another, for final discount approval.",
  },
  {
    name: "Inconsistent terms",
    what: "A word, deadline or obligation means different things in different places.",
    example:
      "“Business day” (工作日) includes Saturday in the Chinese warehouse guide but not in the English HR policy.",
  },
  {
    name: "Duplicated guidance",
    what: "Several current documents cover the same process in slightly different ways.",
    example: "Three versions of the escalation process across Support and Operations.",
  },
];

const AUTOPLAY_MS = 5500;

/**
 * Seven problem types on one stage. Dots underneath pick a type; its copy crossfades
 * at a fixed height. It cycles on its own
 * while on screen until someone picks one.
 */
export function Checks() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [onScreen, setOnScreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const n = checks.length;

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const cycling = auto && !prefersReducedMotion();
  const playing = cycling && onScreen;
  // Scrolling away pauses the countdown (and its progress bar) instead of
  // finishing it; coming back resumes from the same point.
  const remaining = useRef(AUTOPLAY_MS);
  useEffect(() => {
    remaining.current = AUTOPLAY_MS;
  }, [active]);
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const id = setTimeout(() => setActive((a) => (a + 1) % n), remaining.current);
    return () => {
      clearTimeout(id);
      remaining.current = Math.max(0, remaining.current - (performance.now() - start));
    };
  }, [playing, active, n]);

  const pick = (i: number) => {
    setAuto(false);
    setActive(i);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (active + step + n) % n;
    pick(next);
    chipRefs.current[next]?.focus();
  };

  return (
    <section id="checks" className="py-20 lg:py-28">
      <Container>
        <Heading
          className="text-[3.4rem] sm:text-[clamp(2.6rem,6vw,5.25rem)]"
          lines={["Seven kinds of problem.", "Each checked its own way."]}
        />
        <BlurText className="mt-6 max-w-[34rem] text-lg leading-[1.55] text-mute">
          Numbers, dates and deadlines are compared by code, exactly. Meaning, exceptions and scope are read by the
          model, then matched back to the source text before you see anything.
        </BlurText>

        <div
          ref={stageRef}
          id="check-stage"
          role="tabpanel"
          aria-labelledby={`check-tab-${active}`}
          className="mt-12 overflow-hidden rounded-[28px] bg-ink text-paper lg:mt-14"
        >
          <div className="relative grid p-7 sm:p-10 lg:p-12">
            {checks.map((c, i) => {
              const shown = i === active;
              return (
                <div
                  key={c.name}
                  aria-hidden={!shown}
                  className={`flex flex-col transition-[opacity,filter,visibility] duration-500 ease-out [grid-area:1/1] ${
                    shown ? "visible opacity-100 blur-0" : "pointer-events-none invisible opacity-0 [@media(hover:hover)]:blur-[6px]"
                  }`}
                >
                  <span className="text-sm font-semibold text-paper tabular-nums">
                    {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
                  </span>
                  <h3 className="display mt-4 text-[clamp(2.25rem,4vw,3.5rem)]">{c.name}</h3>
                  <p className="mt-5 max-w-[30rem] text-lg leading-[1.55] text-paper/70">{c.what}</p>
                  <p className="mt-8 max-w-[30rem] border-l-2 border-red pl-4 leading-[1.6]">{c.example}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Problem types"
          onKeyDown={onKey}
          className="mt-6 flex items-center justify-center gap-2"
        >
          {checks.map((c, i) => {
            const selected = i === active;
            return (
              <button
                key={c.name}
                ref={(el) => {
                  chipRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`check-tab-${i}`}
                aria-selected={selected}
                aria-controls="check-stage"
                aria-label={c.name}
                title={c.name}
                tabIndex={selected ? 0 : -1}
                onClick={() => pick(i)}
                className="group flex h-6 items-center"
              >
                <span
                  className={`relative block h-2.5 overflow-hidden rounded-full transition-[width,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    selected ? "w-10 bg-ink/15" : "w-2.5 bg-ink/20 group-hover:bg-ink/50 group-data-[hover]:bg-ink/50"
                  }`}
                >
                  {selected &&
                    (cycling ? (
                      <span
                        key={`p${active}`}
                        aria-hidden="true"
                        className="checks-progress absolute inset-0 origin-left rounded-full bg-red"
                        style={{
                          animationDuration: `${AUTOPLAY_MS}ms`,
                          animationPlayState: playing ? "running" : "paused",
                        }}
                      />
                    ) : (
                      <span aria-hidden="true" className="absolute inset-0 rounded-full bg-red" />
                    ))}
                </span>
              </button>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
