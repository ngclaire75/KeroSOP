"use client";

import { useEffect, useRef } from "react";
import { Container } from "@/components/ui";
import { Heading } from "@/components/Heading";
import { BlurText } from "@/components/BlurText";
import { Eye } from "@/components/art/Eye";
import { EyeField } from "@/components/art/EyeField";
import { useOnView } from "@/lib/anim";
import { LifecycleTrack, RoleCards } from "@/components/landing/SignOffFlow";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/random";

/** Staggered rise for a list's children (anime.js), played once on view. */
function useStagger<E extends HTMLElement>(step = 80) {
  return useOnView<E>(({ animate, stagger }, el) => {
    const items = Array.from(el.children) as HTMLElement[];
    items.forEach((n) => (n.style.opacity = "0"));
    animate(items, {
      opacity: { from: 0, to: 1 },
      translateY: { from: 28, to: 0 },
      duration: 900,
      delay: stagger(step),
      ease: "outExpo",
      // Drop the leftover transform so the text renders off the GPU layer.
      onComplete: () => items.forEach((n) => (n.style.transform = "")),
    });
  });
}

const steps = [
  {
    title: "Upload",
    body: "Add PDF and Word files in Chinese or English. Tag the owner, department and version, and say which document governs which.",
  },
  {
    title: "Extract",
    body: "Each instruction becomes a rule: who does what, by when, under which conditions, and exactly where it came from.",
  },
  {
    title: "Compare",
    body: "Only rules about the same action, place and period are compared, across languages. Dates and amounts are checked exactly.",
  },
  {
    title: "Verify",
    body: "Every quote is matched against the stored source before a finding reaches your reviewers.",
  },
  {
    title: "Review",
    body: "Reviewers confirm, dismiss or mark a valid exception. The document owner drafts the fix.",
  },
  {
    title: "Rescan",
    body: "Approved revisions are checked again. A finding only closes when the conflict is actually gone.",
  },
];

export function Steps() {
  const listRef = useStagger<HTMLOListElement>(90);
  return (
    <section id="how" className="bg-fog py-20 lg:py-28">
      <Container>
        <div className="flex flex-col gap-6">
          <Heading className="text-[3.4rem] sm:text-[clamp(2.6rem,6vw,5.25rem)]" lines={["From upload", "to a closed finding."]} />
          <BlurText className="max-w-[30rem] text-lg leading-[1.55] text-mute">
            A fixed pipeline, not a chat window. The same documents give the same findings, so you can test it and trust
            it.
          </BlurText>
        </div>

        <ol ref={listRef} data-stagger className="mt-14 grid gap-4 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="group relative overflow-hidden rounded-[24px] border border-line bg-paper p-6 sm:p-7 transition-colors duration-300 hover:border-ink data-[hover]:border-ink"
            >
              <div className="flex items-start justify-between">
                <span className="display text-[3.25rem] text-red sm:text-[4.5rem]" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="mt-2 grid grid-cols-3 gap-1" aria-hidden="true">
                  {Array.from({ length: 6 }).map((_, d) => (
                    <span key={d} className={`size-1.5 rounded-full ${d <= i ? "bg-ink" : "border border-ink/25"}`} />
                  ))}
                </span>
              </div>
              <h3 className="mt-5 text-2xl font-bold sm:mt-8">{s.title}</h3>
              <p className="mt-3 max-w-[22rem] text-base leading-[1.55] text-mute">{s.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

const lifecycle = [
  "Detected",
  "Under review",
  "Confirmed",
  "Assigned to owner",
  "Revision proposed",
  "Approved",
  "Rescanned",
  "Verified and closed",
];

export function SignOff() {
  return (
    <section id="governance" className="py-20 lg:py-28">
      <Container className="flex flex-col gap-12 lg:gap-16">
        <div className="relative flex min-h-[420px] flex-col justify-between overflow-hidden rounded-[24px] bg-red p-7 md:min-h-[440px] md:flex-row md:items-end lg:p-9">
          <EyeField className="pointer-events-none absolute inset-0" />
          <Heading
            className="relative max-w-[11ch] text-[3.4rem] text-paper sm:text-[clamp(3rem,6.2vw,5.75rem)] md:self-start"
            lines={["We flag it.", "You decide."]}
            tint="#ffb3ae"
          />
          <Eye className="relative -mr-7 ml-auto w-[min(100%,560px)] shrink-0 self-end md:w-[52%] lg:-mr-9" />
        </div>

        <div className="flex flex-col">
          <BlurText
            as="h2"
            step={45}
            blur={12}
            className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.1] font-bold tracking-[-0.015em]"
          >
            Nothing changes until a person signs off.
          </BlurText>
          <BlurText className="mt-5 max-w-[34rem] text-lg leading-[1.55] text-mute">
            KeroSOP suggests wording. Your people decide. Each decision records who made it, when, and against which
            version of which document. Dismissed findings stay dismissed unless new evidence turns up.
          </BlurText>

          <LifecycleTrack stages={lifecycle} />
          <RoleCards />
        </div>
      </Container>
    </section>
  );
}

const MESH = [
  "radial-gradient(42% 46% at 22% 18%, #e8261f 0%, rgba(232,38,31,0) 100%)",
  "radial-gradient(48% 52% at 86% 86%, #6e000b 0%, rgba(110,0,11,0) 100%)",
  "radial-gradient(38% 40% at 84% 16%, #9a000d 0%, rgba(154,0,13,0) 100%)",
  "radial-gradient(40% 42% at 16% 88%, #a8000e 0%, rgba(168,0,14,0) 100%)",
  "#c2000f",
].join(", ");

const impacts = [
  {
    doc: "客服操作规程",
    sub: "Customer Service SOP",
    detail: "Section 2.3 already allows 14 days. SOP-001 rechecked.",
    status: "Now aligned",
    flagged: false,
  },
  {
    doc: "Refund email template",
    sub: "English",
    detail: "Still tells customers they have 7 days.",
    status: "Review required",
    flagged: true,
  },
  {
    doc: "新员工培训手册",
    sub: "Staff training guide",
    detail: "The module 4 quiz answer is still 7 days.",
    status: "Review required",
    flagged: true,
  },
];

export function Monitoring() {
  const gridRef = useRef<HTMLDivElement>(null);

  // Cards start as one stacked pile and fan out into the grid as you scroll (GSAP).
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>("[data-card]");
      const centre = (el: HTMLElement) => ({
        x: grid.offsetWidth / 2 - (el.offsetLeft + el.offsetWidth / 2),
        y: grid.offsetHeight / 2 - (el.offsetTop + el.offsetHeight / 2),
      });
      gsap
        .timeline({
          scrollTrigger: { trigger: grid, start: "top 88%", end: "center 52%", scrub: 0.8, invalidateOnRefresh: true },
        })
        .from(cards, {
          x: (i, el) => centre(el).x + i * 14,
          y: (i, el) => centre(el).y - i * 22,
          rotateX: 50,
          rotateZ: -22,
          scale: 0.86,
          transformPerspective: 1400,
          ease: "power2.out",
          stagger: 0.05,
        })
        .from("[data-status]", { opacity: 0, scale: 0.4, ease: "back.out(2.4)", stagger: 0.08 }, ">-0.15");
    }, grid);
    return () => ctx.revert();
  }, []);

  return (
    <section className="on-dark overflow-hidden bg-ink py-20 text-paper lg:py-28">
      <Container>
        <div>
          <Heading
            className="text-[3.4rem] sm:text-[clamp(2.6rem,6vw,5.25rem)]"
            lines={["When a policy changes,", "we check what it touches."]}
          />
          <BlurText className="mt-6 max-w-[30rem] text-lg leading-[1.55] text-paper/70">
            Upload Refund Policy v3.0 and KeroSOP compares only the changed rules against the guides, templates and
            training that depend on them, in either language. Older findings are rechecked, never closed automatically.
          </BlurText>
        </div>

        <div ref={gridRef} className="relative mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          <div
            data-card
            className="will-change-transform on-red relative isolate z-10 flex min-h-[220px] [clip-path:inset(0_round_24px)] flex-col justify-between overflow-hidden rounded-[24px] bg-red p-6 sm:min-h-[260px] sm:p-7"
          >
            {/* Mesh gradient from layered radial gradients: painted once, drifts on the GPU. */}
            <div
              aria-hidden="true"
              className="mesh-drift pointer-events-none absolute -inset-[25%]"
              style={{ background: MESH }}
            />
            <div aria-hidden="true" className="grain pointer-events-none absolute inset-0" />
            <div className="relative">
              <p className="font-semibold">Refund Policy v3.0</p>
              <p className="text-sm text-paper/80">Approved, replaces v2.0</p>
            </div>
            <div className="relative">
              <p className="text-sm text-paper/85">Refund window, was 7 days</p>
              <p className="display mt-2 text-[clamp(3.25rem,5vw,4.5rem)]">14 days</p>
            </div>
          </div>

          {impacts.map((item) => (
            <div
              key={item.doc}
              data-card
              className="will-change-transform flex min-h-[220px] flex-col justify-between rounded-[24px] bg-paper p-6 text-ink sm:min-h-[260px] sm:p-7"
            >
              <div>
                <p className="text-xl leading-tight font-semibold">{item.doc}</p>
                <p className="text-sm text-mute">{item.sub}</p>
                <p className="mt-3 max-w-[17rem] leading-[1.5] text-mute">{item.detail}</p>
              </div>
              <p data-status className="mt-6 flex items-center gap-2.5 self-start font-semibold">
                {item.flagged ? (
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0">
                    <circle cx="8" cy="8" r="8" fill="var(--red)" />
                    <path
                      d="M5.25 5.25 10.75 10.75M10.75 5.25 5.25 10.75"
                      fill="none"
                      stroke="var(--paper)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0">
                    <circle cx="8" cy="8" r="8" fill="var(--ink)" />
                    <path d="M4.5 8.2 7 10.5l4.5-5" fill="none" stroke="var(--paper)" strokeWidth="1.8" />
                  </svg>
                )}
                <span className={item.flagged ? "text-red" : ""}>{item.status}</span>
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

const audiences = [
  { who: "Customer support and BPO", why: "Scripts, escalation rules and service policies that change every month." },
  { who: "Retail and multi-branch", why: "Refund, discount and store rules that drift apart between branches." },
  { who: "Logistics and operations", why: "Procedures with hard deadlines and named owners at every step." },
  { who: "Bilingual teams", why: "Head office writes in English, stores and warehouses work from Chinese copies." },
];

export function Audiences() {
  const listRef = useStagger<HTMLUListElement>(90);
  return (
    <section id="solutions" className="py-20 lg:py-28">
      <Container>
        <Heading
          className="text-[3.4rem] sm:text-[clamp(2.6rem,6vw,5.25rem)]"
          lines={["Built for teams that run", "on written procedures."]}
        />
        <ul ref={listRef} data-stagger className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {audiences.map((a) => (
            <li key={a.who} className="border-t-2 border-ink pt-5">
              <h3 className="text-lg font-bold">{a.who}</h3>
              <p className="mt-2 leading-[1.55] text-mute">{a.why}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
