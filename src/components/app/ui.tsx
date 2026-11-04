"use client";

import Link from "next/link";
import { limitWords, textWords } from "@/lib/text-limit";
import { usePanelLock } from "@/lib/use-panel-lock";
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
    return <span role="link" aria-disabled="true" className={`${props.className ?? ""} cursor-not-allowed`} style={props.style} title={props.title} onPointerDown={props.onPointerDown} onPointerMove={props.onPointerMove} onPointerLeave={props.onPointerLeave} onClick={props.onClick}>{props.children}</span>;
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
  text = text.replaceAll("S$", "$");
  mark = mark?.replaceAll("S$", "$");
  if (!mark) return <span className={className}>{text}</span>;
  const i = text.indexOf(mark);
  if (i < 0) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {text.slice(0, i)}
      <mark className="rounded-[4px] bg-red px-1 font-semibold text-paper [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">{mark}</mark>
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
  const [ownValue, setOwnValue] = useState(props.defaultValue ?? "");
  const dateValue = String(props.value ?? ownValue);
  return (
    <div className={`min-w-0 ${className}`}>
      {label && <Label htmlFor={id} hint={hint}>{label}</Label>}
      <div className="relative min-w-0">
        {props.type === "date" ? (
          <>
            {/* Keep the native picker; draw its value ourselves so Safari and Chrome align identically. */}
            <input id={id} className="peer block h-10 w-full min-w-0 max-w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" {...props} onClick={(event) => {
              props.onClick?.(event);
              if (!event.defaultPrevented && !props.readOnly) {
                try { event.currentTarget.showPicker?.(); } catch { /* Native focus still opens the picker on iOS. */ }
              }
            }} onChange={(event) => {
              setOwnValue(event.target.value);
              props.onChange?.(event);
            }} />
            <span aria-hidden="true" className={`${FIELD} pointer-events-none absolute inset-0 flex h-10 items-center peer-hover:border-ink/30 peer-focus:border-ink ${dateValue ? "" : "text-mute!"}`}>
              {dateValue ? dateValue.split("-").reverse().join("/") : "Select date"}
            </span>
          </>
        ) : <input id={id} className={`${FIELD} block h-10 min-w-0 max-w-full`} {...props} />}
      </div>
    </div>
  );
}

export function Textarea({ label, hint, className = "", maxWords = 200, onChange, ...props }: ComponentProps<"textarea"> & { label?: string; hint?: string; maxWords?: number }) {
  const id = useId();
  const [count, setCount] = useState(() => textWords(String(props.value ?? props.defaultValue ?? "")).length);
  const words = props.value !== undefined ? textWords(String(props.value)).length : count;
  return (
    <div className={className}>
      {label && <Label htmlFor={id} hint={hint}>{label}</Label>}
      <textarea id={id} aria-describedby={`${id}-limit`} className={`${FIELD} h-[108px] resize-none overflow-y-auto py-2.5 leading-[1.5]`} {...props} onChange={(e) => {
        e.target.value = limitWords(e.target.value, maxWords);
        setCount(textWords(e.target.value).length);
        onChange?.(e);
      }} />
      <p id={`${id}-limit`} className="mt-1 text-right text-[12px] tabular-nums text-mute">{words}/{maxWords} words</p>
    </div>
  );
}

/** A labelled field built on MenuSelect, so every dropdown in the app opens the same custom menu. */
export function Select({
  label,
  options,
  className = "",
  value,
  defaultValue,
  onChange,
  disabled,
  name,
  "aria-label": ariaLabel,
}: {
  label?: string;
  options: (string | { value: string; label: string })[];
  className?: string;
  value?: string;
  defaultValue?: string;
  onChange?(e: { target: { value: string; name?: string } }): void;
  disabled?: boolean;
  name?: string;
  "aria-label"?: string;
}) {
  const id = useId();
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const [own, setOwn] = useState(String(defaultValue ?? items[0]?.value ?? ""));
  const current = value !== undefined ? String(value) : own;
  return (
    <div className={`min-w-0 ${className}`}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <MenuSelect
        id={id}
        aria-label={ariaLabel ?? label ?? ""}
        value={current}
        disabled={disabled}
        options={items}
        onChange={(v) => {
          setOwn(v);
          onChange?.({ target: { value: v, name } });
        }}
      />
      {name && <input type="hidden" name={name} value={current} />}
    </div>
  );
}

/* ---------- paging ---------- */

export const PAGE_SIZE = 10;

/** Ten rows at a time by default. A different result count (a filter or search changed) goes back to page one. */
export function usePaged<T>(rows: T[], size = PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(rows.length);
  if (count !== rows.length) { setCount(rows.length); setPage(0); }
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages - 1);
  return { page: current, pages, size, total: rows.length, setPage, items: rows.slice(current * size, (current + 1) * size) };
}

/** "Showing 1–10 of 40" with Previous and Next on the same line, in the same small type. */
export function ListFooter({ paged, className = "" }: { paged: ReturnType<typeof usePaged<unknown>>; className?: string }) {
  const { page, pages, size, total, setPage } = paged;
  const from = total ? page * size + 1 : 0, to = Math.min(total, (page + 1) * size);
  const step = "font-semibold transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
  return (
    <div className={`flex items-center justify-between gap-4 pt-4 text-[12px] text-mute ${className}`}>
      <p role="status">Showing {from}–{to} of {total}</p>
      {pages > 1 && (
        <div className="flex items-center gap-4">
          <button type="button" className={step} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <button type="button" className={step} disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

/**
 * A select whose menu always opens below the field. A native select on macOS opens its menu
 * over the chosen option, so with a long list the menu jumps up and down depending on the value.
 */
export function MenuSelect({ value, onChange, options, className = "", disabled, id: given, "aria-label": ariaLabel }: {
  value: string;
  onChange(value: string): void;
  options: { value: string; label: string }[];
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-label": string;
}) {
  const own = useId();
  const id = given ?? own;
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const chosen = Math.max(0, options.findIndex((o) => o.value === value));

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  // Keep the highlighted option in view inside the menu without scrolling the page.
  useEffect(() => {
    const ul = list.current, li = ul?.children[active] as HTMLElement | undefined;
    if (!open || !ul || !li) return;
    if (li.offsetTop < ul.scrollTop) ul.scrollTop = li.offsetTop;
    else if (li.offsetTop + li.offsetHeight > ul.scrollTop + ul.clientHeight) ul.scrollTop = li.offsetTop + li.offsetHeight - ul.clientHeight;
  }, [open, active]);

  const show = () => { setActive(chosen); setOpen(true); };
  const pick = (i: number) => { setOpen(false); if (options[i] && options[i].value !== value) onChange(options[i].value); };
  const onKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); show(); }
      return;
    }
    const move: Record<string, number> = { ArrowDown: Math.min(last, active + 1), ArrowUp: Math.max(0, active - 1), Home: 0, End: last };
    if (e.key in move) { e.preventDefault(); setActive(move[e.key]); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(active); }
    else if (e.key === "Escape" || e.key === "Tab") setOpen(false);
  };

  return (
    // min-w-0 at every level so a long label truncates instead of widening its grid or flex parent
    <div ref={root} className={`relative min-w-0 max-w-full ${className}`}>
      <button
        type="button"
        id={id}
        role="combobox"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        className={`${FIELD} flex h-10 min-w-0 items-center pr-9 text-left disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className="min-w-0 flex-1 truncate">{options[chosen]?.label ?? ""}</span>
      </button>
      <Icon name="down" className={`pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-mute transition-transform ${open ? "rotate-180" : ""}`} />
      {open && (
        <ul ref={list} id={`${id}-list`} role="listbox" aria-label={ariaLabel} className="absolute top-full right-0 left-0 z-40 mt-1.5 max-h-[320px] overflow-y-auto overscroll-contain rounded-[12px] border border-line bg-paper py-1.5 shadow-[0_12px_32px_#0000001a]">
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === chosen}
              onPointerMove={() => setActive(i)}
              onClick={() => pick(i)}
              className={`cursor-pointer px-3.5 py-2 text-[14px] leading-[1.4] [overflow-wrap:anywhere] transition-colors ${i === active ? "text-red" : "text-ink"} ${i === chosen ? "font-semibold" : "font-normal"}`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
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

function useEnter(open: boolean, from: Record<string, [number | string, number | string]>) {
  const ref = useRef<HTMLDivElement>(null);
  const fromRef = useRef(from);
  useEffect(() => {
    if (!open || !ref.current || prefersReducedMotion()) return;
    const el = ref.current;
    // once in place, drop the leftover transform so the text inside renders on whole pixels and stays still
    import("animejs").then(({ animate }) => animate(el, { ...fromRef.current, duration: 420, ease: "outQuart", onComplete: () => el.style.removeProperty("transform") }));
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
  const ref = useEnter(open, { opacity: [0, 1], translateY: [16, 0] });
  usePanelLock(open, ref, onClose);
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
  const ref = useEnter(open, { translateX: [40, 0], opacity: [0, 1] });
  usePanelLock(open, ref, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-ink/30 backdrop-blur-[1px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" className="flex h-full w-full max-w-[640px] flex-col bg-paper shadow-2xl">
        <header className="flex items-start justify-between gap-4 px-5 py-4">
          <div className="min-w-0 text-[17px] font-bold">{title}</div>
          <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full" aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 px-5 py-4">{footer}</footer>}
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
  // one toast per message: the same message again, while it is still showing, only keeps it up longer
  const timers = useRef(new Map<string, { id: number; timer: number }>());
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const key = `${tone}:${text}`;
    const shown = timers.current.get(key);
    const id = shown?.id ?? Date.now() + Math.random();
    if (shown) window.clearTimeout(shown.timer);
    else setList((l) => [...l, { id, text, tone }]);
    const timer = window.setTimeout(() => {
      timers.current.delete(key);
      setList((l) => l.filter((t) => t.id !== id));
    }, 4200);
    timers.current.set(key, { id, timer });
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
