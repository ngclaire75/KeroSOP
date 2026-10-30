"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui";
import { MenuField } from "@/components/three/MenuField";
import { prefersReducedMotion } from "@/lib/random";

type Link = { href: string; label: string };

/* Circle wipe out of the menu button (26px from the right, 34px from the top). */
const CLIP_OPEN = "circle(150vmax at calc(100% - 26px) 34px)";
const CLIP_SHUT = "circle(0px at calc(100% - 26px) 34px)";
const EASE = "cubic-bezier(0.76,0,0.24,1)";

const pad = (n: number) => String(n).padStart(2, "0");

const lockPage = (locked: boolean) => {
  document.documentElement.style.overflow = locked ? "hidden" : "";
  if (locked) window.__lenis?.stop();
  else window.__lenis?.start();
};

/**
 * Full-screen mobile menu. A three.js dot matrix sweeps out of the menu
 * button and the links rise in one after another; the link under your
 * finger slides out. Scrolling behind it is locked while open.
 */
export function MobileMenu({
  open,
  onClose,
  links,
  current,
}: {
  open: boolean;
  onClose: () => void;
  links: Link[];
  current: number | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [pick, setPick] = useState<number | null>(null);
  const closing = useRef(!open);
  const firstLink = useRef<HTMLAnchorElement>(null);

  // Mount, then open on the next frame so the wipe has a start state; on
  // close, play the wipe backwards before unmounting.
  useEffect(() => {
    closing.current = !open;
    let inner = 0;
    const id = requestAnimationFrame(() => {
      if (open) {
        setPick(null);
        setMounted(true);
        inner = requestAnimationFrame(() => setShown(true));
      } else setShown(false);
    });
    const t = open ? 0 : window.setTimeout(() => setMounted(false), prefersReducedMotion() ? 0 : 750);
    return () => {
      cancelAnimationFrame(id);
      cancelAnimationFrame(inner);
      window.clearTimeout(t);
    };
  }, [open]);

  // Lock the page underneath while open.
  useEffect(() => {
    if (!open) return;
    lockPage(true);
    return () => lockPage(false);
  }, [open]);

  useEffect(() => {
    if (shown) firstLink.current?.focus({ preventScroll: true });
  }, [shown]);

  // Close first, then glide to the section while the wipe retracts.
  const go = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    onClose();
    lockPage(false);
    const lenis = window.__lenis;
    if (lenis) {
      lenis.scrollTo(href, { offset: -88, duration: 1.2 });
    } else {
      const el = document.querySelector<HTMLElement>(href);
      if (el)
        window.scrollTo({
          top: el.getBoundingClientRect().top + window.scrollY - 88,
          behavior: "smooth",
        });
    }
    history.replaceState(null, "", href);
  };

  if (!mounted) return null;

  const rise = (i: number) => ({
    transform: shown ? "translateY(0)" : "translateY(105%)",
    transition: `transform 0.8s ${EASE} ${shown ? 0.18 + i * 0.06 : 0}s`,
  });

  return (
    <div
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-[#0a0a0a] text-paper lg:hidden"
      style={{
        clipPath: shown ? CLIP_OPEN : CLIP_SHUT,
        transition: `clip-path 0.75s ${EASE}`,
      }}
    >
      <MenuField closing={closing} className="pointer-events-none fixed inset-0" />

      <div className="relative flex min-h-full flex-col px-4 pt-[92px] pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
        <div
          className="flex items-center justify-between border-b border-paper pb-3 text-xs font-semibold tracking-[0.14em] text-paper uppercase"
          style={{ opacity: shown ? 1 : 0, transition: "opacity 0.4s 0.15s" }}
        >
          <span>Menu</span>
          <span>
            <span lang="zh-Hans">中文</span> / EN
          </span>
        </div>

        <nav
          aria-label="Mobile"
          className="mt-4"
          onPointerMove={(e) => {
            const a = (e.target as Element).closest<HTMLElement>("[data-idx]");
            if (a) setPick(Number(a.dataset.idx));
          }}
        >
          <ol>
            {links.map((l, i) => {
              const here = i === current;
              return (
                <li key={l.href} className="overflow-hidden border-b border-paper">
                  <a
                    ref={i === 0 ? firstLink : undefined}
                    href={l.href}
                    data-idx={i}
                    onClick={(e) => go(e, l.href)}
                    onFocus={() => setPick(i)}
                    aria-current={here ? "location" : undefined}
                    className="group grid grid-cols-[2.25rem_1fr_auto] items-center py-2.5 outline-none"
                    style={rise(i)}
                  >
                    <span className="text-sm text-paper tabular-nums">{pad(i + 1)}</span>
                    <span
                      className={`display text-[clamp(2.6rem,12.5vw,4.25rem)] leading-[1] transition-transform duration-300 group-hover:translate-x-2 group-data-[hover]:translate-x-2 ${
                        i === pick ? "translate-x-2" : ""
                      }`}
                    >
                      {l.label}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`size-2.5 rounded-full ${here ? "bg-red" : ""}`}
                    />
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        <div
          className="mt-auto grid gap-2 pt-10"
          style={{
            opacity: shown ? 1 : 0,
            transform: shown ? "none" : "translateY(24px)",
            transition: `transform 0.8s ${EASE} ${shown ? 0.55 : 0}s, opacity 0.5s ${shown ? 0.55 : 0}s`,
          }}
        >
          <Button href="#book" variant="white" className="w-full" onClick={(e) => go(e, "#book")}>
            Book a sample audit
          </Button>
          <Button href="/signup" variant="outline-light" className="w-full" onClick={onClose}>
            Sign up / Log in
          </Button>
        </div>
      </div>
    </div>
  );
}
