#!/usr/bin/env python3
"""Minimal working licensing, schema and leakage guard for the KEROSOP seed dataset."""
import argparse, json, collections
from pathlib import Path
ALLOWED={'direct_conflict','permission_prohibition_conflict','deadline_mismatch','threshold_mismatch','role_conflict','version_drift','missing_documented_step','ambiguous','compatible','valid_exception','historical_difference','insufficient_evidence'}
REQUIRED={'case_id','doc_family','dataset_split','language_pair','premise','hypothesis','context','source_spans','evidence_span_ids','label','license','commercial_eligible'}
BLOCKED_LICENSES={'CC BY-NC 2.0','CC-BY-NC-2.0','CC BY-NC 4.0','CC-BY-NC-4.0','research-only','unknown'}
def validate(path, commercial=True):
    rows=[]; errors=[]; families=collections.defaultdict(set); ids=set()
    for line_no,line in enumerate(Path(path).read_text(encoding='utf-8').splitlines(),1):
        if not line.strip(): continue
        try: row=json.loads(line)
        except json.JSONDecodeError as e:
            errors.append(f'{line_no}: invalid JSON: {e}'); continue
        missing=REQUIRED-row.keys()
        if missing: errors.append(f'{line_no}: missing {sorted(missing)}'); continue
        cid=row['case_id'];
        if cid in ids: errors.append(f'{line_no}: duplicate case_id {cid}')
        ids.add(cid)
        if row['label'] not in ALLOWED: errors.append(f'{line_no}: invalid label {row["label"]}')
        if row['dataset_split'] not in {'train','validation','test'}: errors.append(f'{line_no}: invalid split')
        if commercial and (not row['commercial_eligible'] or row['license'] in BLOCKED_LICENSES):
            errors.append(f'{line_no}: not eligible for commercial training')
        if not row['premise'].strip() or not row['hypothesis'].strip(): errors.append(f'{line_no}: empty clause')
        spans={s.get('span_id'):s for s in row['source_spans']}
        if len(spans)!=len(row['source_spans']): errors.append(f'{line_no}: duplicate source span ID')
        for s in row['source_spans']:
            if not s.get('quote') or not s.get('document_version_id'):errors.append(f'{line_no}: missing source evidence')
        if any(e not in spans for e in row['evidence_span_ids']): errors.append(f'{line_no}: evidence ID not in source spans')
        families[row['doc_family']].add(row['dataset_split']); rows.append(row)
    for fam,splits in families.items():
        if len(splits)>1:errors.append(f'Leakage: doc_family {fam} crosses splits {sorted(splits)}')
    if errors:
        print('FAIL:'); print('\n'.join(errors));return 1
    print(f'PASS: {len(rows)} examples; label counts={dict(collections.Counter(r["label"] for r in rows))}; splits={dict(collections.Counter(r["dataset_split"] for r in rows))}')
    print('NOTE: Synthetic examples are illustrative and unadjudicated, not a validated training corpus.')
    return 0
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('path');p.add_argument('--research-only',action='store_true');a=p.parse_args();raise SystemExit(validate(a.path,not a.research_only))
