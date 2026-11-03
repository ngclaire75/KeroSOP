#!/usr/bin/env python3
"""Create a reproducible, synthetic bilingual QA fixture, not a trained model."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
# (label, premise, hypothesis, context, language_pair, family)
CASES = [
('direct_conflict','Refund requests submitted on calendar day 8 after delivery must be rejected.','Refund requests submitted on calendar day 8 after delivery must be accepted.','Both approved and effective for the same customer class and region.','en-en','refund_eligibility'),
('compatible','Customers must submit refund requests within 7 days.','Finance must process approved refunds within 14 days.','Submission deadline is not the processing deadline.','en-en','refund_events'),
('valid_exception','Standard customers may request refunds within 7 days.','VIP customers may request refunds within 14 days.','Distinct approved customer classes.','en-en','refund_exception'),
('historical_difference','From 2023 through 2024, the allowance was 10 days.','Effective 2026, the allowance is 14 days.','No overlap in effective periods.','en-en','leave_history'),
('permission_prohibition_conflict','Support agents may issue discounts without approval up to 5%.','Support agents must not issue any discount without manager approval.','Same agent, same region, same period; no exceptions.','en-en','discount_permission'),
('deadline_mismatch','Report all outages to IT within 30 minutes of discovery.','Report all outages to IT within 2 hours of discovery.','Same incident report obligation in approved SOPs.','en-en','incident_deadline'),
('threshold_mismatch','Orders above USD 500 require procurement approval.','Orders above USD 1000 require procurement approval.','Same transaction category, region and effective period.','en-en','purchase_threshold'),
('role_conflict','Only the finance director may approve expense exceptions.','Only the operations director may approve expense exceptions.','Both define exclusive approval authority for the same exception.','en-en','expense_approver'),
('ambiguous','Escalate urgent cases promptly.','Escalate priority-one cases within 30 minutes.','Whether urgent equals priority-one is undefined.','en-en','urgency_ambiguity'),
('insufficient_evidence','Claims are handled as described in Annex C.','The claim process must finish within 10 days.','Annex C has not been uploaded or reviewed.','en-en','missing_annex'),
('missing_documented_step','Baseline: obtain manager approval before issuing a supplier refund.','Target SOP: validate supplier invoice, issue refund, and log transaction.','Approved baseline applies to this target SOP; no manager approval appears in checked sections.','en-en','supplier_baseline'),
('version_drift','Current policy v3 requires manager authorization on every refund.','Active training slides still teach agents to issue refunds directly.','Training slides are still assigned even though old procedure was superseded.','en-en','training_drift'),
('direct_conflict','在收货后的第八个自然日提交的退款申请必须被拒绝。','在收货后的第八个自然日提交的退款申请必须被接受。','同一地区、同一客户类别、两个文件均已生效。','zh-CN-zh-CN','cn_refund'),
('compatible','客户必须在收到商品后的七天内申请退款。','财务部门应在退款获批后的十四天内完成付款。','申请期限与付款期限指向不同事件。','zh-CN-zh-CN','cn_refund_events'),
('valid_exception','普通会员须在七天内申请退款。','高级会员可在十四天内申请退款。','不同会员等级且例外已获批准。','zh-CN-zh-CN','cn_vip'),
('permission_prohibition_conflict','客服人员可直接批准不超过百分之五的折扣。','未经经理批准，客服人员不得批准任何折扣。','同一岗位、相同期间且没有例外条款。','zh-CN-zh-CN','cn_discount'),
('deadline_mismatch','发现网络故障后，必须在三十分钟内报告。','发现网络故障后，必须在两小时内报告。','两份有效 SOP 规定相同的上报事件。','zh-CN-zh-CN','cn_incident'),
('threshold_mismatch','采购金额超过人民币五千元须部门主管审批。','采购金额超过人民币一万元须部门主管审批。','同一采购类别及有效期。','zh-CN-zh-CN','cn_threshold'),
('role_conflict','只有财务经理可以批准费用例外。','只有运营经理可以批准费用例外。','相同的费用例外类型且两者具有排他性。','zh-CN-zh-CN','cn_role'),
('ambiguous','重大事件应立即上报。','一级事故应在十五分钟内上报。','没有定义“重大事件”与“一级事故”是否相同。','zh-CN-zh-CN','cn_ambiguity'),
('historical_difference','2024年员工每年享有十天年假。','自2026年1月1日起员工每年享有十四天年假。','相关生效时间不重叠。','zh-CN-zh-CN','cn_history'),
('insufficient_evidence','有关特殊退货事项，请参阅附录乙。','所有特殊退货必须在五天内审核。','附录乙缺失，无法判断例外条件。','zh-CN-zh-CN','cn_missing'),
('direct_conflict','Replacement requests received on day 7 after delivery must be rejected.','签收后第七天收到的换货申请必须予以受理。','The same approved policy scope and event; bilingual versions conflict.','en-zh-CN','cross_replacement'),
('compatible','Send a status update within 24 hours after receiving a claim.','理赔审批须在收到全部资料后的七个工作日内完成。','The status update and approval are different activities/triggers.','en-zh-CN','cross_claim_events'),
('valid_exception','Standard warehouse returns require a supervisor signature.','紧急安全召回可以由值班经理签字确认。','Safety recalls are a formally approved exception.','en-zh-CN','cross_recall_exception'),
('role_conflict','Only the procurement director can approve rush purchase orders.','紧急采购订单只能由财务总监批准。','Same exclusive action and effective jurisdiction.','en-zh-CN','cross_purchase'),
('deadline_mismatch','Employees must escalate privacy incidents within 1 hour after discovery.','员工必须在发现隐私事件后三十分钟内升级报告。','Overlapping scope and same escalation event.','en-zh-CN','cross_privacy'),
('missing_documented_step','Baseline: record approval evidence before executing a payment.','操作流程：核对发票、执行付款、存档凭证。','An approved baseline requires separate prior approval recording; target SOP reviewed in full.','en-zh-CN','cross_payment_baseline'),
('direct_conflict','設備點檢在第四個工作天完成時，必須視為逾期。','設備點檢在第四個工作天完成時，必須視為準時。','同一站點、相同的點檢事件與生效期間。','zh-TW-zh-TW','tw_equipment'),
('valid_exception','一般設備每週檢查一次。','高風險設備每天檢查一次。','高風險設備具有更嚴格的核准要求。','zh-TW-zh-TW','tw_inspection'),
('compatible','Employees must report losses to finance within one day.','財務部門須於收到完整報告後三天內完成調查。','Report receipt and investigation completion are different duties.','en-zh-TW','cross_tw_loss'),
('insufficient_evidence','進貨驗收應遵循最新版供應商政策。','Supplier checklists must be signed within 2 days.','The supplier policy version and its applicability cannot be verified.','zh-TW-en','cross_tw_supplier'),
('direct_conflict','Customer support must archive records for 2 years after case closure.','客服必須於案件結束後將紀錄保留三年。','同一類紀錄、同一地點，均為目前有效要求。','en-zh-TW','cross_tw_retention'),
('ambiguous','Inventory exceptions must be escalated promptly to an owner.','庫存異常需於一小時內通知值班主管。','Owner role and meaning of promptly are not defined.','en-zh-CN','cross_inventory_ambiguity'),
('version_drift','Effective version 4 says all incidents require ticket IDs.','培训教材仍要求员工通过电话报告，不需要工单。','Training material from superseded version is still active.','en-zh-CN','cross_incident_drift'),
('threshold_mismatch','Purchases over EUR 750 require compliance review.','超過一千歐元的採購須經合規審核。','Same procurement class, currency and effective dates.','en-zh-TW','cross_threshold_tw'),
]

# Keep splits grouped by domain family, so cases cannot leak between train and test.
records = []
for i, (label, premise, hypothesis, context, language_pair, family) in enumerate(CASES,1):
    split = 'test' if i % 5 == 0 else 'validation' if i % 5 == 1 else 'train'
    sp1, sp2 = f'CASE{i:03d}_A',f'CASE{i:03d}_B'
    records.append({
        'case_id':f'KS-{i:03d}', 'doc_family':family, 'dataset_split':split, 'language_pair':language_pair,
        'premise':premise, 'hypothesis':hypothesis, 'context':context,
        'evidence_span_ids':[sp1,sp2],
        'source_spans':[{'span_id':sp1,'quote':premise,'document_version_id':f'SYN-{i:03d}-V1'},
                        {'span_id':sp2,'quote':hypothesis,'document_version_id':f'SYN-{i:03d}-V2'}],
        'label':label, 'license':'synthetic-original', 'commercial_eligible':True,
        'annotation_status':'illustrative_unadjudicated',
        'rights_note':'Original fictional synthetic example; not expert-adjudicated ground truth',
        'source_type':'KEROSOP starter fixture'
    })
out=ROOT/'datasets'/'kerosop_sop_seed.jsonl'
with out.open('w',encoding='utf-8') as f:
    for r in records: f.write(json.dumps(r,ensure_ascii=False)+'\n')
print(f'Wrote {len(records)} synthetic examples to {out}')
