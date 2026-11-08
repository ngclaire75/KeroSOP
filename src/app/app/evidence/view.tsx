"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { DocViewer } from "@/components/app/DocViewer";
import { BaselineLogo, VerifiedBadge } from "@/components/app/Evidence";
import { AppLink, Empty, Marked, MenuSelect, PageHeader, PILL, RiskBadge } from "@/components/app/ui";
import { useWorkspace } from "@/lib/app/store";
import { STATUS_LABEL, TYPE_LABEL, type Doc, type Evidence, type Finding, type Risk, type Status } from "@/lib/app/types";

const OPEN: Status[] = ["detected", "under_review", "confirmed", "assigned", "revision_proposed", "approved", "rejected", "rescanned"];
const RISK_RANK: Record<Risk, number> = { high: 0, medium: 1, low: 2 };
const ROW_STYLE: CSSProperties = { background: "#ffffff", border: "1px solid #e5e5e3", borderRadius: 9, color: "#171717" };
const SEL = "[&_button]:rounded-[6px] [&_button]:font-semibold";

export default function EvidenceComparison() {
  const { ws } = useWorkspace();
  const ordered = useMemo(
    () =>
      [...ws.findings].sort(
        (a, b) => Number(OPEN.includes(b.status)) - Number(OPEN.includes(a.status)) || RISK_RANK[a.risk] - RISK_RANK[b.risk] || a.id.localeCompare(b.id),
      ),
    [ws.findings],
  );
  const [id, setId] = useState("");

  // ?id=F640381 opens that finding; otherwise the highest-risk open one
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get("id");
    queueMicrotask(() => setId(want && ws.findings.some((f) => f.id === want) ? want : (ordered[0]?.id ?? "")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const choose = (next: string) => {
    setId(next);
    const url = new URL(window.location.href);
    url.searchParams.set("id", next);
    window.history.replaceState(null, "", url);
  };

  const f = ws.findings.find((x) => x.id === id) ?? null;

  return (
    <>
      <PageHeader
        title="Evidence Comparison"
        intro="Both clauses of a finding, open in their original Word or PDF files. Each opens at the cited page with the quoted wording highlighted."
      />

      {ordered.length === 0 ? (
        <div style={ROW_STYLE}>
          <Empty icon="split" title="Nothing to compare yet" body="Run a scan; each finding it raises can be compared here, clause against clause." />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2 pb-5 sm:grid-cols-[minmax(0,560px)]">
            <MenuSelect
              aria-label="Finding"
              value={id}
              onChange={choose}
              options={ordered.map((x) => ({ value: x.id, label: `${x.id} · ${x.title}${OPEN.includes(x.status) ? "" : ` (${STATUS_LABEL[x.status]})`}` }))}
              className={SEL}
            />
          </div>
          {f && <Comparison key={f.id} f={f} />}
        </>
      )}
    </>
  );
}

function Comparison({ f }: { f: Finding }) {
  const { ws } = useWorkspace();
  return (
    <div className="flex flex-col gap-12 xl:gap-4">
      <section style={ROW_STYLE} className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-[760px]">
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge risk={f.risk} />
            <span className={`${PILL} border border-ink/35 text-ink`}>{STATUS_LABEL[f.status]}</span>
            <span className="text-[12px] text-mute">
              {f.id} · {TYPE_LABEL[f.type]}
            </span>
          </div>
          <h2 className="mt-3 text-[18px] leading-[1.35] font-bold">{f.title}</h2>
          <p className="mt-1.5 text-[14px] leading-[1.6] text-mute">{f.explanation}</p>
          {f.authority && (
            <p className="mt-3 text-[13px] leading-[1.55]">
              <span className="font-semibold">Which one governs: </span>
              {f.authority}
            </p>
          )}
        </div>
        <AppLink href={`/findings?id=${f.id}`} className="inline-flex h-10 shrink-0 items-center rounded-[6px] bg-ink px-4.5 text-[14px] font-semibold whitespace-nowrap text-paper transition-colors hover:bg-red">
          Open finding
        </AppLink>
      </section>

      {/* stacked on smaller screens, with a little more room between the two clauses */}
      <div className={`grid gap-12 xl:gap-4 ${f.evidence.length > 1 ? "xl:grid-cols-2" : ""}`}>
        {f.evidence.map((e, i) => (
          <Side key={i} e={e} letter={String.fromCharCode(65 + i)} doc={ws.docs.find((d) => d.id === e.docId)} />
        ))}
      </div>
    </div>
  );
}

function Side({ e, letter, doc }: { e: Evidence; letter: string; doc?: Doc }) {
  const label = `Clause ${letter}`;
  const zh = /[一-鿿]/.test(e.quote);
  return (
    // side by side, both sides share rows, so the files line up and the quote cards are always the same height
    <div className="flex min-w-0 flex-col gap-3 xl:row-span-2 xl:grid xl:grid-rows-subgrid">
      {e.baseline || !doc ? (
        <div className="flex h-full min-w-0 flex-col gap-3">
          <div className="flex h-8 shrink-0 items-center gap-2.5">
            <BaselineLogo />
            <p className="text-[13px] font-semibold">{label}</p>
          </div>
          <section style={ROW_STYLE} className="flex min-h-[200px] flex-1 aspect-[210/297] flex-col items-center justify-center px-5 py-6 text-center">
          <p className="mt-1 text-[15px] font-bold">{e.baseline ? `Approved baseline: ${e.baseline}` : "The document has since been deleted"}</p>
          <p className="mt-1 text-[13px] text-mute">{e.baseline ? "A required process set in Settings, not a file." : "The quote below is kept for the audit trail."}</p>
          </section>
        </div>
      ) : (
        <DocViewer doc={doc} evidence={e} label={`${letter} · ${doc.id} · v${e.version}`} />
      )}
      <section style={ROW_STYLE} className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[12px] text-mute">
            {doc ? `${doc.title} · §${e.sectionRef} · page ${e.page}` : label}
          </p>
          {e.verified ? <VerifiedBadge /> : <span className={`${PILL} bg-red text-white`}>Unverified</span>}
        </div>
        <blockquote lang={zh ? "zh" : "en"} className="mt-2 text-[15px] leading-[1.65]">
          <Marked text={e.quote} mark={e.highlight} />
        </blockquote>
      </section>
    </div>
  );
}
