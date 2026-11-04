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


# Bump whenever the demo's documents, findings or storyline change: a demo workspace built from an
# older version is rebuilt the next time its administrator signs in (demo.refresh_demos).
DEMO_VERSION = "2026-11-04.3"

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
            ("2", "Purchasing steps", 2, "1. The requester must raise a purchase request in the procurement system.\n2. Procurement must obtain at least three quotations for purchases above $1,000.\n3. Procurement must issue a purchase order to the selected supplier.\n4. Finance must record the transaction in the ledger within 2 business days."),
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
    ("D-011", "Expense Claims Policy", "Expense Claims Policy.pdf", "corporate_policy", "Finance", "Daniel Koh", "en", [
        ("1.0", "2026-02-15", "First issue", [
            ("2.1", "Submitting claims", 3, "Employees must submit expense claims within 30 calendar days of the purchase date."),
            ("2.3", "Approval", 3, "Expense claims above $500 must be approved by the Department Head."),
            ("3.1", "Reimbursement", 5, "Finance must reimburse approved expense claims within 10 business days."),
        ])]),
    ("D-012", "Travel & Expenses SOP", "Travel & Expenses SOP.docx", "department_sop", "Finance", "Daniel Koh", "en", [
        ("1.2", "2026-08-04", "Mileage rates updated", [
            ("3.2", "Claim deadline", 4, "Staff must submit expense claims within 60 calendar days of the purchase date."),
            ("3.4", "Receipts", 4, "Every expense claim must include an itemised receipt."),
        ])]),
    ("D-013", "Information Security Policy", "Information Security Policy.pdf", "corporate_policy", "Operations", "Ahmad Faris", "en", [
        ("2.0", "2026-04-01", "Annual review", [
            ("4.1", "Passwords", 6, "Staff must change their system password every 90 days."),
            ("4.3", "Access cards", 6, "Lost access cards must be reported to the Security Desk within 24 hours."),
            ("5.2", "Work laptops", 8, "Work laptops must be locked whenever they are left unattended."),
        ])]),
    ("D-014", "Store Security SOP", "Store Security SOP.docx", "department_sop", "Operations", "Ahmad Faris", "en", [
        ("1.3", "2026-06-18", "CCTV retention added", [
            ("2.2", "Till passwords", 3, "Store staff must change their till password every 180 days."),
            ("2.5", "Cash office", 3, "The cash office must stay locked and CCTV must record it at all times."),
        ])]),
    ("D-015", "Complaints Handling Policy", "Complaints Handling Policy.pdf", "corporate_policy", "Customer Service", "Grace Tan", "en", [
        ("1.1", "2026-03-09", "Escalation path clarified", [
            ("2.1", "Acknowledgement", 2, "Customer Service must acknowledge every complaint within 2 business days."),
            ("2.4", "Serious complaints", 3, "Complaints about staff conduct must be escalated to the Customer Service Manager."),
        ])]),
    ("D-016", "客户投诉处理规程", "客户投诉处理规程.docx", "department_sop", "Customer Support", "Lim Wei Ling", "zh", [
        ("1.0", "2026-05-20", "首版", [
            ("2.1", "回复时限", 2, "客服人员必须在收到投诉后3个工作日内回复顾客。"),
            ("2.3", "投诉记录", 2, "每宗投诉必须在客户系统中记录。"),
        ])]),
    ("D-017", "Remote Work Policy", "Remote Work Policy.pdf", "corporate_policy", "HR", "Nur Aisyah", "en", [
        ("1.0", "2026-01-12", "First issue", [
            ("2.1", "Eligibility", 2, "Office employees may work remotely for up to 2 days per week."),
            ("2.3", "Approval", 2, "Each remote work arrangement must be approved by the line manager."),
            ("3.1", "Devices", 3, "Work laptops must only connect to public Wi-Fi through the company VPN."),
        ])]),
    ("D-018", "Working Hours & Overtime SOP", "Working Hours & Overtime SOP.docx", "department_sop", "HR", "Nur Aisyah", "en", [
        ("2.0", "2026-07-07", "Overtime threshold changed", [
            ("2.2", "Overtime", 3, "Overtime above 10 hours per month must be approved by the Store Manager."),
            ("2.4", "Breaks", 3, "Staff must take a lunch break of at least 60 minutes per shift."),
            ("3.1", "Booking time off", 4, "Annual leave must be booked in the HR portal at least 7 days in advance."),
        ])]),
    ("D-019", "Gifts & Hospitality Policy", "Gifts & Hospitality Policy.pdf", "corporate_policy", "Sales", "Marcus Lee", "en", [
        ("1.0", "2026-02-27", "First issue", [
            ("2.1", "Declaring gifts", 2, "Staff must declare any gift above $100 to Compliance within 5 business days."),
            ("2.2", "Supplier gifts", 2, "Staff must not accept gifts from a supplier during an open quotation process."),
        ])]),
    ("D-020", "Supplier Onboarding Checklist", "Supplier Onboarding Checklist.docx", "template", "Finance", "Daniel Koh", "en", [
        ("1.0", "2026-04-28", "First issue", [
            ("1", "Quotations", 1, "Procurement must obtain at least three quotations for purchases above $1,000."),
            ("2", "Supplier approval", 1, "Finance must approve each new supplier before the first purchase order is issued."),
        ])]),
    ("D-021", "New Starter Handbook", "New Starter Handbook.pdf", "training", "HR", "Nur Aisyah", "en", [
        ("1.0", "2026-09-01", "First issue", [
            ("3", "Time off", 5, "Employees receive 14 days of annual leave per year."),
            ("4", "Working from home", 6, "You may work remotely for up to 3 days per week once your probation ends."),
            ("6", "Expenses", 8, "Expense claims must be submitted within 30 calendar days of the purchase date."),
            ("7", "Discounts at the till", 9, "Discounts above 20% need final approval from the Regional Director."),
            ("8", "Stock checks", 10, "Stock discrepancies above 5 units must be escalated to the Area Supervisor."),
        ])]),
    ("D-022", "Discount Request Form", "Discount Request Form.docx", "template", "Sales", "Marcus Lee", "en", [
        ("1.1", "2026-06-05", "Approver field updated", [
            ("1", "Approval", 1, "Discounts above 20% require final approval from the Regional Director."),
            ("2", "Records", 1, "The approved form must be filed with the sale record."),
        ])]),
    ("D-023", "Code of Conduct", "Code of Conduct.pdf", "corporate_policy", "HR", "Grace Tan", "en", [
        ("3.0", "2026-01-05", "Annual review", [
            ("4.1", "Gifts", 7, "Staff must declare any gift above $100 to Compliance within 5 business days."),
            ("5.2", "Complaints about colleagues", 8, "Complaints about staff conduct must be escalated to the HR Business Partner."),
            ("6.1", "Company devices", 9, "Work laptops and phones must be returned on the last working day."),
        ])]),
    ("D-024", "Returns & Exchanges SOP", "Returns & Exchanges SOP.docx", "department_sop", "Customer Service", "Grace Tan", "en", [
        ("1.1", "2026-07-15", "Exchange rules added", [
            ("2.1", "Request window", 2, "Store staff may accept new refund requests within 7 calendar days of delivery."),
            ("2.3", "Faulty goods", 2, "Faulty items must be recorded in the returns log on the same day."),
        ])]),
    ("D-025", "Cash Handling SOP", "Cash Handling SOP.docx", "department_sop", "Finance", "Daniel Koh", "en", [
        ("2.0", "2026-05-02", "Safe limits revised", [
            ("3.1", "Cash office", 4, "The cash office must stay locked and only the duty manager may hold the access card."),
            ("3.4", "Till variances", 5, "Till variances above $20 must be escalated to the Store Manager."),
            ("4.2", "Banking", 6, "Takings must be recorded in the ledger on the day they are banked."),
        ])]),
    ("D-026", "Procurement Policy", "Procurement Policy.pdf", "corporate_policy", "Finance", "Daniel Koh", "en", [
        ("1.4", "2026-03-30", "Thresholds aligned", [
            ("2.1", "Quotations", 3, "Procurement must obtain at least three quotations for purchases above $1,000."),
            ("2.4", "Supplier approval", 3, "Finance must approve each new supplier before the first purchase order is issued."),
            ("3.2", "Supplier gifts", 4, "Staff must not accept gifts from a supplier during an open quotation process."),
        ])]),
    ("D-027", "采购操作指引", "采购操作指引.docx", "department_sop", "Finance", "Chen Jia Hui", "zh", [
        ("1.0", "2026-06-10", "首版", [
            ("1.2", "采购流程", 1, "申请人必须在采购系统中提交采购申请。采购申请经部门主管审批后，采购部向供应商发出采购订单。"),
            ("2.1", "报价", 2, "采购金额超过1,000元时，采购部必须取得至少两份报价。"),
            ("2.4", "记录", 3, "财务部必须在2个工作日内在系统中记录采购交易。"),
        ])]),
    ("D-028", "Annual Leave Procedure", "Annual Leave Procedure.docx", "department_sop", "HR", "Nur Aisyah", "en", [
        ("2.1", "2026-02-10", "Entitlement aligned to policy v3", [
            ("2.1", "Entitlement", 2, "Full-time employees are entitled to 14 days of annual leave per year."),
            ("2.3", "Booking", 2, "Annual leave must be booked in the HR portal at least 7 days in advance."),
            ("2.5", "Carry forward", 3, "Unused annual leave may be carried forward for up to 6 months."),
        ])]),
    ("D-029", "Sick Leave Guidelines", "Sick Leave Guidelines.pdf", "training", "HR", "Nur Aisyah", "en", [
        ("1.0", "2026-04-14", "First issue", [
            ("2", "Reporting sick leave", 2, "Staff on sick leave must inform their line manager before the start of the shift."),
            ("3", "Medical certificates", 3, "Sick leave of more than 2 days must be supported by a medical certificate."),
        ])]),
    ("D-030", "IT Acceptable Use Policy", "IT Acceptable Use Policy.pdf", "corporate_policy", "Operations", "Ahmad Faris", "en", [
        ("1.2", "2026-05-25", "Personal device rules", [
            ("3.1", "Passwords", 4, "Staff must change their system password every 90 days."),
            ("3.3", "Public Wi-Fi", 4, "Work laptops must only connect to public Wi-Fi through the company VPN."),
            ("4.1", "Lost devices", 5, "Lost work phones must be reported to the Security Desk within 24 hours."),
        ])]),
    ("D-031", "Device Return Checklist", "Device Return Checklist.docx", "template", "Operations", "Ahmad Faris", "en", [
        ("1.0", "2026-06-22", "First issue", [
            ("1", "Return date", 1, "Work laptops and phones must be returned within 3 working days of the last working day."),
            ("2", "Access cards", 1, "Access cards must be returned to the Security Desk with the device."),
        ])]),
    ("D-032", "Customer Service Training Pack", "Customer Service Training Pack.pdf", "training", "Customer Service", "Grace Tan", "en", [
        ("2.0", "2026-08-20", "Complaints module added", [
            ("3", "Complaints", 4, "Acknowledge every complaint within 2 business days."),
            ("4", "Discounts", 6, "Discounts above 20% need final approval from the Regional Director."),
            ("5", "Refund window", 7, "Customers may submit new refund requests within 7 calendar days of delivery."),
        ])]),
    ("D-033", "Price Match Guidelines", "Price Match Guidelines.pdf", "department_sop", "Sales", "Marcus Lee", "en", [
        ("1.0", "2026-03-16", "First issue", [
            ("2.1", "Approval", 2, "Price-match discounts above 20% must receive final approval from the Regional Director."),
            ("2.3", "Records", 3, "Every price-match discount must be recorded with the competitor's advertised price."),
        ])]),
    ("D-034", "门店排班与加班规程", "门店排班与加班规程.docx", "department_sop", "Operations", "Chen Jia Hui", "zh", [
        ("1.1", "2026-07-01", "加班上限调整", [
            ("2.2", "加班审批", 2, "每月加班超过12小时必须由店长审批。"),
            ("2.4", "午休", 2, "员工每班必须有至少60分钟的午休。"),
        ])]),
    ("D-035", "Stocktake Procedure", "Stocktake Procedure.docx", "department_sop", "Operations", "Ahmad Faris", "en", [
        ("1.2", "2026-09-12", "Cycle counts added", [
            ("3.1", "Counting", 3, "Stores must complete a full stock count every quarter."),
            ("3.4", "Discrepancies", 4, "Stock discrepancies above 5 units must be escalated to the Area Supervisor."),
        ])]),
    ("D-036", "Business Travel Policy", "Business Travel Policy.pdf", "corporate_policy", "Finance", "Daniel Koh", "en", [
        ("1.0", "2026-02-02", "First issue", [
            ("2.2", "Travel approval", 2, "Overseas business travel must be approved by the Department Head."),
            ("4.1", "Travel claims", 5, "Travel expense claims must be submitted within 30 calendar days of return."),
        ])]),
    ("D-037", "Expense Claim Form", "Expense Claim Form.docx", "template", "Finance", "Daniel Koh", "en", [
        ("2.0", "2026-08-04", "Receipt field added", [
            ("1", "Deadline", 1, "Submit this expense claim within 60 calendar days of the purchase date."),
            ("2", "Approval", 1, "Claims above $500 must be approved by the Department Head."),
        ])]),
    ("D-038", "Hybrid Work Guidelines", "Hybrid Work Guidelines.pdf", "department_sop", "HR", "Nur Aisyah", "en", [
        ("1.0", "2026-03-23", "First issue", [
            ("2.1", "Remote days", 2, "Office employees may work remotely for up to 2 days per week."),
            ("2.4", "Working hours", 3, "Remote staff must keep core working hours of 10am to 4pm."),
        ])]),
    ("D-039", "Supplier Code of Conduct", "Supplier Code of Conduct.pdf", "corporate_policy", "Finance", "Marcus Lee", "en", [
        ("1.1", "2026-05-08", "Hospitality limits added", [
            ("2.1", "Gifts to staff", 2, "Suppliers must not offer gifts above $100 to Harbour & Co. staff."),
            ("3.2", "Complaints", 3, "Supplier complaints must be acknowledged within 5 business days."),
        ])]),
    ("D-040", "Store Manager Handbook", "Store Manager Handbook.pdf", "training", "Operations", "Ahmad Faris", "en", [
        ("3.0", "2026-10-02", "Annual refresh", [
            ("2", "Overtime", 4, "Overtime above 10 hours per month must be approved by the Store Manager."),
            ("3", "Till variances", 5, "Till variances above $20 must be escalated to the Area Supervisor."),
            ("4", "Stock counts", 6, "Stock discrepancies above 5 units must be escalated to the Area Supervisor."),
            ("5", "Discount approvals", 7, "Discounts above 20% need final approval from the Regional Director."),
            ("6", "Leave approvals", 8, "Annual leave must be booked in the HR portal at least 7 days in advance."),
        ])]),
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


# Later findings placed along the resolution path so Review & Approve has work at every stage:
# id -> (status, owner, due date). Proposals for these live in demo.REVISIONS.
RESOLVING = {
    "SOP-007": ("confirmed", None, None),
    "SOP-008": ("assigned", "Grace Tan", "2026-11-12"),
    "SOP-019": ("assigned", "Ahmad Faris", "2026-11-03"),
    "SOP-011": ("revision_proposed", "Daniel Koh", "2026-11-10"),
    "SOP-015": ("revision_proposed", "Lim Wei Ling", "2026-11-18"),
    "SOP-017": ("rejected", "Nur Aisyah", "2026-11-20"),
}

ORDER = ["contradiction|refund|submission", "missing_step|B-purchase", "outdated|leave", "responsibility|discount", "contradiction|refund|response"]


def sample_findings() -> list[dict]:
    """Demo findings with their demo review states, all produced by the engine."""
    settings = default_settings("Harbour & Co. Retail")
    docs = demo_docs()
    before = [{**d, "current": 0} if d["id"] in ("D-009", "D-010") else d for d in docs]
    first = detect(before, rules_for(before), settings, DEFAULT_BASELINES)
    now = detect(docs, rules_for(docs), settings, DEFAULT_BASELINES)

    # The original storyline findings keep SOP-001 to SOP-006: the first draft per ORDER key whose
    # evidence cites only the original ten documents. Findings from later documents follow.
    original = {d["id"] for d in docs[:10]} | {""}
    slots: dict[int, str] = {}
    for d in now["drafts"]:
        k = next((k for k, p in enumerate(ORDER) if d["dedupKey"].startswith(p)), None)
        if k is not None and k not in slots and {e["docId"] for e in d["evidence"]} <= original:
            slots[k] = d["dedupKey"]
    ranks = {key: k for k, key in slots.items()}
    ordered = sorted(now["drafts"], key=lambda d: ranks.get(d["dedupKey"], 99))
    ambiguity = next((d for d in first["drafts"] if d["dedupKey"].startswith("ambiguity|inventory")), None)
    out, n = [], 1
    states = {2: ("under_review", None), 5: ("under_review", "Marcus Lee")}
    for d in ordered:
        if n == 4 and ambiguity:
            out.append({**ambiguity, "id": "SOP-004", "status": "closed", "owner": "Ahmad Faris", "reverified": "resolved", "scan": "SCAN-001"})
            n += 1
        status, owner = states.get(n, ("detected", None))
        status, owner, due = RESOLVING.get(f"SOP-{n:03d}", (status, owner, None))
        out.append({**d, "id": f"SOP-{n:03d}", "status": status, "owner": owner, "dueDate": due, "reverified": None, "scan": "SCAN-002" if n == 6 else "SCAN-001"})
        n += 1
    return out
