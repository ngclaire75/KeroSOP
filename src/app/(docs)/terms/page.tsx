import type { Metadata } from "next";
import { DocArticle, DocHero, type DocSection } from "@/components/docs/DocParts";

export const metadata: Metadata = {
  title: "Terms — KeroSOP",
  description: "The terms for using KeroSOP: your account, your content, acceptable use and how findings should be used.",
  alternates: { canonical: "/terms" },
};

const EMAIL = "ngclaire75@gmail.com";

const sections: DocSection[] = [
  {
    id: "agreement",
    title: "The agreement",
    body: (
      <p>
        These terms apply when you use the KeroSOP website or app. By creating an account or using the service, you agree
        to them. If you use KeroSOP for your company, you confirm that you are allowed to accept these terms on its
        behalf.
      </p>
    ),
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <ul>
        <li>Give accurate details when you sign up and keep them up to date.</li>
        <li>Keep your password private. You are responsible for activity under your account.</li>
        <li>Tell us straight away if you think someone else has accessed it.</li>
      </ul>
    ),
  },
  {
    id: "your-content",
    title: "Your content",
    body: (
      <p>
        You keep ownership of the documents you upload and everything your team writes in KeroSOP. You give us permission
        to store and process that content only as needed to provide the service to you. Make sure you have the right to
        upload what you share.
      </p>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>Please don’t:</p>
        <ul>
          <li>break the law or anyone else’s rights through the service;</li>
          <li>try to access accounts, workspaces or data that aren’t yours;</li>
          <li>disrupt, overload, or reverse-engineer the service;</li>
          <li>upload malware or content you have no right to share.</li>
        </ul>
      </>
    ),
  },
  {
    id: "findings",
    title: "How to use findings",
    body: (
      <p>
        KeroSOP points out instructions that may conflict and shows you the source for each one.{" "}
        <strong>Findings support your review; they are not legal or compliance advice.</strong> Your policy owners and
        reviewers decide which instruction is right and what to change.
      </p>
    ),
  },
  {
    id: "plans",
    title: "Plans and payment",
    body: (
      <p>
        Paid plans are billed as shown when you choose them. If prices change, we will tell you before the change applies
        to you.
      </p>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes",
    body: (
      <p>
        We work to keep KeroSOP available and improving, which means features may change over time. We may pause the
        service briefly for maintenance and will try to give notice when we can.
      </p>
    ),
  },
  {
    id: "ending",
    title: "Ending the agreement",
    body: (
      <p>
        You can stop using KeroSOP and close your account at any time. We may suspend or close an account that breaks
        these terms. After an account closes, you can ask us for a copy of your content before it is deleted.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Disclaimers and liability",
    body: (
      <p>
        The service is provided “as is”. As far as the law allows, we are not liable for indirect or consequential losses
        arising from your use of KeroSOP. Nothing in these terms limits liability that cannot be limited by law.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Changes and contact",
    body: (
      <p>
        If we update these terms, we will change the date at the top of this page and tell you about significant changes
        by email. Questions? Write to <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <>
      <DocHero
        glyph="terms"
        eyebrow="Terms of service"
        title={["The rules,", "made plain."]}
        intro="What you can expect from us, what we expect from you, and how KeroSOP’s findings should be used."
        meta="Last updated 30 October 2026"
      />
      <DocArticle sections={sections} />
    </>
  );
}
