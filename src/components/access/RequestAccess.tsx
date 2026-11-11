"use client";

/**
 * Where every new account lands after signing up, laid out like the landing
 * page: sections stacked one after another, with anime.js bringing each
 * section's text and items in as it scrolls into view.
 * Sending the form books a demo: the KeroSOP team is emailed, the company's
 * workspace opens straight away and the browser goes on to the dashboard.
 */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BrandLogo, INTEGRATIONS } from "@/components/app/BrandLogo";
import { Icon } from "@/components/app/icons";
import { BlurText, Heading } from "@/components/BlurText";
import { DocFooter } from "@/components/docs/DocParts";
import { Container, Logo } from "@/components/ui";
import { useOnView } from "@/lib/anim";
import { prefersReducedMotion } from "@/lib/random";
import { api } from "@/lib/app/api";
import { useAuthUser } from "@/lib/app/nav";
import type { Me } from "@/lib/app/types";
import { logOut } from "@/lib/auth";
import { Dropdown } from "./Dropdown";

const SIZES = ["1-49", "50-199", "200-999", "1000-4999", "5000+"].map((s) => ({ value: s, label: `${s} people` }));
const REGIONS = ["Singapore", "Malaysia", "Hong Kong", "Taiwan", "Mainland China", "Indonesia", "Other"].map((r) => ({ value: r, label: r }));
/** Fits the fixed note box on the narrowest phone without scrolling. */
const NOTE_MAX = 180;
const dashboard = () => (window.location.hostname.startsWith("app.") ? "/" : "/app");
const INPUT =
  "quiet-focus h-[52px] w-full rounded-[10px] bg-[#1c1c1c] px-4 text-[15px] text-paper outline-none transition-colors placeholder:text-paper/40 focus:bg-[#262626] focus-visible:outline-none";

/**
 * Children fade in one after another when the group scrolls into view.
 * Opacity only: sliding text sits on sub-pixel positions mid-animation and
 * snaps when it stops, which reads as jitter.
 */
function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useOnView<HTMLDivElement>(
    ({ animate, stagger }, el) => {
      const items = Array.from(el.children as HTMLCollectionOf<HTMLElement>);
      animate(items, {
        opacity: [0, 1],
        duration: 800,
        delay: stagger(90, { start: delay }),
        ease: "outQuad",
        onComplete: () => items.forEach((c) => (c.style.opacity = "")),
      });
    },
    { threshold: 0.15 },
  );
  return (
    <div ref={ref} data-stagger className={className}>
      {children}
    </div>
  );
}

export function RequestAccess() {
  const user = useAuthUser();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", companySize: "", jobTitle: "", region: "", useCase: "" });
  const [langs, setLangs] = useState<string[]>(["English", "中文"]);

  useEffect(() => {
    if (user === null) window.location.replace("/login?next=/request-access");
    if (!user) return;
    api<Me>("/v1/me")
      .then((m) => {
        // Book a demo always shows this page, even for people who already have a workspace;
        // submitting then opens their existing workspace rather than a second one (see the API)
        setMe(m);
        let company = "";
        try {
          company = localStorage.getItem(`kerosop:company:${m.user.email}`) ?? "";
        } catch {}
        setForm((f) => ({ ...f, name: f.name || m.user.name, company: f.company || company }));
      })
      .catch((e) => setError((e as Error).message));
  }, [user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { organization } = await api<{ organization: string }>("/v1/access-requests", { method: "POST", json: { ...form, languages: langs } });
      try {
        localStorage.setItem("kerosop:org", organization);
      } catch {}
      window.location.replace(dashboard());
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const valid = form.name && form.company && form.companySize && form.jobTitle && form.region;

  return (
    <div data-text-scale className="bg-paper">
      <header className="relative z-10">
        <Container>
          <div className="flex h-[76px] items-center justify-between gap-4">
            <Link href="/" aria-label="KeroSOP home">
              <Logo className="block h-7 w-auto" />
            </Link>
            <div className="flex items-center gap-4 text-[length:calc(14px*var(--ts))]">
              <span className="hidden truncate text-mute sm:inline">{me?.user.email}</span>
              <button
                type="button"
                onClick={() => logOut().then(() => window.location.assign("/login"))}
                className="inline-flex h-10 items-center rounded-full bg-ink px-5 font-semibold text-paper hover:bg-red"
              >
                Log out
              </button>
            </div>
          </div>
        </Container>
      </header>

      {/* 1. hero */}
      <section className="pt-12 pb-16 sm:pt-20 sm:pb-24">
        <Container className="text-center">
          <BlurText className="font-mono text-[length:calc(12px*var(--ts))] tracking-[0.18em] text-mute uppercase">Book a demo</BlurText>
          <Heading as="h1" className="mx-auto mt-5 max-w-[980px] text-[length:calc(clamp(3rem,8vw,6.4rem)*var(--ts))]" lines={["See KeroSOP on", <span key="r" className="text-red">your own SOPs.</span>]} />
          <BlurText className="mx-auto mt-6 max-w-[620px] text-[length:calc(17px*var(--ts))] leading-[1.6] text-mute">
            Tell us about your team and your workspace opens straight away. We will also email you to book a 30-minute walkthrough on your own documents.
          </BlurText>
          <Reveal className="mt-9 flex flex-wrap justify-center gap-3" delay={500}>
            <a href="#request" className="inline-flex h-12 items-center rounded-full bg-red px-7 text-[length:calc(15px*var(--ts))] font-semibold text-paper hover:bg-red-deep">
              Book a demo
            </a>
            <a href="#next" className="inline-flex h-12 items-center rounded-full border border-ink/20 bg-paper/80 px-7 text-[length:calc(15px*var(--ts))] font-semibold hover:border-ink">
              How it works
            </a>
          </Reveal>
        </Container>
      </section>

      {/* 2. what you get */}
      <section className="pb-24">
        <Container>
          <Reveal className="grid gap-3 md:grid-cols-3">
            {[
              ["split", "Exact clauses, both sides", "Every finding quotes the two conflicting instructions with document version, section and page."],
              ["sparkle", "English and Chinese", "Policies in one language and SOPs in another are compared clause by clause."],
              ["users", "People decide", "Reviewers confirm, owners fix, approvers publish. Nothing changes in your documents on its own."],
            ].map(([, t, d]) => (
              <div key={t} className="rounded-[17px] bg-fog/70 p-7">
                <Icon name="check" className="size-7 text-red" weight="fill" />
                <p className="mt-5 text-[length:calc(18px*var(--ts))] font-bold">{t}</p>
                <p className="mt-2 text-[length:calc(15px*var(--ts))] leading-[1.6] text-mute">{d}</p>
              </div>
            ))}
          </Reveal>
        </Container>
      </section>

      {/* 3. the form */}
      <section id="request" className="scroll-mt-6 pb-24">
        <Container>
          <div className="on-dark rounded-[22px] bg-[#0b0b0b] px-6 pt-12 pb-6 text-paper sm:p-10 lg:p-14">
            {!me && !error && <p className="py-16 text-center text-[length:calc(15px*var(--ts))] text-paper/60">Checking your account…</p>}
            {error && !me && <p className="py-16 text-center text-[length:calc(15px*var(--ts))] text-red">{error}</p>}

            {me && (
              <form onSubmit={submit} className="flex flex-col gap-10">
                <Reveal className="text-center">
                  <h2 className="display text-[length:calc(clamp(2.6rem,5vw,4rem)*var(--ts))]">Book a demo</h2>
                  <p className="mt-4 text-[length:calc(16px*var(--ts))] leading-[1.6] text-paper/70 sm:whitespace-nowrap">Tell us about your team. It takes a minute, and your workspace opens as soon as you send it.</p>
                  <p className="mt-3 text-[length:calc(13px*var(--ts))] leading-[1.6] text-paper/55">
                    We use these details only to set up your workspace. See our{" "}
                    <Link href="/privacy" className="underline underline-offset-4 hover:text-paper">
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </Reveal>
                <Reveal className="grid gap-5 sm:grid-cols-2" delay={150}>
                  <Field label="Your name">
                    <input className={INPUT} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
                  </Field>
                  <Field label="Job title">
                    <input className={INPUT} required value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} autoComplete="organization-title" placeholder="Head of Operations" />
                  </Field>
                  <Field label="Company" wide>
                    <input className={INPUT} required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} autoComplete="organization" />
                  </Field>
                  <Dropdown dark label="Company size" value={form.companySize} onChange={(v) => setForm({ ...form, companySize: v })} options={SIZES} />
                  <Dropdown dark label="Where your teams are" value={form.region} onChange={(v) => setForm({ ...form, region: v })} options={REGIONS} />
                  <fieldset className="sm:col-span-2">
                    <legend className="mb-2 text-[length:calc(13px*var(--ts))] font-semibold">Document languages</legend>
                    <div className="flex flex-wrap gap-2">
                      {["English", "中文", "繁體中文"].map((l) => (
                        <button
                          key={l}
                          type="button"
                          aria-pressed={langs.includes(l)}
                          onClick={() => setLangs(langs.includes(l) ? langs.filter((x) => x !== l) : [...langs, l])}
                          className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-[length:calc(14px*var(--ts))] font-semibold transition-colors ${langs.includes(l) ? "bg-paper text-ink" : "bg-[#1c1c1c] text-paper/80"}`}
                        >
                          {langs.includes(l) && <Icon name="check" className="size-4" weight="bold" />}
                          {l}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <Field
                    label="What would you like to check first?"
                    hint={
                      <>
                        {form.useCase.length}/{NOTE_MAX}
                        {/* phones show just the count, so the label and counter stay on one line */}
                        <span className="hidden sm:inline"> characters</span>
                      </>
                    }
                    wide
                  >
                    <textarea
                      className={`${INPUT} h-[156px] resize-none overflow-hidden py-3.5 leading-[1.55]`}
                      maxLength={NOTE_MAX}
                      value={form.useCase}
                      onChange={(e) => setForm({ ...form, useCase: e.target.value.slice(0, NOTE_MAX) })}
                      placeholder="e.g. Our refund policy and the Chinese customer service SOPs seem to disagree."
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    {error && <p className="mb-3 text-[length:calc(14px*var(--ts))] text-red">{error}</p>}
                    <button type="submit" disabled={!valid || busy} className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-red text-[length:calc(16px*var(--ts))] font-semibold text-paper transition-colors hover:bg-red-deep disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-red">
                      {busy ? "Opening your workspace…" : "Book a demo"}
                    </button>
                  </div>
                </Reveal>
              </form>
            )}
          </div>
        </Container>
      </section>

      {/* 4. what happens next: full-width black band, three cards */}
      <section id="next" className="on-dark mb-24 scroll-mt-6 bg-[#0b0b0b] py-24 text-paper sm:py-28">
        <Container>
          <div>
            <div className="text-center">
              <p className="font-mono text-[length:calc(12px*var(--ts))] tracking-[0.18em] text-paper/55 uppercase">What happens next</p>
              <h2 className="display mt-4 text-[length:calc(clamp(2.4rem,5vw,3.8rem)*var(--ts))]">Three steps to your first scan</h2>
            </div>
            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              {[
                ["Your workspace opens", "Send the form and you land in your dashboard, ready to upload documents and invite reviewers."],
                ["A 30-minute walkthrough", "We scan a few of your own documents, in English or Chinese, and go through the findings together."],
                ["Find the first conflicts", "Run your first scan and keep every finding, with the exact clauses on both sides."],
              ].map(([t, d], i) => (
                <li key={t} className={`${CARD} p-8`}>
                  <span className={`display text-[length:calc(64px*var(--ts))] ${i === 2 ? "text-red" : "text-paper"}`}>{String(i + 1).padStart(2, "0")}</span>
                  <p className="mt-4 text-[length:calc(18px*var(--ts))] font-bold">{t}</p>
                  <p className="mt-2 text-[length:calc(15px*var(--ts))] leading-[1.6] text-paper/65">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* 5. what you get: dark bento grid */}
      <WhatYouGet />

      {/* 6. closing */}
      <section className="py-24">
        <Container>
          <Reveal>
            <div className="rounded-[22px] bg-ink px-6 py-20 text-center text-paper sm:px-12">
              <h2 className="display text-[length:calc(clamp(2.6rem,6vw,4.8rem)*var(--ts))]">
                Two pages.
                <br />
                <span className="text-red">One conflict.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-[520px] text-[length:calc(16px*var(--ts))] leading-[1.6] text-paper/70">Find it before your customers or your staff do.</p>
              {me && (
                <a href="#request" className="mt-9 inline-flex h-12 items-center rounded-full bg-red px-7 text-[length:calc(15px*var(--ts))] font-semibold text-paper hover:bg-red-deep">
                  Book a demo
                </a>
              )}
            </div>
          </Reveal>
        </Container>
      </section>
      <DocFooter />
    </div>
  );
}

/** Red asterisk badge used for the section eyebrow and the feature chips. */
function Star({ className = "size-5" }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-red text-paper ${className}`} aria-hidden="true">
      <svg viewBox="0 0 16 16" width="12" height="12" className="block" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M8 2v12M2.8 5l10.4 6M2.8 11l10.4-6" />
      </svg>
    </span>
  );
}

const CARD = "relative flex flex-col overflow-hidden rounded-[20px] border border-paper/[0.08] bg-[linear-gradient(180deg,#1b1b1b_0%,#121212_100%)]";
/** Marks whose official colour is near-black are shown in white on the dark tiles. */
const MONO = new Set(["github", "notion", "slack", "confluence"]);
const BARS = [34, 22, 48, 58, 40, 66, 52, 30, 62, 88, 70, 56, 74, 46];

/** Every brand we show, in the order the tiles cycle through them. */
const LOGO_POOL = ["slack", "github", "notion", "googledrive", "zapier", "teams", "n8n", "gmail", "make", "jira", "linear", "confluence", "dropbox", "microsoft365"];
const LOGO_SLOTS = 8;

/** Fades a newly mounted logo in. Opacity only: nothing moves or scales, so nothing shakes. */
const fadeIn = (el: HTMLElement | null) => {
  if (el && !prefersReducedMotion()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: "ease-out" });
};

/**
 * Eight round tiles that never move; every couple of seconds one of them
 * swaps its logo for the next brand that is not on screen. Still for reduced motion.
 */
function RotatingLogos() {
  const [slots, setSlots] = useState(() => LOGO_POOL.slice(0, LOGO_SLOTS));
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let cur = LOGO_POOL.slice(0, LOGO_SLOTS);
    let turn = 0;
    let next = LOGO_SLOTS;
    const order = [2, 5, 0, 7, 3, 4, 1, 6];
    const id = window.setInterval(() => {
      let brand = LOGO_POOL[next % LOGO_POOL.length];
      while (cur.includes(brand)) brand = LOGO_POOL[++next % LOGO_POOL.length];
      next++;
      cur = cur.map((b, i) => (i === order[turn % order.length] ? brand : b));
      turn++;
      setSlots(cur);
    }, 1800);
    return () => window.clearInterval(id);
  }, []);
  return (
    // one permanent compositor layer: a fade never promotes a logo to its own layer and snaps it sideways
    <div className="relative flex flex-1 flex-col gap-3 overflow-hidden px-8 pb-8 [transform:translateZ(0)] sm:-mr-6 sm:px-0 sm:pb-0" aria-label="Integrations">
      {[slots.slice(0, 4), slots.slice(4)].map((row, r) => (
        <div key={r} className={`flex gap-3 ${r ? "sm:translate-x-10" : ""}`}>
          {row.map((b, i) => {
            const it = INTEGRATIONS.find((x) => x.brand === b);
            return (
              <span key={r * 4 + i} title={it?.name} className="grid size-[72px] shrink-0 place-items-center overflow-hidden rounded-full border border-paper/[0.08] bg-[#1a1a1a]">
                <span key={b} ref={fadeIn} className="grid size-8 place-items-center [backface-visibility:hidden] [will-change:opacity]">
                  <BrandLogo brand={b} mono={MONO.has(b)} className={`size-8 ${MONO.has(b) ? "text-paper" : ""}`} />
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function WhatYouGet() {
  const people = [
    ["WL", "ring-red", "/team/wl.jpg"],
    ["DT", "ring-paper", "/team/dt.jpg"],
    ["PN", "ring-[#c9c9c4]", "/team/pn.jpg"],
  ];
  return (
    <section className="on-dark bg-[#0b0b0b] py-24 text-paper sm:py-28">
      <Container>
        <Reveal className="flex flex-col items-center text-center">
          <p className="font-mono text-[length:calc(12px*var(--ts))] tracking-[0.18em] text-paper/55 uppercase">What you get</p>
          <h2 className="display mt-4 max-w-[900px] text-[length:calc(clamp(2.4rem,5vw,3.8rem)*var(--ts))] text-paper">
            We find the conflicts hiding in your SOPs and policies.
          </h2>
        </Reveal>

        <Reveal className="mt-14 grid gap-5 md:grid-cols-3" delay={120}>
          {/* 1. every clause checked: a small findings widget */}
          <article className={CARD}>
            <div className="relative h-[230px] px-8 pt-8">
              <div className="relative h-[182px] rounded-[14px] border border-paper/[0.08] bg-[#191919] p-4" aria-hidden="true">
                <p className="text-[length:calc(14px*var(--ts))] font-semibold text-paper">Findings</p>
                <div className="relative mt-3 flex h-[96px] items-end justify-between gap-1">
                  {BARS.map((h, i) => (
                    <span key={i} className="relative w-[7px] rounded-full bg-[linear-gradient(180deg,#ff5a4f,#e30613)]" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[length:calc(10px*var(--ts))] text-paper/40">
                  <span>3 Nov</span>
                  <span>10 Nov</span>
                  <span>Today</span>
                </div>
              </div>
            </div>
            <div className="mt-auto p-8 pt-6">
              <h3 className="text-[length:calc(22px*var(--ts))] font-medium tracking-[-0.01em]">Every clause checked</h3>
              <p className="mt-2 text-[length:calc(15px*var(--ts))] leading-[1.55] text-paper/55">Policies and SOPs compared clause by clause, in English and Chinese.</p>
            </div>
          </article>

          {/* 2. exact evidence: a new finding arriving on top of a reviewed one */}
          <article className={CARD}>
            <div className="relative h-[230px] px-6 pt-10" aria-hidden="true">
              <div className="mx-auto flex h-11 w-[76%] items-center gap-2 rounded-[10px] border border-paper/[0.08] bg-paper/[0.04] px-4 text-[length:calc(10px*var(--ts))] font-semibold tracking-[0.1em] text-paper/45">
                REVIEWED
              </div>
              <div className="relative -mt-3 flex items-center gap-4 rounded-[13px] border border-paper/[0.1] bg-[#1d1d1d] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                <span className="grid size-[60px] shrink-0 place-items-center rounded-[10px] bg-ink text-paper">
                  <Icon name="alert" className="size-6" weight="fill" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[length:calc(10px*var(--ts))] font-bold tracking-[0.1em] text-red">NEW</span>
                  <span className="mt-0.5 block truncate text-[length:calc(17px*var(--ts))] font-medium">Refund window: 14 vs 30 days</span>
                  <span className="mt-0.5 block text-[length:calc(12px*var(--ts))] text-paper/45">Today, 11:50 · p. 4 and p. 7</span>
                </span>
              </div>
              <div className="mt-6 ml-auto flex w-[70%] flex-col gap-3">
                {[100, 80, 92, 64].map((w, i) => (
                  <span key={i} className="block border-t border-dashed border-red/35" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>
            <div className="mt-auto p-8 pt-6">
              <h3 className="text-[length:calc(22px*var(--ts))] font-medium tracking-[-0.01em]">Exact evidence, both sides</h3>
              <p className="mt-2 text-[length:calc(15px*var(--ts))] leading-[1.55] text-paper/55">Every finding quotes the two instructions with version, section and page.</p>
            </div>
          </article>

          {/* 3. grows with the library: documents checked over six months */}
          <article className={CARD}>
            <div className="relative h-[230px] px-8 pt-8" aria-hidden="true">
              <svg viewBox="0 0 300 190" className="h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="rise" x1="0" x2="1">
                    <stop offset="0" stopColor="#f2a097" />
                    <stop offset="0.5" stopColor="#ec5e52" />
                    <stop offset="1" stopColor="#e30613" />
                  </linearGradient>
                </defs>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <g key={i}>
                    <line x1={10 + i * 56} x2={10 + i * 56} y1="8" y2="160" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 5" />
                    <text x={10 + i * 56} y="184" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="11">
                      {["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"][i]}
                    </text>
                  </g>
                ))}
                <line x1="10" x2="290" y1="160" y2="160" stroke="rgba(255,255,255,0.12)" />
                <path d="M10 150 C 50 148, 80 136, 122 120 S 180 96, 206 72 S 260 30, 290 18" fill="none" stroke="url(#rise)" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <div className="mt-auto p-8 pt-6">
              <h3 className="text-[length:calc(22px*var(--ts))] font-medium tracking-[-0.01em]">Grows with your library</h3>
              <p className="mt-2 text-[length:calc(15px*var(--ts))] leading-[1.55] text-paper/55">Re-scan when a document changes and keep every decision on record.</p>
            </div>
          </article>
        </Reveal>

        <Reveal className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]" delay={200}>
          {/* 4. integrations: official logos in round tiles, running off the edge */}
          <article className={`${CARD} min-h-[220px] sm:flex-row sm:items-center`}>
            <div className="relative z-10 p-8 sm:max-w-[48%]">
              <h3 className="text-[length:calc(22px*var(--ts))] leading-[1.2] font-medium tracking-[-0.01em]">Works with the tools you use</h3>
              <p className="mt-3 text-[length:calc(15px*var(--ts))] leading-[1.55] text-paper/55">Import from GitHub, send alerts to Slack, n8n, Zapier or Make. Drive and SharePoint are next.</p>
            </div>
            <RotatingLogos />
          </article>

          {/* 5. people decide: the reviewers on one finding */}
          <article className={`${CARD} min-h-[220px] sm:flex-row sm:items-center`}>
            <div className="relative z-10 p-8 sm:max-w-[50%]">
              <h3 className="text-[length:calc(22px*var(--ts))] leading-[1.2] font-medium tracking-[-0.01em]">Reviewers decide together</h3>
              <p className="mt-3 text-[length:calc(15px*var(--ts))] leading-[1.55] text-paper/55">Reviewers confirm, owners fix, approvers publish. Nothing changes on its own.</p>
            </div>
            <div className="relative flex flex-1 items-center justify-center px-8 pb-10 sm:pb-0" aria-hidden="true">
              <div className="flex -space-x-3">
                {people.map(([n, ring, src]) => (
                  <span key={n} className={`relative grid size-[62px] place-items-center overflow-hidden rounded-full bg-paper text-[length:calc(16px*var(--ts))] font-semibold text-ink ring-4 ${ring}`}>
                    <Image src={src} alt="" width={124} height={124} className="size-full object-cover" />
                  </span>
                ))}
                <span className="grid size-[62px] place-items-center rounded-full bg-[#1a1a1a] text-[length:calc(18px*var(--ts))] font-semibold text-paper ring-4 ring-red">+4</span>
              </div>
            </div>
          </article>
        </Reveal>

        <Reveal className="mx-auto mt-8 flex max-w-[860px] flex-wrap justify-center gap-3" delay={260}>
          {["English and 简体中文", "繁體中文", "Cited evidence", "Version history", "Approval workflow", "Audit-ready PDF", "Workspace isolation"].map((c) => (
            <span key={c} className="inline-flex h-12 items-center gap-2.5 rounded-[10px] border border-paper/[0.08] bg-[#161616] px-4 text-[length:calc(15px*var(--ts))] text-paper/75">
              <Star />
              {c}
            </span>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}

function Field({ label, children, wide, hint }: { label: string; children: ReactNode; wide?: boolean; hint?: ReactNode }) {
  return (
    <label className={`flex flex-col gap-2 ${wide ? "sm:col-span-2" : ""}`}>
      {/* label and counter share one line: the label truncates before the counter wraps */}
      <span className="flex items-baseline justify-between gap-3 text-[length:calc(13px*var(--ts))] font-semibold">
        <span className="min-w-0 truncate">{label}</span>
        {hint && <span className="shrink-0 font-normal whitespace-nowrap text-paper/50 tabular-nums">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
