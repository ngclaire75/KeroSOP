"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { Button, Container, Logo } from "@/components/ui";
import { BlurText, Heading } from "@/components/BlurText";
import { GlyphCloud, HERO_START, type Glyph } from "@/components/docs/GlyphCloud";
import { prefersReducedMotion } from "@/lib/random";

const DOC_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/help", label: "Help" },
];

/* ---------- header ---------- */

/** Logo home, and the sign-up button. */
export function DocHeader() {
  return (
    <header className="relative z-10">
      <Container>
        <div className="flex h-[76px] items-center justify-between gap-4">
          <Link href="/" aria-label="KeroSOP home" className="flex h-full items-center">
            <Logo className="block h-7 w-auto" />
          </Link>
          <Button href="/signup" size="sm" variant="black">
            Sign up / Log in
          </Button>
        </div>
      </Container>
    </header>
  );
}

/* ---------- hero ---------- */

/** Black rounded panel: the title on the left, the page's dot glyph on the right. */
export function DocHero({
  glyph,
  eyebrow,
  title,
  intro,
  meta,
}: {
  glyph: Glyph;
  eyebrow: string;
  title: string[];
  intro: string;
  meta?: string;
}) {
  return (
    <Container>
      <section className="on-dark relative grid overflow-hidden rounded-[28px] bg-ink text-paper lg:h-[460px] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <GlyphCloud glyph={glyph} className="relative h-[280px] sm:h-[300px] lg:order-2 lg:h-full" />
        <div className="relative flex flex-col justify-end p-6 pt-0 sm:p-10 sm:pt-0 lg:p-14">
          {/* Small mono label: a plain fade (no blur), which reads cleaner at this size. */}
          <BlurText
            startOn={HERO_START}
            blur={0}
            tint="rgba(255,255,255,0)"
            className="font-mono text-[12px] tracking-[0.18em] text-paper/55 uppercase"
          >
            {eyebrow}
          </BlurText>
          <Heading
            as="h1"
            startOn={HERO_START}
            className="mt-5 text-[clamp(3rem,7vw,6.2rem)]"
            lines={[title[0], ...(title[1] ? [<span key="red" className="text-red">{title[1]}</span>] : [])]}
          />
          <BlurText startOn={HERO_START} className="mt-6 max-w-[34rem] text-[17px] leading-[1.6] text-paper/65">
            {intro}
          </BlurText>
          {meta && <p className="mt-6 font-mono text-[12px] tracking-[0.12em] text-paper/40 uppercase">{meta}</p>}
        </div>
      </section>
    </Container>
  );
}

/* ---------- article ---------- */

export type DocSection = { id: string; title: string; body: ReactNode };

/**
 * Numbered sections with a sticky contents list that follows the section
 * you are reading.
 */
export function DocArticle({ sections }: { sections: DocSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections]);

  const jump = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <Container>
      <div className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-20">
        <aside className="hidden lg:block">
          <div className="sticky top-10">
            <nav aria-label="On this page" className="grid gap-1">
              <p className="mb-3 font-mono text-[12px] tracking-[0.16em] text-mute uppercase">On this page</p>
              {sections.map((s, i) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={jump(s.id)}
                  aria-current={active === s.id ? "location" : undefined}
                  className={`flex gap-3 py-1.5 text-[14px] leading-[1.35] transition-colors duration-200 ${
                    active === s.id ? "font-semibold text-ink" : "text-mute hover:text-ink"
                  }`}
                >
                  <span className="w-5 shrink-0 font-mono text-[12px] leading-[1.6] text-mute">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <div className="max-w-[46rem]">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-10 border-t border-line py-10 first:border-t-0 first:pt-0">
              <p className="font-mono text-[12px] tracking-[0.16em] text-red">{String(i + 1).padStart(2, "0")}</p>
              <Heading as="h2" className="mt-3 text-[clamp(1.9rem,3.4vw,2.8rem)]" lines={[s.title]} />
              <div className="doc-body mt-5">{s.body}</div>
            </section>
          ))}
        </div>
      </div>
    </Container>
  );
}

/* ---------- footer ---------- */

export function DocFooter() {
  return (
    <footer className="on-dark bg-[#111111] text-paper">
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-6 text-[14px] font-semibold">
          <span>© 2026 KeroSOP</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-7 gap-y-2">
            {DOC_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-paper">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
