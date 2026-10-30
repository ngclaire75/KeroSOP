import type { Metadata } from "next";
import { DocHero } from "@/components/docs/DocParts";
import { HelpCenter } from "@/components/docs/HelpCenter";

export const metadata: Metadata = {
  title: "Help — KeroSOP",
  description: "Get help with KeroSOP: uploading SOPs, scans, findings, sign-off and your account.",
  alternates: { canonical: "/help" },
};

export default function HelpPage() {
  return (
    <>
      <DocHero
        glyph="help"
        eyebrow="Help centre"
        title={["How can we", "help?"]}
        intro="Questions about uploading documents, scans, findings or sign-off? A person is one email away."
      />
      <HelpCenter />
    </>
  );
}
