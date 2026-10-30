"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import Link from "next/link";
import { sendAuth } from "@/lib/authEvents";
import { prefersReducedMotion } from "@/lib/random";

const anime = () => import("animejs");

/* ---------- caret ripple ---------- */

let measurer: CanvasRenderingContext2D | null = null;

/** Tell the dot field where the caret is, so a ripple can start there. */
function rippleFromCaret(input: HTMLInputElement) {
  measurer ??= document.createElement("canvas").getContext("2d");
  if (!measurer) return;
  const cs = getComputedStyle(input);
  measurer.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const upto = input.value.slice(0, input.selectionStart ?? input.value.length);
  const text = input.type === "password" ? "•".repeat(upto.length) : upto;
  const r = input.getBoundingClientRect();
  const x = r.left + parseFloat(cs.paddingLeft) + measurer.measureText(text).width - input.scrollLeft;
  sendAuth({ type: "key", x: Math.min(x, r.right - 12), y: r.top + r.height * 0.64 });
}

/* ---------- text field ---------- */

export type FieldHandle = { focus(): void };

type FieldProps = Omit<ComponentProps<"input">, "ref"> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  trailing?: ReactNode;
};

/** Floating-label input. The label rests inside the box and lifts once there is text or focus. */
export const Field = forwardRef<FieldHandle, FieldProps>(function Field(
  { label, error, hint, trailing, className = "", onInput, ...props },
  handle,
) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(handle, () => ({ focus: () => input.current?.focus() }));

  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <div className="group relative rounded-2xl border border-line bg-paper">
        <input
          ref={input}
          id={id}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onInput={(e) => {
            rippleFromCaret(e.currentTarget);
            onInput?.(e);
          }}
          className={`peer block h-[60px] w-full rounded-2xl bg-transparent pt-[22px] pb-1.5 pl-4 text-[16px] text-ink outline-none placeholder:text-transparent auth-input ${
            trailing ? "pr-14" : "pr-4"
          }`}
          {...props}
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute top-[20px] left-4 origin-left text-[13px] font-semibold tracking-[0.08em] text-mute uppercase transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] peer-focus:-translate-y-[11px] peer-focus:scale-[0.8] peer-[:not(:placeholder-shown)]:-translate-y-[11px] peer-[:not(:placeholder-shown)]:scale-[0.8]"
        >
          {label}
        </label>
        {trailing && <div className="absolute top-1/2 right-2 -translate-y-1/2">{trailing}</div>}
      </div>
      {error ? (
        <p id={`${id}-err`} className="mt-2 pl-1 text-[13px] font-medium text-red">
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="mt-2 pl-1 text-[13px] text-mute">
          {hint}
        </div>
      ) : null}
    </div>
  );
});

/* ---------- password ---------- */

/** 0–4: length, mixed case, digits, symbols, and length again past 14. */
export function passwordScore(pw: string) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (pw.length >= 14) s++;
  return Math.min(4, pw.length < 8 ? Math.min(1, s) : s);
}

const STRENGTH = ["Too short", "Weak", "Fair", "Strong", "Very strong"];

/** A dot-matrix meter: 4 groups of 5 dots that pop in as the password gets stronger. */
function StrengthMeter({ score }: { score: number }) {
  const row = useRef<HTMLDivElement>(null);
  const last = useRef(0);
  useEffect(() => {
    const el = row.current;
    if (!el || score <= last.current || prefersReducedMotion()) {
      last.current = score;
      return;
    }
    const fresh = Array.from(el.querySelectorAll<HTMLElement>("[data-dot]")).slice(last.current * 5, score * 5);
    last.current = score;
    anime().then(({ animate, stagger, spring }) =>
      animate(fresh, { scale: [0.2, 1], delay: stagger(22), ease: spring({ bounce: 0.55, duration: 380 }) }),
    );
  }, [score]);

  const tone = score <= 1 ? "bg-red" : score === 2 ? "bg-ink/70" : "bg-ink";
  return (
    <div className="flex items-center justify-between gap-3">
      <div ref={row} className="flex gap-[7px]" aria-hidden="true">
        {Array.from({ length: 4 }, (_, g) => (
          <div key={g} className="flex gap-[3px]">
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                data-dot
                className={`size-[6px] rounded-full transition-colors duration-200 ${g < score ? tone : "bg-line"}`}
              />
            ))}
          </div>
        ))}
      </div>
      <span className={`text-[12px] font-semibold tracking-wide uppercase ${score <= 1 ? "text-red" : "text-ink"}`}>
        {STRENGTH[score]}
      </span>
    </div>
  );
}

type PasswordProps = Omit<FieldProps, "type" | "trailing" | "hint"> & { meter?: boolean; value: string };

/**
 * Password field with a show / hide toggle. While it has focus, the cat on the
 * left puts its shades on.
 */
export const PasswordField = forwardRef<FieldHandle, PasswordProps>(function PasswordField(
  { meter, value, onFocus, onBlur, ...props },
  handle,
) {
  const [shown, setShown] = useState(false);
  useEffect(() => () => sendAuth({ type: "privacy", on: false }), []);
  return (
    <Field
      ref={handle}
      type={shown ? "text" : "password"}
      value={value}
      onFocus={(e) => {
        sendAuth({ type: "privacy", on: true });
        onFocus?.(e);
      }}
      onBlur={(e) => {
        sendAuth({ type: "privacy", on: false });
        onBlur?.(e);
      }}
      hint={meter && value ? <StrengthMeter score={passwordScore(value)} /> : undefined}
      trailing={
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          // Keep focus (and the shades) on the input when the toggle is clicked.
          onMouseDown={(e) => e.preventDefault()}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="inline-flex size-11 items-center justify-center rounded-xl text-mute transition-colors hover:bg-fog hover:text-ink"
        >
          <EyeIcon open={shown} />
        </button>
      }
      {...props}
    />
  );
});

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 20 20 4" strokeLinecap="round" />}
    </svg>
  );
}

/* ---------- checkbox ---------- */

export function Check({
  checked,
  onChange,
  children,
  error,
}: {
  checked: boolean;
  onChange(v: boolean): void;
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <label className="group flex cursor-pointer items-center gap-3 text-[14px] leading-[1.45] text-mute select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={error || undefined}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`grid size-[20px] shrink-0 place-items-center rounded-[6px] border transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-red ${
          checked ? "border-ink bg-ink" : error ? "border-red" : "border-ink/25 group-hover:border-ink/60"
        }`}
      >
        <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="white" strokeWidth="2.4">
          <path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="14"
            strokeDashoffset={checked ? 0 : 14}
            style={{ transition: "stroke-dashoffset 220ms cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>
      </span>
      <span className={error ? "text-red" : ""}>{children}</span>
    </label>
  );
}

/* ---------- submit ---------- */

export type SubmitState = "idle" | "busy" | "done";

/**
 * Red pill. While busy, three dots bounce (anime.js); once done it turns
 * black and draws a tick.
 */
export function Submit({ state, children, done }: { state: SubmitState; children: ReactNode; done: string }) {
  const dots = useRef<HTMLSpanElement>(null);
  const tick = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let run: { cancel(): unknown } | undefined;
    let live = true;
    anime().then(({ animate, stagger }) => {
      if (!live) return;
      if (state === "busy" && dots.current)
        run = animate(dots.current.children, {
          translateY: [0, -5, 0],
          opacity: [0.45, 1, 0.45],
          duration: 720,
          delay: stagger(120),
          loop: true,
          ease: "inOutSine",
        });
      if (state === "done" && tick.current)
        run = animate(tick.current, { strokeDashoffset: [20, 0], duration: 520, delay: 80, ease: "outQuart" });
    });
    return () => {
      live = false;
      run?.cancel();
    };
  }, [state]);

  return (
    <button
      type="submit"
      disabled={state !== "idle"}
      aria-busy={state === "busy"}
      className={`relative inline-flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-full text-[16px] font-semibold text-paper transition-[background-color,transform] duration-300 active:scale-[0.985] disabled:cursor-default ${
        state === "done" ? "bg-ink" : "bg-red hover:bg-red-deep"
      }`}
    >
      {state === "idle" && children}
      {state === "busy" && <span className="sr-only">Working…</span>}
      {state === "busy" && (
        <span ref={dots} className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} aria-hidden="true" className="size-[7px] rounded-full bg-paper" />
          ))}
        </span>
      )}
      {state === "done" && (
        <>
          <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
            <path
              ref={tick}
              d="M4.5 10.5 8.5 14.5 15.5 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="20"
            />
          </svg>
          {done}
        </>
      )}
    </button>
  );
}

/* ---------- switch ---------- */

/**
 * "Already have an account? Log in" under the form. Phones only: on desktop
 * the same link sits on the dark panel under the headline.
 */
export function SwitchPrompt({ question, label, href }: { question: string; label: string; href: string }) {
  return (
    <p className="text-center text-[15px] text-mute lg:hidden">
      {question}{" "}
      <Link
        href={href}
        scroll={false}
        className="font-semibold text-ink underline decoration-ink/25 underline-offset-4 transition-colors hover:decoration-red hover:text-red"
      >
        {label}
      </Link>
    </p>
  );
}

/* ---------- entrance ---------- */

/**
 * Children fade in one after another (anime.js) each time the form is shown,
 * including when Next brings a kept page back into view.
 */
export function Stagger({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.dataset.revealed = "1";
      return;
    }
    let run: { cancel(): unknown; revert?(): unknown } | undefined;
    let live = true;
    anime().then(({ animate, stagger }) => {
      if (!live) return;
      el.dataset.revealed = "1";
      run = animate(el.children, {
        // Opacity only: moving text re-rasterises it on sub-pixels, which reads as jitter.
        opacity: [0, 1],
        duration: 700,
        delay: stagger(60, { start: 60 }),
        ease: "outQuad",
        onComplete: () => Array.from(el.children as HTMLCollectionOf<HTMLElement>).forEach((c) => (c.style.opacity = "")),
      });
    });
    return () => {
      live = false;
      run?.cancel();
      delete el.dataset.revealed;
    };
  }, []);
  return (
    <div ref={ref} data-stagger className={className}>
      {children}
    </div>
  );
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
