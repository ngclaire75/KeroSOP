"""
Stage A evaluation of the pairwise comparator on KEROSOP-SOP-SYNTH (original
synthetic cases written for this project; no third-party data). Reports
accuracy and per-label precision/recall for conflict detection.

    .venv/bin/python eval/run_llm_eval.py
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import llm  # noqa: E402

GROUP = {"direct_conflict": "conflict", "permission_prohibition_conflict": "conflict", "deadline_mismatch": "conflict", "threshold_mismatch": "conflict",
         "actor_ownership_conflict": "conflict", "compatible": "compatible", "valid_exception": "exception", "historical_difference": "compatible",
         "ambiguous_requirement": "ambiguous", "insufficient_evidence": "insufficient"}


def doc(t):
    return {"title": t, "authority": "department_sop", "approval": "approved", "current": 0, "versions": [{"effectiveDate": ""}]}


def rule(text, sid):
    return {"quote": text, "version": "1.0", "scope": "All regions", "lang": "zh" if any("一" <= c <= "鿿" for c in text) else "en",
            "sectionId": sid, "topic": None, "subject": None, "event": None, "actor": None, "modality": None, "conditions": []}


cases = [json.loads(l) for l in (Path(__file__).parent / "pairs.jsonl").read_text().splitlines() if l.strip()]
tp = fp = fn = correct = 0
t0 = time.time()
for c in cases:
    v, err = llm.compare(rule(c["a"], "A"), doc("Document A"), rule(c["b"], "B"), doc("Document B"))
    got = "error" if err else GROUP[v.classification]
    ok = got == c["label"]
    correct += ok
    tp += got == "conflict" and c["label"] == "conflict"
    fp += got == "conflict" and c["label"] != "conflict"
    fn += got != "conflict" and c["label"] == "conflict"
    print(f"{'✔' if ok else '✖'} {c['case_id']} {c['language_pair']:6} expected {c['label']:10} got {got:12} {'' if ok else (v.classification if v else err)}")
p = tp / (tp + fp) if tp + fp else 0
r = tp / (tp + fn) if tp + fn else 0
print(f"\naccuracy {correct}/{len(cases)} = {correct / len(cases):.0%} · conflict precision {p:.0%} recall {r:.0%} · {time.time() - t0:.0f}s · prompt {llm.PROMPT_VERSION} · model {llm.settings.llm_model}")
