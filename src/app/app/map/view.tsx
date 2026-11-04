"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Btn, BtnLink, Card, CardHead, Empty, PageHeader, SearchInput, Select } from "@/components/app/ui";
import { topicLabel } from "@/lib/app/labels";
import { useWorkspace } from "@/lib/app/store";
import DocumentDetails from "./DocumentDetails";
import { isOpen, policyLinks } from "./model";

const PolicyGraph = dynamic(() => import("./PolicyGraph"), { ssr: false, loading: () => <div className="grid h-[620px] place-items-center text-[13px] text-mute" role="status">Loading policy map…</div> });
const allOption = (label: string) => ({ value: "all", label });

export default function PolicyMap() {
  const { ws } = useWorkspace();
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("all");
  const [department, setDepartment] = useState("all");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const links = useMemo(() => policyLinks(ws.docs, ws.rules, ws.findings), [ws.docs, ws.rules, ws.findings]);
  const live = useMemo(() => ws.rules.filter((r) => !r.historical), [ws.rules]);
  const topics = [...new Set(live.map((r) => r.topic))].sort();
  const departments = [...new Set(ws.docs.map((d) => d.department).filter(Boolean))].sort();
  const openFindings = ws.findings.filter(isOpen);
  const citedDocs = new Set(openFindings.flatMap((f) => f.evidence.map((e) => e.docId)));
  const docs = ws.docs.filter((d) => {
    const rules = live.filter((r) => r.docId === d.id);
    return (department === "all" || department === d.department) &&
      (topic === "all" || rules.some((r) => r.topic === topic)) &&
      (!onlyOpen || citedDocs.has(d.id)) &&
      (!q.trim() || [d.title, d.id, d.owner, d.department, ...rules.map((r) => topicLabel(r.topic))].some((s) => s.toLowerCase().includes(q.trim().toLowerCase())));
  }).sort((a, b) => ws.settings.hierarchy.indexOf(a.authority) - ws.settings.hierarchy.indexOf(b.authority) || a.title.localeCompare(b.title));
  const shown = new Set(docs.map((d) => d.id));
  const visibleLinks = links.filter((l) => shown.has(l.a) && shown.has(l.b));
  const active = docs.find((d) => d.id === selected) ?? null;
  const activeLinks = active ? links.filter((l) => l.a === active.id || l.b === active.id) : [];
  const activeFindings = active ? openFindings.filter((f) => f.evidence.some((e) => e.docId === active.id)) : [];
  const filtered = !!q || topic !== "all" || department !== "all" || onlyOpen;
  const reset = () => { setQ(""); setTopic("all"); setDepartment("all"); setOnlyOpen(false); setSelected(null); };
  const select = (id: string) => setSelected((old) => old === id ? null : id);
  const docById = new Map(ws.docs.map((d) => [d.id, d]));

  return <>
    <PageHeader title="Policy Map" intro="Trace how your documents connect through extracted rules and open findings. Select a document to see its connections and evidence." />
    <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[
        { label: "Documents", value: ws.docs.length, hint: "Across the workspace" },
        { label: "Rules in force", value: live.length, hint: "Historical rules excluded" },
        { label: "Connected pairs", value: links.length, hint: "Shared topics or cited evidence" },
        { label: "Open findings", value: openFindings.length, hint: "Including single-document issues" },
      ].map((stat) => <Card key={stat.label} className="px-4 py-4"><p className="text-[13px] font-semibold text-mute">{stat.label}</p><p className="mt-2 text-[28px] leading-none font-bold tracking-[-0.035em] tabular-nums">{stat.value}</p></Card>)}
    </div>
    {ws.docs.length === 0 ? <Card><Empty icon="graph" title="Your policy map starts with documents" body="Add policies and SOPs, then run a scan to extract rules and find relationships." action={<BtnLink href="/documents" variant="ink">Open Document Library</BtnLink>} /></Card> : <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search documents, owners or topics" className="min-w-[200px] flex-1" />
        <Select aria-label="Filter by topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full sm:w-[170px]" options={[allOption("All topics"), ...topics.map((t) => ({ value: t, label: topicLabel(t) }))]} />
        <Select aria-label="Filter by department" value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full sm:w-[180px]" options={[allOption("All departments"), ...departments]} />
        <Btn aria-pressed={onlyOpen} variant={onlyOpen ? "ink" : "outline"} onClick={() => setOnlyOpen(!onlyOpen)}>With open findings</Btn>
        {filtered && <Btn variant="ghost" onClick={reset}>Clear filters</Btn>}
      </div>
      <div className="grid gap-4">
        <Card className="min-w-0 overflow-hidden">
          <CardHead title="Document relationships" hint={<span role="status">{docs.length} of {ws.docs.length} documents · {visibleLinks.length} visible connections</span>} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-mute"><span className="flex items-center gap-2"><span className="h-px w-5 bg-mute/50" />Shared rule topic</span><span className="flex items-center gap-2"><span className="h-[2px] w-5 bg-red" />Cited in an open finding</span></div>
          </div>
          {!docs.length ? <Empty icon="graph" title="No documents match" body="Try another topic, department or search term." action={<Btn onClick={reset}>Clear filters</Btn>} /> : <PolicyGraph docs={docs} links={visibleLinks} selected={active?.id ?? null} onSelect={select} />}
        </Card>
        <Card className="min-w-0" aria-label="Document details">
          <DocumentDetails doc={active} ruleCount={active ? live.filter((r) => r.docId === active.id).length : 0} links={activeLinks} findings={activeFindings} docs={docById} shown={shown} />
        </Card>
      </div>
    </>}
  </>;
}
