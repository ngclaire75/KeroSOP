/**
 * Audit History model: what kind of entry each logged action is, how it reads
 * as a sentence, and the per-day tally behind the activity strip. The API
 * writes free-text verbs (see backend service.audit calls), so kinds are
 * matched on those verbs.
 */
import type { AuditEvent } from "@/lib/app/types";

export type Kind = "decision" | "finding" | "document" | "scan" | "workspace" | "export";

/** Kinds Audit History lists. Scan runs are left out: Document Scan keeps their record. */
export const KINDS: Kind[] = ["decision", "finding", "document", "workspace", "export"];

/** Scan runs and re-scans of a finding stay on the Document Scan page, not in Audit History. */
export const isScan = (action: string) => kindOf(action) === "scan" || action === "re-scanned";

export const KIND_LABEL: Record<Kind, string> = {
  decision: "Decision",
  finding: "Finding",
  document: "Document",
  scan: "Scan",
  workspace: "Workspace",
  export: "Export",
};

/** Plural names for the Activity filter and the hero figures. */
export const KIND_PLURAL: Record<Kind, string> = {
  decision: "Decisions",
  finding: "Finding activity",
  document: "Documents",
  scan: "Scans",
  workspace: "Workspace",
  export: "Exports",
};

/** Decisions are red like the rest of the app's "needs attention" marks; the rest step down in weight. */
export const KIND_LOOK: Record<Kind, string> = {
  decision: "bg-red text-white",
  finding: "bg-ink text-paper",
  document: "border border-ink/35 text-ink",
  scan: "border border-ink/35 text-ink",
  workspace: "bg-red text-white",
  export: "border border-line text-mute",
};

const DECISION = /^(confirmed|dismissed|verified and closed|reopened|moved to review|approved the revision for|rejected the revision for)$/;
const FINDING = /^(detected|commented on|assigned .+ to|proposed a revision for|re-scanned)$/;
const DOCUMENT = /^(uploaded|uploaded a new version of|archived|marked \w+|edited details of|deleted)$/;
const SCAN = /^(started a scan|started a re-scan for|completed a scan)$/;

export function kindOf(action: string): Kind {
  if (DECISION.test(action)) return "decision";
  if (FINDING.test(action)) return "finding";
  if (DOCUMENT.test(action)) return "document";
  if (SCAN.test(action)) return "scan";
  if (action === "exported") return "export";
  return "workspace";
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Approved the revision for SOP-004". Settings changes name what changed in brackets. */
export function sentence(a: AuditEvent) {
  if (a.action.startsWith("updated ")) return `${cap(a.action)} (${a.target})`;
  return `${cap(a.action)} ${a.target}`;
}

/** An entry plus how many identical ones it stands for (see collapseRepeats). */
export type Entry = AuditEvent & { times?: number };

/**
 * Same person, same action, same target, each within a minute of the last:
 * one entry with a count. Repeat clicks (an export pressed while the print
 * dialog was slow to open) otherwise flood the list and the activity strip.
 * Expects newest first.
 */
export function collapseRepeats(events: AuditEvent[], windowMs = 60000): Entry[] {
  const out: Entry[] = [];
  let last: AuditEvent | undefined;
  for (const a of events) {
    const top = out[out.length - 1];
    if (top && last && a.actor === top.actor && a.action === top.action && a.target === top.target && (a.detail ?? "") === (top.detail ?? "") && new Date(last.at).getTime() - new Date(a.at).getTime() <= windowMs) {
      top.times = (top.times ?? 1) + 1;
    } else out.push({ ...a });
    last = a;
  }
  return out;
}

/** Local calendar day, so "today" matches the reader's clock. */
export const dayKey = (iso: string | number | Date) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export type Day = { key: string; date: Date; n: number; decisions: number };

/**
 * The last `span` days, ending today, or ending on the latest entry when
 * nothing happened in that window (an idle workspace still shows its history).
 */
export function tallyDays(events: AuditEvent[], span: number, now = Date.now()): Day[] {
  const latest = events.reduce((m, a) => Math.max(m, new Date(a.at).getTime()), 0);
  const end = latest && now - latest > span * 86400000 ? latest : now;
  const last = new Date(end);
  last.setHours(12, 0, 0, 0);
  const days: Day[] = Array.from({ length: span }, (_, i) => {
    const date = new Date(last);
    date.setDate(last.getDate() - (span - 1 - i));
    return { key: dayKey(date), date, n: 0, decisions: 0 };
  });
  const at = new Map(days.map((d) => [d.key, d]));
  for (const a of events) {
    const d = at.get(dayKey(a.at));
    if (!d) continue;
    d.n++;
    if (kindOf(a.action) === "decision") d.decisions++;
  }
  return days;
}

export type Period = "all" | "7" | "30" | "90";

export const PERIOD_LABEL: Record<Period, string> = {
  all: "All time",
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
};

export const csvCell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;

/** Logged links name a finding as "/findings/SOP-004"; the Findings page opens one from "?id=". */
export function linkFor(href?: string) {
  if (!href) return undefined;
  const m = href.match(/^\/findings\/([^/?#]+)$/);
  return m ? `/findings?id=${m[1]}` : href;
}

/** Where an entry's link goes, for the drawer's link row. */
export function placeOf(href?: string) {
  const path = href?.split(/[?#]/)[0] ?? "";
  if (path.startsWith("/findings")) return "Findings";
  if (path.startsWith("/documents")) return "Document Library";
  if (path.startsWith("/scans")) return "Document Scan";
  if (path.startsWith("/reports")) return "Reports";
  if (path.startsWith("/settings")) return "Settings";
  return "Workspace";
}

/** Entries are UUIDs; the first block is enough to tell them apart on screen. */
export const shortId = (id: string) => (id.length > 12 ? id.split("-")[0] : id);

/* ---------- regions on the China and Southeast Asia map ---------- */

export const COUNTRY_NAME: Record<string, string> = {
  BN: "Brunei", KH: "Cambodia", CN: "China", LA: "Laos", MY: "Malaysia", MM: "Myanmar",
  PH: "Philippines", SG: "Singapore", TH: "Thailand", VN: "Vietnam",
};

/** Words in a region name, and where they put it. Cities first, so "Penang stores" lands on Penang, not Malaysia's centre. */
const PLACES: { words: RegExp; code: string; lon: number; lat: number }[] = [
  { words: /singapore/i, code: "SG", lon: 103.82, lat: 1.35 },
  { words: /kuala lumpur|\bkl\b/i, code: "MY", lon: 101.69, lat: 3.14 },
  { words: /penang/i, code: "MY", lon: 100.33, lat: 5.41 },
  { words: /johor/i, code: "MY", lon: 103.76, lat: 1.49 },
  { words: /sabah|kota kinabalu/i, code: "MY", lon: 116.07, lat: 5.98 },
  { words: /sarawak|kuching/i, code: "MY", lon: 110.35, lat: 1.55 },
  { words: /shanghai/i, code: "CN", lon: 121.47, lat: 31.23 },
  { words: /beijing|peking/i, code: "CN", lon: 116.41, lat: 39.9 },
  { words: /shenzhen/i, code: "CN", lon: 114.06, lat: 22.54 },
  { words: /guangzhou|canton/i, code: "CN", lon: 113.26, lat: 23.13 },
  { words: /hong kong/i, code: "CN", lon: 114.17, lat: 22.32 },
  { words: /macau|macao/i, code: "CN", lon: 113.54, lat: 22.2 },
  { words: /chengdu/i, code: "CN", lon: 104.07, lat: 30.67 },
  { words: /hangzhou/i, code: "CN", lon: 120.16, lat: 30.27 },
  { words: /bangkok/i, code: "TH", lon: 100.5, lat: 13.76 },
  { words: /chiang mai/i, code: "TH", lon: 98.98, lat: 18.79 },
  { words: /phuket/i, code: "TH", lon: 98.39, lat: 7.88 },
  { words: /manila/i, code: "PH", lon: 120.98, lat: 14.6 },
  { words: /cebu/i, code: "PH", lon: 123.89, lat: 10.32 },
  { words: /davao/i, code: "PH", lon: 125.61, lat: 7.07 },
  { words: /ho chi minh|saigon/i, code: "VN", lon: 106.7, lat: 10.78 },
  { words: /hanoi/i, code: "VN", lon: 105.85, lat: 21.03 },
  { words: /da nang/i, code: "VN", lon: 108.22, lat: 16.05 },
  { words: /phnom penh/i, code: "KH", lon: 104.92, lat: 11.56 },
  { words: /vientiane/i, code: "LA", lon: 102.63, lat: 17.97 },
  { words: /yangon|rangoon/i, code: "MM", lon: 96.16, lat: 16.87 },
  { words: /bandar seri begawan/i, code: "BN", lon: 114.94, lat: 4.89 },
  // whole countries, at their capital
  { words: /china|中国/i, code: "CN", lon: 116.41, lat: 39.9 },
  { words: /malaysia/i, code: "MY", lon: 101.69, lat: 3.14 },
  { words: /thailand/i, code: "TH", lon: 100.5, lat: 13.76 },
  { words: /philippines/i, code: "PH", lon: 120.98, lat: 14.6 },
  { words: /vietnam|viet nam/i, code: "VN", lon: 105.85, lat: 21.03 },
  { words: /cambodia/i, code: "KH", lon: 104.92, lat: 11.56 },
  { words: /laos|lao pdr/i, code: "LA", lon: 102.63, lat: 17.97 },
  { words: /myanmar|burma/i, code: "MM", lon: 96.16, lat: 16.87 },
  { words: /brunei/i, code: "BN", lon: 114.94, lat: 4.89 },
];

export type Place = { region: string; code: string; lon: number; lat: number };

/** The workspace's regions that name a place on the map; others (e.g. "All regions", "EMEA") are left off the map. */
export function placesFor(regions: string[]): Place[] {
  return regions.flatMap((region) => {
    const hit = PLACES.find((p) => p.words.test(region));
    return hit ? [{ region, code: hit.code, lon: hit.lon, lat: hit.lat }] : [];
  });
}
