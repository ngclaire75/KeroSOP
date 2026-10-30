import type { ReactNode } from "react";
import { DocFooter, DocHeader } from "@/components/docs/DocParts";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <DocHeader />
      <main className="flex-1">{children}</main>
      <DocFooter />
    </div>
  );
}
