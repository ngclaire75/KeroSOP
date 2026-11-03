"use client";

/**
 * A custom select: styled trigger with a caret, and a menu that opens with
 * anime.js. Keyboard: Enter / Space / arrows open it, arrows move, Enter
 * picks, Escape closes, typing a letter jumps to the first match.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/app/icons";
import { prefersReducedMotion } from "@/lib/random";

export function Dropdown({
  label,
  value,
  onChange,
  options,
  placeholder = "Choose…",
}: {
  label: string;
  value: string;
  onChange(v: string): void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    const el = menu.current;
    if (el && !prefersReducedMotion())
      import("animejs").then(({ animate, stagger }) => {
        animate(el, { opacity: [0, 1], translateY: [-6, 0], duration: 260, ease: "outQuart" });
        animate(el.children, { opacity: [0, 1], translateX: [-6, 0], duration: 320, delay: stagger(22), ease: "outQuart" });
      });
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const show = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const pick = (i: number) => {
    onChange(options[i].value);
    setOpen(false);
    button.current?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Tab") setOpen(false);
    else if (e.key.length === 1) {
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setActive(i);
    }
  };

  return (
    <div ref={root} className={`relative flex flex-col gap-2 ${open ? "z-40" : ""}`}>
      <span id={`${id}-label`} className="text-[13px] font-semibold">
        {label}
      </span>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        className="quiet-focus flex h-[52px] w-full items-center justify-between gap-3 rounded-[14px] bg-fog px-4 text-left text-[15px] outline-none transition-colors focus-visible:bg-[#e6e6e2]"
      >
        <span id={`${id}-value`} className={current ? "text-ink" : "text-mute"}>
          {current?.label ?? placeholder}
        </span>
        <span className={`grid size-7 place-items-center rounded-full bg-paper transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
          <Icon name="down" className="size-3.5" weight="bold" />
        </span>
      </button>
      {open && (
        <ul
          ref={menu}
          role="listbox"
          aria-labelledby={`${id}-label`}
          tabIndex={-1}
          className="absolute top-[calc(100%+6px)] right-0 left-0 z-30 max-h-[280px] overflow-y-auto overscroll-contain rounded-[16px] border border-line bg-paper p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(i);
              }}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-[15px] ${i === active ? "bg-fog" : ""}`}
            >
              {o.label}
              {o.value === value && <Icon name="check" className="size-4 text-red" weight="fill" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
