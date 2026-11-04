import type { Doc, Finding, Rule } from "@/lib/app/types";

export type PolicyLink = { id: string; a: string; b: string; topics: string[]; findings: Finding[] };
export const isOpen = (f: Finding) => !["closed", "dismissed"].includes(f.status);

/** Shared topics describe classification only. Findings connect the exact document versions cited.
 * Research: https://pages.nist.gov/OSCAL/learn/concepts/layer/control/mapping/
 * This app visualizes its own evidence relationships; it does not assert OSCAL equivalence.
 */
export function policyLinks(docs: Doc[], rules: Rule[], findings: Finding[]): PolicyLink[] {
  const ids = new Set(docs.map((d) => d.id));
  const current = rules.filter((r) => !r.historical && ids.has(r.docId));
  const topics = new Map(docs.map((d) => [d.id, new Set(current.filter((r) => r.docId === d.id).map((r) => r.topic))]));
  const pairs = new Map<string, PolicyLink>();
  const get = (a: string, b: string) => {
    const [first, second] = [a, b].sort();
    const id = JSON.stringify([first, second]);
    if (!pairs.has(id)) pairs.set(id, { id, a: first, b: second, topics: [], findings: [] });
    return pairs.get(id)!;
  };
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const shared = [...topics.get(docs[i].id)!].filter((t) => topics.get(docs[j].id)!.has(t));
      if (shared.length) get(docs[i].id, docs[j].id).topics = shared;
    }
  }
  for (const finding of findings.filter(isOpen)) {
    const cited = [...new Set(finding.evidence.map((e) => e.docId).filter((id) => ids.has(id)))];
    for (let i = 0; i < cited.length; i++) {
      for (let j = i + 1; j < cited.length; j++) get(cited[i], cited[j]).findings.push(finding);
    }
  }
  return [...pairs.values()];
}
