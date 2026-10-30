"use client";

import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/random";

type Tag = "h1" | "h2" | "h3" | "p";

/** Wrap each word of a string in a span; non-string nodes count as one word. */
function toWords(node: ReactNode, key: string): ReactNode {
  if (typeof node !== "string") return <span className="w">{node}</span>;
  return node.split(/(\s+)/).map((part, i) =>
    !part ? null : /^\s+$/.test(part) ? (
      <Fragment key={`${key}${i}`}>{part}</Fragment>
    ) : (
      <span key={`${key}${i}`} className="w">
        {part}
      </span>
    ),
  );
}

type RevealOptions = {
  /** Colour the words pass through on their way to their final colour. */
  tint?: string;
  blur?: number;
  step?: number;
  delay?: number;
  /** Kept for API compatibility; text now animates whenever it enters view. */
  immediate?: boolean;
  /**
   * Window event to wait for before the first run, so the text can start with
   * something else (a hero's 3D intro). Falls back after 1.5s if it never fires.
   */
  startOn?: string;
};

/**
 * Word-by-word focus-in, in the spirit of butter.video: each word starts
 * blurred, faded and tinted, then sharpens into its final colour. Words never
 * move: easing a position settles in sub-pixel steps, which reads as jitter. It replays
 * every time the text scrolls back into view: once fully off screen the
 * words quietly reset, ready for the next entrance. Inline styles are
 * cleared after each run so nothing lingers.
 */
function useBlurReveal<E extends HTMLElement>({
  tint = "#e30613",
  blur = 12,
  step = 40,
  delay = 0,
  startOn,
}: RevealOptions) {
  const ref = useRef<E>(null);
  const opts = useRef({ tint, blur, step, delay, startOn });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.dataset.revealed = "1";
      return;
    }
    const { tint, blur, step, delay, startOn } = opts.current;
    // First run waits for the start signal (or a timeout); later entrances play straight away.
    let gate: Promise<void> | null = startOn
      ? new Promise<void>((go) => {
          const done = () => {
            window.removeEventListener(startOn, done);
            go();
          };
          window.addEventListener(startOn, done);
          setTimeout(done, 1500);
        })
      : null;
    const words = Array.from(el.querySelectorAll<HTMLElement>(".w"));
    const final = getComputedStyle(el).color;
    // iOS Safari paints stray magenta slivers between blurred inline words, and
    // a blur per word is costly on phones. Moving words also get their own GPU
    // layer, and iOS re-rasterises the text when that layer is dropped, so the
    // copy visibly snaps once the run ends. Touch screens get a still fade.
    const soft = !window.matchMedia("(hover: none)").matches;
    let anime: Promise<typeof import("animejs")> | null = null;
    let run: { pause: () => unknown } | null = null;
    let inView = false;

    const hide = () =>
      words.forEach((w) => {
        w.style.opacity = "0";
        if (soft) w.style.filter = `blur(${blur}px)`;
        w.style.color = tint;
      });

    const play = async () => {
      anime ??= import("animejs");
      const { animate, stagger } = await anime;
      if (gate) {
        await gate;
        gate = null;
      }
      if (!inView) return;
      hide();
      el.dataset.revealed = "1";
      run = animate(words, {
        opacity: { to: 1 },
        ...(soft ? { filter: { to: "blur(0px)" } } : {}),
        color: { to: final },
        duration: 1100,
        delay: stagger(step, { start: delay }),
        ease: "outQuart",
        onComplete: () => {
          run = null;
          words.forEach((w) => {
            w.style.opacity = "";
            w.style.filter = "";
            w.style.color = "";
          });
        },
      });
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.15) {
          if (!inView) {
            inView = true;
            play();
          }
        } else if (!entry.isIntersecting && inView) {
          // Fully off screen: reset quietly so the next entrance replays.
          inView = false;
          run?.pause();
          run = null;
          hide();
        }
      },
      { threshold: [0, 0.15] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      run?.pause();
      // Back to the CSS-hidden state. Next keeps visited pages and shows them again
      // later; without this the text flashes in full before its entrance replays.
      delete el.dataset.revealed;
      words.forEach((w) => {
        w.style.opacity = "";
        w.style.filter = "";
        w.style.color = "";
      });
    };
  }, []);

  return ref;
}

type HeadingProps = RevealOptions & { lines: ReactNode[]; as?: Tag; className?: string };

/** Display headline: one block per line, words focus in left to right. */
export function Heading({ lines, as: TagName = "h2", className = "", ...opts }: HeadingProps) {
  const ref = useBlurReveal<HTMLHeadingElement>({ step: 55, blur: 14, ...opts });
  return (
    <TagName ref={ref} data-blur className={`display ${className}`}>
      {lines.map((line, i) => (
        <span key={i} className="block">
          {toWords(line, `l${i}-`)}
        </span>
      ))}
    </TagName>
  );
}

type TextProps = RevealOptions & { children: string; as?: Tag; className?: string };

/** Body copy with a softer, quicker version of the same focus-in. */
export function BlurText({ children, as: TagName = "p", className = "", ...opts }: TextProps) {
  const ref = useBlurReveal<HTMLParagraphElement>({ step: 14, blur: 8, delay: 120, ...opts });
  return (
    <TagName ref={ref} data-blur className={className}>
      {toWords(children, "t")}
    </TagName>
  );
}
