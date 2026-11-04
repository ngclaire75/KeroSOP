"""
Body text for the sample (demo) documents.

Each sample document is a full company document of ten pages or more, so it
needs much more text than the clauses KeroSOP compares. This module writes
that text from a small bank per topic (the steps of the procedure, its
definitions, questions staff ask, the records it needs), in English or
Chinese to match the document. The cited clauses themselves come from the
workspace and are never changed.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Block:
    """One heading and its paragraphs. `chapter` starts a new top-level part."""

    heading: str
    paras: list[str]
    chapter: bool = False
    bullets: bool = False


# ---------- English topics ----------

EN = {
    "refund": dict(
        area="refunds, returns and exchanges",
        case="a refund request",
        who="Customer Service colleagues and store staff",
        defs=["Refund request: a customer's request to return goods for their money back.", "Proof of purchase: a receipt, order number or card statement showing the sale.", "Store credit: a credit note the customer can spend in any Harbour & Co. store.", "Faulty goods: items that do not work as described or are damaged on arrival.", "Change-of-mind return: a return of goods that are not faulty.", "Refund method: the way money goes back to the customer, normally the original payment method."],
        steps=[("Greet and listen", "Let the customer explain the problem in full before asking questions, and note what they are asking for."), ("Check the proof of purchase", "Find the sale on the receipt, order number or card statement and confirm the date, store and item."), ("Inspect the goods", "Check the item's condition, packaging and accessories against what was sold, and note any damage."), ("Check the request window", "Compare the purchase date with the request window that applies to this customer and this type of return."), ("Decide the outcome", "Choose refund, exchange, repair or store credit according to the rules in this document, and explain the decision."), ("Process the refund", "Refund to the original payment method in the till, using the return reason code that matches the case."), ("Record and file", "Attach the photos and notes to the case in the customer system and give the customer the case reference."), ("Follow up", "If the refund needs approval or a supplier claim, tell the customer when to expect an answer and diarise the follow-up.")],
        faqs=[("The customer has no receipt.", "Look the sale up by card or order number. Without any proof of purchase, offer store credit at the lowest recent selling price."), ("The item was a gift.", "Offer an exchange or store credit to the person returning it; refunds go to the original payer only."), ("The packaging is missing.", "Accept the return if the item is unused and complete; note the missing packaging on the case."), ("The customer paid in cash and wants a card refund.", "Refund in cash up to the till limit; larger amounts are paid by bank transfer within five working days."), ("The system will not accept the return.", "Do not force it through. Record the case on the offline form and ask the duty manager to review it."), ("The customer is upset with the decision.", "Explain the rule calmly, give the case reference and offer to escalate to the Customer Service manager.")],
        records=["the case reference and the date of the request", "the proof of purchase used", "photos of the item where it is damaged or faulty", "the outcome and the reason code", "who approved any exception"],
    ),
    "discount": dict(
        area="discounts, price matches and price overrides",
        case="a discount or price override",
        who="store staff, team leaders and Store Managers",
        defs=["Discount: any reduction from the ticketed price.", "Price override: a manual change to a price at the till.", "Price match: matching a competitor's advertised price for the same item.", "Approver: the person whose authority the discount level requires.", "Promotion: a planned, company-wide price reduction set by Marketing.", "Margin floor: the lowest margin a sale may make without Finance approval."],
        steps=[("Confirm the reason", "Ask why a discount is needed and check it is not already covered by a live promotion."), ("Check the evidence", "For price matches, see the competitor's current advertised price for the identical item."), ("Work out the level", "Calculate the discount as a percentage of the ticketed price, including any promotion already applied."), ("Find the approver", "Use the approval table in this document to find who must approve that level."), ("Get approval", "Get the approval in the till or in writing before the sale is completed, never afterwards."), ("Apply the discount", "Enter the discount with the matching reason code so it is reported correctly."), ("Record the decision", "Keep the approval reference and any evidence with the sale record."), ("Review weekly", "Store Managers review all overrides each week and query any that look unusual.")],
        faqs=[("The customer asks for a discount for a small mark.", "Offer up to the level you may approve yourself; above that, ask your team leader."), ("Two promotions apply.", "Promotions do not stack unless Marketing says so; apply the better one for the customer."), ("A competitor's price is online only.", "Online prices from listed competitors can be matched if the item is in stock with them."), ("The approver is not on shift.", "Ask the duty manager; if no one with authority is available, do not apply the discount."), ("A colleague asks for a staff discount on a sale item.", "Staff discount applies to the current selling price only and is not added to an override."), ("The till rejects the discount.", "The till blocks discounts above your authority; ask the right approver rather than splitting the sale.")],
        records=["the discount level and reason code", "the approver and approval reference", "the evidence for any price match", "the original and final price"],
    ),
    "store operations": dict(
        area="store opening, trading and closing",
        case="a store routine",
        who="duty managers and all store colleagues",
        defs=["Duty manager: the most senior person on shift, responsible for the store.", "Trading hours: the hours a store is open to customers.", "Opening check: the checklist completed before the doors open.", "Cash-up: counting and reconciling the tills at the end of the day.", "Incident: any event that affects safety, stock or the customer experience.", "Stock exception: a stock problem that needs action the same day."],
        steps=[("Arrive and secure", "Two colleagues open the store together, disarm the alarm and check for signs of entry."), ("Opening checks", "Walk the shop floor, fitting rooms and stockroom using the opening checklist."), ("Set up the tills", "Count each float, sign it out and log in to the tills before trading."), ("Daily briefing", "Share sales targets, promotions, deliveries and any safety notices with the team."), ("Trading", "Keep the shop floor stocked and tidy, and keep at least one till open at all times."), ("Deliveries", "Check deliveries against the delivery note and report shortages the same day."), ("Cash-up", "Count the tills with a witness, record variances and bank the takings."), ("Close and secure", "Check all areas are empty, set the alarm and lock up with two colleagues present.")],
        faqs=[("A colleague is late for opening.", "Do not open alone; wait for a second colleague and tell the Area Supervisor."), ("The alarm will not set.", "Call the alarm company and stay until it is resolved or a guard arrives."), ("A till is short at cash-up.", "Recount with a witness, record the variance and report variances over $20."), ("A delivery is missing items.", "Sign for what arrived only and raise a shortage claim the same day."), ("A customer is injured in store.", "Give first aid, record the incident and inform the duty manager immediately."), ("The store must close early.", "Get approval from the Area Supervisor and put a notice on the door.")],
        records=["the opening and closing checklists", "till floats and cash-up sheets", "delivery notes and shortage claims", "incident reports"],
    ),
    "purchase": dict(
        area="purchasing goods and services",
        case="a purchase",
        who="requesters, budget holders, Procurement and Finance",
        defs=["Requester: the person who needs the goods or service.", "Purchase request: the request raised in the procurement system.", "Quotation: a written price from a supplier, valid for a stated period.", "Purchase order (PO): the approved order sent to a supplier.", "Budget holder: the manager responsible for the cost centre.", "Approved supplier: a supplier already checked and set up by Procurement."],
        steps=[("Raise the request", "The requester raises a purchase request with a clear description, quantity and cost centre."), ("Get quotations", "Procurement collects quotations according to the value thresholds in this document."), ("Select the supplier", "Choose the best-value quotation from an approved supplier and record why."), ("Approve the spend", "The budget holder approves the request in the system before any order is placed."), ("Issue the purchase order", "Procurement issues the PO to the supplier; no goods are ordered without one."), ("Receive the goods", "The requester confirms receipt and checks the goods against the PO."), ("Match the invoice", "Finance matches the invoice to the PO and the goods receipt before payment."), ("Record the transaction", "Finance records the payment in the ledger and files the documents.")],
        faqs=[("The supplier is not approved yet.", "Ask Procurement to set them up first; urgent cases need the Procurement Manager's approval."), ("The price has gone up since the quotation.", "Get a new quotation and re-approve if the increase is more than 5%."), ("The goods are needed today.", "Use an approved supplier and the emergency route; the PO is still raised the same day."), ("The invoice has no PO number.", "Return it to the supplier asking for the PO number before it can be paid."), ("A purchase is split to stay under a limit.", "Splitting purchases is not allowed; the full value sets the approval needed."), ("The budget is exceeded.", "The budget holder must get Finance approval before the request can proceed.")],
        records=["the purchase request and approvals", "the quotations received", "the purchase order", "the goods receipt and the invoice"],
    ),
    "finance": dict(
        area="payments, refunds and ledger records",
        case="a payment",
        who="Finance colleagues and budget holders",
        defs=["Ledger: the company's record of financial transactions.", "Payment run: the scheduled release of approved payments.", "Reconciliation: matching ledger entries to bank statements.", "Approved refund: a customer refund signed off under the Refund Policy.", "Cut-off: the last time a transaction can be included in a period.", "Segregation of duties: no one person both approves and releases a payment."],
        steps=[("Receive the request", "Payments arrive as approved invoices, approved refunds or expense claims."), ("Check approval", "Confirm the approval matches the authority limits before anything is paid."), ("Check the details", "Check the payee, amount and bank details against the supporting documents."), ("Schedule the payment", "Add the payment to the next payment run that meets the required deadline."), ("Release the payment", "A second Finance colleague reviews and releases the payment run."), ("Record in the ledger", "Record each payment in the ledger with its reference and cost centre."), ("Reconcile", "Reconcile the bank account to the ledger every working day."), ("Close the period", "At month end, review open items and complete the close checklist.")],
        faqs=[("A supplier asks to change bank details.", "Call the supplier on a known number to confirm before any change is made."), ("A refund is approved late in the day.", "It goes into the next payment run; tell Customer Service the expected date."), ("A payment fails.", "Contact the payee, correct the details and re-release within two working days."), ("A duplicate invoice arrives.", "Mark it as a duplicate and do not pay it; tell the supplier."), ("A ledger entry is wrong.", "Correct it with a journal entry and a note; never delete the original."), ("A payment is urgent.", "Urgent payments still need two people: one to approve and one to release.")],
        records=["the approved invoice or refund", "the payment run report", "the ledger entry and reference", "the bank reconciliation"],
    ),
    "inventory": dict(
        area="stock counts and stock records",
        case="a stock movement",
        who="store teams, Area Supervisors and the Inventory team",
        defs=["Stock count: a physical count of goods on hand.", "Cycle count: a count of one section of stock, done on a rota.", "Discrepancy: the difference between counted and recorded stock.", "Area Supervisor: the manager responsible for a group of stores.", "Adjustment: a change made to the stock record after a count.", "Shrinkage: stock lost through damage, error or theft."],
        steps=[("Plan the count", "Schedule the count outside trading hours and assign counters to each area."), ("Freeze movements", "Stop deliveries, transfers and returns in the area being counted."), ("Count", "Count every item in the area, with a second colleague checking high-value lines."), ("Enter the results", "Enter the counts in the stock system the same day."), ("Find discrepancies", "Compare the counts with the stock record and list every difference."), ("Recount", "Recount any line where the difference is above the threshold before reporting it."), ("Report and escalate", "Report discrepancies to the right level according to this document."), ("Adjust the record", "Adjust the stock record once the discrepancy is approved, with the reason.")],
        faqs=[("A count is interrupted.", "Mark where the count stopped and restart that section from the beginning."), ("Stock is found in the wrong location.", "Count it where it is found and move it after the count."), ("A delivery arrives during the count.", "Keep it unopened in a separate area until the count is finished."), ("The system shows negative stock.", "Report it to the Inventory team; do not adjust it yourself."), ("A high-value item is missing.", "Recount at once, then escalate to the Area Supervisor the same day."), ("The scanner fails.", "Count on paper count sheets and enter the results later the same day.")],
        records=["the count sheets or scanner files", "the list of discrepancies", "recount results", "approved adjustments and their reasons"],
    ),
    "training": dict(
        area="new-starter and refresher training",
        case="a customer situation",
        who="new starters, buddies, trainers and managers",
        defs=["Module: a unit of training with its own assessment.", "Buddy: an experienced colleague assigned to a new starter.", "Assessment: a check that the colleague can do the task correctly.", "Refresher: training repeated each year to keep skills current.", "Sign-off: the manager's confirmation that a module is complete.", "Learning record: the system entry showing a colleague's completed training."],
        steps=[("Welcome", "The manager welcomes the new starter and introduces their buddy."), ("Induction", "Complete the induction modules on safety, conduct and data protection."), ("Shadowing", "The new starter shadows their buddy on the shop floor and at the till."), ("Customer service module", "Learn how to handle refunds, complaints and enquiries using the company procedures."), ("Practice", "Handle real cases with the buddy watching and giving feedback."), ("Assessment", "Complete the assessment for each module with a trainer."), ("Sign-off", "The manager signs off each module in the learning record."), ("Refresh", "Complete the yearly refresher and any update training when procedures change.")],
        faqs=[("A new starter fails an assessment.", "Repeat the practice with the buddy and re-take the assessment within two weeks."), ("A procedure changes after training.", "Complete the update module before handling that task again."), ("The buddy is away.", "The manager assigns a temporary buddy; training does not pause."), ("A colleague moves stores.", "Their learning record moves with them; only store-specific modules are repeated."), ("Training is missed because of a busy shift.", "The manager reschedules it within the same week."), ("The training material conflicts with a policy.", "Follow the policy and tell the training team so the material is corrected.")],
        records=["the learning record", "assessment results", "manager sign-offs", "refresher completion dates"],
    ),
    "leave": dict(
        area="annual leave and time off",
        case="a leave request",
        who="all employees and their managers",
        defs=["Annual leave: paid days off accrued during the leave year.", "Leave year: 1 January to 31 December.", "Carry-forward: unused leave moved into the next leave year.", "Public holiday: a gazetted public holiday.", "Leave request: the request submitted in the HR system.", "Blackout period: dates when leave is normally not approved."],
        steps=[("Check the balance", "Check your remaining leave in the HR system before asking."), ("Plan ahead", "Request leave at least two weeks ahead, or four weeks for more than five days."), ("Submit the request", "Submit the request in the HR system with the dates and any notes."), ("Manager review", "Your manager checks cover and blackout periods before deciding."), ("Decision", "The manager approves or declines within three working days, with a reason if declined."), ("Arrange cover", "Hand over open work and tell colleagues who is covering."), ("Take the leave", "Leave is recorded automatically once approved; do not work while on leave."), ("Review the balance", "Check your balance at year end and plan any carry-forward.")],
        faqs=[("Leave is needed at short notice.", "Ask your manager directly; urgent requests are considered case by case."), ("Leave is declined.", "Your manager must give a reason and suggest other dates."), ("Someone is sick during leave.", "Tell your manager and send a medical certificate; those days become sick leave."), ("Leave is left at year end.", "Carry forward up to the limit in this policy; the rest lapses unless HR agrees."), ("A public holiday falls during leave.", "It is not counted as a leave day."), ("A colleague leaves the company.", "Unused leave is paid out in the final salary.")],
        records=["the leave request and approval", "the leave balance", "medical certificates for sick days during leave", "carry-forward approvals"],
    ),
}
DEFAULT_EN = dict(
    area="this procedure", case="a request", who="all colleagues",
    defs=["Owner: the person accountable for this document.", "Staff: everyone employed or contracted by Harbour & Co. Retail.", "Case: one request handled under this document."],
    steps=[("Receive", "Receive the request and confirm what is being asked."), ("Check", "Check the request against this document."), ("Decide", "Decide the outcome and explain it."), ("Record", "Record the outcome in the system of record.")],
    faqs=[("Something is not covered here.", "Ask the document owner before acting.")],
    records=["the request", "the outcome", "any approvals"],
)

# ---------- Chinese topics ----------

ZH = {
    "退款": dict(
        area="退款、退货与换货",
        case="退款申请",
        who="客服人员及门店员工",
        defs=["退款申请：顾客为退回商品并取回款项而提出的申请。", "购买凭证：收据、订单号或能证明交易的银行卡记录。", "门店积分：可在任一 Harbour & Co. 门店使用的抵用凭证。", "质量问题商品：无法按说明使用或到货即损坏的商品。", "无理由退货：非质量问题的退货。", "退款方式：款项退回顾客的方式，通常为原支付方式。"],
        steps=[("接待与倾听", "先让顾客完整说明问题，再提问，并记录顾客的诉求。"), ("核对购买凭证", "通过收据、订单号或银行卡记录找到交易，确认日期、门店和商品。"), ("检查商品", "对照销售记录检查商品状况、包装和配件，并记录任何损坏。"), ("核对受理期限", "将购买日期与适用于该顾客和该退货类型的受理期限进行比对。"), ("确定处理方式", "按本规程选择退款、换货、维修或门店积分，并向顾客说明理由。"), ("办理退款", "在收银系统中按原支付方式退款，并选择对应的退货原因代码。"), ("记录与归档", "将照片和说明附在客户系统的个案中，并告知顾客个案编号。"), ("跟进", "如需审批或向供应商索赔，告知顾客预计答复时间并登记跟进日期。")],
        faqs=[("顾客没有收据。", "可通过银行卡或订单号查询交易；如无任何购买凭证，按近期最低售价提供门店积分。"), ("商品是礼物。", "可为退货人办理换货或门店积分；退款只退回原付款人。"), ("包装缺失。", "如商品未使用且配件齐全，可受理退货，并在个案中注明包装缺失。"), ("顾客用现金支付但要求退到银行卡。", "收银限额内以现金退款；超出部分在五个工作日内以银行转账退回。"), ("系统无法受理退货。", "不得强行操作。使用离线表格登记，并请值班经理复核。"), ("顾客对处理结果不满。", "耐心说明规定，提供个案编号，并可升级至客服经理。")],
        records=["个案编号及申请日期", "所用的购买凭证", "商品损坏或故障的照片", "处理结果及原因代码", "例外情况的审批人"],
    ),
    "库存": dict(
        area="库存盘点与库存记录",
        case="库存变动",
        who="门店团队、区域主管及库存团队",
        defs=["盘点：对在库商品进行的实物清点。", "循环盘点：按排程对某一区域进行的盘点。", "差异：实盘数量与系统记录之间的差额。", "区域主管：负责一组门店的管理人员。", "调整：盘点后对库存记录所做的修改。", "损耗：因损坏、差错或盗窃造成的库存损失。"],
        steps=[("计划盘点", "在营业时间以外安排盘点，并为各区域指派盘点人员。"), ("冻结库存变动", "暂停盘点区域内的收货、调拨和退货。"), ("实物清点", "清点区域内所有商品，高价值商品由第二名同事复核。"), ("录入结果", "当天将盘点结果录入库存系统。"), ("查找差异", "将盘点结果与库存记录比对，列出所有差异。"), ("复盘", "差异超过阈值的品项须先复盘，再行上报。"), ("上报与升级", "按本指引将差异上报至相应层级。"), ("调整记录", "差异经批准后，调整库存记录并注明原因。")],
        faqs=[("盘点中途被打断。", "标记中断位置，并从该区域开头重新盘点。"), ("商品存放位置错误。", "在发现位置清点，盘点结束后再归位。"), ("盘点期间有货到达。", "原封不动放在独立区域，待盘点结束后再处理。"), ("系统显示负库存。", "报告库存团队，不得自行调整。"), ("高价值商品缺失。", "立即复盘，并于当天升级至区域主管。"), ("扫描枪故障。", "使用纸质盘点表清点，并于当天补录结果。")],
        records=["盘点表或扫描文件", "差异清单", "复盘结果", "已批准的调整及原因"],
    ),
}
DEFAULT_ZH = ZH["退款"]


def _bank(title: str, zh: bool) -> dict:
    if zh:
        return next((v for k, v in ZH.items() if k in title), DEFAULT_ZH)
    t = title.lower()
    return next((v for k, v in EN.items() if k in t), DEFAULT_EN)


def stream(title: str, owner: str, department: str, zh: bool) -> list[Block]:
    """The full body of a sample document, in reading order, long enough to fill ten pages and more."""
    b = _bank(title, zh)
    owner = owner or ("文件负责人" if zh else "the document owner")
    department = department or ("所属部门" if zh else "the owning department")
    return _zh_stream(b, owner, department) if zh else _en_stream(b, owner, department, title)


def _en_stream(b: dict, owner: str, dept: str, title: str) -> list[Block]:
    area, case, who = b["area"], b["case"], b["who"]
    out = [
        Block("Purpose and scope", [f"This document sets out how Harbour & Co. Retail handles {area}. It gives {who} one clear set of rules, so that every store, the customer contact centre and head office give the same answer.", "It applies to all stores, regional offices and the contact centre in Singapore and Kuala Lumpur, and to every employee, agency worker and contractor acting for the company. Where a local law sets a stricter rule, the stricter rule applies and the document owner must be told."], chapter=True),
        Block("Who this document is for", [f"Read this document if you handle {case}, supervise colleagues who do, or audit the process. Managers should also read the sections on approvals, records and monitoring.", "If you are unsure whether a situation is covered, stop and ask the duty manager before acting. It is always better to ask than to guess."]),
        Block("Definitions", b["defs"], bullets=True),
        Block("Roles and responsibilities", [f"{owner}, {dept}, owns this document: they keep it current, answer questions about it and approve exceptions.", "Store and team managers make sure their colleagues have read it, follow it and know where to find it.", f"Every colleague handling {case} follows the steps here, records what they did and raises anything unusual.", "Internal Audit checks that the process is followed and reports findings to the owner."], bullets=True),
        Block("Principles", ["Treat every customer and colleague fairly and consistently: the same facts lead to the same outcome in every store.", "Decide on the evidence in front of you and record it, so someone else can see why a decision was made.", "Never promise an outcome this document does not allow; if a case needs an exception, ask for it before acting.", "Protect personal data and company money as if they were your own."], bullets=True),
        Block("The procedure", [f"The steps below apply to every {case}. Follow them in order; each step lists what to do, who does it and what to record."], chapter=True),
    ]
    for i, (name, what) in enumerate(b["steps"], 1):
        out.append(Block(f"Step {i}: {name}", [what, f"Who does it: the colleague handling the {case.split(' ')[-1]}, with the duty manager's help where the case is outside their authority.", "What to record: a short note in the system of record saying what was done at this step and when. If the step could not be completed, record why and who was told."]))
        out.append(Block(f"Checks before moving on from step {i}", [f"Before moving on, confirm that '{name.lower()}' is complete and that the case notes say so. A step left half done is the most common reason a case is reopened later.", "If something at this step does not match what you expected, pause the case and ask the duty manager. Do not skip ahead to keep the customer waiting less."]))
    out += [
        Block("Approvals and authority", ["Some outcomes need approval before they are applied. The approval level depends on the value and the type of case, and is set out in the approval table kept with this document.", "Approval is given in the system wherever possible. Where it is given verbally, the colleague records the approver's name, the time and the reference in the case notes.", "No one approves their own case. If the right approver is not available, the case waits; it is never split or reworded to fit a lower level."], chapter=True),
        Block("Exceptions", [f"Any exception to this document needs written approval from {owner} before it is applied, and is logged with the reason.", "An exception covers one case only. It never changes the rule for later cases, and repeated exceptions are a signal that the document needs reviewing."]),
        Block("Escalation", ["Escalate to the duty manager when a request falls outside your authority or the customer is not satisfied with the outcome.", "Escalate to the document owner when two company documents seem to give different answers. Do not choose one yourself; record both and wait for a decision.", "Urgent safety, legal or fraud concerns go straight to the Head of Operations, the same day."], bullets=True),
        Block("Customer communication", ["Use plain language and the approved templates. Explain what was decided, why, and what happens next.", "Give the customer a reference number for every decision, so they can follow it up in any store or with the contact centre.", "If the customer disagrees, explain how to escalate and record that you did so."]),
        Block("Records", [f"Keep these records for every {case}:"] + [r[0].upper() + r[1:] + "." for r in b["records"]] + ["Records are kept in the system of record for seven years and are available to Internal Audit on request. Do not keep copies in personal email or on personal phones."], chapter=True, bullets=True),
        Block("Data protection", ["Only collect the personal data the process needs. Do not photograph receipts, ID or cards on personal devices.", "Customer data is never shared outside the company without the customer's consent or a legal requirement."]),
        Block("Quality checks", ["Each week the Store Manager samples five completed cases and checks they followed this document.", "Findings are recorded in the store quality log and shared at the next team briefing, with any retraining needed."], chapter=True),
        Block("Measures", ["The owner tracks how well the process works using: the share of cases completed first time without escalation; the average time from request to outcome; the number of exceptions approved; and the findings from store audits.", "Measures are reviewed each quarter and shared with store and regional managers."]),
        Block("Shift handover", ["Open cases are handed over in the shift log with their current status and the next step.", "The incoming duty manager confirms the handover before the outgoing manager leaves."]),
        Block("Training and awareness", ["New colleagues read this document in their first week and confirm they have done so in the learning record.", "Changes to the document are announced in the weekly operations briefing and in the staff handbook, and colleagues confirm they have read the change."], chapter=True),
        Block("Worked examples", ["The examples below show the procedure end to end. Names and details are illustrative."], chapter=True),
    ]
    steps = b["steps"]
    for k in range(0, len(steps) - 1, 2):
        a, c = steps[k], steps[k + 1]
        out.append(Block(f"Example: {a[0].lower()} and {c[0].lower()}", [f"A colleague in the Orchard Road store receives {case} on a busy Saturday. They start with '{a[0].lower()}': {a[1][0].lower() + a[1][1:]}", f"Next comes '{c[0].lower()}': {c[1][0].lower() + c[1][1:]} They record both steps in the case notes, and the Monday quality check finds nothing to correct."]))
    out += [
        Block("Frequently asked questions", ["These are the questions colleagues ask most often. If yours is not here, ask the duty manager."], chapter=True),
    ]
    for q, a in b["faqs"]:
        out.append(Block(q, [a]))
    out += [
        Block("Monitoring and review", [f"{owner} reviews this document at least once a year, or sooner when the law, a system or a related document changes.", "The review checks the measures above, audit findings, exceptions and customer feedback, and records any changes in the revision history."], chapter=True),
        Block("Related documents", ["Staff Handbook; Code of Conduct; Data Protection Policy; Store Operations Guide; Refund Policy; Purchase Procedure.", "Where a related document conflicts with this one, raise it with both owners. The authority order set by the company decides which governs until the conflict is fixed."]),
        Block("Contacts", [f"Document owner: {owner}, {dept}.", "Operations help desk: extension 4400, 08:00 to 20:00 every day.", "Compliance Office: compliance@harbourco.example."], bullets=True),
        Block("Form: case register", ["Date, store number and the colleague's name.", "What was asked for, and any amount involved.", "Who handled it, the outcome and the date.", "Manager's sign-off."], chapter=True, bullets=True),
        Block("Form: approval record", ["Approval reference.", "Approver's name and role.", "Decision and the reason given.", "Date of approval."], bullets=True),
        Block("Form: incident log", ["Date and time.", "People involved.", "What happened, in brief.", "Action taken and who follows it up."], bullets=True),
        Block("Form: audit checklist", ["Cases sampled and their references.", "Steps followed correctly, yes or no.", "Issues found and the owner of each fix.", "Auditor's sign-off and date."], bullets=True),
    ]
    return out


def _zh_stream(b: dict, owner: str, dept: str) -> list[Block]:
    area, case, who = b["area"], b["case"], b["who"]
    out = [
        Block("目的与适用范围", [f"本规程规定 Harbour & Co. Retail 处理{area}的方式，为{who}提供一套清晰统一的规则，确保各门店、客服中心与总部给出一致的答复。", "本规程适用于新加坡及吉隆坡的所有门店、区域办公室和客服中心，以及代表公司工作的全体员工、派遣人员与承包商。如当地法规有更严格的要求，以更严格者为准，并须告知文件负责人。"], chapter=True),
        Block("适用对象", [f"凡办理{case}、管理相关员工或审核相关流程的人员，均须阅读本规程。经理还应重点阅读审批、记录与监督章节。", "如不确定某一情况是否适用本规程，请先暂停并请示值班经理。宁可多问，不可猜测。"]),
        Block("术语定义", b["defs"], bullets=True),
        Block("职责", [f"{owner}（{dept}）为本规程负责人，负责维护、解释本规程并审批例外情况。", "门店及团队经理确保员工已阅读、遵守本规程，并知道在哪里查阅。", f"所有办理{case}的员工须按本规程步骤办理，如实记录，并及时上报异常情况。", "内部审计负责检查流程执行情况，并向负责人报告。"], bullets=True),
        Block("基本原则", ["公平一致地对待每一位顾客和同事：相同事实在任何门店都得出相同结果。", "依据现有证据作出决定并加以记录，使他人能够理解决定的理由。", "不得承诺本规程不允许的结果；如需例外，须事先申请。", "像保护自己的财物一样保护个人资料与公司资金。"], bullets=True),
        Block("办理流程", [f"以下步骤适用于每一宗{case}。请按顺序办理，每一步均说明做什么、由谁做以及须记录什么。"], chapter=True),
    ]
    for i, (name, what) in enumerate(b["steps"], 1):
        out.append(Block(f"第{i}步：{name}", [what, "办理人：经办员工；超出权限时由值班经理协助。", "记录要求：在指定系统中简要记录本步骤的办理内容及时间；如未能完成，须记录原因及已告知的人员。"]))
        out.append(Block(f"第{i}步完成前的核对", [f"进入下一步前，须确认“{name}”已完成，并已在个案记录中注明。步骤未完成即进入下一步，是个案日后被重开的最常见原因。", "如本步骤出现与预期不符的情况，须暂停个案并请示值班经理，不得为缩短顾客等待时间而跳过步骤。"]))
    out += [
        Block("审批与权限", ["部分处理结果须事先审批。审批层级视金额及个案类型而定，详见随本规程保存的审批表。", "审批应尽量在系统中完成；如为口头审批，经办人须在个案中记录审批人姓名、时间及编号。", "任何人不得审批本人经办的个案。如相应审批人不在，个案须等待，不得拆分或改写以降低审批层级。"], chapter=True),
        Block("例外处理", [f"任何例外须事先获得{owner}的书面批准，并登记原因。", "例外仅适用于单一个案，不改变后续个案的规则；频繁出现例外说明本规程需要复核。"]),
        Block("升级处理", ["超出本人权限或顾客对结果不满意时，升级至值班经理。", "如两份公司文件给出不同答案，升级至文件负责人，不得自行选择；须同时记录两份文件的内容。", "紧急的安全、法律或舞弊问题，须当天直接上报运营总监。"], bullets=True),
        Block("顾客沟通", ["使用通俗语言和标准模板，说明处理结果、理由及后续安排。", "每项处理结果均须提供参考编号，便于顾客在任一门店或客服中心跟进。", "如顾客不同意处理结果，须说明升级途径并作记录。"]),
        Block("记录保存", [f"每宗{case}须保存以下记录："] + [r + "。" for r in b["records"]] + ["记录在指定系统中保存七年，内部审计可随时调阅；不得保存在个人邮箱或个人手机中。"], chapter=True, bullets=True),
        Block("数据保护", ["只收集流程所需的个人资料，不得用个人设备拍摄收据、证件或银行卡。", "未经顾客同意或法律要求，不得向公司以外的人士提供顾客资料。"]),
        Block("质量抽查", ["门店经理每周抽查五宗已完成个案，核对是否符合本规程。", "抽查结果记录于门店质量日志，并在下次团队简报中通报及安排所需的再培训。"], chapter=True),
        Block("衡量指标", ["负责人通过以下指标衡量流程成效：一次办结且无需升级的比例；从申请到结果的平均时间；获批例外的数量；门店审核发现的问题。", "指标每季度复核一次，并通报门店及区域经理。"]),
        Block("交接班", ["未结个案须在交接日志中注明当前状态及下一步。", "接班值班经理确认后，交班经理方可离开。"]),
        Block("培训与宣导", ["新员工须在入职第一周内阅读本规程，并在学习记录中确认。", "规程变更将在每周运营简报及员工手册中公布，员工须确认已阅读变更内容。"], chapter=True),
        Block("案例说明", ["以下案例完整演示办理流程，姓名及细节仅供说明。"], chapter=True),
    ]
    steps = b["steps"]
    for k in range(0, len(steps) - 1, 2):
        a, c = steps[k], steps[k + 1]
        out.append(Block(f"案例：{a[0]}与{c[0]}", [f"乌节路门店的一名员工在繁忙的周六受理了一宗{case}。首先是“{a[0]}”：{a[1]}", f"接着是“{c[0]}”：{c[1]}该员工在个案中记录了这两个步骤，周一的质量抽查未发现需要更正之处。"]))
    out += [
        Block("常见问题", ["以下是员工最常提出的问题；如未涵盖，请咨询值班经理。"], chapter=True),
    ]
    for q, a in b["faqs"]:
        out.append(Block(q, [a]))
    out += [
        Block("监督与复核", [f"{owner}至少每年复核本规程一次；如法规、系统或相关文件变更，须提前复核。", "复核内容包括上述指标、审核发现、例外情况及顾客反馈，并在修订记录中登记变更。"], chapter=True),
        Block("相关文件", ["员工手册；行为守则；数据保护政策；门店运营指南；退款政策；采购流程。", "如相关文件与本规程有冲突，须同时告知两份文件的负责人；在冲突解决前，以公司设定的权限顺序决定适用哪一份。"]),
        Block("联系方式", [f"文件负责人：{owner}（{dept}）。", "运营服务台：分机 4400，每日 08:00 至 20:00。", "合规办公室：compliance@harbourco.example。"], bullets=True),
        Block("附表：个案登记表", ["日期、门店编号及经办人姓名。", "申请事项及涉及金额。", "处理人、处理结果及日期。", "主管签名。"], chapter=True, bullets=True),
        Block("附表：审批记录", ["审批编号。", "审批人姓名及职级。", "审批意见及理由。", "审批日期。"], bullets=True),
        Block("附表：事件记录", ["日期及时间。", "涉及人员。", "经过简述。", "采取的措施及跟进人。"], bullets=True),
        Block("附表：审核清单", ["抽查个案及编号。", "各步骤是否正确执行（是/否）。", "发现的问题及整改负责人。", "审核人签名及日期。"], bullets=True),
    ]
    return out


def guidance(title: str, zh: bool) -> list[Block]:
    """An appendix of detailed guidance per step, used only by documents long enough to need it."""
    b = _bank(title, zh)
    if zh:
        out = [Block("附录：分步详细指引", ["本附录就办理流程的每一步提供更详细的做法、审核关注点及对顾客的影响。"], chapter=True)]
        for name, what in b["steps"]:
            out.append(Block(f"指引：{name}", [f"良好做法：{what}办理时保持记录简洁、准确，并使用系统中的标准选项，避免自由文本造成歧义。", f"审核关注点：审核人员会核对“{name}”是否在规定时间内完成、记录是否完整，以及是否有越权处理的情况。", "对顾客的影响：本步骤办理得当，可减少顾客重复往返和等待，也能降低投诉与升级的数量。"]))
        return out
    out = [Block("Appendix: detailed guidance by step", ["This appendix gives more detail on each step of the procedure: good practice, what auditors look for, and how the step affects customers."], chapter=True)]
    for name, what in b["steps"]:
        out.append(Block(f"Guidance: {name.lower()}", [f"Good practice: {what} Keep notes short and factual, and use the standard options in the system rather than free text, so the record means the same thing to everyone who reads it.", f"What auditors look for: that '{name.lower()}' was done in the right order and on time, that the record is complete, and that no one acted beyond their authority.", "Customer impact: doing this step well saves the customer a second visit or call, and it is the step most often mentioned when customers praise or complain about the service."]))
    return out
