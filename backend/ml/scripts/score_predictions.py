#!/usr/bin/env python3
"""Score case_id/predicted_label/predicted_evidence_span_ids JSONL predictions."""
import argparse,json,collections
from pathlib import Path

def read(path):
    items={}
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        if line.strip():
            item=json.loads(line)
            cid=item['case_id']
            if cid in items:raise ValueError(f'duplicate case_id {cid}')
            items[cid]=item
    return items

def score(gold_file,pred_file):
    gold=read(gold_file);pred=read(pred_file)
    missing=set(gold)-set(pred);extra=set(pred)-set(gold)
    if missing or extra:raise ValueError(f'Missing predictions: {sorted(missing)}; Extra IDs: {sorted(extra)}')
    total=len(gold);correct=0;invalid_quotes=0
    labels=sorted(set(g['label'] for g in gold.values())|set(p.get('predicted_label','') for p in pred.values()))
    per={k:collections.Counter() for k in labels}
    for k,g in gold.items():
        p=pred[k];expected=g['label'];chosen=p.get('predicted_label','')
        if expected==chosen:correct+=1
        for label in labels:
            if expected==label and chosen==label:per[label]['tp']+=1
            elif expected!=label and chosen==label:per[label]['fp']+=1
            elif expected==label and chosen!=label:per[label]['fn']+=1
        source_ids={s['span_id'] for s in g['source_spans']}
        cited=p.get('predicted_evidence_span_ids',[])
        if not isinstance(cited,list) or any(cid not in source_ids for cid in cited):invalid_quotes+=1
    print(f'Accuracy: {correct}/{total} ({correct/total:.1%})')
    print(f'Invalid evidence-ID sets: {invalid_quotes}/{total}')
    for label in labels:
        a=per[label];pr=a['tp']/max(1,a['tp']+a['fp']);rc=a['tp']/max(1,a['tp']+a['fn'])
        print(f'{label:35s} precision={pr:.3f} recall={rc:.3f} support={a["tp"]+a["fn"]}')
    return 1 if invalid_quotes else 0
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('gold');p.add_argument('predictions');a=p.parse_args();raise SystemExit(score(a.gold,a.predictions))
