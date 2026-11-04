import { AppLink } from "@/components/app/ui";

/** Same wipe-and-redraw underline as the rest of the app (.swipe-line in globals.css). */
export default function SlidingLink({ href, children }: { href: string; children: string }) {
  return <AppLink href={href} className="block text-[13px] leading-[1.5] font-semibold text-white">
    <span className="swipe-line [box-decoration-break:clone]">{children}</span>
  </AppLink>;
}
