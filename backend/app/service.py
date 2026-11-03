"""
Workspace operations. Everything runs inside a tenant() transaction, so the
database's row-level security scopes every read and write to one organisation.
The snapshot uses the same shape as the web client's `Workspace` type, with
human codes (D-001, SOP-001, R-0001, SCAN-001) as ids.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlalchemy import text
from sqlalchemy.engine import Connection

from . import engine
from .seed import DEFAULT_BASELINES

ROLE_CAN = {
    "review": {"owner", "admin", "reviewer", "approver"},
    "edit_docs": {"owner", "admin", "editor"},
    "propose": {"owner", "admin", "editor", "reviewer"},
    "approve": {"owner", "admin", "approver"},
    "scan": {"owner", "admin", "editor", "reviewer", "approver"},
    "admin": {"owner", "admin"},
}


class Denied(Exception):
    pass


class Invalid(Exception):
    pass


def require(role: str, action: str) -> None:
    if role not in ROLE_CAN[action]:
        raise Denied(f"Your role ({role}) cannot do this.")


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def iso(v) -> str | None:
    if v is None:
        return None
    return v.isoformat() if hasattr(v, "isoformat") else str(v)


def rows(conn: Connection, sql: str, **kw):
    return conn.execute(text(sql), kw).mappings().all()


def one(conn: Connection, sql: str, **kw):
    return conn.execute(text(sql), kw).mappings().first()


# ---------- audit + notifications ----------

def audit(conn, org, actor: str, action: str, target: str, href: str | None = None, detail: str | None = None, user=None):
    conn.execute(
        text("INSERT INTO audit_events (organization_id, actor, actor_user, action, target, href, detail) VALUES (:o,:a,:u,:ac,:t,:h,:d)"),
        {"o": org, "a": actor, "u": user, "ac": action, "t": target, "h": href, "d": detail},
    )


def notify(conn, org, body: str, href: str | None = None):
    conn.execute(text("INSERT INTO notifications (organization_id, body, href) VALUES (:o,:b,:h)"), {"o": org, "b": body, "h": href})
    s = one(conn, "SELECT name, settings FROM organizations WHERE id = :o", o=org)
    hook = ((s or {}).get("settings") or {}).get("webhook", "").strip()
    if hook.startswith("https://"):
        payload = {"text": f"KeroSOP · {s['name']}: {body}"} if "hooks.slack.com" in hook else {"source": "kerosop", "workspace": s["name"], "text": body, "link": href, "at": now()}
        try:  # best effort: a failing receiver never blocks the workflow
            httpx.post(hook, json=payload, timeout=4)
        except Exception:
            pass


def next_code(conn, org, kind: str, prefix: str, width: int = 3) -> str:
    row = one(conn, "SELECT seq FROM organizations WHERE id = :o FOR UPDATE", o=org)
    seq = dict(row["seq"])
    n = int(seq.get(kind, 1))
    seq[kind] = n + 1
    conn.execute(text("UPDATE organizations SET seq = CAST(:s AS jsonb) WHERE id = :o"), {"s": json.dumps(seq), "o": org})
    return f"{prefix}-{n:0{width}d}"


# ---------- loading for the engine ----------

def load_docs(conn, org) -> list[dict]:
    docs = rows(conn, "SELECT * FROM documents ORDER BY created_at DESC")
    versions = rows(conn, "SELECT * FROM document_versions ORDER BY uploaded_at, version")
    spans = rows(conn, "SELECT id, version_id, ref, heading, page, text, ordinal FROM source_spans ORDER BY ordinal")
    by_version: dict = {}
    for s in spans:
        by_version.setdefault(s["version_id"], []).append({"id": str(s["id"]), "ref": s["ref"], "heading": s["heading"], "page": s["page"], "text": s["text"]})
    out = []
    for d in docs:
        vs = [v for v in versions if v["document_id"] == d["id"]]
        vs.sort(key=lambda v: [int(p) if p.isdigit() else 0 for p in v["version"].split(".")])
        cur = next((i for i, v in enumerate(vs) if v["id"] == d["current_version_id"]), len(vs) - 1)
        out.append({
            "uuid": d["id"], "id": d["code"], "title": d["title"], "fileName": d["file_name"], "kind": d["kind"], "owner": d["owner_name"],
            "department": d["department"], "authority": d["authority"], "approval": d["approval"], "language": d["language"], "scope": d["scope"],
            "current": max(cur, 0), "parseIssue": d["parse_issue"],
            "versions": [{"uuid": v["id"], "version": v["version"], "sections": by_version.get(v["id"], []), "checksum": v["checksum"], "size": v["size"],
                          "uploadedAt": iso(v["uploaded_at"]), "uploadedBy": v["uploaded_by"], "note": v["note"],
                          "effectiveDate": iso(v["effective_date"]) or "", "status": v["status"], "pages": v["pages"]} for v in vs],
        })
    return out


def load_rules(conn) -> list[dict]:
    rs = rows(conn, """SELECT r.*, d.code AS doc_code, v.version AS ver, s.ref AS sref, s.page AS spage
                       FROM extracted_rules r JOIN documents d ON d.id = r.document_id
                       JOIN document_versions v ON v.id = r.version_id JOIN source_spans s ON s.id = r.span_id ORDER BY r.code""")
    out = []
    for r in rs:
        rule = {"id": r["code"], "uuid": r["id"], "docId": r["doc_code"], "version": r["ver"], "historical": r["historical"], "sectionId": str(r["span_id"]),
                "sectionRef": r["sref"], "page": r["spage"], "quote": r["quote"], "topic": r["topic"], "subject": r["subject"], "event": r["event"],
                "actor": r["actor"], "action": r["action"], "modality": r["modality"], "conditions": r["conditions"], "scope": r["scope"], "lang": r["lang"],
                "period": r["period"], "extractor": r["extractor"]}
        if r["value"] is not None:
            rule.update(value=engine._num(r["value"]), unit=r["unit"], norm=r["norm"], unitClass=r["unit_class"], valueText=r["value_text"])
        out.append(rule)
    return out


def baselines(conn) -> list[dict]:
    return [{"id": b["key"], "topic": b["topic"], "name": b["name"], "steps": b["steps"], "approved": b["approved"]}
            for b in rows(conn, "SELECT * FROM policy_baselines ORDER BY name")]


def org_settings(conn, org) -> dict:
    return dict(one(conn, "SELECT settings FROM organizations WHERE id = :o", o=org)["settings"])


# ---------- snapshot ----------

def snapshot(conn, org, user_id) -> dict:
    o = one(conn, "SELECT * FROM organizations WHERE id = :o", o=org)
    docs = load_docs(conn, org)
    rules = load_rules(conn)
    doc_code = {d["uuid"]: d["id"] for d in docs}
    ver = {v["uuid"]: v["version"] for d in docs for v in d["versions"]}
    findings = rows(conn, "SELECT * FROM findings ORDER BY created_at DESC, code DESC")
    evidence = rows(conn, "SELECT * FROM finding_evidence ORDER BY ordinal")
    comments = rows(conn, "SELECT * FROM comments ORDER BY created_at")
    revisions = rows(conn, "SELECT * FROM revision_proposals ORDER BY proposed_at")
    fout = []
    for f in findings:
        rev = [r for r in revisions if r["finding_id"] == f["id"]]
        r = rev[-1] if rev else None
        fout.append({
            "id": f["code"], "type": f["type"], "risk": f["risk"], "status": f["status"], "title": f["title"], "explanation": f["explanation"],
            "why": f["why"], "authority": f["authority"], "recommendation": f["recommendation"], "topic": f["topic"], "department": f["department"],
            "dedupKey": f["fingerprint"], "owner": f["owner_name"], "dueDate": iso(f["due_date"]), "createdAt": iso(f["created_at"]),
            "updatedAt": iso(f["updated_at"]), "scanId": f["scan_code"], "reverified": f["reverified"], "source": f["source"], "ai": f["ai"],
            "evidence": [{"docId": doc_code.get(e["document_id"], ""), "version": ver.get(e["version_id"], ""), "sectionId": str(e["span_id"]) if e["span_id"] else "",
                          "sectionRef": e["section_ref"], "page": e["page"], "quote": e["quote"], "highlight": e["highlight"], "verified": e["verified"],
                          "baseline": e["baseline"]} for e in evidence if e["finding_id"] == f["id"]],
            "notes": [{"id": str(c["id"]), "at": iso(c["created_at"]), "by": c["author"], "text": c["body"]} for c in comments if c["finding_id"] == f["id"]],
            "revision": {"docId": doc_code.get(r["document_id"], ""), "sectionId": str(r["span_id"]) if r["span_id"] else "", "current": r["current_text"],
                         "proposed": r["proposed_text"], "by": r["proposed_by"], "at": iso(r["proposed_at"]), "decidedBy": r["decided_by"],
                         "decidedAt": iso(r["decided_at"]), "newVersion": r["new_version"], "decision": r["decision"]} if r else None,
        })
    scans = [{"id": s["code"], "name": s["name"], "docIds": [doc_code.get(d, "") for d in s["doc_ids"]], "startedAt": iso(s["started_at"]),
              "finishedAt": iso(s["finished_at"]), "stage": s["stage"], "by": s["started_by"], "counts": s["counts"], "newFindings": s["new_findings"],
              "reverify": s["reverify"], "useAi": s["use_ai"], "model": s["model"], "error": s["error"]}
             for s in rows(conn, "SELECT * FROM scan_jobs ORDER BY started_at DESC")]
    members = [{"id": str(m["user_id"] or m["id"]), "name": m["name"], "email": m["email"], "role": m["role"], "department": m["department"],
                "invited": m["user_id"] is None} for m in rows(conn, "SELECT * FROM memberships ORDER BY created_at")]
    return {
        "version": 1, "createdAt": iso(o["created_at"]), "sample": o["is_demo"], "settings": o["settings"], "members": members,
        "docs": [{k: v for k, v in d.items() if k != "uuid"} | {"versions": [{k: v for k, v in x.items() if k != "uuid"} for x in d["versions"]]} for d in docs],
        "rules": [{k: v for k, v in r.items() if k != "uuid"} for r in rules],
        "findings": fout, "scans": scans,
        "audit": [{"id": str(a["id"]), "at": iso(a["created_at"]), "actor": a["actor"], "action": a["action"], "target": a["target"], "detail": a["detail"], "href": a["href"]}
                  for a in rows(conn, "SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 500")],
        "notices": [{"id": str(n["id"]), "at": iso(n["created_at"]), "text": n["body"], "href": n["href"], "read": n["read"]}
                    for n in rows(conn, "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 60")],
        "baselines": baselines(conn),
        "seq": o["seq"],
    }


# ---------- documents ----------

def rebuild_rules(conn, org, doc_uuid) -> int:
    """Re-extract rules for every version of one document (historical flags follow the current version)."""
    conn.execute(text("DELETE FROM extracted_rules WHERE document_id = :d"), {"d": doc_uuid})
    doc = next(d for d in load_docs(conn, org) if d["uuid"] == doc_uuid)
    n = 0
    for i, v in enumerate(doc["versions"]):
        for r in engine.extract_rules(doc, i):
            code = next_code(conn, org, "rule", "R", 4)
            conn.execute(text("""INSERT INTO extracted_rules (organization_id, code, document_id, version_id, span_id, historical, quote, lang, topic, subject,
                 event, actor, action, modality, value, unit, value_text, unit_class, norm, period, conditions, scope)
                 VALUES (:o,:code,:d,:v,:s,:h,:q,:lang,:topic,:subject,:event,:actor,:action,:mod,:value,:unit,:vt,:uc,:norm,:period,CAST(:cond AS jsonb),:scope)"""),
                         {"o": org, "code": code, "d": doc_uuid, "v": v["uuid"], "s": UUID(r["sectionId"]), "h": r["historical"], "q": r["quote"], "lang": r["lang"],
                          "topic": r["topic"], "subject": r["subject"], "event": r["event"], "actor": r["actor"], "action": r["action"], "mod": r["modality"],
                          "value": r.get("value"), "unit": r.get("unit"), "vt": r.get("valueText"), "uc": r.get("unitClass"), "norm": r.get("norm"),
                          "period": r.get("period"), "cond": json.dumps(r["conditions"]), "scope": r["scope"]})
            n += 1
    return n


def add_version(conn, org, doc_uuid, version: str, sections: list[dict], checksum: str, size: int, by: str, note: str,
                effective: str | None, pages: int, storage_key: str | None, status: str = "ready"):
    v = one(conn, """INSERT INTO document_versions (organization_id, document_id, version, checksum, size, storage_key, note, effective_date, pages, status, uploaded_by)
                     VALUES (:o,:d,:v,:c,:s,:k,:n,:e,:p,:st,:b) RETURNING id""",
            o=org, d=doc_uuid, v=version, c=checksum, s=size, k=storage_key, n=note, e=effective or None, p=pages, st=status, b=by)
    for i, s in enumerate(sections):
        conn.execute(text("INSERT INTO source_spans (organization_id, version_id, ordinal, ref, heading, page, text) VALUES (:o,:v,:i,:r,:h,:p,:t)"),
                     {"o": org, "v": v["id"], "i": i, "r": s["ref"], "h": s["heading"], "p": s["page"], "t": s["text"]})
    conn.execute(text("UPDATE documents SET current_version_id = :v WHERE id = :d"), {"v": v["id"], "d": doc_uuid})
    return v["id"]


def bump(v: str) -> str:
    parts = [int(p) if p.isdigit() else 0 for p in v.split(".")]
    if len(parts) == 1:
        parts.append(0)
    parts[-1] += 1
    return ".".join(map(str, parts))


def doc_uuid(conn, code: str):
    row = one(conn, "SELECT id FROM documents WHERE code = :c", c=code)
    if not row:
        raise Invalid(f"No document {code}.")
    return row["id"]


def finding_row(conn, code: str):
    row = one(conn, "SELECT * FROM findings WHERE code = :c FOR UPDATE", c=code)
    if not row:
        raise Invalid(f"No finding {code}.")
    return row


# ---------- findings: state machine ----------

ALLOWED = {
    "detected": {"under_review", "dismissed"},
    "under_review": {"confirmed", "dismissed", "detected"},
    "confirmed": {"dismissed"},
    "assigned": {"dismissed"},
    "revision_proposed": set(),
    "approved": set(),
    "rejected": {"dismissed"},
    "rescanned": {"closed", "detected"},
    "closed": {"detected"},
    "dismissed": {"detected"},
}
VERB = {"under_review": "moved to review", "confirmed": "confirmed", "dismissed": "dismissed", "detected": "reopened", "closed": "verified and closed"}


def set_status(conn, org, me, role, code: str, status: str, note: str | None):
    require(role, "review")
    f = finding_row(conn, code)
    if status not in ALLOWED.get(f["status"], set()):
        raise Invalid(f"A finding that is “{f['status'].replace('_', ' ')}” cannot move to “{status.replace('_', ' ')}”.")
    if status == "dismissed" and not (note or "").strip():
        raise Invalid("Give a reason for dismissing. It is kept in the audit trail.")
    if status == "closed" and f["reverified"] != "resolved" and not (note or "").strip():
        raise Invalid("The last re-scan did not confirm the fix. Re-scan first, or record why you are closing it anyway.")
    conn.execute(text("UPDATE findings SET status = :s, updated_at = now(), reverified = CASE WHEN :s = 'detected' THEN NULL ELSE reverified END WHERE id = :i"),
                 {"s": status, "i": f["id"]})
    if note:
        add_comment(conn, org, me, code, note, log=False)
    audit(conn, org, me.name, VERB.get(status, status), code, f"/findings/{code}", note, me.user_id)


def add_comment(conn, org, me, code, body: str, log: bool = True):
    f = finding_row(conn, code)
    conn.execute(text("INSERT INTO comments (organization_id, finding_id, author, body) VALUES (:o,:f,:a,:b)"), {"o": org, "f": f["id"], "a": me.name, "b": body})
    if log:
        audit(conn, org, me.name, "commented on", code, f"/findings/{code}", body[:120], me.user_id)


def assign(conn, org, me, role, code, owner: str, due: str | None):
    require(role, "review")
    f = finding_row(conn, code)
    if f["status"] not in ("confirmed", "assigned", "rejected"):
        raise Invalid("Confirm the finding before assigning it.")
    conn.execute(text("UPDATE findings SET owner_name = :o, due_date = :d, status = 'assigned', updated_at = now() WHERE id = :i"), {"o": owner, "d": due or None, "i": f["id"]})
    audit(conn, org, me.name, f"assigned {code} to", owner, f"/findings/{code}", f"due {due}" if due else None, me.user_id)
    if org_settings(conn, org).get("notifyAssigned", True):
        notify(conn, org, f"{code} was assigned to {owner}" + (f", due {due}" if due else ""), f"/findings/{code}")


def propose(conn, org, me, role, code, doc_code: str, span_id: str, current: str, proposed: str):
    require(role, "propose")
    f = finding_row(conn, code)
    if f["status"] not in ("assigned", "rejected"):
        raise Invalid("Assign the finding to an owner before proposing a revision.")
    if not proposed.strip() or proposed.strip() == current.strip():
        raise Invalid("Write the replacement wording.")
    d = doc_uuid(conn, doc_code)
    conn.execute(text("""INSERT INTO revision_proposals (organization_id, finding_id, document_id, span_id, current_text, proposed_text, proposed_by, proposed_by_user)
                         VALUES (:o,:f,:d,:s,:c,:p,:b,:u)"""),
                 {"o": org, "f": f["id"], "d": d, "s": UUID(span_id) if span_id else None, "c": current, "p": proposed, "b": me.name, "u": me.user_id})
    conn.execute(text("UPDATE findings SET status = 'revision_proposed', updated_at = now() WHERE id = :i"), {"i": f["id"]})
    audit(conn, org, me.name, "proposed a revision for", code, f"/findings/{code}", proposed[:120], me.user_id)
    notify(conn, org, f"Revision proposed for {code}: waiting for an approver", f"/findings/{code}")


def decide(conn, org, me, role, code, approve: bool, note: str | None):
    require(role, "approve")
    f = finding_row(conn, code)
    r = one(conn, "SELECT * FROM revision_proposals WHERE finding_id = :f AND decision IS NULL ORDER BY proposed_at DESC LIMIT 1", f=f["id"])
    if f["status"] != "revision_proposed" or not r:
        raise Invalid("There is no revision waiting for a decision.")
    if org_settings(conn, org).get("separationOfDuties", True) and r["proposed_by_user"] == me.user_id:
        raise Denied("Separation of duties: someone other than the author must approve this revision.")
    if not approve:
        conn.execute(text("UPDATE revision_proposals SET decision='rejected', decided_by=:b, decided_at=now() WHERE id=:i"), {"b": me.name, "i": r["id"]})
        conn.execute(text("UPDATE findings SET status='rejected', updated_at=now() WHERE id=:i"), {"i": f["id"]})
        if note:
            add_comment(conn, org, me, code, note, log=False)
        audit(conn, org, me.name, "rejected the revision for", code, f"/findings/{code}", note, me.user_id)
        return None
    doc = next(d for d in load_docs(conn, org) if d["uuid"] == r["document_id"])
    cur = doc["versions"][doc["current"]]
    if not any(r["current_text"] in s["text"] for s in cur["sections"]):
        raise Invalid("The clause has changed since the revision was proposed. Propose it again against the current version.")
    version = bump(doc["versions"][-1]["version"])
    sections = [{**s, "text": s["text"].replace(r["current_text"], r["proposed_text"]) if r["current_text"] in s["text"] else s["text"]} for s in cur["sections"]]
    body = "\n".join(s["text"] for s in sections)
    add_version(conn, org, doc["uuid"], version, sections, hashlib.sha256(body.encode()).hexdigest(), cur["size"], me.name,
                f"Revision for {code}", datetime.now(timezone.utc).date().isoformat(), cur.get("pages", 1), None)
    rebuild_rules(conn, org, doc["uuid"])
    conn.execute(text("UPDATE revision_proposals SET decision='approved', decided_by=:b, decided_at=now(), new_version=:v WHERE id=:i"), {"b": me.name, "v": version, "i": r["id"]})
    conn.execute(text("UPDATE findings SET status='approved', updated_at=now() WHERE id=:i"), {"i": f["id"]})
    if note:
        add_comment(conn, org, me, code, note, log=False)
    audit(conn, org, me.name, "approved the revision for", code, f"/findings/{code}", f"{doc['title']} v{version} published", me.user_id)
    notify(conn, org, f"{doc['title']} v{version} published for {code}. Re-scan to verify.", f"/findings/{code}")
    return version


def default_org_rows(conn, org, company: str, demo: bool = False):
    from .seed import default_settings
    s = default_settings(company)
    if not demo:
        s["departments"], s["regions"] = [], []
    conn.execute(text("UPDATE organizations SET settings = CAST(:s AS jsonb) WHERE id = :o"), {"s": json.dumps(s), "o": org})
    for b in DEFAULT_BASELINES:
        conn.execute(text("INSERT INTO policy_baselines (organization_id, key, topic, name, steps, approved) VALUES (:o,:k,:t,:n,CAST(:s AS jsonb),:a)"),
                     {"o": org, "k": b["id"], "t": b["topic"], "n": b["name"], "s": json.dumps(b["steps"]), "a": b["approved"]})
