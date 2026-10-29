import type { ComponentProps } from "react";

export function Container({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-10 ${className}`} {...props} />;
}

type Variant = "red" | "black" | "white" | "outline" | "outline-light";

const variants: Record<Variant, string> = {
  red: "bg-red text-paper hover:bg-red-deep data-[hover]:bg-red-deep",
  black: "bg-ink text-paper hover:bg-[#262626] data-[hover]:bg-[#262626]",
  white: "bg-paper text-ink hover:bg-fog data-[hover]:bg-fog",
  outline: "border border-ink/20 text-ink hover:border-ink data-[hover]:border-ink",
  "outline-light": "border border-paper/30 text-paper hover:border-paper data-[hover]:border-paper",
};

export function Button({
  variant = "red",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"a"> & { variant?: Variant; size?: "sm" | "md" }) {
  const sizing = size === "sm" ? "h-10 px-5 text-sm" : "h-12 px-6 text-[15px]";
  return (
    <a
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold whitespace-nowrap transition-colors duration-150 ${sizing} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export const CAT_HEAD =
  "M212 518 C 172 430, 152 330, 172 258 C 186 210, 230 192, 275 200 C 350 214, 425 262, 482 337 C 590 292, 700 292, 805 337 C 862 262, 937 214, 1012 200 C 1057 192, 1101 210, 1115 258 C 1135 330, 1115 430, 1080 518 C 1150 610, 1176 720, 1150 840 C 1108 1010, 890 1062, 645 1064 C 400 1062, 178 1012, 130 845 C 108 720, 138 610, 212 518 Z";
export const CAT_BRIDGE = "M584 700 C 612 664, 676 664, 704 700";

/** KeroSOP mark: a cat in round reading glasses. Strokes are weighted for small sizes. */
export function LogoMark({ className = "", tone = "ink" }: { className?: string; tone?: "ink" | "paper" }) {
  return (
    <svg
      viewBox="56 148 1178 964"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke={tone === "ink" ? "var(--ink)" : "var(--paper)"}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={CAT_HEAD} strokeWidth="66" />
      <circle cx="414" cy="707" r="150" strokeWidth="56" />
      <circle cx="866" cy="707" r="150" strokeWidth="56" />
      <path d={CAT_BRIDGE} strokeWidth="50" />
    </svg>
  );
}

export function Logo({ tone = "ink", className = "h-8 w-auto" }: { tone?: "ink" | "paper"; className?: string }) {
  return (
    <span className="inline-flex items-center">
      <LogoMark className={className} tone={tone} />
      <span className="sr-only">KeroSOP</span>
    </span>
  );
}
