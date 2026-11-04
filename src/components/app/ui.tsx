"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import { appHref, isAppPageEnabled } from "@/lib/app/nav";
import type { FindingType, Risk, Status } from "@/lib/app/types";
import { RISK_NAME, STATUS_LABEL, TYPE_LABEL } from "@/lib/app/types";
import { prefersReducedMotion } from "@/lib/random";
import { Icon } from "./icons";

/* ---------- formatting ---------- */

export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
export const fmtDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";
export function ago(iso?: string) {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(iso);
}
/** Workspace names without the "(demo)" suffix older sample workspaces were saved with. */
export const orgName = (name: string) => name.replace(/\s*\(demo\)\s*$/i, "");
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

/* ---------- links and buttons ---------- */

export function AppLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  if (!isAppPageEnabled(href)) {
    return <span role="link" aria-disabled="true" className={`${props.className ?? ""} cursor-not-allowed`} style={props.style} title={props.title} onPointerMove={props.onPointerMove} onPointerLeave={props.onPointerLeave}>{props.children}</span>;
  }
  return <Link href={appHref(href)} {...props} />;
}

type BtnVariant = "red" | "ink" | "outline" | "ghost" | "danger";
const BTN: Record<BtnVariant, string> = {
  red: "bg-red text-white hover:bg-red-deep",
  ink: "bg-ink text-paper hover:bg-red",
  outline: "border border-line bg-paper text-ink hover:border-ink/40",
  ghost: "text-ink underline-offset-4 hover:underline",
  danger: "border border-red/30 bg-paper text-red hover:border-red",
};

export function btnClass(variant: BtnVariant = "outline", size: "sm" | "md" = "md") {
  return `inline-flex shrink-0 items-center justify-center gap-2 rounded-[8px] font-semibold whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${
    size === "sm" ? "h-9 px-3.5 text-[13px]" : "h-10 px-4.5 text-[14px]"
  } ${BTN[variant]}`;
}

export function Btn({
  variant = "outline",
  size = "md",
  icon,
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { variant?: BtnVariant; size?: "sm" | "md"; icon?: string }) {
  return (
    <button type="button" className={`${btnClass(variant, size)} ${className}`} {...props}>
      {icon && <Icon name={icon} className="size-4" />}
      {children}
    </button>
  );
}

export function BtnLink({
  variant = "outline",
  size = "md",
  icon,
  className = "",
  children,
  href,
}: {
  variant?: BtnVariant;
  size?: "sm" | "md";
  icon?: string;
  className?: string;
  children: ReactNode;
  href: string;
}) {
  return (
    <AppLink href={href} className={`${btnClass(variant, size)} ${className}`}>
      {icon && <Icon name={icon} className="size-4" />}
      {children}
    </AppLink>
  );
}

/* ---------- surfaces ---------- */

/** Shared light palette for dashboard cards and tables. */
export const SURFACE_STYLE = {
  "--ink": "#171717",
  "--paper": "#ffffff",
  "--fog": "#f5f5f4",
  "--line": "#e5e5e3",
  "--mute": "#62625f",
  "--red-deep": "#b8000d",
  background: "#ffffff",
  color: "#171717",
  border: "1px solid #e5e5e3",
  borderRadius: 10,
} as CSSProperties;
/** Light table headers and alternating rows keep dense data easy to scan. */
export const TABLE_LOOK =
  "[&_thead_th]:bg-fog [&_thead_th]:text-mute [&_thead_th]:rounded-none [&_tbody_tr:nth-child(even)>td]:bg-fog/60";
/** One item in a list of separate cards inside a surface. */
export const TILE_STYLE: CSSProperties = { background: "#ffffff", borderRadius: 0 };

export function Card({ className = "", children, style, ...props }: ComponentProps<"section">) {
  return (
    <section className={`surface min-w-0 ${TABLE_LOOK} ${className}`} style={{ ...SURFACE_STYLE, ...style }} {...props}>
      {children}
    </section>
  );
}

export function CardHead({ title, hint, action, className = "" }: { title: string; hint?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <header className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold tracking-[-0.005em]">{title}</h2>
        {hint && <p className="mt-0.5 text-[13px] leading-[1.45] text-mute">{hint}</p>}
      </div>
      {action}
    </header>
  );
}

export function PageHeader({
  title,
  intro,
  actions,
  eyebrow,
}: {
  title: string;
  intro?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="flex flex-col gap-4 pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 font-mono text-[11px] tracking-[0.18em] text-mute uppercase">{eyebrow}</p>}
        <h1 className="text-[36px] leading-[1.2] font-bold tracking-[-0.035em]">{title}</h1>
        {intro && <p className="mt-2 max-w-[640px] text-[13px] leading-[1.5] text-mute">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Empty({ icon = "doc", title, body, action }: { icon?: string; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-fog text-ink">
        <Icon name={icon} className="size-5" />
      </span>
      <h3 className="mt-4 text-[16px] font-bold">{title}</h3>
      <p className="mt-1.5 max-w-[380px] text-[14px] leading-[1.5] text-mute">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------- badges ---------- */

/** All label badges share a solid black container and fully white text. */
export const STATUS_PILL = "inline-flex h-6 items-center rounded-full bg-black px-2.5 text-[12px] font-semibold whitespace-nowrap text-white";

export function RiskBadge({ risk }: { risk: Risk }) {
  return <span className={`${STATUS_PILL} capitalize`}>{RISK_NAME[risk]}</span>;
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={STATUS_PILL}>{STATUS_LABEL[status]}</span>;
}

export function TypeBadge({ type }: { type: FindingType }) {
  return <span className={STATUS_PILL}>{TYPE_LABEL[type]}</span>;
}

export function Chip({ children }: { children: ReactNode; tone?: "fog" | "ink" | "red" | "green" | "amber" }) {
  return <span className={STATUS_PILL}>{children}</span>;
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-ink font-semibold text-paper"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/** Text with one phrase marked, used for citations. */
export function Marked({ text, mark, className = "" }: { text: string; mark?: string; className?: string }) {
  if (!mark) return <span className={className}>{text}</span>;
  const i = text.indexOf(mark);
  if (i < 0) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {text.slice(0, i)}
      <mark className="rounded-[4px] bg-red px-1 font-semibold text-paper">{mark}</mark>
      {text.slice(i + mark.length)}
    </span>
  );
}

/* ---------- form fields ---------- */

const FIELD =
  "w-full rounded-[12px] border border-line bg-paper px-3.5 text-[14px] text-ink outline-none transition-colors placeholder:text-mute/70 hover:border-ink/30 focus:border-ink";

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-semibold">
      {children}
      {hint && <span className="text-[12px] font-normal text-mute">{hint}</span>}
    </label>
  );
}

export function Input({ label, hint, className = "", ...props }: ComponentProps<"input"> & { label?: string; hint?: string }) {
  const id = useId();
  return (
    <div className={className}>
      {label && <Label htmlFor={id} hint={hint}>{label}</Label>}
      <input id={id} className={`${FIELD} h-10`} {...props} />
    </div>
  );
}

export function Textarea({ label, hint, className = "", ...props }: ComponentProps<"textarea"> & { label?: string; hint?: string }) {
  const id = useId();
  return (
    <div className={className}>
      {label && <Label htmlFor={id} hint={hint}>{label}</Label>}
      <textarea id={id} className={`${FIELD} min-h-[96px] py-2.5 leading-[1.5]`} {...props} />
    </div>
  );
}

export function Select({
  label,
  options,
  className = "",
  ...props
}: ComponentProps<"select"> & { label?: string; options: (string | { value: string; label: string })[] }) {
  const id = useId();
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  // a native select cuts long text off (Safari never shows an ellipsis), so the chosen label is drawn on top, ending in "…"
  const [own, setOwn] = useState(String(props.defaultValue ?? items[0]?.value ?? ""));
  const current = props.value !== undefined ? String(props.value) : own;
  const shown = items.find((o) => o.value === current)?.label ?? "";
  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-9 left-0 flex items-center truncate px-3.5 text-[14px]">
          <span className="truncate">{shown}</span>
        </span>
        <select
          id={id}
          className={`${FIELD} h-10 appearance-none pr-9 text-transparent! [&>option]:text-ink`}
          {...props}
          onChange={(e) => {
            setOwn(e.target.value);
            props.onChange?.(e);
          }}
        >
          {options.map((o) =>
            typeof o === "string" ? (
              <option key={o} value={o}>
                {o}
              </option>
            ) : (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ),
          )}
        </select>
        <Icon name="down" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-mute" />
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search", className = "" }: { value: string; onChange(v: string): void; placeholder?: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mute" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`${FIELD} h-10 pl-9`}
      />
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange(v: boolean): void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-[14px] font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] leading-[1.45] text-mute">{hint}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-red ${checked ? "bg-ink" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-paper shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
    </label>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange(v: NoInfer<T>): void; tabs: { id: NoInfer<T>; label: string; count?: number }[] }) {
  return (
    <div className="max-w-full self-start overflow-x-auto">
      <div role="tablist" className="flex w-max items-center gap-1 rounded-full border border-line bg-paper p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={value === t.id}
            onClick={() => onChange(t.id)}
            className={`h-8 shrink-0 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${value === t.id ? "bg-ink text-paper" : "text-mute hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- overlays ---------- */

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

function useEnter(open: boolean, from: Record<string, [number | string, number | string]>) {
  const ref = useRef<HTMLDivElement>(null);
  const fromRef = useRef(from);
  useEffect(() => {
    if (!open || !ref.current || prefersReducedMotion()) return;
    const el = ref.current;
    // once in place, drop the leftover transform so the text inside renders on whole pixels and stays still
    import("animejs").then(({ animate }) => animate(el, { ...fromRef.current, duration: 420, ease: "outQuart", onComplete: () => el.style.removeProperty("transform") }));
    el.querySelector<HTMLElement>("[data-autofocus], input, textarea, select, button")?.focus();
  }, [open]);
  return ref;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  fullOnMobile,
}: {
  open: boolean;
  onClose(): void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** On phones, take the whole screen instead of rising as a sheet. */
  fullOnMobile?: boolean;
}) {
  useEscape(open, onClose);
  const ref = useEnter(open, { opacity: [0, 1], translateY: [16, 0] });
  // close only when the whole click happens on the backdrop, not when a press or drag merely ends there
  const downOnBackdrop = useRef(false);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => downOnBackdrop.current && e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex w-full flex-col overflow-hidden bg-paper shadow-2xl sm:max-h-[92dvh] sm:rounded-[12px] ${fullOnMobile ? "h-dvh max-sm:max-h-none sm:h-auto" : "max-h-[92dvh] rounded-t-[12px]"} ${wide ? "sm:max-w-[860px]" : "sm:max-w-[540px]"}`}
      >
        <header className="flex items-center justify-between gap-4 px-5 pt-5 pb-1">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full" aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 px-5 pt-1 pb-5">{footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose(): void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEscape(open, onClose);
  const ref = useEnter(open, { translateX: [40, 0], opacity: [0, 1] });
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-ink/30 backdrop-blur-[1px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" className="flex h-full w-full max-w-[640px] flex-col bg-paper shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0 text-[17px] font-bold">{title}</div>
          <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full" aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

/* ---------- toasts ---------- */

type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, text, tone }]);
    window.setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 left-4 z-[90] flex flex-col items-center gap-2 sm:left-auto sm:items-end">
        {list.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    const el = ref.current;
    import("animejs").then(({ animate }) => animate(el, { translateY: [18, 0], opacity: [0, 1], duration: 380, ease: "outBack(1.4)", onComplete: () => el.style.removeProperty("transform") }));
  }, []);
  return (
    <div
      ref={ref}
      role="status"
      className={`pointer-events-auto flex max-w-[420px] items-center gap-3 rounded-full px-4 py-2.5 text-[14px] font-semibold shadow-lg ${toast.tone === "ok" ? "bg-ink text-paper" : "bg-red text-paper"}`}
    >
      <Icon name={toast.tone === "ok" ? "check" : "alert"} className="size-4" />
      {toast.text}
    </div>
  );
}

/* ---------- tables ---------- */

export const TH = "px-4 py-3 text-left text-[12px] font-semibold tracking-[0.04em] uppercase whitespace-nowrap";
export const TD = "px-4 py-3.5 align-top text-[14px]";
