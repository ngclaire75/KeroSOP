"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Container, Logo } from "@/components/ui";
import { MobileMenu } from "@/components/landing/MobileMenu";

const links = [
  { href: "#checks", label: "Platform" },
  { href: "#how", label: "Workflow" },
  { href: "#governance", label: "Governance" },
  { href: "#solutions", label: "Solutions" },
  { href: "#pricing", label: "Pricing" },
];

/**
 * Sticky header: transparent at the top of the page, a solid dark bar once
 * scrolled. A soft indicator slides behind the hovered link and otherwise
 * rests on the section currently in view.
 */
export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [pill, setPill] = useState({ x: 0, w: 0, on: false });
  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const menuButton = useRef<HTMLButtonElement>(null);

  // Once the page scrolls, the header turns into a solid dark bar.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scrollspy: which linked section sits across the middle of the viewport.
  useEffect(() => {
    const targets = links
      .map((l, i) => ({ i, el: document.querySelector<HTMLElement>(l.href) }))
      .filter((t): t is { i: number; el: HTMLElement } => !!t.el);
    const visible = new Set<number>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const i = targets.find((t) => t.el === e.target)!.i;
          if (e.isIntersecting) visible.add(i);
          else visible.delete(i);
        });
        setCurrent(visible.size ? Math.min(...visible) : null);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    targets.forEach((t) => io.observe(t.el));
    return () => io.disconnect();
  }, []);

  // Place the sliding pill under the hovered link, else the current section.
  const target = hover ?? current;
  useEffect(() => {
    const place = () => {
      const el = target === null ? null : linkRefs.current[target];
      const nav = navRef.current;
      if (!el || !nav) return setPill((p) => ({ ...p, on: false }));
      setPill({ x: el.offsetLeft, w: el.offsetWidth, on: true });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [target]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      menuButton.current?.focus();
    };
    // The menu is mobile only: rotating or resizing up to desktop closes it.
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = () => wide.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  const close = () => setOpen(false);
  const onColour = scrolled || open;
  const pillColour = onColour ? "bg-white/12" : "bg-ink/[0.06]";

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,color] duration-300 ${
          open ? "bg-transparent text-paper" : onColour ? "bg-[#141414] text-paper" : "bg-transparent text-ink"
        }`}
      >
        <Container>
          <div>
            <div className="grid h-[68px] grid-cols-[1fr_auto_1fr] items-center gap-4">
              <a
                href="#top"
                aria-label="KeroSOP home"
                onClick={close}
                className="flex h-full items-center justify-self-start"
              >
                <Logo tone={onColour ? "paper" : "ink"} className="block h-7 w-auto" />
              </a>

              <nav
                ref={navRef}
                aria-label="Main"
                className="relative col-start-2 hidden items-center lg:flex"
                onMouseLeave={() => setHover(null)}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-0 left-0 h-full rounded-full transition-[transform,width,opacity,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${pillColour}`}
                  style={{
                    transform: `translateX(${pill.x}px)`,
                    width: pill.w,
                    opacity: pill.on ? 1 : 0,
                  }}
                />
                {links.map((l, i) => {
                  const lit = i === target;
                  return (
                    <a
                      key={l.href}
                      ref={(el) => {
                        linkRefs.current[i] = el;
                      }}
                      href={l.href}
                      aria-current={i === current ? "location" : undefined}
                      onMouseEnter={() => setHover(i)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                      className={`relative rounded-full px-4 py-2 text-[15px] font-medium tracking-[-0.005em] transition-colors duration-200 ${
                        lit ? (onColour ? "text-paper" : "text-ink") : onColour ? "text-paper/70" : "text-ink/60"
                      }`}
                    >
                      {l.label}
                    </a>
                  );
                })}
              </nav>

              <div className="col-start-3 hidden shrink-0 items-center gap-2 justify-self-end lg:flex">
                <a
                  href="#signin"
                  className={`rounded-full px-4 py-2 text-[15px] font-medium transition-colors ${
                    onColour ? "text-paper/75 hover:text-paper" : "text-ink/65 hover:text-ink"
                  }`}
                >
                  Log in
                </a>
                <Button href="#book" size="sm" variant={onColour ? "white" : "black"}>
                  Book a sample audit
                </Button>
              </div>

              <button
                ref={menuButton}
                type="button"
                className="col-start-3 -mr-3 inline-flex size-11 items-center justify-center justify-self-end rounded-full lg:hidden"
                aria-expanded={open}
                aria-controls="mobile-menu"
                aria-label={open ? "Close menu" : "Open menu"}
                onClick={() => setOpen((o) => !o)}
              >
                <span className="relative block h-3 w-5" aria-hidden="true">
                  <span
                    className={`absolute left-0 h-[2px] w-5 bg-current transition-transform duration-200 ${
                      open ? "top-[5px] rotate-45" : "top-0"
                    }`}
                  />
                  <span
                    className={`absolute left-0 h-[2px] w-5 bg-current transition-transform duration-200 ${
                      open ? "top-[5px] -rotate-45" : "top-[10px]"
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>
        </Container>
      </header>

      <MobileMenu open={open} onClose={close} links={links} current={current} />
    </>
  );
}
