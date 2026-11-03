"""
Deterministic SOP rule engine (English + Chinese).

1. Split each source span into sentence-sized instructions and extract typed
   rules: topic, subject, event, actor, modality, value/unit/period, conditions,
   scope. Unknown attributes stay "Unknown"/None; nothing is invented.
2. Compare only rules on the same topic, subject and event, with overlapping
   scope and the same period. Numbers, units and thresholds are compared in
   code. Every candidate pair gets one of five classifications.
3. A finding is kept only when every quoted clause is found word for word
   (whitespace-insensitive) in the stored source span.

Hard negatives from the specification are built in: different regions, standard
vs premium exceptions, submission vs approval deadlines, archived vs current,
business days vs calendar days, and illustrative examples.

Data is plain dicts with the same camelCase keys as the web client's types.
"""
from __future__ import annotations

import re
from typing import Any

AUTHORITY_LABEL = {
    "corporate_policy": "Corporate policy",
    "department_sop": "Department SOP",
    "training": "Training material",
    "template": "Template",
}

I = re.I
CJK = re.compile(r"[一-鿿]")


def _lex(id_: str, label: str, en: str, zh: str, flags: int = I) -> dict:
    return {"id": id_, "label": label, "en": re.compile(en, flags), "zh": re.compile(zh)}


TOPICS = [
    _lex("refund", "Refunds", r"\brefund", r"退款"),
    _lex("discount", "Discounts", r"\bdiscount", r"折扣"),
    _lex(
        "leave",
        "Leave & time off",
        r"\bannual leave\b|\bleave entitlement|\bpaid time off\b|\bPTO\b|\bvacation|\bsick (leave|days?|time)|\bparental leave|\bparent leave|\bcaregiver|\bbereavement|\bsabbatical|\bunpaid time off|\btime off\b",
        r"年假|病假|假期|休假|产假|陪产假|调休",
    ),
    _lex("remote", "Remote work", r"\bremote(ly)? work|\bwork(ing)? remotely|\bwork from home|\bcoworking", r"远程办公|居家办公"),
    _lex("gifts", "Gifts & hospitality", r"\bgifts?\b|\bhospitality|\bbrib", r"礼品|礼物|招待|贿赂"),
    _lex("devices", "Work devices", r"\blaptops?\b|\bwork devices?|\bcomputer equipment|\bphones?\b", r"电脑|设备|手机"),
    _lex("hours", "Working hours", r"\bworking hours|\bwork hours|\blunch break|\bbreaks?\b|\bovertime", r"工作时间|午休|加班"),
    _lex("inventory", "Inventory", r"\bstock\b|\binventory\b", r"库存|盘点"),
    _lex("purchase", "Purchasing", r"\bpurchase|\bprocure|\bquotation|\bsupplier", r"采购|报价|供应商"),
    _lex("expenses", "Expenses", r"\bexpense|\breimburse|\bclaims?\b", r"报销|费用"),
    _lex("security", "Security", r"\bpassword|\baccess card|\bcctv|\bcash (drawer|office)", r"密码|门禁|监控"),
    _lex("complaints", "Complaints", r"\bcomplaint", r"投诉"),
]

EVENTS = [
    _lex("approval", "approval", r"\bapprov|\bsign[- ]off|\bauthori[sz]", r"审批|批准|核准"),
    _lex(
        "payment",
        "payment deadline",
        r"\bpa(y|id)\b(?!\s+(time off|leave|sabbatical|holidays?|vacation))|\bpay out|\breimburse|\bprocess(ed)? (the )?refund",
        r"支付|付款|退还|打款",
    ),
    _lex("response", "response time", r"\brepl(y|ies)\b|\brespond|\backnowledge", r"回复|答复|响应"),
    _lex("escalation", "escalation route", r"\bescalat|\breport(ed)? to\b", r"上报|报告给|汇报"),
    _lex("submission", "request window", r"\bsubmit|\baccept(ed)? new|\brequests? (a )?refund|\bfile\b", r"提交|受理"),
    _lex("recording", "recording deadline", r"\brecord|\blog(ged)? (in|the)", r"记录|登记"),
    _lex(
        "entitlement",
        "entitlement",
        r"\bentitled|\breceive \d+|\bdays of (annual )?leave|\bearns?\b|\baccru|\baccumulate|\btake up to|\boffers? \d+|\bbegin with",
        r"享有|可享|累计",
    ),
    _lex("application", "limit", r"\bapply|\bgive\b.*\bdiscount|\boffer", r"给予|使用"),
]

QUALIFIERS = [
    _lex(
        "cap",
        "maximum balance",
        r"\bmaximum\b|\bat most\b|\bno more than\b|\bup to\b|\bcapped\b|\brolls? over\b|\bcarr(y|ied) (forward|over)\b",
        r"最多|至多|不超过|上限|结转",
    ),
    _lex("initial", "starting balance", r"\bbegin with\b|\bnewly hired\b|\bnew hires?\b|\bstarting balance\b", r"新入职|入职首年"),
]

SUBJECTS: dict[str, list[dict]] = {
    "leave": [
        _lex("parental", "", r"\bparent|\bcaregiver|\bmaternity|\bpaternity|\bnew child", r"产假|陪产假|育儿假"),
        _lex("sick", "", r"\bsick|\billness|\bmedical leave", r"病假"),
        _lex("bereavement", "", r"\bbereavement|\bcompassionate", r"丧假"),
        _lex("sabbatical", "", r"\bsabbatical", r"长假"),
        _lex("unpaid", "", r"\bunpaid\b|\bUTO\b|\bquick review\b", r"无薪|事假"),
        _lex("annual", "", r"\bannual leave|\bvacation|\bpaid time off|\bPTO\b|\bpersonal days", r"年假|带薪假"),
    ],
    "expenses": [
        _lex("furniture", "", r"\bdesk\b|\bchairs?\b|\bfurniture|\bhome office", r"办公家具|桌椅"),
        _lex("coworking", "", r"\bcoworking|\bdeskpass", r"共享办公"),
        _lex("travel", "", r"\btravel|\bflights?\b|\bhotels?\b|\bmileage", r"差旅|机票|酒店"),
        _lex("meals", "", r"\bmeals?\b|\blunch|\bdinner|\bentertainment", r"餐|招待费"),
        _lex("insurance", "", r"\binsurance|\bFSA\b|\bhealth", r"保险|医疗"),
        _lex("training", "", r"\btraining|\bcourses?\b|\bconference|\beducation|\bbooks?\b", r"培训|课程|会议"),
        _lex("equipment", "", r"\bcomputer|\blaptop|\bphones?\b|\bmonitor|\bdevice", r"电脑|手机|设备"),
        _lex("receipts", "", r"\breceipts?\b", r"发票|收据"),
    ],
}

PERIODS = [
    (re.compile(r"\b(per|each|every|a) (pay period)\b|每个?发薪周期", I), "pay period"),
    (re.compile(r"\b(per|each|every|a) (day|working day)\b|/day\b|\bdaily\b|每天|每日", I), "day"),
    (re.compile(r"\b(per|each|every|a) week\b|/(wk|week)\b|\bweekly\b|每周|每星期", I), "week"),
    (re.compile(r"\b(per|each|every|a) month\b|/(mo|month)\b|\bmonthly\b|每月", I), "month"),
    (re.compile(r"\b(per|each|every|a) (year|calendar year)\b|/(yr|year)\b|\bannually\b|\byearly\b|每年|每一年", I), "year"),
]

ILLUSTRATION = re.compile(r"^(for example|for instance|e\.g\.|assuming|suppose|let[’']s say|例如|比如|假设)", I)

ROLES = [
    ("Regional Director", re.compile(r"\bregional directors?\b", I), re.compile(r"区域总监")),
    ("Area Supervisor", re.compile(r"\barea supervisors?\b", I), re.compile(r"区域主管")),
    ("Store Manager", re.compile(r"\bstore managers?\b", I), re.compile(r"店长")),
    ("Support agent", re.compile(r"\b(support )?agents?\b|\bcustomer service (staff|officers?)\b", I), re.compile(r"客服人员|客服")),
    ("Finance", re.compile(r"\bfinance\b", I), re.compile(r"财务")),
    ("Procurement", re.compile(r"\bprocurement\b", I), re.compile(r"采购部")),
    ("HR", re.compile(r"\bHR\b|\bhuman resources\b"), re.compile(r"人事")),
    ("Customer", re.compile(r"\bcustomers?\b", I), re.compile(r"顾客|客户")),
    ("Requester", re.compile(r"\brequesters?\b", I), re.compile(r"申请人")),
    ("Employee", re.compile(r"\b(full-time )?employees?\b|\bstaff\b", I), re.compile(r"员工")),
]

MODAL_EN = [
    ("must_not", re.compile(r"\b(must not|shall not|may not|must never|cannot|is not allowed|are not allowed|is prohibited|are prohibited)\b", I)),
    ("must", re.compile(r"\b(must|shall|is required to|are required to|need to|needs to)\b", I)),
    ("may", re.compile(r"\b(may|can|is allowed to|are allowed to)\b", I)),
    ("should", re.compile(r"\bshould\b", I)),
]
MODAL_ZH = [
    ("must_not", re.compile(r"不得|禁止|不可|不能|严禁")),
    ("must", re.compile(r"必须|须|应当|需要|需")),
    ("may", re.compile(r"可以|可|允许|能够")),
    ("should", re.compile(r"应|宜|建议")),
]

WORD_NUM = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "fourteen": 14, "fifteen": 15, "twenty": 20, "thirty": 30, "sixty": 60, "ninety": 90,
}
NUM = r"(\d+(?:[.,]\d+)?|" + "|".join(WORD_NUM) + r")"
VALUE_EN = re.compile(
    NUM + r"\s*(calendar days?|business days?|working days?|days?|weeks?|months?|hours?|hrs|minutes?|mins?|units?|items?|%|percent)|S?\$\s?([\d,]+)",
    I,
)
VALUE_ZH = re.compile(r"(\d+(?:\.\d+)?)\s*个?\s*(自然日|工作日|天|日|小时|分钟|周|星期|月|件|%)")


def topic_label(id_: str) -> str:
    for t in TOPICS:
        if t["id"] == id_:
            return t["label"]
    return id_[:1].upper() + id_[1:]


def event_label(id_: str) -> str:
    for e in QUALIFIERS + EVENTS:
        if e["id"] == id_:
            return e["label"]
    return id_


def squash(t: str) -> str:
    return re.sub(r"\s+", " ", t).strip()


def detect_lang(text: str) -> str:
    han = len(CJK.findall(text))
    latin = len(re.findall(r"[A-Za-z]", text))
    if han and latin and han * 3 > latin and latin * 2 > han:
        return "mixed"
    return "zh" if han > latin / 2 else "en"


_SPLIT = re.compile(r"(?<=[.!?;])\s+(?=[A-Z0-9(一-鿿])|(?<=[。！？；])")


def sentences(text: str) -> list[str]:
    out = []
    for line in re.split(r"\n+", text):
        for s in _SPLIT.split(line):
            s = re.sub(r"^\s*(\(?\d+[.)]|[-•*])\s+", "", s).strip()
            if len(s) > 6:
                out.append(s)
    return out


def first_match(items: list[dict], text: str, zh: bool):
    best = None
    for item in items:
        m = (item["zh"] if zh else item["en"]).search(text)
        if m and (best is None or m.start() < best[1]):
            best = (item, m.start())
    return best


def _num(v: float) -> float | int:
    return int(v) if float(v).is_integer() else v


def read_value(s: str, zh: bool) -> dict | None:
    if zh:
        m = VALUE_ZH.search(s)
        if not m:
            return None
        v = float(m.group(1))
        u = m.group(2)
        base = {"value": _num(v), "valueText": m.group(0), "index": m.start()}
        table = {
            "小时": ("hours", "time", v), "分钟": ("minutes", "time", v / 60), "周": ("weeks", "time", v * 168),
            "星期": ("weeks", "time", v * 168), "月": ("months", "count", v * 1000), "工作日": ("business days", "business_days", v),
            "件": ("units", "count", v), "%": ("%", "percent", v),
        }
        unit, cls, norm = table.get(u, ("days", "time", v * 24))
        return {**base, "unit": unit, "unitClass": cls, "norm": norm}
    m = VALUE_EN.search(s)
    if not m:
        return None
    if m.group(3):
        v = float(m.group(3).replace(",", ""))
        return {"value": _num(v), "unit": "S$" if m.group(0).strip().startswith("S$") else "$", "unitClass": "money", "norm": v, "valueText": m.group(0), "index": m.start()}
    raw = m.group(1).lower()
    v = float(WORD_NUM.get(raw, raw.replace(",", "")))
    u = m.group(2).lower()
    base = {"value": _num(v), "valueText": m.group(0), "index": m.start()}
    if re.fullmatch(r"hours?|hrs", u):
        return {**base, "unit": "hours", "unitClass": "time", "norm": v}
    if re.fullmatch(r"minutes?|mins?", u):
        return {**base, "unit": "minutes", "unitClass": "time", "norm": v / 60}
    if re.fullmatch(r"weeks?", u):
        return {**base, "unit": "weeks", "unitClass": "time", "norm": v * 168}
    if re.fullmatch(r"months?", u):  # months vary in length: compared only with months
        return {**base, "unit": "months", "unitClass": "count", "norm": v * 1000}
    if re.search(r"business|working", u):
        return {**base, "unit": "business days", "unitClass": "business_days", "norm": v}
    if re.search(r"units?|items?", u):
        return {**base, "unit": "units", "unitClass": "count", "norm": v}
    if re.search(r"%|percent", u):
        return {**base, "unit": "%", "unitClass": "percent", "norm": v}
    return {**base, "unit": "days", "unitClass": "time", "norm": v * 24}


def read_modality(s: str, zh: bool):
    if not zh and re.search(r"\bmay not be (eligible|able|available|possible|required)\b", s, I):
        return "may", re.search(r"\bmay not be\b", s, I).start() + 10
    for modality, rx in MODAL_ZH if zh else MODAL_EN:
        m = rx.search(s)
        if m:
            return modality, m.end()
    return None


def read_event(s: str, zh: bool, modal_at: int, value: dict | None) -> str:
    q = first_match(QUALIFIERS, s, zh)
    if q and value:
        return q[0]["id"]
    if zh:
        after = s[value["index"]:] if value else s[modal_at:]
        hit = first_match(EVENTS, after, True) or first_match(EVENTS, s, True)
        return hit[0]["id"] if hit else "other"
    phrase = re.sub(r"^(be|not|only|also|always)\s+", "", s[modal_at:].strip(), flags=I)
    phrase = " ".join(phrase.split()[:3])
    hit = first_match(EVENTS, phrase, False) or first_match(EVENTS, s, False)
    return hit[0]["id"] if hit else "other"


def read_actor(s: str, zh: bool, event: str, modal_at: int) -> str:
    found = []
    for name, en, cn in ROLES:
        for m in (cn if zh else en).finditer(s):
            found.append((m.start(), name))
    if not found:
        return "Unknown"
    found.sort()
    if event in ("approval", "escalation"):
        marker = re.compile(r"由|上报|报告给|交由") if zh else re.compile(r"\b(from|to|by)\s+(the\s+)?", I)
        for m in marker.finditer(s):
            hit = next((n for i, n in found if 0 <= i - m.end() < 4), None)
            if hit:
                return hit
        if re.search(r"\bfinal approval\b", s, I) or "最终审批" in s:
            subj = next((n for i, n in found if i < modal_at), None)
            if subj:
                return subj
        if re.search(r"\bbe escalated\b|\bbe approved\b", s, I) or (zh and not re.search(r"由|上报.+", s)):
            return "Unknown"
    return next((n for i, n in found if i < modal_at), found[0][1])


GROUPS = [
    (re.compile(r"\bpart-time\b", I), re.compile(r"兼职"), "Part-time staff"),
    (re.compile(r"\bprimary caregiver\b", I), re.compile(r"主要照顾者"), "Primary caregiver"),
    (re.compile(r"\bsecondary caregiver\b", I), re.compile(r"次要照顾者"), "Secondary caregiver"),
    (re.compile(r"\b(first|1st) year\b|\bless than (1|one) year\b|\bbefore (\d+|two|three|four)[- ]year", I), re.compile(r"入职(首|第一)年|不满一年"), "Early tenure"),
    (re.compile(r"\bafter (\d+|two|three|four|five)[- ]years?\b|\bover (\d+|one|two) years?\b", I), re.compile(r"满\d+年"), "Longer tenure"),
]


def read_conditions(s: str, zh: bool) -> list[str]:
    out = []
    if (re.search(r"会员", s) if zh else re.search(r"\bpremium (members?|customers?)\b", s, I)):
        out.append("Premium members")
    if (re.search(r"除.+外", s) if zh else re.search(r"\bexcept\b", s, I)):
        out.append("Stated exception")
    everyone = re.search(r"全职和兼职|全职及兼职", s) if zh else re.search(r"\bfull-time (and|or|&) part-time\b|\bpart-time (and|or|&) full-time\b", s, I)
    for en, cn, label in GROUPS:
        if (cn if zh else en).search(s) and not (everyone and label == "Part-time staff"):
            out.append(label)
    return out


def read_scope(s: str, fallback: str) -> str:
    if re.search(r"\bSingapore\b|新加坡", s):
        return "Singapore stores"
    if re.search(r"\bKuala Lumpur\b|吉隆坡", s):
        return "Kuala Lumpur stores"
    return fallback


def subject_of(topic: str, s: str, zh: bool) -> str:
    lst = SUBJECTS.get(topic)
    if not lst:
        return ""
    parental = next((x for x in lst if x["id"] == "parental"), None)
    if parental and (parental["zh"] if zh else parental["en"]).search(s):
        return "parental"
    hit = first_match(lst, s, zh)
    return hit[0]["id"] if hit else ""


def extract_rules(doc: dict, version_index: int) -> list[dict]:
    """Rules for one version of a document; the caller assigns ids."""
    v = doc["versions"][version_index]
    historical = version_index != doc["current"]
    out = []
    for section in v["sections"]:
        for s in sentences(section["text"]):
            if ILLUSTRATION.search(s):
                continue
            zh = bool(CJK.search(s)) and detect_lang(s) != "en"
            topic_hit = first_match(TOPICS, s, zh)
            value = read_value(s, zh)
            modal = read_modality(s, zh)
            if not modal and not value:
                continue
            modal_at = modal[1] if modal else 0
            event = read_event(s, zh, modal_at, value)
            if not topic_hit and event == "other":
                continue
            actor = read_actor(s, zh, event, modal_at)
            if zh:
                ev = next((e for e in EVENTS if e["id"] == event), None)
                m = ev["zh"].search(s) if ev else None
                action = m.group(0) if m else ""
            else:
                action = " ".join(re.sub(r"^(be|not)\s+", "", s[modal_at:].strip(), flags=I).split()[:3]).rstrip(".,;")
            rule = {
                "docId": doc["id"],
                "version": v["version"],
                "historical": historical,
                "sectionId": section["id"],
                "sectionRef": section["ref"],
                "page": section["page"],
                "quote": s,
                "topic": topic_hit[0]["id"] if topic_hit else "general",
                "subject": subject_of(topic_hit[0]["id"], s, zh) if topic_hit else "",
                "period": next((p for rx, p in PERIODS if rx.search(s)), None) if value else None,
                "event": event,
                "actor": actor,
                "action": action,
                "modality": modal[0] if modal else "must",
                "conditions": read_conditions(s, zh),
                "scope": read_scope(s, doc.get("scope", "All regions")),
                "lang": "zh" if zh else "en",
            }
            if value:
                rule.update({k: value[k] for k in ("value", "unit", "norm", "unitClass", "valueText")})
            out.append(rule)
    return out


# ---------- detection ----------

WHY = {
    "refund": "Staff may accept or refuse the same customer refund depending on which document they read.",
    "discount": "Two different people believe they hold the final sign-off, so a discount can be approved without the right authority.",
    "leave": "Employees trained on the old figure will plan and request leave against the wrong entitlement.",
    "inventory": "When nobody is clearly named, discrepancies are either reported twice or not at all.",
    "purchase": "Purchases can be ordered without the documented control the company requires.",
}


def fmt_value(r: dict) -> str:
    v = r.get("value")
    if v is None:
        return ""
    u = r.get("unit")
    if u == "%":
        return f"{v}%"
    if u in ("S$", "$"):
        return f"{u}{v:,}"
    unit = re.sub(r"s$", "", u) if v == 1 else u
    return f"{v} {unit}"


def _scopes_overlap(a: str, b: str) -> bool:
    return a == b or a == "All regions" or b == "All regions"


def _evidence(rule: dict, docs: dict) -> dict:
    doc = docs.get(rule["docId"])
    section = None
    if doc:
        for v in doc["versions"]:
            if v["version"] == rule["version"]:
                section = next((s for s in v["sections"] if s["id"] == rule["sectionId"]), None)
    return {
        "docId": rule["docId"],
        "version": rule["version"],
        "sectionId": rule["sectionId"],
        "sectionRef": rule["sectionRef"],
        "page": rule["page"],
        "quote": rule["quote"],
        "highlight": rule.get("valueText"),
        "verified": bool(section) and squash(rule["quote"]) in squash(section["text"]),
        "ruleId": rule.get("id"),
    }


def _rank(doc: dict, settings: dict) -> int:
    h = settings.get("hierarchy", [])
    return h.index(doc["authority"]) if doc["authority"] in h else 99


def _authority(a: dict, b: dict, settings: dict) -> dict:
    if a["approval"] == "draft" or b["approval"] == "draft":
        return {"text": "Insufficient information: one of the documents is still a draft.", "governing": None, "other": b}
    ra, rb = _rank(a, settings), _rank(b, settings)
    if ra == rb:
        return {"text": f"Unresolved: both are {AUTHORITY_LABEL[a['authority']].lower()}s, so neither governs by default.", "governing": None, "other": b}
    gov, other = (a, b) if ra < rb else (b, a)
    return {"text": f"Governing document confirmed: {gov['title']} ({AUTHORITY_LABEL[gov['authority']]}).", "governing": gov, "other": other}


def _risk(type_: str, topic: str, settings: dict) -> str:
    base = settings.get("topicRisk", {}).get(topic, "medium")
    if type_ in ("outdated", "ambiguity", "duplicate"):
        return "medium" if base == "high" else base
    return base


def _owner(doc: dict) -> str:
    return doc.get("owner") or "the document owner"


def detect(docs: list[dict], rules: list[dict], settings: dict, baselines: list[dict], doc_ids: list[str] | None = None) -> dict[str, Any]:
    by_id = {d["id"]: d for d in docs}
    in_set = (lambda i: True) if doc_ids is None else (lambda i: i in doc_ids)
    live = [r for r in rules if r["docId"] in by_id and not r["historical"] and by_id[r["docId"]]["approval"] != "archived" and in_set(r["docId"])]
    counts = {"rules": len(live), "candidates": 0, "potential": 0, "compatible": 0, "exception": 0, "historical": 0, "insufficient": 0}
    drafts: dict[str, dict] = {}
    pairs: list[dict] = []  # same topic + event, numbers not decisive: for semantic (LLM) review

    def add(d: dict) -> None:
        if any(not e.get("baseline") and not e["verified"] for e in d["evidence"]):
            return
        drafts.setdefault(d["dedupKey"], d)

    for r in rules:
        if r["historical"] and in_set(r["docId"]):
            now = next((c for c in live if c["docId"] == r["docId"] and c["topic"] == r["topic"] and c["event"] == r["event"]), None)
            if now and now.get("norm") is not None and r.get("norm") is not None and now["norm"] != r["norm"]:
                counts["historical"] += 1

    groups: dict[str, list[dict]] = {}
    for r in live:
        groups.setdefault(r["topic"], []).append(r)
    owners: dict[str, list[dict]] = {}

    for topic, lst in groups.items():
        if topic == "general":
            continue
        for i in range(len(lst)):
            for j in range(i + 1, len(lst)):
                a, b = lst[i], lst[j]
                if a["quote"] == b["quote"] and a["docId"] == b["docId"]:
                    continue
                counts["candidates"] += 1
                da, db = by_id[a["docId"]], by_id[b["docId"]]
                if da.get("parseIssue") or db.get("parseIssue"):
                    counts["insufficient"] += 1
                    continue
                if a["event"] != b["event"] or a["event"] == "other" or (topic in SUBJECTS and a["subject"] != b["subject"]):
                    # neither clause names a recognisable event: the rules cannot decide, so a person or the model should look
                    if a["event"] == "other" and b["event"] == "other" and a["docId"] != b["docId"] and a["subject"] == b["subject"] \
                            and _scopes_overlap(a["scope"], b["scope"]):
                        pairs.append({"a": a, "b": b})
                    counts["compatible"] += 1
                    continue
                if not _scopes_overlap(a["scope"], b["scope"]):
                    counts["compatible"] += 1
                    continue
                comparable = (
                    a.get("norm") is not None and b.get("norm") is not None and a.get("unitClass") == b.get("unitClass")
                    and (a.get("period") or "") == (b.get("period") or "")
                )
                threshold = a.get("unitClass") in ("percent", "money", "count")

                if (
                    {a["modality"], b["modality"]} == {"may", "must_not"}
                    and (a["actor"] == b["actor"] or "Unknown" in (a["actor"], b["actor"]))
                    and (not comparable or a["norm"] == b["norm"])
                ):
                    counts["potential"] += 1
                    auth = _authority(da, db, settings)
                    add({
                        "dedupKey": f"prohibition|{topic}|{a['event']}|{'+'.join(sorted([a['docId'], b['docId']]))}",
                        "type": "prohibition",
                        "risk": _risk("prohibition", topic, settings),
                        "title": f"{topic_label(topic)}: one document permits what another forbids",
                        "explanation": f"{da['title']} says this {'may' if a['modality'] == 'may' else 'must not'} happen; {db['title']} says it {'may' if b['modality'] == 'may' else 'must not'}.",
                        "why": WHY.get(topic, "Staff cannot follow both instructions at once."),
                        "authority": auth["text"],
                        "recommendation": f"Keep {auth['governing']['title']} and ask {_owner(auth['other'])} to change {auth['other']['title']}." if auth["governing"] else "Ask both owners to agree which instruction stands.",
                        "evidence": [_evidence(a, by_id), _evidence(b, by_id)],
                        "topic": topic,
                        "department": (auth["other"] if auth["governing"] else db)["department"],
                    })
                    continue

                if comparable and a["norm"] != b["norm"] and not threshold:
                    if ",".join(a["conditions"]) != ",".join(b["conditions"]):
                        counts["exception"] += 1
                        continue

                    def past_of(gov: dict, other: dict) -> bool:
                        return any(
                            h["historical"] and h["docId"] == gov["docId"] and h["topic"] == gov["topic"] and h["event"] == gov["event"] and h.get("norm") == other["norm"]
                            for h in rules
                        )

                    outdated = {"gov": a, "old": b} if past_of(a, b) else {"gov": b, "old": a} if past_of(b, a) else None
                    counts["potential"] += 1
                    if outdated:
                        gd, od = by_id[outdated["gov"]["docId"]], by_id[outdated["old"]["docId"]]
                        prev = next((h for h in rules if h["historical"] and h["docId"] == gd["id"] and h["event"] == outdated["gov"]["event"] and h.get("norm") == outdated["old"]["norm"]), None)
                        pv = prev["version"] if prev else "previous"
                        add({
                            "dedupKey": f"outdated|{topic}|{a['event']}|{od['id']}",
                            "type": "outdated",
                            "risk": _risk("outdated", topic, settings),
                            "title": f"Old {topic_label(topic).lower()} {event_label(a['event'])} still in {od['title']}",
                            "explanation": f"{od['title']} still says {fmt_value(outdated['old'])}, the figure from {gd['title']} v{pv}. The current v{outdated['gov']['version']} says {fmt_value(outdated['gov'])}.",
                            "why": WHY.get(topic, "People reading the older guidance will follow a rule that no longer applies."),
                            "authority": f"Governing document confirmed: {gd['title']} v{outdated['gov']['version']} supersedes v{prev['version'] if prev else '?'}.",
                            "recommendation": f"Update {od['title']} {outdated['old']['sectionRef']} to {fmt_value(outdated['gov'])} and ask {_owner(od)} to re-issue it.",
                            "evidence": [_evidence(outdated["gov"], by_id), _evidence(outdated["old"], by_id)],
                            "topic": topic,
                            "department": od["department"],
                        })
                        continue
                    auth = _authority(da, db, settings)
                    ev = [b, a] if auth["governing"] and auth["governing"]["id"] == db["id"] else [a, b]
                    scope = b["scope"] if a["scope"] == "All regions" else a["scope"]
                    add({
                        "dedupKey": f"contradiction|{topic}|{a['event']}|{'+'.join(sorted([a['docId'], b['docId']]))}",
                        "type": "contradiction",
                        "risk": _risk("contradiction", topic, settings),
                        "title": f"Conflicting {topic_label(topic).lower()} {event_label(a['event'])}: {fmt_value(ev[0])} vs {fmt_value(ev[1])}",
                        "explanation": f"{by_id[ev[0]['docId']]['title']} sets {fmt_value(ev[0])} for the {event_label(a['event'])}; {by_id[ev[1]['docId']]['title']} sets {fmt_value(ev[1])}. Same event, overlapping scope ({scope}), and neither clause is marked as an exception.",
                        "why": WHY.get(topic, "Staff following different documents will handle the same case differently."),
                        "authority": auth["text"],
                        "recommendation": f"Treat {auth['governing']['title']} as governing. Ask {_owner(auth['other'])} to align {auth['other']['title']} {ev[1]['sectionRef']}." if auth["governing"] else "Both documents carry the same authority: ask the policy owners for an explicit decision, then align the other.",
                        "evidence": [_evidence(ev[0], by_id), _evidence(ev[1], by_id)],
                        "topic": topic,
                        "department": (auth["other"] if auth["governing"] else db)["department"],
                    })
                    continue

                if a["event"] in ("approval", "escalation") and (not comparable or a["norm"] == b["norm"] or not threshold):
                    owners.setdefault(f"{topic}|{a['event']}", []).extend([a, b])
                    continue
                if not comparable and a["docId"] != b["docId"]:
                    pairs.append({"a": a, "b": b})
                counts["compatible"] += 1

    for key, raw in owners.items():
        topic, event = key.split("|")
        seen, lst = set(), []
        for r in raw:
            if id(r) not in seen:
                seen.add(id(r))
                lst.append(r)
        named = list(dict.fromkeys(r["actor"] for r in lst))
        if len(named) < 2:
            counts["compatible"] += 1
            continue
        counts["potential"] += 1
        known = [r for r in lst if r["actor"] != "Unknown"]
        docs_in = sorted(dict.fromkeys(r["docId"] for r in lst))
        if event == "approval" and "Unknown" not in named and len(known) >= 2:
            a, b = known[0], known[1]
            da, db = by_id[a["docId"]], by_id[b["docId"]]
            auth = _authority(da, db, settings)
            ev = [b, a] if auth["governing"] and auth["governing"]["id"] == db["id"] else [a, b]
            add({
                "dedupKey": f"responsibility|{topic}|{'+'.join(docs_in)}",
                "type": "responsibility",
                "risk": _risk("responsibility", topic, settings),
                "title": f"Conflicting {topic_label(topic).lower()} approval roles: {ev[0]['actor']} vs {ev[1]['actor']}",
                "explanation": f"{by_id[ev[0]['docId']]['title']} gives final approval to the {ev[0]['actor']}; {by_id[ev[1]['docId']]['title']} gives it to the {ev[1]['actor']}, for the same threshold.",
                "why": WHY.get(topic, "Two roles believe they hold the final decision."),
                "authority": auth["text"],
                "recommendation": f"Confirm the {ev[0]['actor']} as approver and ask {_owner(auth['other'])} to correct {auth['other']['title']} {ev[1]['sectionRef']}." if auth["governing"] else "Ask the policy owners to name one approver.",
                "evidence": [_evidence(ev[0], by_id), _evidence(ev[1], by_id)],
                "topic": topic,
                "department": (auth["other"] if auth["governing"] else db)["department"],
            })
        else:
            add({
                "dedupKey": f"ambiguity|{topic}|{event}|{'+'.join(docs_in)}",
                "type": "ambiguity",
                "risk": _risk("ambiguity", topic, settings),
                "title": f"Unclear {topic_label(topic).lower()} {'approver' if event == 'approval' else 'escalation owner'}",
                "explanation": f"{len(docs_in)} documents name {len(named)} different owners ({', '.join('nobody named' if n == 'Unknown' else n for n in named)}).",
                "why": WHY.get(topic, "When the owner is unclear, the step is either done twice or skipped."),
                "authority": "Insufficient information: no document names a single owner with higher authority.",
                "recommendation": "Ask the department owner to name one role and use the same wording in every document.",
                "evidence": [_evidence(r, by_id) for r in lst[:3]],
                "topic": topic,
                "department": by_id[lst[0]["docId"]]["department"],
            })

    # Missing documented steps: only against an explicit, approved baseline.
    for base in baselines:
        if not base.get("approved", True) or not base.get("steps"):
            continue
        topic_lex = [t for t in TOPICS if t["id"] == base["topic"]]
        for doc in docs:
            if not in_set(doc["id"]) or doc["approval"] == "archived" or doc["authority"] != "department_sop":
                continue
            v = doc["versions"][doc["current"]]
            on_topic = sum(1 for r in live if r["docId"] == doc["id"] and r["topic"] == base["topic"])
            titled = first_match(topic_lex, doc["title"], bool(CJK.search(doc["title"]))) if topic_lex else None
            if not titled and on_topic < 3:
                continue
            text = "\n".join(s["text"] for s in v["sections"]).lower()

            def has(kw: list[str], t: str = text) -> bool:
                return any(k.lower() in t for k in kw)

            if sum(1 for s in base["steps"] if has(s["keywords"])) < 2:
                continue
            for step in base["steps"]:
                if has(step["keywords"]):
                    continue
                proc = max(v["sections"], key=lambda sec: sum(1 for s in base["steps"] if has(s["keywords"], sec["text"].lower())))
                counts["potential"] += 1
                add({
                    "dedupKey": f"missing_step|{base['id']}|{doc['id']}|{step['name']}",
                    "type": "missing_step",
                    "risk": _risk("missing_step", base["topic"], settings),
                    "title": f"Missing {step['name'].lower()} step in {doc['title']}",
                    "explanation": f'The approved {base["name"]} baseline requires "{step["name"]}". {doc["title"]} v{v["version"]} lists the other steps but never documents this one.',
                    "why": WHY.get(base["topic"], "A required control is not written down, so new staff will not know to perform it."),
                    "authority": f"Reference: approved {base['name']} baseline (Settings → Policy baselines).",
                    "recommendation": f"Ask {_owner(doc)} to add the {step['name'].lower()} step to {proc['ref']}. This shows the step is undocumented, not that it never happens.",
                    "evidence": [
                        {"docId": "", "version": "", "sectionId": "", "sectionRef": "Baseline", "page": 0,
                         "quote": f"{base['name']}: {' → '.join(s['name'] for s in base['steps'])}", "highlight": step["name"], "verified": True, "baseline": base["name"]},
                        {"docId": doc["id"], "version": v["version"], "sectionId": proc["id"], "sectionRef": proc["ref"], "page": proc["page"],
                         "quote": proc["text"], "verified": True},
                    ],
                    "topic": base["topic"],
                    "department": doc["department"],
                })

    return {"drafts": list(drafts.values()), "counts": counts, "pairs": pairs}
