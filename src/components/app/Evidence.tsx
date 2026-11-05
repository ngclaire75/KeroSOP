"use client";

import { AppLink, Chip, Marked } from "./ui";
import { sectionOf } from "@/lib/app/labels";
import type { Doc, Evidence } from "@/lib/app/types";
import { AUTHORITY_LABEL } from "@/lib/app/types";

/** Optical footprint matches the 28px file logos, with a little air around the scales. */
export function BaselineLogo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 16 16" className="size-7 shrink-0 p-[2px] text-[#4a5565]">
      <path fill="currentColor" d="M8.75.75V2h.985c.304 0 .603.08.867.231l1.29.736q.058.033.124.033h2.234a.75.75 0 0 1 0 1.5h-.427l2.111 4.692a.75.75 0 0 1-.154.838l-.53-.53l.529.531l-.001.002l-.002.002l-.006.006l-.006.005l-.01.01l-.045.04q-.317.265-.686.45C14.556 10.78 13.88 11 13 11a4.5 4.5 0 0 1-2.023-.454a3.5 3.5 0 0 1-.686-.45l-.045-.04l-.016-.015l-.006-.006l-.004-.004v-.001a.75.75 0 0 1-.154-.838L12.178 4.5h-.162c-.305 0-.604-.079-.868-.231l-1.29-.736a.25.25 0 0 0-.124-.033H8.75V13h2.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.5V3.5h-.984a.25.25 0 0 0-.124.033l-1.289.737c-.265.15-.564.23-.869.23h-.162l2.112 4.692a.75.75 0 0 1-.154.838l-.53-.53l.529.531l-.001.002l-.002.002l-.006.006l-.016.015l-.045.04q-.317.265-.686.45C4.556 10.78 3.88 11 3 11a4.5 4.5 0 0 1-2.023-.454a3.5 3.5 0 0 1-.686-.45l-.045-.04l-.016-.015l-.006-.006l-.004-.004v-.001a.75.75 0 0 1-.154-.838L2.178 4.5H1.75a.75.75 0 0 1 0-1.5h2.234a.25.25 0 0 0 .125-.033l1.288-.737c.265-.15.564-.23.869-.23h.984V.75a.75.75 0 0 1 1.5 0m2.945 8.477c.285.135.718.273 1.305.273s1.02-.138 1.305-.273L13 6.327Zm-10 0c.285.135.718.273 1.305.273s1.02-.138 1.305-.273L3 6.327Z" />
    </svg>
  );
}

/** Shown when a quote was found word for word in the stored source version. */
export function VerifiedBadge() {
  return (
    <span title="This exact text was found in the stored source version" className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#16703d]">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0" fill="currentColor">
        <path d="m8.6 22.5l-1.9-3.2l-3.6-.8l.35-3.7L1 12l2.45-2.8l-.35-3.7l3.6-.8l1.9-3.2L12 2.95l3.4-1.45l1.9 3.2l3.6.8l-.35 3.7L23 12l-2.45 2.8l.35 3.7l-3.6.8l-1.9 3.2l-3.4-1.45zm2.35-6.95L16.6 9.9l-1.4-1.45l-4.25 4.25l-2.15-2.1L7.4 12z" />
      </svg>
      Verified
    </span>
  );
}

/** One cited clause: document, version, section, page, the exact quote, and whether it was verified word for word. */
export function EvidenceCard({ e, doc, label, context = false }: { e: Evidence; doc?: Doc; label: string; context?: boolean }) {
  const section = doc ? sectionOf(doc, e.version, e.sectionId) : undefined;
  const zh = /[一-鿿]/.test(e.quote);
  return (
    <article className="flex min-w-0 flex-col rounded-[7px] border border-line bg-paper">
      <header className="flex items-start justify-between gap-3 px-4 pt-3.5">
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
          <VerifiedBadge />
        ) : (
          <Chip tone="red">Unverified</Chip>
        )}
      </header>
      <blockquote lang={zh ? "zh" : "en"} className="px-4 pt-3 pb-4 text-[15px] leading-[1.65]">
        <Marked text={e.quote} mark={e.highlight} />
      </blockquote>
      {context && section && section.text.trim() !== e.quote.trim() && (
        <details className="px-4 pb-3.5 text-[13px]">
          <summary className="inline-block cursor-pointer list-none font-semibold text-mute transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="swipe-line">Full section {section.ref}</span>
          </summary>
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
