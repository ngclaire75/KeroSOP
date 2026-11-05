"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CountUp } from "@/components/app/charts";
import { Icon } from "@/components/app/icons";
import { AppLink, Avatar, Btn, Drawer, Empty, ListFooter, PageHeader, SearchInput, Select, ago, fmtDate, useToast, usePaged } from "@/components/app/ui";
import { AsiaMap } from "@/components/three/AsiaMap";
import { useWorkspace } from "@/lib/app/store";
import { prefersReducedMotion } from "@/lib/random";
import type { AuditEvent } from "@/lib/app/types";
import { ActivityStrip, STRIP_GAP } from "./ActivityStrip";
import { KINDS, KIND_LABEL, KIND_LOOK, KIND_PLURAL, PERIOD_LABEL, csvCell, dayKey, isScan, kindOf, linkFor, placeOf, placesFor, sentence, shortId, tallyDays, type Kind, type Period } from "./model";

/** Same row look as the other library pages: white, hairline border, 10px corners. */
const ROW_STYLE: CSSProperties = { background: "#ffffff", border: "1px solid #e5e5e3", borderRadius: 10, color: "#171717" };
/** Desktop columns: entry, who, activity, when, arrow. */
const COLS = "xl:grid xl:grid-cols-[minmax(0,1fr)_200px_112px_136px_16px] xl:items-center xl:gap-x-6";
const SEL = "[&_button]:rounded-[8px] font-semibold";
/** Each day gets about this many px of strip, so bars keep their shape at any width. */
const DAY_PX = 12;
const HERO_KINDS: Kind[] = ["decision", "finding", "document", "workspace"];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const dayShort = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const full = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function KindPill({ kind }: { kind: Kind }) {
  return <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap ${KIND_LOOK[kind]}`}>{KIND_LABEL[kind]}</span>;
}

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------- page ---------- */

export default function AuditHistory() {
  const { ws, logExport } = useWorkspace();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [who, setWho] = useState("all");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [period, setPeriod] = useState<Period>("all");
  const [day, setDay] = useState<string | null>(null);
  const [hover, setHover] = useState(-1);
  const [openId, setOpenId] = useState<string | null>(null);
  // one clock for the whole render, so "Last 7 days" and the strip agree
  const [now] = useState(() => Date.now());
  const [span, setSpan] = useState(30);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSpan(Math.max(21, Math.min(90, Math.floor((el.clientWidth + STRIP_GAP) / DAY_PX)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ws.audit.length]);

  // deep links: ?event=123, ?q=SOP-004
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      if (p.get("event")) setOpenId(p.get("event"));
      if (p.get("q")) setQ(p.get("q")!);
    });
  }, []);
  const openEvent = (id: string | null) => {
    setOpenId(id);
    const url = new URL(window.location.href);
    url.searchParams.delete("event");
    if (id) url.searchParams.set("event", id);
    window.history.replaceState(null, "", url);
  };

  // newest first, as the API sends it; sorted again in case entries arrive out of order. Scan runs live on Document Scan.
  const events = useMemo(() => ws.audit.filter((a) => !isScan(a.action)).sort((a, b) => b.at.localeCompare(a.at)), [ws.audit]);
  const people = useMemo(() => [...new Set(events.map((a) => a.actor))].sort((a, b) => (a === "System" ? 1 : b === "System" ? -1 : a.localeCompare(b))), [events]);
  const days = useMemo(() => tallyDays(events, span, now), [events, span, now]);
  const tally = useMemo(() => {
    const by = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<Kind, number>;
    for (const a of events) by[kindOf(a.action)]++;
    return by;
  }, [events]);
  const places = useMemo(() => placesFor(ws.settings.regions ?? []), [ws.settings.regions]);
  const countries = [...new Set(places.map((p) => p.code))];

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const since = period === "all" ? 0 : now - Number(period) * 86400000;
    return events.filter(
      (a) =>
        (who === "all" || a.actor === who) &&
        (kind === "all" || kindOf(a.action) === kind) &&
        (!since || new Date(a.at).getTime() >= since) &&
        (!day || dayKey(a.at) === day) &&
        (!needle || [a.actor, a.action, a.target, a.detail, sentence(a)].some((s) => s?.toLowerCase().includes(needle))),
    );
  }, [events, q, who, kind, period, day, now]);
  const paged = usePaged(rows);

  // anime.js: each page of rows settles in from just below, one after another
  const list = useRef<HTMLUListElement>(null);
  const pageKey = `${paged.page}|${paged.items.map((a) => a.id).join(",")}`;
  useEffect(() => {
    const el = list.current;
    if (!el || prefersReducedMotion()) return;
    const items = [...el.children] as HTMLElement[];
    let stop = () => {};
    import("animejs").then(({ animate, stagger }) => {
      const run = animate(items, {
        opacity: [0, 1],
        translateY: [8, 0],
        delay: stagger(28),
        duration: 420,
        ease: "outQuart",
        onComplete: () => items.forEach((i) => i.style.removeProperty("transform")),
      });
      stop = () => {
        run.cancel();
        items.forEach((i) => i.style.removeProperty("transform"));
        items.forEach((i) => i.style.removeProperty("opacity"));
      };
    });
    return () => stop();
  }, [pageKey]);

  const clear = () => {
    setQ("");
    setWho("all");
    setKind("all");
    setPeriod("all");
    setDay(null);
  };

  const exportCsv = async () => {
    const out = [
      ["Entry", "Time (UTC)", "Who", "Activity", "Action", "Target", "Detail"],
      ...rows.map((a) => [a.id, new Date(a.at).toISOString(), a.actor, KIND_LABEL[kindOf(a.action)], a.action, a.target, a.detail ?? ""]),
    ];
    download(`kerosop-audit-history-${new Date().toISOString().slice(0, 10)}.csv`, "﻿" + out.map((r) => r.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
    await logExport("Audit history (CSV)").catch(() => {});
    toast("CSV downloaded");
  };

  const activeDay = days.findIndex((d) => d.key === day);
  const shown = hover >= 0 ? days[hover] : activeDay >= 0 ? days[activeDay] : null;
  const inRange = days.reduce((s, d) => s + d.n, 0);
  const busiest = days.reduce((m, d) => (d.n > m.n ? d : m), days[0]);
  const activePeople = new Set(events.filter((a) => days.some((d) => d.key === dayKey(a.at))).map((a) => a.actor)).size;
  const event = events.find((a) => a.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Audit History"
        intro={
          <>
            Every decision, upload, export and access change in this workspace, with who made it and when. Entries are append-only: no one, including owners, can edit or delete
            them.
          </>
        }
        actions={
          events.length > 0 && (
            <Btn icon="download" onClick={exportCsv}>
              Export CSV
            </Btn>
          )
        }
      />

      {events.length === 0 ? (
        <div style={ROW_STYLE}>
          <Empty icon="clock" title="Nothing logged yet" body="Entries appear here as soon as someone uploads a document or reviews a finding." />
        </div>
      ) : (
        <>
          <div className="grid gap-4 pb-8 xl:grid-cols-12">
            {/* WebGL: China and Southeast Asia as a dot matrix; the countries this workspace's regions are in glow red */}
            <section className="on-dark relative min-h-[560px] overflow-hidden rounded-[12px] border border-[#37373b] bg-black text-white sm:min-h-[340px] xl:col-span-7">
              <AsiaMap key={places.map((p) => p.region).join("|")} active={countries} pins={places} />
              <div className="pointer-events-none relative flex h-full flex-col gap-8 p-7 sm:justify-between">
                <p className="font-mono text-[11px] tracking-[0.14em] text-white/60 uppercase">
                  Append-only log · since {fmtDate(events.at(-1)?.at)}
                </p>
                <div>
                  <div className="flex items-end gap-4">
                    <CountUp value={events.length} className="display text-[96px] leading-[0.82]" />
                    <p className="pb-1 text-[13px] leading-[1.45] text-white/70">
                      {events.length === 1 ? "entry" : "entries"} by {plural(people.length, "person", "people")}
                      <br />
                      <span className="text-red">{plural(tally.decision, "decision")}</span> on findings
                    </p>
                  </div>
                  <dl className="mt-7 grid max-w-[260px] grid-cols-2 gap-x-6 gap-y-4">
                    {HERO_KINDS.map((k) => (
                      <div key={k}>
                        <dt className="text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-white/60 uppercase">{k === "finding" ? "Findings" : KIND_PLURAL[k]}</dt>
                        <dd className="mt-1 text-[20px] font-semibold tabular-nums">{tally[k]}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <p className="hidden max-w-[260px] text-[12px] leading-[1.5] text-white/50 sm:block">
                  {places.length
                    ? `Red countries hold this workspace's regions: ${places.map((p) => p.region).join(" and ")}.`
                    : "Add regions in China or Southeast Asia in Settings to mark them on the map."}
                </p>
              </div>
            </section>

            {/* p5: one block per entry per day; doubles as the day filter */}
            <section style={{ ...ROW_STYLE, borderRadius: 12 }} className="flex min-w-0 flex-col xl:col-span-5">
              <header className="flex items-start justify-between gap-3 px-5 pt-5">
                <div>
                  <h2 className="text-[15px] font-bold">Activity by day</h2>
                  <p className="mt-0.5 text-[13px] leading-[1.45] text-mute">One block per entry; red blocks are decisions. Select a day to filter.</p>
                </div>
                {day && (
                  <button type="button" onClick={() => setDay(null)} className="h-8 shrink-0 text-[13px] font-semibold hover:text-red">
                    Show all
                  </button>
                )}
              </header>

              <p className="mt-4 h-5 px-5 text-[13px] tabular-nums" aria-live="polite">
                {shown ? (
                  <>
                    <b className="font-semibold">{fmtDate(shown.date.toISOString())}</b>
                    <span className="text-mute">
                      {" "}
                      · {plural(shown.n, "entry", "entries")}
                      {shown.decisions > 0 && ` · ${plural(shown.decisions, "decision")}`}
                    </span>
                  </>
                ) : (
                  <span className="text-mute">
                    {dayShort(days[0].date)} – {dayShort(days[days.length - 1].date)}
                  </span>
                )}
              </p>

              <div ref={strip} className="relative mx-5 mt-3 min-h-[104px] flex-1 sm:min-h-[132px]" onPointerLeave={() => setHover(-1)}>
                <ActivityStrip days={days} active={activeDay} hover={hover} />
                <div className="absolute inset-0 flex" style={{ gap: STRIP_GAP }}>
                  {days.map((d, i) => (
                    <button
                      key={d.key}
                      type="button"
                      aria-pressed={d.key === day}
                      aria-label={`${fmtDate(d.date.toISOString())}: ${plural(d.n, "entry", "entries")}`}
                      onPointerEnter={(e) => e.pointerType !== "touch" && setHover(i)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(-1)}
                      onClick={() => setDay(d.key === day ? null : d.key)}
                      className="h-full min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
                    />
                  ))}
                </div>
              </div>
              <div className="mx-5 mt-2 flex justify-between text-[11px] text-mute tabular-nums">
                <span>{dayShort(days[0].date)}</span>
                <span>{dayShort(days[Math.floor(days.length / 2)].date)}</span>
                <span>{dayShort(days[days.length - 1].date)}</span>
              </div>

              <dl className="mx-5 mt-5 mb-5 grid grid-cols-3 gap-x-6 text-[13px]">
                <Fact label="Entries">{inRange}</Fact>
                <Fact label="Busiest day">{busiest.n ? dayShort(busiest.date) : "—"}</Fact>
                <Fact label="People active">{activePeople}</Fact>
              </dl>
            </section>
          </div>

          <div className="grid grid-cols-2 gap-2 pb-5 xl:grid-cols-[minmax(200px,1fr)_190px_170px_160px]">
            <SearchInput value={q} onChange={setQ} placeholder="Search who, what or detail" className="col-span-2 xl:col-span-1 [&_input]:rounded-[8px]" />
            <Select aria-label="Who" value={who} onChange={(e) => setWho(e.target.value)} options={[{ value: "all", label: "Everyone" }, ...people.map((p) => ({ value: p, label: p }))]} className={SEL} />
            <Select
              aria-label="Activity"
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind | "all")}
              options={[{ value: "all", label: "All activity" }, ...KINDS.map((k) => ({ value: k, label: KIND_PLURAL[k] }))]}
              className={SEL}
            />
            <Select
              aria-label="Period"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value as Period);
                setDay(null);
              }}
              options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
              className={`col-span-2 xl:col-span-1 ${SEL}`}
            />
          </div>

          <div className={`hidden pr-5 pb-2.5 text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-mute uppercase ${COLS}`}>
            <span>Entry</span>
            <span>Who</span>
            <span>Activity</span>
            <span>When</span>
            <span />
          </div>

          {rows.length ? (
            <ul ref={list} className="flex flex-col gap-2">
              {paged.items.map((a) => (
                <EventRow key={a.id} event={a} onOpen={() => openEvent(a.id)} />
              ))}
            </ul>
          ) : (
            <div style={ROW_STYLE}>
              <Empty icon="search" title="No entries match" body="Try another search or clear the filters." action={<Btn onClick={clear}>Clear filters</Btn>} />
            </div>
          )}
          <ListFooter paged={paged} />
        </>
      )}

      <EventDrawer event={event} events={events} onClose={() => openEvent(null)} onOpen={openEvent} />
    </>
  );
}

/* ---------- one entry row ---------- */

function EventRow({ event: a, onOpen }: { event: AuditEvent; onOpen(): void }) {
  const kind = kindOf(a.action);
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
            <span className="block text-[14px] leading-[1.35] font-semibold [overflow-wrap:anywhere] xl:truncate">{sentence(a)}</span>
            <span className="mt-0.5 block truncate text-[12px] text-mute">{a.detail || placeOf(linkFor(a.href))}</span>
          </span>
          <Icon name="chevron" className="size-4 shrink-0 text-mute transition-colors group-hover:text-ink xl:hidden" />
        </span>

        <span className="hidden min-w-0 items-center gap-2.5 xl:flex">
          <Avatar name={a.actor} size={26} />
          <span className="truncate text-[13px]">{a.actor}</span>
        </span>
        <span className="hidden xl:block">
          <KindPill kind={kind} />
        </span>
        <span className="hidden min-w-0 xl:block">
          <span className="block truncate text-[13px] tabular-nums">
            {fmtDate(a.at)}, {time(a.at)}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-mute">{ago(a.at)}</span>
        </span>
        <Icon name="chevron" className="hidden size-4 text-mute transition-colors group-hover:text-ink xl:block" />

        <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-mute xl:hidden">
          <KindPill kind={kind} />
          <span className="flex min-w-0 items-center gap-2 text-ink">
            <Avatar name={a.actor} size={22} />
            <span className="truncate">{a.actor}</span>
          </span>
          <span className="tabular-nums">
            {fmtDate(a.at)}, {time(a.at)}
          </span>
        </span>
      </button>
    </li>
  );
}

/* ---------- details drawer ---------- */

function EventDrawer({ event: a, events, onClose, onOpen }: { event: AuditEvent | null; events: AuditEvent[]; onClose(): void; onOpen(id: string): void }) {
  if (!a) return null;
  const kind = kindOf(a.action);
  const href = linkFor(a.href);
  // everything else logged against the same thing, oldest first
  const trail = events.filter((e) => e.target === a.target || (a.href && e.href === a.href)).reverse();

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span className="block min-w-0">
          <span className="block [overflow-wrap:anywhere]">{sentence(a)}</span>
          <span className="block truncate text-[12px] font-normal text-mute">
            Entry {shortId(a.id)} · {KIND_LABEL[kind]}
          </span>
        </span>
      }
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-wrap items-center gap-2">
          <KindPill kind={kind} />
          <span className="text-[13px] text-mute">{ago(a.at)}</span>
        </div>

        <section>
          <h3 className="mb-3 text-[13px] font-bold">Who and when</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
            <Fact label="Who">
              <span className="flex min-w-0 items-center gap-2">
                <Avatar name={a.actor} size={22} />
                <span className="truncate">{a.actor}</span>
              </span>
            </Fact>
            <Fact label="Activity">{KIND_LABEL[kind]}</Fact>
            <Fact label="When">{full(a.at)}</Fact>
            <Fact label="Entry">
              <span className="font-mono text-[12px] break-all">{a.id}</span>
            </Fact>
          </dl>
        </section>

        {a.detail && (
          <section>
            <h3 className="mb-3 text-[13px] font-bold">Detail</h3>
            <blockquote className="rounded-[10px] border border-line px-4 py-3.5 text-[15px] leading-[1.6] [overflow-wrap:anywhere]">{a.detail}</blockquote>
          </section>
        )}

        {href && (
          <section>
            <h3 className="mb-3 text-[13px] font-bold">Open</h3>
            <AppLink href={href} className="flex h-14 items-center gap-3 rounded-[10px] border border-line px-3 transition-colors hover:border-ink/40">
              <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-fog">
                <Icon name="link" className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{a.target}</span>
                <span className="block truncate text-[12px] text-mute">{placeOf(href)}</span>
              </span>
              <Icon name="chevron" className="size-4 text-mute" />
            </AppLink>
          </section>
        )}

        {trail.length > 1 && (
          <section>
            <h3 className="mb-1 text-[13px] font-bold">History of {a.target}</h3>
            <p className="mb-3 text-[12px] text-mute">Every entry about it, oldest first.</p>
            <ol className="flex flex-col gap-2">
              {trail.map((e) => {
                const here = e.id === a.id;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(e.id)}
                      aria-current={here || undefined}
                      className={`grid h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] border px-3 text-left transition-colors ${here ? "border-ink" : "border-line hover:border-ink/40"}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold">{sentence(e)}</span>
                        <span className="block truncate text-[12px] text-mute tabular-nums">
                          {e.actor} · {fmtDate(e.at)}, {time(e.at)}
                        </span>
                      </span>
                      <KindPill kind={kindOf(e.action)} />
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <p className="flex items-center gap-2 text-[12px] text-mute">
          <Icon name="lock" className="size-3.5 shrink-0" />
          Append-only. This entry can&apos;t be edited or deleted.
        </p>
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
