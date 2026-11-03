import type { Metadata } from "next";
import { RequestAccess } from "@/components/access/RequestAccess";

export const metadata: Metadata = {
  title: "Request access — KeroSOP",
  description: "Tell us about your team. A KeroSOP specialist reviews every request and opens your workspace.",
  robots: { index: false, follow: false },
};

export default function RequestAccessPage() {
  return <RequestAccess />;
}
