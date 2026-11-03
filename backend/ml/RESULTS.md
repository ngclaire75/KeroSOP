# Evaluation results (Stage A: no fine-tuning)

Model `qwen3:8b` via Ollama on an Apple M5 (16 GB), temperature 0, seed 7, `think: false`. Prompt `comparator-2026-11-03.v3`. Run 2026-11-03.

## KEROSOP seed set (36 cases, EN / zh-CN / zh-TW / cross-lingual)
Scored with the kit's `scripts/score_predictions.py`. Both "exact label" (12 classes) and "should this raise a finding" (conflict-type labels and `ambiguous` vs the rest).

| Mode | Exact label | Raise-a-finding accuracy | Precision | Recall | Invalid evidence IDs |
|---|---|---|---|---|---|
| Rules engine only | 5/36 (14%) | 14/36 | 67% | 9% | 0 |
| Qwen3 only | 15/36 (42%) | 27/36 | 89% | 70% | 0 |
| Rules first, then Qwen3 (production order) | 13/36 (36%) | 24/36 | 82% | 61% | 0 |

The seed cases are two isolated sentences with a written context line; the rules engine is built for full documents with version history, scopes and baselines, which these cases do not carry. Version-drift, historical and missing-step cases depend on that metadata.

## KEROSOP-SOP-SYNTH v1 (16 cases, `eval/pairs.jsonl`)
| Prompt | Accuracy | Conflict precision | Conflict recall |
|---|---|---|---|
| v1 (spec wording only) | 7/16 (44%) | 0% | 0% |
| v2 (decision procedure + 3 examples) | 13/16 (81%) | 86% | 75% |
| v3 (+ version, baseline and context guidance) | 13/16 (81%) | 100% | 75% |

## Not yet meeting the pilot target
The spec's pilot target is at least 90% reviewer-confirmed precision on high-risk alerts, on a representative, expert-labelled holdout. These sets are small (52 cases) and not adjudicated, so they show direction only. Next steps: 500–1,000 adjudicated cases split by document family, then error analysis before any LoRA fine-tuning.

Reproduce:
```sh
KEROSOP_LLM_ENABLED=1 .venv/bin/python ml/predict.py ml/datasets/kerosop_sop_seed.jsonl --mode system --out ml/results/seed-system.jsonl
.venv/bin/python ml/scripts/score_predictions.py ml/datasets/kerosop_sop_seed.jsonl ml/results/seed-system.jsonl
.venv/bin/python eval/run_llm_eval.py
```
