"use client";

import { AppLink, CardHead, Empty } from "@/components/app/ui";
import { AUTHORITY_LABEL, STATUS_LABEL, type Doc, type Finding } from "@/lib/app/types";
import { topicLabel } from "@/lib/app/labels";
import type { PolicyLink } from "./model";
import SlidingLink from "./SlidingLink";

const PANEL = "on-dark rounded-[7px] bg-black p-4 text-left text-white";
const ACTION = "inline-flex min-h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-[6px] border border-white/25 px-3 text-[13px] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const PRIMARY_ACTION = "inline-flex min-h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-[6px] border-0 bg-red px-3 text-[13px] font-semibold text-white hover:bg-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

type Props = {
  doc: Doc | null;
  ruleCount: number;
  links: PolicyLink[];
  findings: Finding[];
  docs: Map<string, Doc>;
  shown: Set<string>;
};

export default function DocumentDetails({ doc, ruleCount, links, findings, docs, shown }: Props) {
  if (!doc) return <Empty icon="graph" title="Follow a connection" body="Select any document on the map to see its rules, related documents and exact finding evidence." />;

  return <>
    <CardHead title="Document details" />
    <div className="space-y-3 p-4">
      <section className={PANEL} aria-label="Selected document">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/85">
          <span>{doc.id} · v{doc.versions[doc.current]?.version ?? "—"}</span>
          <span className="rounded-full border border-white/25 px-2.5 py-1 font-semibold capitalize text-white">{doc.approval}</span>
        </div>
        <h3 className="mt-3 text-[18px] leading-[1.35] font-bold">{doc.title}</h3>
        <p className="mt-1 text-[13px] text-white/85">{AUTHORITY_LABEL[doc.authority]}</p>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-[13px] leading-[1.45]">
          {[["Owner", doc.owner || "Unassigned"], ["Department", doc.department || "Not set"], ["Scope", doc.scope || "Not set"], ["Current rules", ruleCount]].map(([label, value]) => <div key={label} className="min-w-0 text-left"><dt className="text-[12px] text-white/85">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
        </dl>
        {doc.parseIssue && <p className="mt-4 rounded-[6px] border border-white/25 p-3 text-[13px] leading-relaxed">Text needs review: {doc.parseIssue}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <AppLink className={PRIMARY_ACTION} href={`/documents?doc=${encodeURIComponent(doc.id)}`}>View document</AppLink>
          <AppLink className={PRIMARY_ACTION} href={`/rules?doc=${encodeURIComponent(doc.id)}`}>View rules</AppLink>
        </div>
      </section>

      <section className={PANEL} aria-labelledby="map-connections-title">
        <h4 id="map-connections-title" className="flex items-center justify-between gap-3 text-[15px] font-bold">Connections</h4>
        {links.length ? <ul className="mt-3 space-y-2">{links.map((link) => {
          const other = docs.get(link.a === doc.id ? link.b : link.a);
          if (!other) return null;
          return <li key={link.id} className="rounded-[6px] border border-white/15 bg-[#242424] p-3">
            <SlidingLink href={`/documents?doc=${encodeURIComponent(other.id)}`}>{other.title}</SlidingLink>
            {link.topics.length > 0 && <div className="mt-3"><p className="text-[12px] text-white/85">Shared topics</p><p className="mt-1 text-[13px] leading-[1.5]">{link.topics.map(topicLabel).join(", ")}</p></div>}
            {link.findings.length > 0 && <p className="mt-2 text-[13px] text-white/85">{link.findings.length} open finding{link.findings.length === 1 ? "" : "s"}</p>}
            {!shown.has(other.id) && <p className="mt-2 text-[12px] text-white/85">Outside current filters</p>}
          </li>;
        })}</ul> : <p className="mt-3 text-[13px] leading-relaxed text-white/85">No connections found yet.</p>}
      </section>

      <section className={PANEL} aria-labelledby="map-findings-title">
        <h4 id="map-findings-title" className="flex items-center justify-between gap-3 text-[15px] font-bold">Open findings</h4>
        {findings.length ? <ul className="mt-3 space-y-3">{findings.map((finding) => <li key={finding.id} className="rounded-[6px] border border-white/15 bg-[#242424] p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/85"><span>{finding.id}</span><span className="rounded-full border border-white/25 px-2 py-0.5 text-white">{STATUS_LABEL[finding.status]}</span></div>
          <SlidingLink href={`/findings?id=${encodeURIComponent(finding.id)}`}>{finding.title}</SlidingLink>
          {finding.evidence.filter((e) => e.docId === doc.id).map((e, i) => <div key={`${e.version}-${e.sectionId}-${i}`} className="mt-4 rounded-[6px] bg-black/20 p-3">
            <p className="text-[12px] leading-[1.5] text-white/85">v{e.version} · §{e.sectionRef} · p. {e.page}</p>
            <p className="mt-1 text-[12px] font-semibold text-white/85">{e.verified ? "Verified quote" : "Quote needs review"}</p>
            <blockquote className="mt-3 text-[13px] leading-[1.65] text-white">“{e.quote}”</blockquote>
          </div>)}
          <AppLink href={`/evidence?id=${encodeURIComponent(finding.id)}`} className={`${ACTION} mt-3`}>Compare evidence</AppLink>
        </li>)}</ul> : <p className="mt-3 text-[13px] leading-relaxed text-white/85">No open findings cite this document.</p>}
      </section>
    </div>
  </>;
}
