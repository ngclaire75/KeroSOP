"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { CountUp } from "@/components/app/charts";
import { Btn, Card, CardHead, ListFooter, Marked, PageHeader, Select, Toggle, fmtDate, fmtDateTime, useToast, orgName, usePaged } from "@/components/app/ui";
import { LogoMark } from "@/components/ui";
import { useWorkspace } from "@/lib/app/store";
import { RISK_NAME, STATUS_LABEL, TYPE_LABEL, type Finding } from "@/lib/app/types";

type Kind = "audit" | "executive" | "change";

const FINDINGS_PAGE = 4;
const KIND: Record<Kind, { title: string; hint: string }> = {
  audit: { title: "Audit report", hint: "Every finding with both quoted clauses, reviewer status and history." },
  executive: { title: "Executive summary", hint: "One page: risk, progress and what needs a decision." },
  change: { title: "Change impact", hint: "Documents revised through KeroSOP and what the re-scan showed." },
};

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const csvCell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;

export default function ReportsPage() {
  const { ws, me, logExport } = useWorkspace();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("audit");
  const [status, setStatus] = useState("open");
  const [risk, setRisk] = useState("all");
  const [dept, setDept] = useState("all");
  const [quotes, setQuotes] = useState(true);
  const depts = [...new Set(ws.findings.map((f) => f.department).filter(Boolean))].sort();
  const findings = ws.findings.filter(
    (f) =>
      (status === "all" || (status === "open" ? !["closed", "dismissed"].includes(f.status) : f.status === status)) &&
      (risk === "all" || f.risk === risk) &&
      (dept === "all" || f.department === dept),
  );
  const lastScan = ws.scans.find((s) => s.stage === "completed" || s.stage === "partially_completed");
  const excluded = ws.docs.filter((d) => d.approval !== "approved" || d.parseIssue);
  const stamp = new Date().toISOString().slice(0, 10);

  const exportPdf = async () => {
    await logExport(`${KIND[kind].title} (PDF)`).catch(() => {});
    window.print();
  };
  const exportCsv = async () => {
    const rows = [
      ["Finding", "Type", "Risk", "Status", "Title", "Department", "Owner", "Due", "Source", "Evidence A", "Evidence B", "Recommendation"],
      ...findings.map((f) => [
        f.id,
        TYPE_LABEL[f.type],
        RISK_NAME[f.risk],
        STATUS_LABEL[f.status],
        f.title,
        f.department,
        f.owner ?? "",
        f.dueDate ?? "",
        f.source === "ai" ? "AI-proposed" : "Rules engine",
        cite(f, 0, ws.docs),
        cite(f, 1, ws.docs),
        f.recommendation,
      ]),
    ];
    download(`kerosop-findings-${stamp}.csv`, "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
    await logExport("Findings (CSV)").catch(() => {});
    toast("CSV downloaded");
  };
  const exportJson = async () => {
    download(`kerosop-findings-${stamp}.json`, JSON.stringify({ organisation: ws.settings.company, exportedAt: new Date().toISOString(), exportedBy: me.email, findings }, null, 2), "application/json");
    await logExport("Findings (JSON)").catch(() => {});
    toast("JSON downloaded");
  };

  const counts = (pred: (f: Finding) => boolean) => ws.findings.filter(pred).length;
  const changed = ws.findings.filter((f) => f.revision?.newVersion);
  const listed = kind === "executive" ? findings.filter((f) => f.risk === "high").slice(0, 8) : findings;
  const paged = usePaged(listed, FINDINGS_PAGE);
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    // flushSync so the full list is on the page before the print dialog snapshots it.
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          intro="Build a report from live findings, preview it, then save it as PDF or export the data. Every quote links back to an exact document version."
          actions={
            <>
              <Btn icon="download" onClick={exportCsv}>
                CSV
              </Btn>
              <Btn icon="download" onClick={exportJson}>
                JSON
              </Btn>
              <Btn variant="red" icon="download" onClick={exportPdf}>
                Save as PDF
              </Btn>
            </>
          }
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit print:hidden">
          <CardHead title="Report" />
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-2">
              {(Object.keys(KIND) as Kind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`rounded-[7px] border p-3 text-left transition-colors ${kind === k ? "border-ink bg-ink text-paper" : "border-line hover:border-ink/30"}`}
                >
                  <span className="block text-[14px] font-bold">{KIND[k].title}</span>
                  <span className={`mt-0.5 block text-[12px] leading-[1.4] ${kind === k ? "text-paper/70" : "text-mute"}`}>{KIND[k].hint}</span>
                </button>
              ))}
            </div>
            <Select label="Findings" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "open", label: "Open only" }, { value: "closed", label: "Closed" }, { value: "dismissed", label: "Dismissed" }, { value: "all", label: "All" }]} />
            <Select label="Risk" value={risk} onChange={(e) => setRisk(e.target.value)} options={[{ value: "all", label: "Any" }, ...(["high", "medium", "low"] as const).map((value) => ({ value, label: RISK_NAME[value] }))]} />
            <Select label="Department" value={dept} onChange={(e) => setDept(e.target.value)} options={[{ value: "all", label: "All" }, ...depts]} />
            <Toggle checked={quotes} onChange={setQuotes} label="Include quoted clauses" />
          </div>
        </Card>

        {/* the report itself; print CSS shows only this */}
        <article id="report" className="h-fit min-w-0 rounded-[7px] border border-line bg-paper p-6 sm:p-10 print:rounded-none print:border-0 print:p-0">
          <header className="flex items-start justify-between gap-6 pb-5">
            <div>
              <p className="font-mono text-[11px] tracking-[0.18em] text-mute uppercase">KeroSOP · {KIND[kind].title}</p>
              <h2 className="display mt-2 text-[34px]">{orgName(ws.settings.company)}</h2>
              <p className="mt-1 text-[13px] text-mute">
                Prepared {fmtDateTime(new Date().toISOString())} by {me.name} · {findings.length} finding{findings.length === 1 ? "" : "s"} in scope
              </p>
            </div>
            <LogoMark className="h-10 w-auto shrink-0" />
          </header>

          <section className="grid grid-cols-2 gap-4 py-5 sm:grid-cols-4">
            {[
              ["Open High risk", counts((f) => f.risk === "high" && !["closed", "dismissed"].includes(f.status))],
              ["Waiting for review", counts((f) => ["detected", "under_review"].includes(f.status))],
              ["In remediation", counts((f) => ["confirmed", "assigned", "revision_proposed", "approved", "rejected", "rescanned"].includes(f.status))],
              ["Closed", counts((f) => f.status === "closed")],
            ].map(([k, v]) => (
              <div key={k as string}>
                <p className="text-[12px] text-mute">{k}</p>
                <p className="display mt-3 text-[32px]"><CountUp value={v as number} /></p>
              </div>
            ))}
          </section>

          <section className="py-5 text-[13px] leading-[1.6]">
            <h3 className="mb-2 text-[14px] font-bold">Scope and method</h3>
            <p>
              Last scan: {lastScan ? `${lastScan.name} (${lastScan.id}), ${fmtDateTime(lastScan.finishedAt ?? lastScan.startedAt)}, ${lastScan.docIds.length} documents` : "none yet"}. Analysis: KeroSOP rules engine
              {lastScan?.model?.reasoning ? ` with AI review by ${lastScan.model.reasoning} (prompt ${lastScan.model.prompt}, model ${lastScan.model.digest})` : " (AI review not used)"}. Every quote below was matched word for word against the stored document version.
            </p>
            {excluded.length > 0 && (
              <p className="mt-2">
                Excluded or limited: {excluded.map((d) => `${d.title} (${d.parseIssue ? "unreadable pages" : d.approval})`).join("; ")}.
              </p>
            )}
          </section>

          {kind === "change" ? (
            <section className="pt-5">
              <h3 className="mb-3 text-[14px] font-bold">Revisions made through KeroSOP</h3>
              {changed.length === 0 && <p className="text-[13px] text-mute">No revisions have been approved yet.</p>}
              {changed.map((f) => (
                <div key={f.id} className="mb-4 last:mb-0 break-inside-avoid rounded-[7px] border border-line p-4 text-[13px]">
                  <p className="font-bold">
                    {f.id} · {ws.docs.find((d) => d.id === f.revision!.docId)?.title} v{f.revision!.newVersion}
                  </p>
                  <p className="mt-1 text-mute">
                    Proposed by {f.revision!.by}, approved by {f.revision!.decidedBy} on {fmtDate(f.revision!.decidedAt)}. Re-scan: {f.reverified === "resolved" ? "issue no longer detected" : f.reverified === "still_present" ? "issue still present" : "not yet run"}.
                  </p>
                  <p className="mt-2 line-through decoration-red/50">{f.revision!.current}</p>
                  <p className="mt-1 font-semibold">{f.revision!.proposed}</p>
                </div>
              ))}
            </section>
          ) : (
            <section className="pt-5">
              <h3 className="mb-3 text-[14px] font-bold">{kind === "executive" ? "Decisions needed" : "Findings"}</h3>
              {findings.length === 0 && <p className="text-[13px] text-mute">No findings match this report.</p>}
              {/* Four at a time on screen; printing or saving as PDF always includes every finding. */}
              {(printing ? listed : paged.items).map((f) => (
                <div key={f.id} className="mb-4 break-inside-avoid pb-4 last:mb-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[14px] font-bold">
                      {f.id} · {f.title}
                    </p>
                    <p className="text-[12px] text-mute">
                      {TYPE_LABEL[f.type]} · <span>{RISK_NAME[f.risk]} risk</span> · {STATUS_LABEL[f.status]}
                      {f.source === "ai" ? " · AI-proposed" : ""}
                    </p>
                  </div>
                  {quotes && kind === "audit" && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {f.evidence.map((e, i) => (
                        <div key={i} className="rounded-[7px] bg-fog/70 p-3 text-[12px] leading-[1.55]">
                          <p className="mb-1 text-mute">{e.baseline ? `Baseline: ${e.baseline}` : `${ws.docs.find((d) => d.id === e.docId)?.title} v${e.version} §${e.sectionRef} p.${e.page}`}</p>
                          <Marked text={e.quote} mark={e.highlight} />
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[13px] leading-[1.55]">
                    <b>Next step:</b> {f.recommendation}
                    {f.owner ? ` Owner: ${f.owner}${f.dueDate ? `, due ${fmtDate(f.dueDate)}` : ""}.` : ""}
                  </p>
                </div>
              ))}
              {listed.length > 0 && <ListFooter paged={paged} className="print:hidden" />}
            </section>
          )}


        </article>
      </div>
    </>
  );
}

function cite(f: Finding, i: number, docs: { id: string; title: string }[]) {
  const e = f.evidence[i];
  if (!e) return "";
  return e.baseline ? `Baseline ${e.baseline}: ${e.quote}` : `${docs.find((d) => d.id === e.docId)?.title} v${e.version} §${e.sectionRef} p.${e.page}: ${e.quote}`;
}
