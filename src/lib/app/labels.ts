/**
 * Display helpers shared by the dashboard pages. Analysis happens in the API
 * (backend/app/engine.py and the Qwen3 comparator); the browser only formats.
 */
import type { Doc, Rule, Section } from "./types";

const TOPIC: Record<string, string> = {
  refund: "Refunds",
  discount: "Discounts",
  leave: "Leave & time off",
  remote: "Remote work",
  gifts: "Gifts & hospitality",
  devices: "Work devices",
  hours: "Working hours",
  inventory: "Inventory",
  purchase: "Purchasing",
  expenses: "Expenses",
  security: "Security",
  complaints: "Complaints",
  general: "General",
};
export const TOPIC_IDS = Object.keys(TOPIC);
export const topicLabel = (id: string) => TOPIC[id] ?? id.charAt(0).toUpperCase() + id.slice(1);

const EVENT: Record<string, string> = {
  approval: "approval",
  payment: "payment deadline",
  response: "response time",
  escalation: "escalation route",
  submission: "request window",
  recording: "recording deadline",
  entitlement: "entitlement",
  application: "limit",
  cap: "maximum balance",
  initial: "starting balance",
  other: "other",
};
export const eventLabel = (id: string) => EVENT[id] ?? id;

export const fmtValue = (r: Pick<Rule, "value" | "unit">) =>
  r.value === undefined || r.value === null
    ? ""
    : r.unit === "%"
      ? `${r.value}%`
      : r.unit === "S$" || r.unit === "$"
        ? `$${r.value.toLocaleString()}`
        : `${r.value} ${r.value === 1 ? r.unit?.replace(/s$/, "") : r.unit}`;

/** Most common topic among a document's current rules. */
export function docTopic(doc: Doc, rules: Rule[]) {
  const tally = new Map<string, number>();
  for (const r of rules) if (r.docId === doc.id && !r.historical) tally.set(r.topic, (tally.get(r.topic) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "general";
}

export const sectionOf = (doc: Doc | undefined, version: string, sectionId: string): Section | undefined =>
  doc?.versions.find((v) => v.version === version)?.sections.find((s) => s.id === sectionId);
