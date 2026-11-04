"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { FileLogo } from "@/components/app/FileLogo";
import { Icon } from "@/components/app/icons";
import { AppLink, Btn, Drawer, Empty, Marked, PageHeader, SearchInput, Select } from "@/components/app/ui";
import { TopicTicks, type Tick } from "@/components/app/viz";
import { RuleOrbit, type OrbitRule } from "@/components/three/RuleOrbit";
import { eventLabel, fmtValue, topicLabel } from "@/lib/app/labels";
import { useWorkspace } from "@/lib/app/store";
import type { Finding, Lang, Modality, Rule, Status } from "@/lib/app/types";

const OPEN: Status[] = ["detected", "under_review", "confirmed", "assigned", "revision_proposed", "approved", "rejected", "rescanned"];
const LANG: Record<Lang, string> = { en: "English", zh: "中文", mixed: "English + 中文" };
const MODALITY: Record<Modality, string> = { must: "Must", must_not: "Must not", should: "Should", may: "May" };
const MODALITIES = Object.keys(MODALITY) as Modality[];
const MOD_LOOK: Record<Modality, string> = {
  must: "bg-ink text-paper",
  must_not: "bg-red text-white",
  should: "border border-ink/35 text-ink",
  may: "border border-line text-mute",
};

/** Same row look as the other library pages: white, hairline border, 10px corners. */
const ROW_STYLE: CSSProperties = { background: "#ffffff", border: "1px solid #e5e5e3", borderRadius: 10, color: "#171717" };
/** Desktop columns: rule, requirement, source, status, arrow. */
const COLS = "xl:grid xl:grid-cols-[minmax(0,1fr)_184px_216px_104px_16px] xl:items-center xl:gap-x-6";
const SEL = "[&_select]:rounded-[8px] [&_select]:font-semibold";
const TOPIC_ROW = 44;

type Scope = "current" | "historical" | "all";

function ModalityPill({ m }: { m: Modality }) {
  return <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap ${MOD_LOOK[m]}`}>{MODALITY[m]}</span>;
}
function StatusPill({ r }: { r: Rule }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap ${r.historical ? "border border-line text-mute" : "border border-ink/35 text-ink"}`}>
      {r.historical ? "Superseded" : "In force"}
    </span>
  );
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- page ---------- */

export default function RuleRegistry() {
  const { ws } = useWorkspace();
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("all");
  const [modality, setModality] = useState<Modality | "all">("all");
  const [doc, setDoc] = useState("all");
  const [scope, setScope] = useState<Scope>("current");
  const [openId, setOpenId] = useState<string | null>(null);
  const [hover, setHover] = useState(-1);

  // deep links: ?rule=R-0001, ?topic=refund, ?doc=D-001
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      if (p.get("rule")) setOpenId(p.get("rule"));
      if (p.get("topic")) setTopic(p.get("topic")!);
      if (p.get("doc")) {
        setDoc(p.get("doc")!);
        setScope("all");
      }
    });
  }, []);
  const openRule = (id: string | null) => {
    setOpenId(id);
    const url = new URL(window.location.href);
    url.searchParams.delete("rule");
    if (id) url.searchParams.set("rule", id);
    window.history.replaceState(null, "", url);
  };

  // which rules open findings cite, and which pairs they set against each other
  const cited = useMemo(() => {
    const by = new Map<string, Finding[]>();
    const pairs: [string, string][] = [];
    // evidence points at a section; the rule is the one in that section whose wording the quote shares
    const ruleFor = (e: Finding["evidence"][number]) => {
      if (e.ruleId) return [e.ruleId];
      const here = ws.rules.filter((r) => r.docId === e.docId && r.version === e.version && r.sectionId === e.sectionId);
      const worded = here.filter((r) => r.quote.includes(e.quote) || e.quote.includes(r.quote));
      return (worded.length ? worded : here).map((r) => r.id);
    };
    for (const f of ws.findings) {
      if (!OPEN.includes(f.status)) continue;
      const ids = [...new Set(f.evidence.flatMap(ruleFor))];
      for (const id of ids) by.set(id, [...(by.get(id) ?? []), f]);
      for (let i = 1; i < ids.length; i++) pairs.push([ids[0], ids[i]]);
    }
    return { by, pairs };
  }, [ws.findings, ws.rules]);

  const docOf = useMemo(() => new Map(ws.docs.map((d) => [d.id, d])), [ws.docs]);
  const live = ws.rules.filter((r) => !r.historical);
  const docsWithRules = new Set(live.map((r) => r.docId)).size;

  const topics = useMemo(() => {
    const tally = new Map<string, Rule[]>();
    for (const r of ws.rules) tally.set(r.topic, [...(tally.get(r.topic) ?? []), r]);
    return [...tally.entries()]
      .map(([id, rules]) => ({ id, rules: rules.sort((a, b) => Number(a.historical) - Number(b.historical)) }))
      .sort((a, b) => b.rules.filter((r) => !r.historical).length - a.rules.filter((r) => !r.historical).length || a.id.localeCompare(b.id));
  }, [ws.rules]);

  const orbit = useMemo(() => {
    const index = new Map(topics.map((t, i) => [t.id, i]));
    const list: OrbitRule[] = ws.rules.map((r) => ({ id: r.id, topic: index.get(r.topic) ?? 0, hot: cited.by.has(r.id) }));
    const at = new Map(list.map((r, i) => [r.id, i]));
    const links = cited.pairs.map(([a, b]) => [at.get(a), at.get(b)]).filter((l): l is [number, number] => l[0] !== undefined && l[1] !== undefined);
    return { list, links };
  }, [ws.rules, topics, cited]);

  const byModality = MODALITIES.map((m) => ({ m, n: live.filter((r) => r.modality === m).length }));

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ws.rules
      .filter(
        (r) =>
          (scope === "all" || (scope === "historical") === r.historical) &&
          (topic === "all" || r.topic === topic) &&
          (modality === "all" || r.modality === modality) &&
          (doc === "all" || r.docId === doc) &&
          (!needle || [r.quote, r.id, r.subject, r.actor, r.action, docOf.get(r.docId)?.title].some((s) => s?.toLowerCase().includes(needle))),
      )
      .sort((a, b) => Number(cited.by.has(b.id)) - Number(cited.by.has(a.id)) || a.topic.localeCompare(b.topic) || a.id.localeCompare(b.id));
  }, [ws.rules, q, scope, topic, modality, doc, docOf, cited.by]);

  const clear = () => {
    setQ("");
    setTopic("all");
    setModality("all");
    setDoc("all");
    setScope("current");
  };
  const rule = ws.rules.find((r) => r.id === openId) ?? null;
  const activeTopic = topics.findIndex((t) => t.id === topic);
  const ticks: Tick[][] = topics.map((t) => t.rules.map((r) => (r.historical ? "old" : cited.by.has(r.id) ? "hot" : "live")));

  return (
    <>
      <PageHeader
        title="Rule Registry"
        intro={
          <>
            {plural(live.length, "rule")} in force from {plural(docsWithRules, "document")} · {plural(topics.length, "topic")}. Every instruction KeroSOP extracted, with the exact sentence
            and where it came from. Scans only compare rules that share a topic, subject and scope.
          </>
        }
      />

      {ws.rules.length === 0 ? (
        <div style={ROW_STYLE}>
          <Empty
            icon="rules"
            title="No rules yet"
            body="Rules appear here as soon as documents are uploaded and read."
            action={
              <AppLink href="/documents?upload=1" className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-red px-4.5 text-[14px] font-semibold text-white hover:bg-red-deep">
                <Icon name="upload" className="size-4" /> Upload documents
              </AppLink>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid gap-4 pb-8 xl:grid-cols-12">
            {/* WebGL: topics as orbits, rules as nodes, conflicts as red arcs */}
            <section className="on-dark relative min-h-[430px] overflow-hidden sm:min-h-[340px] rounded-[12px] border border-[#37373b] bg-black text-white xl:col-span-7">
              <RuleOrbit key={`${orbit.list.length}-${orbit.links.length}`} rules={orbit.list} links={orbit.links} topics={topics.length} />
              <div className="pointer-events-none relative flex h-full flex-col gap-8 p-7 sm:justify-between">
                <p className="font-mono text-[11px] tracking-[0.14em] text-white/60 uppercase">Rules in force · {plural(docsWithRules, "document")}</p>
                <div>
                  <div className="flex items-end gap-4">
                    <p className="display text-[96px] leading-[0.82]">{live.length}</p>
                    <p className="pb-1 text-[13px] leading-[1.45] text-white/70">
                      across {plural(topics.length, "topic")}
                      <br />
                      <span className="text-red">{plural(new Set([...cited.by.keys()]).size, "rule")}</span> cited by open findings
                    </p>
                  </div>
                  <dl className="mt-7 flex gap-8">
                    {byModality.map(({ m, n }) => (
                      <div key={m}>
                        <dt className="text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-white/60 uppercase">{MODALITY[m]}</dt>
                        <dd className="mt-1 text-[20px] font-semibold tabular-nums">{n}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <p className="hidden max-w-[250px] text-[12px] leading-[1.5] text-white/50 sm:block">Each ring is a topic. Red rules are cited by an open finding; arcs join rules that conflict.</p>
              </div>
            </section>

            {/* p5: one tick per rule, by topic; doubles as the topic filter */}
            <section style={{ ...ROW_STYLE, borderRadius: 12 }} className="flex flex-col xl:col-span-5">
              <header className="flex items-start justify-between gap-3 px-5 pt-5">
                <div>
                  <h2 className="text-[15px] font-bold">By topic</h2>
                  <p className="mt-0.5 text-[13px] leading-[1.45] text-mute">One tick per rule; red is cited by an open finding. Select a topic to filter.</p>
                </div>
                {topic !== "all" && (
                  <button type="button" onClick={() => setTopic("all")} className="h-8 shrink-0 text-[13px] font-semibold hover:text-red">
                    Show all
                  </button>
                )}
              </header>
              <div className="relative mx-5 mt-3 mb-4" onPointerLeave={() => setHover(-1)}>
                <TopicTicks rows={ticks} row={TOPIC_ROW} x0={144} x1={52} active={activeTopic} hover={hover} />
                <ul>
                  {topics.map((t, i) => {
                    const on = t.id === topic;
                    const n = t.rules.filter((r) => !r.historical).length;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onPointerEnter={() => setHover(i)}
                          onFocus={() => setHover(i)}
                          onBlur={() => setHover(-1)}
                          onClick={() => setTopic(on ? "all" : t.id)}
                          style={{ height: TOPIC_ROW }}
                          className={`relative grid w-full grid-cols-[132px_minmax(0,1fr)_40px] items-center gap-3 text-left text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${on ? "font-semibold text-red" : "hover:text-red"}`}
                        >
                          <span className="truncate font-semibold">{topicLabel(t.id)}</span>
                          <span />
                          <span className="text-right tabular-nums">{n}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-2 gap-2 pb-5 xl:grid-cols-[minmax(200px,1fr)_170px_170px_200px_150px]">
            <SearchInput value={q} onChange={setQ} placeholder="Search wording, code, subject or document" className="col-span-2 xl:col-span-1 [&_input]:rounded-[8px]" />
            <Select aria-label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} options={[{ value: "all", label: "All topics" }, ...topics.map((t) => ({ value: t.id, label: topicLabel(t.id) }))]} className={SEL} />
            <Select
              aria-label="Requirement"
              value={modality}
              onChange={(e) => setModality(e.target.value as Modality | "all")}
              options={[{ value: "all", label: "All requirements" }, ...MODALITIES.map((m) => ({ value: m, label: MODALITY[m] }))]}
              className={SEL}
            />
            <Select
              aria-label="Document"
              value={doc}
              onChange={(e) => setDoc(e.target.value)}
              options={[{ value: "all", label: "All documents" }, ...ws.docs.filter((d) => ws.rules.some((r) => r.docId === d.id)).map((d) => ({ value: d.id, label: d.title }))]}
              className={SEL}
            />
            <Select
              aria-label="Version"
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              options={[
                { value: "current", label: "In force" },
                { value: "historical", label: "Superseded" },
                { value: "all", label: "All versions" },
              ]}
              className={SEL}
            />
          </div>

          <div className={`hidden pr-5 pb-2.5 text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-mute uppercase ${COLS}`}>
            <span>Rule</span>
            <span>Requirement</span>
            <span>Source</span>
            <span>Status</span>
            <span />
          </div>

          {rows.length ? (
            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <RuleRow key={r.id} rule={r} docTitle={docOf.get(r.docId)?.title ?? r.docId} findings={cited.by.get(r.id) ?? []} onOpen={() => openRule(r.id)} />
              ))}
            </ul>
          ) : (
            <div style={ROW_STYLE}>
              <Empty icon="search" title="No rules match" body="Try another search or clear the filters." action={<Btn onClick={clear}>Clear filters</Btn>} />
            </div>
          )}
          <p className="pt-4 text-[12px] text-mute">
            Showing {rows.length} of {ws.rules.length}
          </p>
        </>
      )}

      <RuleDrawer rule={rule} findings={rule ? (cited.by.get(rule.id) ?? []) : []} onClose={() => openRule(null)} onOpen={openRule} />
    </>
  );
}

/* ---------- one rule row ---------- */

function RuleRow({ rule, docTitle, findings, onOpen }: { rule: Rule; docTitle: string; findings: Finding[]; onOpen(): void }) {
  const value = fmtValue(rule);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        style={ROW_STYLE}
        className={`group flex w-full flex-col gap-3 px-5 py-4 text-left transition-[border-color] hover:!border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red xl:h-[76px] xl:py-0 ${COLS}`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold">{rule.quote}</span>
            <span className="mt-0.5 block truncate text-[12px] text-mute">
              {rule.id} · {topicLabel(rule.topic)}
              {rule.subject && rule.subject !== rule.topic ? ` · ${rule.subject}` : ""}
              {findings.length > 0 && <span className="font-semibold text-red"> · Cited by {findings.map((f) => f.id).join(", ")}</span>}
            </span>
          </span>
          <Icon name="chevron" className="size-4 shrink-0 text-mute transition-colors group-hover:text-ink xl:hidden" />
        </span>

        <span className="hidden min-w-0 items-center gap-2 xl:flex">
          <ModalityPill m={rule.modality} />
          {value && <span className="truncate text-[13px] tabular-nums">{value}</span>}
        </span>
        <span className="hidden min-w-0 xl:block">
          <span className="block truncate text-[13px]">{docTitle}</span>
          <span className="mt-0.5 block truncate text-[12px] text-mute">
            §{rule.sectionRef} · p.{rule.page} · v{rule.version}
          </span>
        </span>
        <span className="hidden xl:block">
          <StatusPill r={rule} />
        </span>
        <Icon name="chevron" className="hidden size-4 text-mute transition-colors group-hover:text-ink xl:block" />

        <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-mute xl:hidden">
          <ModalityPill m={rule.modality} />
          {value && <span className="tabular-nums text-ink">{value}</span>}
          <span className="min-w-0 truncate">
            {docTitle} · §{rule.sectionRef}
          </span>
          <StatusPill r={rule} />
        </span>
      </button>
    </li>
  );
}

/* ---------- details drawer ---------- */

function RuleDrawer({ rule, findings, onClose, onOpen }: { rule: Rule | null; findings: Finding[]; onClose(): void; onOpen(id: string): void }) {
  const { ws } = useWorkspace();
  if (!rule) return null;
  const doc = ws.docs.find((d) => d.id === rule.docId);
  const related = ws.rules.filter((r) => r.id !== rule.id && r.topic === rule.topic && r.subject === rule.subject && !r.historical);
  const value = fmtValue(rule);

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span className="block min-w-0">
          <span className="block truncate">
            {MODALITY[rule.modality]}
            {value ? ` · ${value}` : ""}
          </span>
          <span className="block truncate text-[12px] font-normal text-mute">
            {rule.id} · {topicLabel(rule.topic)}
            {rule.subject && rule.subject !== rule.topic ? ` · ${rule.subject}` : ""}
          </span>
        </span>
      }
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-wrap items-center gap-2">
          <ModalityPill m={rule.modality} />
          <StatusPill r={rule} />
          {findings.length > 0 && <span className="text-[13px] font-semibold text-red">Cited by {plural(findings.length, "open finding")}</span>}
        </div>

        <section>
          <h3 className="mb-3 text-[13px] font-bold">Exact wording</h3>
          <blockquote className="rounded-[10px] border border-line px-4 py-3.5 text-[15px] leading-[1.6]">
            <Marked text={rule.quote} mark={rule.valueText} />
          </blockquote>
        </section>

        <section>
          <h3 className="mb-3 text-[13px] font-bold">What KeroSOP read</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
            <Fact label="Who">{rule.actor || "Not stated"}</Fact>
            <Fact label="Does what">{rule.action || "—"}</Fact>
            <Fact label="When">{rule.event ? cap(eventLabel(rule.event)) : "—"}</Fact>
            <Fact label="Limit">{value ? `${value}${rule.period ? ` per ${rule.period}` : ""}` : "None"}</Fact>
            <Fact label="Applies to">{rule.scope || "All regions"}</Fact>
            <Fact label="Language">{LANG[rule.lang]}</Fact>
          </dl>
          <div className="mt-4 text-[13px]">
            <p className="text-[12px] text-mute">Conditions</p>
            {rule.conditions.length ? (
              <ul className="mt-1 flex flex-col gap-1 font-semibold">
                {rule.conditions.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-0.5 font-semibold">None</p>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-[13px] font-bold">Source</h3>
          {doc ? (
            <AppLink href={`/documents?doc=${doc.id}`} className="flex h-14 items-center gap-3 rounded-[10px] border border-line px-3 transition-colors hover:border-ink/40">
              <FileLogo kind={doc.kind} className="size-8 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{doc.title}</span>
                <span className="block truncate text-[12px] text-mute">
                  {doc.id} · §{rule.sectionRef} · page {rule.page} · v{rule.version}
                </span>
              </span>
              <Icon name="chevron" className="size-4 text-mute" />
            </AppLink>
          ) : (
            <p className="text-[13px] text-mute">The document has since been deleted.</p>
          )}
        </section>

        {findings.length > 0 && (
          <section>
            <h3 className="mb-3 text-[13px] font-bold">Open findings citing it</h3>
            <ul className="flex flex-col gap-2">
              {findings.map((f) => (
                <li key={f.id} className="flex h-14 items-center gap-3 rounded-[10px] border border-line px-3">
                  <span className="w-16 shrink-0 font-mono text-[12px] text-mute">{f.id}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{f.title}</span>
                  <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold capitalize ${f.risk === "high" ? "bg-red text-white" : "border border-ink/35 text-ink"}`}>{f.risk}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-1 text-[13px] font-bold">Compared with</h3>
          <p className="mb-3 text-[12px] text-mute">Other rules in force on the same topic and subject.</p>
          {related.length ? (
            <ul className="flex flex-col gap-2">
              {related.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => onOpen(r.id)} className="flex h-14 w-full items-center gap-3 rounded-[10px] border border-line px-3 text-left transition-colors hover:border-ink/40">
                    <ModalityPill m={r.modality} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{r.quote}</span>
                      <span className="block truncate text-[12px] text-mute">
                        {r.id} · {ws.docs.find((d) => d.id === r.docId)?.title ?? r.docId}
                        {fmtValue(r) ? ` · ${fmtValue(r)}` : ""}
                      </span>
                    </span>
                    <Icon name="chevron" className="size-4 shrink-0 text-mute" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-mute">No other rule in force covers this.</p>
          )}
        </section>
      </div>
    </Drawer>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-mute">{label}</dt>
      <dd className="mt-0.5 font-semibold break-words">{children}</dd>
    </div>
  );
}
