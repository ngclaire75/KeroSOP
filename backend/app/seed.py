"""
Defaults and the DEMO workspace (a fictional Singapore / Kuala Lumpur
retailer with English and Chinese documents). Demo findings are produced by
the engine from these documents, never hand-written, and the organisation is
flagged is_demo so it can never be confused with a customer's data.
"""
from __future__ import annotations

import hashlib

from .engine import detect, extract_rules

DEFAULT_BASELINES = [
    {
        "id": "B-purchase", "topic": "purchase", "name": "Purchasing", "approved": True,
        "steps": [
            {"name": "Purchase request", "keywords": ["purchase request", "requisition", "采购申请"]},
            {"name": "Quotations", "keywords": ["quotation", "报价"]},
            {"name": "Approval", "keywords": ["approv", "sign-off", "审批"]},
            {"name": "Purchase order", "keywords": ["purchase order", "采购订单"]},
            {"name": "Record transaction", "keywords": ["record", "ledger", "记录"]},
        ],
    },
    {
        "id": "B-refund", "topic": "refund", "name": "Refund handling", "approved": True,
        "steps": [
            {"name": "Validate order", "keywords": ["validate", "verify the order", "order details", "核对订单"]},
            {"name": "Verify eligibility", "keywords": ["eligib", "资格"]},
            {"name": "Approval", "keywords": ["approv", "审批"]},
            {"name": "Payment", "keywords": ["pay", "支付"]},
            {"name": "Record transaction", "keywords": ["record", "ledger", "记录"]},
        ],
    },
]


def default_settings(company: str) -> dict:
    return {
        "company": company,
        "departments": ["Customer Service", "Customer Support", "Finance", "HR", "Operations", "Sales"],
        "languages": ["English", "中文"],
        "regions": ["Singapore stores", "Kuala Lumpur stores"],
        "hierarchy": ["corporate_policy", "department_sop", "training", "template"],
        "topicRisk": {"refund": "high", "discount": "high", "purchase": "high", "security": "high",
                      "leave": "medium", "inventory": "medium", "expenses": "medium", "complaints": "medium"},
        "retentionDays": 365,
        "notifyEmail": True,
        "notifyAssigned": True,
        "notifyScans": True,
        "webhook": "",
        "separationOfDuties": True,
    }


# (code, title, file, authority, department, owner, language, [(version, date, note, [(ref, heading, page, text)])])
DEMO_DOCS = [
    ("D-001", "Refund Policy", "Refund Policy.pdf", "corporate_policy", "Customer Service", "Grace Tan", "en", [
        ("2.0", "2026-07-01", "Annual review", [
            ("1", "Purpose", 1, "This policy sets the rules for customer refunds in every Harbour & Co. store in Singapore and Kuala Lumpur."),
            ("3.1", "Refund window", 4, "Customers may submit new refund requests within 7 calendar days of delivery. Items must be unused and returned with the original receipt."),
            ("3.4", "Premium members", 5, "Premium members may submit refund requests within 30 calendar days of delivery."),
            ("4.1", "Refund method", 6, "Refunds are returned to the original payment method."),
        ])]),
    ("D-002", "客服操作规程", "客服操作规程.docx", "department_sop", "Customer Support", "Lim Wei Ling", "zh", [
        ("1.4", "2026-05-12", "新增超期处理", [
            ("2.1", "回复时限", 2, "客服人员必须在收到退款申请后24小时内回复顾客。"),
            ("2.3", "受理期限", 2, "客服人员可受理发货后14个自然日内提交的新退款申请。"),
            ("2.4", "超期处理", 3, "超出受理期限的退款申请必须上报店长。"),
            ("2.5", "处理流程", 3, "客服人员必须核对订单信息并确认退款资格。退款经店长审批后，由财务部门支付并在系统中记录。"),
        ])]),
    ("D-003", "Finance Procedure", "Finance Procedure.docx", "department_sop", "Finance", "Daniel Koh", "en", [
        ("3.2", "2026-03-18", "Ledger update", [
            ("4.2", "Refund payments", 6, "Finance must pay out approved refunds within 14 calendar days of approval."),
            ("4.3", "Records", 6, "Finance must record every refund payment in the ledger on the day it is paid."),
        ])]),
    ("D-004", "Staff Training Guide", "Staff Training Guide.pdf", "training", "HR", "Nur Aisyah", "en", [
        ("1.1", "2026-02-03", "New-joiner refresh", [
            ("2", "Customer refunds", 3, "Support agents must reply to refund requests within 48 hours. Refund requests outside the approved window must be escalated to the Store Manager."),
            ("5", "Your leave", 9, "Employees receive 12 days of annual leave per year. Leave must be booked in the HR portal at least 7 days in advance."),
        ])]),
    ("D-005", "Leave Policy", "Leave Policy.pdf", "corporate_policy", "HR", "Nur Aisyah", "en", [
        ("2.0", "2025-01-01", "Original", [("2.1", "Entitlement", 2, "Full-time employees are entitled to 12 days of annual leave per year.")]),
        ("3.0", "2026-01-01", "Entitlement raised to 14 days", [
            ("2.1", "Entitlement", 2, "Full-time employees are entitled to 14 days of annual leave per year."),
            ("2.2", "Carry forward", 2, "Unused annual leave may be carried forward for up to 6 months."),
        ])]),
    ("D-006", "Purchase Procedure", "Purchase Procedure.docx", "department_sop", "Finance", "Daniel Koh", "en", [
        ("1.0", "2026-04-20", "First issue", [
            ("2", "Purchasing steps", 2, "1. The requester must raise a purchase request in the procurement system.\n2. Procurement must obtain at least three quotations for purchases above S$1,000.\n3. Procurement must issue a purchase order to the selected supplier.\n4. Finance must record the transaction in the ledger within 2 business days."),
        ])]),
    ("D-007", "Discount Policy", "Discount Policy.pdf", "corporate_policy", "Sales", "Marcus Lee", "en", [
        ("1.2", "2026-06-01", "Approval threshold clarified", [
            ("3.1", "Approval", 3, "Discounts above 20% must receive final approval from the Regional Director."),
            ("3.2", "Limits", 3, "Staff must not apply discounts above 50%."),
        ])]),
    ("D-008", "Store Operations Guide", "Store Operations Guide.pdf", "department_sop", "Operations", "Ahmad Faris", "en", [
        ("2.1", "2026-05-30", "Store layout changes", [
            ("6.2", "Discount approvals", 11, "Store Managers must give final approval for discounts above 20%."),
            ("8.1", "Stock counts", 14, "Stock discrepancies must be escalated to the Area Supervisor."),
        ])]),
    ("D-009", "Inventory Control SOP", "Inventory Control SOP.docx", "department_sop", "Operations", "Ahmad Faris", "en", [
        ("1.0", "2026-03-02", "First issue", [("4", "Discrepancies", 3, "Stock discrepancies above 5 units must be escalated.")]),
        ("1.1", "2026-10-24", "Escalation owner named (SOP-004)", [("4", "Discrepancies", 3, "Stock discrepancies above 5 units must be escalated to the Area Supervisor.")]),
    ]),
    ("D-010", "门店库存盘点指引", "门店库存盘点指引.docx", "department_sop", "Operations", "Chen Jia Hui", "zh", [
        ("1.0", "2026-03-10", "首版", [("3", "差异处理", 2, "库存差异超过5件必须上报店长。")]),
        ("1.1", "2026-10-25", "统一上报对象 (SOP-004)", [("3", "差异处理", 2, "库存差异超过5件必须上报区域主管。")]),
    ]),
]

DEMO_TEAM = [
    ("Grace Tan", "grace.tan@harbourco.example", "approver", "Customer Service"),
    ("Lim Wei Ling", "weiling.lim@harbourco.example", "editor", "Customer Support"),
    ("Daniel Koh", "daniel.koh@harbourco.example", "editor", "Finance"),
    ("Nur Aisyah", "aisyah@harbourco.example", "editor", "HR"),
    ("Ahmad Faris", "ahmad.faris@harbourco.example", "reviewer", "Operations"),
    ("Chen Jia Hui", "jiahui.chen@harbourco.example", "editor", "Operations"),
    ("Marcus Lee", "marcus.lee@harbourco.example", "approver", "Sales"),
    ("Priya Nair", "priya.nair@harbourco.example", "viewer", "Internal Audit"),
]


def demo_docs() -> list[dict]:
    out = []
    for code, title, fname, authority, dept, owner, lang, versions in DEMO_DOCS:
        vs = []
        for version, date, note, secs in versions:
            sections = [{"id": f"{code}-{version}-{ref}", "ref": ref, "heading": h, "page": p, "text": t} for ref, h, p, t in secs]
            body = "\n".join(s["text"] for s in sections)
            vs.append({"version": version, "sections": sections, "checksum": hashlib.sha256(body.encode()).hexdigest(),
                       "size": 18_000 + len(body) * 37, "uploadedAt": f"{date}T09:00:00Z", "uploadedBy": owner, "note": note, "effectiveDate": date})
        out.append({"id": code, "code": code, "title": title, "fileName": fname, "kind": "pdf" if fname.endswith(".pdf") else "docx",
                    "owner": owner, "department": dept, "authority": authority, "approval": "approved", "language": lang,
                    "scope": "All regions", "current": len(vs) - 1, "versions": vs, "parseIssue": None})
    return out


def rules_for(docs: list[dict]) -> list[dict]:
    rules = []
    for d in docs:
        for k in range(len(d["versions"])):
            for r in extract_rules(d, k):
                rules.append({**r, "id": f"R-{len(rules) + 1:04d}"})
    return rules


def demo_counts() -> tuple[dict, dict]:
    """Real engine counts for the demo's two scans (before and after the inventory fix)."""
    settings = default_settings("demo")
    docs = demo_docs()
    before = [{**d, "current": 0} if d["id"] in ("D-009", "D-010") else d for d in docs]
    first = detect(before, rules_for(before), settings, DEFAULT_BASELINES)["counts"]
    now = detect(docs, rules_for(docs), settings, DEFAULT_BASELINES)["counts"]
    return {**first, "suppressed": 0}, {**now, "suppressed": 0}


ORDER = ["contradiction|refund|submission", "missing_step|B-purchase", "outdated|leave", "responsibility|discount", "contradiction|refund|response"]


def sample_findings() -> list[dict]:
    """Demo findings with their demo review states, all produced by the engine."""
    settings = default_settings("Harbour & Co. Retail")
    docs = demo_docs()
    before = [{**d, "current": 0} if d["id"] in ("D-009", "D-010") else d for d in docs]
    first = detect(before, rules_for(before), settings, DEFAULT_BASELINES)
    now = detect(docs, rules_for(docs), settings, DEFAULT_BASELINES)

    def rank(d):
        i = next((k for k, p in enumerate(ORDER) if d["dedupKey"].startswith(p)), 99)
        return i

    ordered = sorted(now["drafts"], key=rank)
    ambiguity = next(d for d in first["drafts"] if d["dedupKey"].startswith("ambiguity|inventory"))
    out, n = [], 1
    states = {2: ("under_review", None), 5: ("under_review", "Marcus Lee")}
    for d in ordered:
        if n == 4:
            out.append({**ambiguity, "id": "SOP-004", "status": "closed", "owner": "Ahmad Faris", "reverified": "resolved", "scan": "SCAN-001"})
            n += 1
        status, owner = states.get(n, ("detected", None))
        out.append({**d, "id": f"SOP-{n:03d}", "status": status, "owner": owner, "reverified": None, "scan": "SCAN-002" if n == 6 else "SCAN-001"})
        n += 1
    return out
