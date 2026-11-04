"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AppLink, Btn, BtnLink, Card, CardHead, Empty, PageHeader, SearchInput, Select, StatusBadge } from "@/components/app/ui";
import { Segmented } from "@/components/app/dash";
import { Icon } from "@/components/app/icons";
import { topicLabel } from "@/lib/app/labels";
import { useWorkspace } from "@/lib/app/store";
import { AUTHORITY_LABEL } from "@/lib/app/types";
import { isOpen, policyLinks } from "./model";

const PolicyGraph = dynamic(() => import("./PolicyGraph"), { ssr: false, loading: () => <div className="grid h-[620px] place-items-center text-[13px] text-mute" role="status">Loading policy map…</div> });
const allOption = (label: string) => ({ value: "all", label });

export default function PolicyMap() {
  const { ws } = useWorkspace();
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("all");
  const [department, setDepartment] = useState("all");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [view, setView] = useState<"map" | "list">("map");
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
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
  const reset = () => { setQ(""); setTopic("all"); setDepartment("all"); setOnlyOpen(false); setSelected(null); setZoom(1); };
  const select = (id: string) => setSelected((old) => old === id ? null : id);
  const docById = new Map(ws.docs.map((d) => [d.id, d]));

  return <>
    <PageHeader title="Policy Map" intro="Trace how your documents connect through extracted rules and open findings. Select a document to follow its sources and see what needs review." actions={<BtnLink href="/rules" icon="rules">Rule Registry</BtnLink>} />
    <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[
        { label: "Documents", value: ws.docs.length, hint: "Across the workspace" },
        { label: "Rules in force", value: live.length, hint: "Historical rules excluded" },
        { label: "Connected pairs", value: links.length, hint: "Shared topics or cited evidence" },
        { label: "Open findings", value: openFindings.length, hint: "Including single-document issues" },
      ].map((stat) => <Card key={stat.label} className="px-4 py-4"><p className="text-[12px] font-semibold text-mute">{stat.label}</p><p className="mt-2 text-[28px] leading-none font-bold tracking-[-0.035em] tabular-nums">{stat.value}</p><p className="mt-2 text-[11px] text-mute">{stat.hint}</p></Card>)}
    </div>
    {ws.docs.length === 0 ? <Card><Empty icon="graph" title="Your policy map starts with documents" body="Add policies and SOPs, then run a scan to extract rules and find relationships." action={<BtnLink href="/documents" variant="ink">Open Document Library</BtnLink>} /></Card> : <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search documents, owners or topics" className="min-w-[200px] flex-1" />
        <Select aria-label="Filter by topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full sm:w-[170px]" options={[allOption("All topics"), ...topics.map((t) => ({ value: t, label: topicLabel(t) }))]} />
        <Select aria-label="Filter by department" value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full sm:w-[180px]" options={[allOption("All departments"), ...departments]} />
        <Btn aria-pressed={onlyOpen} variant={onlyOpen ? "ink" : "outline"} onClick={() => setOnlyOpen(!onlyOpen)}>With open findings</Btn>
        {filtered && <Btn variant="ghost" onClick={reset}>Clear filters</Btn>}
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="min-w-0 overflow-hidden">
          <CardHead title="Document relationships" hint={<span role="status">{docs.length} of {ws.docs.length} documents · {visibleLinks.length} visible connections</span>} action={<Segmented label="Map view" value={view} onChange={setView} options={[{ id: "map", label: "Map" }, { id: "list", label: "List" }]} />} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-line px-5 py-3">
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-mute"><span className="flex items-center gap-2"><span className="h-px w-5 bg-mute/50" />Shared rule topic</span><span className="flex items-center gap-2"><span className="h-[2px] w-5 bg-red" />Cited in an open finding</span></div>
            {view === "map" && <div className="flex items-center gap-1"><Btn size="sm" aria-label="Zoom out" disabled={zoom <= .6} onClick={() => setZoom((z) => Math.max(.6, +(z - .2).toFixed(1)))}>−</Btn><span className="w-10 text-center text-[11px] tabular-nums">{Math.round(zoom * 100)}%</span><Btn size="sm" aria-label="Zoom in" disabled={zoom >= 1.6} onClick={() => setZoom((z) => Math.min(1.6, +(z + .2).toFixed(1)))}>+</Btn><Btn size="sm" onClick={() => { setZoom(1); setSelected(null); }}>Reset</Btn></div>}
          </div>
          {!docs.length ? <Empty icon="graph" title="No documents match" body="Try another topic, department or search term." action={<Btn onClick={reset}>Clear filters</Btn>} /> : view === "map" ? <PolicyGraph docs={docs} links={visibleLinks} selected={active?.id ?? null} onSelect={select} zoom={zoom} issueCounts={Object.fromEntries(docs.map((d) => [d.id, openFindings.filter((f) => f.evidence.some((e) => e.docId === d.id)).length]))} /> : <div className="divide-y divide-line">{docs.map((d) => {
            const related = visibleLinks.filter((l) => l.a === d.id || l.b === d.id);
            const findings = openFindings.filter((f) => f.evidence.some((e) => e.docId === d.id));
            return <button type="button" key={d.id} aria-pressed={active?.id === d.id} onClick={() => select(d.id)} className={`flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-fog focus-visible:outline-2 focus-visible:-outline-offset-2 ${active?.id === d.id ? "bg-fog" : ""}`}><span className="min-w-0 flex-1"><span className="block text-[13px] font-bold">{d.title}</span><span className="mt-1 block text-[11px] text-mute">{AUTHORITY_LABEL[d.authority]} · {d.department || "No department"} · {d.id}</span></span><span className="text-[12px] text-mute">{related.length} connections · {findings.length} open</span><Icon name="arrow" className="size-4" /></button>;
          })}</div>}
          <p className="border-t border-line px-5 py-3 text-[11px] leading-relaxed text-mute">Shared topics do not establish agreement or compliance. Red links mean documents are cited together, including historical versions; findings still need review. Single-document findings appear in document details.</p>
        </Card>
        <Card className="min-w-0" aria-label="Document details">
          {active ? <>
            <CardHead title="Document details" action={<Btn size="sm" variant="ghost" aria-label="Clear document selection" onClick={() => setSelected(null)}>Close</Btn>} />
            <div className="px-5 pb-5 pt-4">
              <p className="font-mono text-[11px] text-mute">{active.id} · v{active.versions[active.current]?.version ?? "—"}</p>
              <h3 className="mt-2 text-[18px] leading-snug font-bold">{active.title}</h3>
              <p className="mt-2 text-[12px] text-mute">{AUTHORITY_LABEL[active.authority]} · {active.approval}</p>
              <dl className="mt-4 grid grid-cols-[90px_1fr] gap-y-2 text-[12px]"><dt className="text-mute">Owner</dt><dd>{active.owner || "Unassigned"}</dd><dt className="text-mute">Department</dt><dd>{active.department || "Not set"}</dd><dt className="text-mute">Scope</dt><dd>{active.scope || "Not set"}</dd><dt className="text-mute">Current rules</dt><dd>{live.filter((r) => r.docId === active.id).length}</dd></dl>
              {active.parseIssue && <p className="mt-4 rounded-[8px] border border-line p-3 text-[12px]">Text needs review: {active.parseIssue}</p>}
              <div className="mt-4 flex flex-wrap gap-2"><BtnLink size="sm" href={`/documents?doc=${encodeURIComponent(active.id)}`}>View document</BtnLink><BtnLink size="sm" href={`/rules?doc=${encodeURIComponent(active.id)}`}>View rules</BtnLink></div>
              <h4 className="mt-6 text-[13px] font-bold">Connections <span className="text-mute">({activeLinks.length})</span></h4>
              <p className="mt-1 text-[11px] text-mute">All connections, including documents outside your filters.</p>
              <ul className="mt-3 divide-y divide-line">{activeLinks.map((link) => {
                const other = docById.get(link.a === active.id ? link.b : link.a)!;
                return <li key={link.id} className="py-3"><AppLink href={`/documents?doc=${encodeURIComponent(other.id)}`} className="text-[13px] font-semibold underline decoration-line underline-offset-4">{other.title}</AppLink>{!shown.has(other.id) && <span className="ml-2 text-[10px] text-mute">Outside filters</span>}{link.topics.length > 0 && <p className="mt-1 text-[11px] text-mute">Shared topic: {link.topics.map(topicLabel).join(", ")}</p>}{link.findings.length > 0 && <p className="mt-1 flex items-center gap-1.5 text-[11px]"><span className="size-1.5 rounded-full bg-red" />{link.findings.length} open finding{link.findings.length === 1 ? "" : "s"}</p>}</li>;
              })}</ul>
              {!activeLinks.length && <p className="mt-3 text-[12px] text-mute">No shared topics or cross-document findings yet.</p>}
              <h4 className="mt-5 text-[13px] font-bold">Open findings ({activeFindings.length})</h4>
              <ul className="mt-3 space-y-3">{activeFindings.map((f) => <li key={f.id} className="rounded-[8px] border border-line p-3"><AppLink href={`/findings?id=${encodeURIComponent(f.id)}`} className="text-[12px] font-semibold underline decoration-line underline-offset-4">{f.title}</AppLink><div className="mt-2"><StatusBadge status={f.status} /></div>{f.evidence.filter((e) => e.docId === active.id).map((e, i) => <p key={i} className="mt-2 text-[11px] leading-relaxed text-mute">v{e.version} · §{e.sectionRef} · p. {e.page} · {e.verified ? "Verified quote" : "Quote needs review"}<span className="mt-1 block text-ink">“{e.quote}”</span></p>)}<AppLink href={`/evidence?id=${encodeURIComponent(f.id)}`} className="mt-2 inline-block text-[11px] font-semibold underline underline-offset-4">Compare evidence</AppLink></li>)}</ul>
              {!activeFindings.length && <p className="mt-3 text-[12px] text-mute">No open findings cite this document. This does not establish compliance.</p>}
            </div>
          </> : <Empty icon="graph" title="Follow a connection" body="Select any document on the map or in the list to see its rules, related documents and exact finding evidence." />}
        </Card>
      </div>
    </>}
  </>;
}
