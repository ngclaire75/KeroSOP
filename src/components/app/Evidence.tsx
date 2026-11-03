"use client";

import { Icon } from "./icons";
import { AppLink, Chip, Marked } from "./ui";
import { sectionOf } from "@/lib/app/labels";
import type { Doc, Evidence } from "@/lib/app/types";
import { AUTHORITY_LABEL } from "@/lib/app/types";

/** One cited clause: document, version, section, page, the exact quote, and whether it was verified word for word. */
export function EvidenceCard({ e, doc, label, context = false }: { e: Evidence; doc?: Doc; label: string; context?: boolean }) {
  const section = doc ? sectionOf(doc, e.version, e.sectionId) : undefined;
  const zh = /[一-鿿]/.test(e.quote);
  return (
    <article className="flex min-w-0 flex-col rounded-[10px] border border-line bg-paper">
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.12em] text-mute uppercase">{label}</p>
          {e.baseline ? (
            <p className="mt-0.5 truncate text-[14px] font-bold">Approved baseline: {e.baseline}</p>
          ) : (
            <AppLink href={`/documents?doc=${e.docId}`} className="mt-0.5 block truncate text-[14px] font-bold hover:underline">
              {doc?.title ?? e.docId}
            </AppLink>
          )}
          {!e.baseline && (
            <p className="text-[12px] text-mute">
              v{e.version} · §{e.sectionRef} · p. {e.page}
              {doc ? ` · ${AUTHORITY_LABEL[doc.authority]}` : ""}
            </p>
          )}
        </div>
        {e.verified ? (
          <span title="This exact text was found in the stored source version" className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#16703d]">
            <Icon name="shield" className="size-4" weight="fill" /> Verified
          </span>
        ) : (
          <Chip tone="red">Unverified</Chip>
        )}
      </header>
      <blockquote lang={zh ? "zh" : "en"} className="px-4 py-4 text-[15px] leading-[1.65]">
        <Marked text={e.quote} mark={e.highlight} />
      </blockquote>
      {context && section && section.text.trim() !== e.quote.trim() && (
        <details className="border-t border-line px-4 py-3 text-[13px]">
          <summary className="cursor-pointer font-semibold text-mute">Full section {section.ref}</summary>
          <p className="mt-2 leading-[1.6] whitespace-pre-line text-mute">
            <Marked text={section.text} mark={e.quote} />
          </p>
        </details>
      )}
    </article>
  );
}

export function EvidencePair({ evidence, docs, context = false }: { evidence: Evidence[]; docs: Doc[]; context?: boolean }) {
  return (
    <div className={`grid gap-3 ${evidence.length > 2 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
      {evidence.map((e, i) => (
        <EvidenceCard key={i} e={e} doc={docs.find((d) => d.id === e.docId)} label={`Evidence ${String.fromCharCode(65 + i)}`} context={context} />
      ))}
    </div>
  );
}
