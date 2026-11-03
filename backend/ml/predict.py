"""
Runs the KeroSOP pipeline on an evaluation dataset (kit schema) and writes
predictions for scripts/score_predictions.py.

  --mode rules   deterministic engine only
  --mode ai      Qwen3 comparator only
  --mode system  engine first; the model decides only what the rules cannot (production behaviour)

    .venv/bin/python ml/predict.py ml/datasets/kerosop_sop_seed.jsonl --mode system --out ml/results/seed-system.jsonl
    .venv/bin/python ml/scripts/score_predictions.py ml/datasets/kerosop_sop_seed.jsonl ml/results/seed-system.jsonl
"""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import engine, llm  # noqa: E402
from app.seed import DEFAULT_BASELINES, default_settings  # noqa: E402

AI_TO_KIT = {"actor_ownership_conflict": "role_conflict", "ambiguous_requirement": "ambiguous"}
TYPE_TO_KIT = {"prohibition": "permission_prohibition_conflict", "outdated": "version_drift", "responsibility": "role_conflict",
               "ambiguity": "ambiguous", "missing_step": "missing_documented_step"}


def doc(span):
    return {"id": span["span_id"], "title": span["document_version_id"], "owner": "", "department": "", "authority": "department_sop",
            "approval": "approved", "scope": "All regions", "parseIssue": None, "current": 0,
            "versions": [{"version": "1.0", "effectiveDate": "", "sections": [{"id": span["span_id"], "ref": "1", "heading": "", "page": 1, "text": span["quote"]}]}]}


def rules_label(case):
    spans = case["source_spans"][:2]
    docs = [doc(s) for s in spans]
    rules = []
    for d in docs:
        rules += [{**r, "id": f"R{len(rules) + i}"} for i, r in enumerate(engine.extract_rules(d, 0))]
    res = engine.detect(docs, rules, default_settings("eval"), DEFAULT_BASELINES)
    if res["drafts"]:
        d = res["drafts"][0]
        if d["type"] == "contradiction":
            r = next((x for x in rules if x.get("unitClass")), {})
            return "threshold_mismatch" if r.get("unitClass") in ("percent", "money", "count") else ("deadline_mismatch" if r.get("event") in ("response", "payment", "recording") else "direct_conflict")
        return TYPE_TO_KIT[d["type"]]
    if res["counts"]["exception"]:
        return "valid_exception"
    if res["counts"]["insufficient"]:
        return "insufficient_evidence"
    decided = res["counts"]["candidates"] > 0 and not res["pairs"]
    return "compatible" if decided else None


def ai_label(case):
    a, b = case["source_spans"][0], case["source_spans"][1] if len(case["source_spans"]) > 1 else case["source_spans"][0]
    rec = lambda s: {"quote": s["quote"], "version": "1.0", "scope": "All regions", "lang": "zh" if engine.CJK.search(s["quote"]) else "en", "sectionId": s["span_id"],  # noqa: E731
                     "conditions": []}
    d = lambda s: {"title": s["document_version_id"], "authority": "department_sop", "approval": "approved", "current": 0, "versions": [{"effectiveDate": ""}]}  # noqa: E731
    v, err = llm.compare(rec(a), d(a), rec(b), d(b), context=case.get("context") or None)
    if err:
        return "insufficient_evidence", []
    return AI_TO_KIT.get(v.classification, v.classification), v.source_span_ids


def main():
    p = argparse.ArgumentParser()
    p.add_argument("dataset")
    p.add_argument("--mode", choices=["rules", "ai", "system"], default="system")
    p.add_argument("--out", required=True)
    a = p.parse_args()
    cases = [json.loads(l) for l in Path(a.dataset).read_text(encoding="utf-8").splitlines() if l.strip()]
    out, t0 = [], time.time()
    for c in cases:
        ids = c["evidence_span_ids"]
        label = rules_label(c) if a.mode in ("rules", "system") else None
        if label is None:
            label, cited = ai_label(c) if a.mode in ("ai", "system") else ("compatible", ids)
            ids = cited or ids
        out.append({"case_id": c["case_id"], "predicted_label": label, "predicted_evidence_span_ids": ids})
        print(f"{c['case_id']} {c['language_pair']:12} gold={c['label']:32} pred={label}", flush=True)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in out) + "\n")
    print(f"{len(out)} predictions in {time.time() - t0:.0f}s · mode {a.mode} · prompt {llm.PROMPT_VERSION} · model {llm.settings.llm_model}")


if __name__ == "__main__":
    main()
