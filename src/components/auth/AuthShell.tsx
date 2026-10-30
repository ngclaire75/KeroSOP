"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui";
import { CatCloud, type AuthMode } from "@/components/auth/CatCloud";
import { DotRipple } from "@/components/auth/DotRipple";
import { BlurText, Heading } from "@/components/BlurText";

const COPY: Record<
  AuthMode,
  { lines: string[]; tag: string; switchTo: { question: string; label: string; href: string } }
> = {
  login: {
    lines: ["Good to see", "you again."],
    tag: "01 / Log in",
    switchTo: { question: "Don’t have an account?", label: "Sign up", href: "/signup" },
  },
  signup: {
    lines: ["Two pages.", "One conflict."],
    tag: "02 / Sign up",
    switchTo: { question: "Already have an account?", label: "Log in", href: "/login" },
  },
};

/**
 * Shared frame for /login and /signup. It stays mounted while you switch
 * between them, so the three.js cloud on the left morphs from one shape to
 * the other instead of reloading.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const mode: AuthMode = usePathname()?.startsWith("/signup") ? "signup" : "login";
  const copy = COPY[mode];

  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
      {/* Art panel: a band across the top on phones, a framed column on desktop. */}
      <aside className="on-dark relative h-[clamp(260px,40svh,380px)] overflow-hidden rounded-b-[28px] bg-ink text-paper lg:sticky lg:top-3 lg:m-3 lg:h-[calc(100dvh-24px)] lg:rounded-[28px]">
        <CatCloud mode={mode} className="absolute inset-0" />
        <div aria-hidden="true" className="grain pointer-events-none absolute inset-0" />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center p-4 sm:p-6 lg:p-8">
          <Link href="/" aria-label="KeroSOP home" className="pointer-events-auto">
            <Logo tone="paper" className="block h-7 w-auto" />
          </Link>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden p-8 lg:block xl:p-12">
          {/* Same word-by-word focus-in as the landing page; keyed by mode so it replays on switch. */}
          <BlurText
            key={`tag-${mode}`}
            blur={0}
            tint="rgba(255,255,255,0)"
            className="mb-5 font-mono text-[12px] tracking-[0.18em] text-paper/55 uppercase"
          >
            {copy.tag}
          </BlurText>
          <Heading
            key={`h-${mode}`}
            className="text-[clamp(3rem,5.4vw,5.6rem)]"
            lines={[
              copy.lines[0],
              <span key="red" className="text-red">
                {copy.lines[1]}
              </span>,
            ]}
          />
          <p className="mt-3 text-[16px] text-paper/60">
            {copy.switchTo.question}{" "}
            <Link
              href={copy.switchTo.href}
              scroll={false}
              className="pointer-events-auto font-semibold text-paper underline decoration-paper/30 underline-offset-4 transition-colors hover:text-red hover:decoration-red"
            >
              {copy.switchTo.label}
            </Link>
          </p>
        </div>
      </aside>

      <main className="relative flex min-h-[calc(100dvh-clamp(260px,40svh,380px))] flex-col overflow-hidden lg:h-dvh lg:min-h-0">
        <DotRipple className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(120%_90%_at_50%_45%,black_35%,transparent_100%)]" />

        {/* Desktop: the form sits centred and the footer stays pinned; if a form is ever taller than the window, only this area scrolls. */}
        <div className="relative flex flex-1 flex-col items-center px-4 pt-12 pb-10 sm:px-8 lg:min-h-0 lg:overflow-y-auto lg:py-10">
          <div className="w-full max-w-[440px] lg:my-auto">{children}</div>
        </div>

        <footer className="relative flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 pb-6 text-[12px] text-mute sm:px-8">
          <span>© 2026 KeroSOP</span>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link href="/help" className="hover:text-ink">
              Help
            </Link>
          </span>
        </footer>
      </main>
    </div>
  );
}
