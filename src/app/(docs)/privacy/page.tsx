import type { Metadata } from "next";
import { DocArticle, DocHero, type DocSection } from "@/components/docs/DocParts";

export const metadata: Metadata = {
  title: "Privacy — KeroSOP",
  description: "What KeroSOP collects, why, who it is shared with, and the choices you have.",
  alternates: { canonical: "/privacy" },
};

const EMAIL = "ngclaire75@gmail.com";

const sections: DocSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <p>
        KeroSOP reads your policies, SOPs and training guides and flags instructions that conflict. This policy explains
        what we collect when you visit this website or use the KeroSOP app, and what we do with it. When we say “we” or
        “us”, we mean KeroSOP.
      </p>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <ul>
        <li>
          <strong>Account details:</strong> your name, email, company and password when you sign up.
        </li>
        <li>
          <strong>Your documents:</strong> the files you upload, and the rules, findings and comments created from them.
        </li>
        <li>
          <strong>Usage information:</strong> pages and features you use, plus basic device and browser details, so we
          can keep the service working and improve it.
        </li>
        <li>
          <strong>Messages:</strong> anything you send us by email or through the app.
        </li>
      </ul>
    ),
  },
  {
    id: "how-we-use-it",
    title: "How we use it",
    body: (
      <ul>
        <li>To run your scans and show findings, sources and reports to your workspace.</li>
        <li>To create and secure your account, and to keep the service reliable.</li>
        <li>To answer your questions and send emails about your account, such as confirmations and password resets.</li>
        <li>To understand how the product is used so we can improve it.</li>
        <li>To send product news only if you have asked for it. You can opt out at any time.</li>
      </ul>
    ),
  },
  {
    id: "your-documents",
    title: "Your documents",
    body: (
      <p>
        The documents you upload belong to you. We process them to provide KeroSOP to your workspace, and people outside
        your workspace cannot see them. You can ask us to delete them at any time.
      </p>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>We do not sell your personal information. We share it only:</p>
        <ul>
          <li>with service providers that host, secure or email for us, under contracts that limit how they use it;</li>
          <li>when the law requires it, or to protect the rights and safety of our users and the public;</li>
          <li>as part of a merger or sale of the business, with this policy still applying to your information.</li>
        </ul>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <p>
        We keep your information for as long as your account is open and we need it to provide the service. When you
        close your account or ask us to delete your data, we delete it within a reasonable time, unless the law requires
        us to keep part of it.
      </p>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        We use technical and organisational measures to protect your information. No system is completely secure, so if
        you think your account has been compromised, tell us straight away at <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your choices and rights",
    body: (
      <>
        <p>
          Depending on where you live, you can ask to see, correct, export or delete your personal information, or object
          to how we use it. Email <a href={`mailto:${EMAIL}`}>{EMAIL}</a> from the address on your account and we’ll help.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <p>
        We use cookies and similar storage that the site needs to work, for example to keep you logged in. If we add
        optional cookies, such as for analytics, we will ask first where the law requires it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: (
      <p>
        If we change this policy, we will update the date at the top of this page, and tell you by email when the change
        is significant. Questions? Write to <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <>
      <DocHero
        glyph="privacy"
        eyebrow="Privacy policy"
        title={["Your data,", "kept yours."]}
        intro="What we collect, why we need it, who sees it, and the choices you have. Written to be read, not skimmed past."
        meta="Last updated 30 October 2026"
      />
      <DocArticle sections={sections} />
    </>
  );
}
