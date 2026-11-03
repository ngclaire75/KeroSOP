# KEROSOP Training and Data Playbook

## What is provided
The downloadable JSONL contains **36 fictional, synthetic, manually curated but not independently expert-adjudicated test examples** across English, Simplified Chinese, and Traditional Chinese. This small fixture verifies data ingestion and evaluation scripts. It is **not a sufficient corpus to train a reliable contradiction model**. Genuine production accuracy must be proven through a separately labeled evaluation set and qualified reviewers.

## Valid datasets and exact purposes
| Resource | URL | Purpose | Licensing notes |
|---|---|---|---|
| ContractNLI | https://stanfordnlp.github.io/contract-nli/ | NLI and evidence for contracts | CC BY 4.0 and source-specific terms. Requires attribution; not equivalent to SOPs. |
| DocLayNet | https://huggingface.co/datasets/docling-project/DocLayNet | Document layout training | CDLA-Permissive-1.0; layout only, does not provide contradiction labels. |
| Qwen3-8B | https://huggingface.co/Qwen/Qwen3-8B | Base model for applied extraction/analysis | Apache 2.0 as documented in model card; check dependencies and distribution obligations. |
| Qwen3-Embedding-0.6B | https://huggingface.co/Qwen/Qwen3-Embedding-0.6B | English-Chinese semantic retrieval | Apache 2.0 as documented in model card. |
| Docling | https://github.com/docling-project/docling | Document extraction | MIT for code; verify individual models separately. |
| PaddleOCR | https://github.com/PaddlePaddle/PaddleOCR | OCR including Chinese | Apache 2.0 for project; verify specific model assets. |
| OCNLI | https://github.com/CLUEbenchmark/OCNLI | Research-only Chinese NLI | CC BY-NC 2.0: **exclude from commercial training unless separately authorized**. |
| XNLI | https://github.com/facebookresearch/XNLI | Cross-lingual NLI evaluation | Verify each upstream corpus and redistribution/training right; no blanket commercial license assumption. |

**Important:** This kit contains links and licensed-download instructions, **not redistributed third-party datasets**. Download official data only after reviewing the current source license, terms, redistribution restrictions and attribution. Access to official downloads may require a separate click or acknowledgement. Do not scrape around download terms.

## Baseline-first roadmap
1. **No fine-tuning:** Work with a pretrained bilingual model + RAG + metadata + deterministic rules; measure on held-out cases. This is the fastest and most explainable path.
2. **Create real annotations:** Gather 500–1,000 distinct pilot cases across scopes, roles, regions, dates, exceptions, missing referenced annexes, Chinese simplification/traditional variants and negative examples. Label independently and adjudicate with SOP experts. The higher the risk, the more carefully it needs human review.
3. **Leakage controls:** Group split by organization/source document family, not merely by sentence pair; do not leak translations of the same case across train and test. Maintain an immutable challenge set.
4. **Error analysis:** Label false positives and false negatives as (a) scope, (b) time, (c) event mismatch, (d) actor, (e) conditional exceptions, (f) source OCR, (g) citation validity, (h) baseline absence, (i) translation, (j) language ambiguity.
5. **Selective fine-tuning:** Only where measured gaps justify it, use LoRA on model with valid commercial license, and keep a separate reproducible model registry (training SHA, data SHA, prompt, seed, hyperparameters, evaluation metrics).
6. **Human-in-loop updates:** Every previously-confirmed result may be reconsidered after a policy change; a model prediction cannot change an approved company policy by itself.

## Use the scripts
From this directory:

```sh
python scripts/make_seed_dataset.py
python scripts/validate_dataset.py datasets/kerosop_sop_seed.jsonl
python scripts/score_predictions.py datasets/kerosop_sop_seed.jsonl path/to/model_predictions.jsonl
```

The scorer accepts one row per case with shape:

```json
{"case_id":"KS-001","predicted_label":"direct_conflict","predicted_evidence_span_ids":["CASE001_A","CASE001_B"]}
```

It prints accuracy, per-class precision/recall, and invalid source-span ID counts; it checks **IDs only**, not authenticity of model-quoted text. The actual application must additionally verify exact quotes and immutable document version references. The seed examples are fictional and do not represent legal/compliance advice.

## Open-source dataset collection interface the AI coding agent must implement
1. `DatasetSource` registry with URL, title, SPDX-like expression, owner, terms URL, attribution string, download instructions, approved-purpose flags, original hash and version.
2. For each data source, block ingestion until a human has accepted applicable license/terms. Preserve artifacts in a dedicated raw dataset store; do not mix with customer data.
3. Import official formats to `source_documents` or `nli_examples`; avoid claiming contract NLI labels are SOP contradiction labels.
4. Build reproducible train/validation/test splits and validate no document-family leakage.
5. Attach every generated training example to rights and provenance records.
6. If training on protected customer documents, require documented permission and permitted processing region, plus data deletion/retraining policies.
