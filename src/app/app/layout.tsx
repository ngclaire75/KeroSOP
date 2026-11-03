import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppRoot } from "@/components/app/Shell";

export const metadata: Metadata = {
  title: { default: "Dashboard — KeroSOP", template: "%s — KeroSOP" },
  robots: { index: false, follow: false },
};

/** The signed-in dashboard. Served at app.kerosop.site (see src/proxy.ts) and at /app elsewhere. */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AppRoot>{children}</AppRoot>;
}
