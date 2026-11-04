"""Creates the clearly flagged DEMO organisation from app.seed (engine-produced findings)."""
from __future__ import annotations

import json
from uuid import UUID

from sqlalchemy import text

from .db import system, tenant
from .seed import DEMO_TEAM, demo_counts, demo_docs, sample_findings
from .service import add_version, audit, default_org_rows, one, rebuild_rules

DAY = lambda d, h=10: f"2026-10-{d:02d}T{h:02d}:00:00+00:00"  # noqa: E731


def create_demo(user_id: UUID, name: str, email: str) -> UUID:
    with system() as conn:
        org = one(conn, "INSERT INTO organizations (name, is_demo, created_at) VALUES ('Harbour & Co. Retail', true, :t) RETURNING id", t=DAY(1))["id"]
        conn.execute(text("INSERT INTO memberships (organization_id, user_id, name, email, role, department) VALUES (:o,:u,:n,:e,'owner','Operations')"),
                     {"o": org, "u": user_id, "n": name, "e": email})
        for n, e, r, d in DEMO_TEAM:
            conn.execute(text("INSERT INTO memberships (organization_id, name, email, role, department) VALUES (:o,:n,:e,:r,:d)"), {"o": org, "n": n, "e": e, "r": r, "d": d})
    with tenant(org, user_id) as conn:
        default_org_rows(conn, org, "Harbour & Co. Retail", demo=True)
        span_ids: dict[str, str] = {}
        for d in demo_docs():
            doc = one(conn, """INSERT INTO documents (organization_id, code, title, file_name, kind, owner_name, department, authority, approval, language, scope, created_at)
                               VALUES (:o,:c,:t,:f,:k,:ow,:de,:a,'approved',:l,'All regions',:ca) RETURNING id""",
                      o=org, c=d["code"], t=d["title"], f=d["fileName"], k=d["kind"], ow=d["owner"], de=d["department"], a=d["authority"], l=d["language"],
                      ca=d["versions"][0]["uploadedAt"])["id"]
            for v in d["versions"]:
                vid = add_version(conn, org, doc, v["version"], v["sections"], v["checksum"], v["size"], v["uploadedBy"], v["note"], v["effectiveDate"], 1, None)
                conn.execute(text("UPDATE document_versions SET uploaded_at = :t WHERE id = :v"), {"t": v["uploadedAt"], "v": vid})
                for s in v["sections"]:
                    span_ids[s["id"]] = str(one(conn, "SELECT id FROM source_spans WHERE version_id = :v AND ref = :r", v=vid, r=s["ref"])["id"])
            rebuild_rules(conn, org, doc)
        conn.execute(text("UPDATE organizations SET seq = jsonb_set(seq, '{doc}', CAST(:n AS jsonb)) WHERE id = :o"), {"o": org, "n": str(len(demo_docs()) + 1)})
        docs = {r["code"]: r for r in conn.execute(text("SELECT id, code FROM documents")).mappings()}
        vers = {(r["document_id"], r["version"]): r["id"] for r in conn.execute(text("SELECT id, document_id, version FROM document_versions")).mappings()}
        notes = {
            "SOP-002": [(14, "Ahmad Faris", "Checking with Finance whether approval happens in the procurement system.")],
            "SOP-004": [(9, "Ahmad Faris", "Confirmed with store ops: the Area Supervisor owns stock escalations."),
                        (28, "Ahmad Faris", "Both inventory documents now name the Area Supervisor. Re-scan came back clean.")],
        }
        updated_on = {"SOP-002": DAY(14), "SOP-004": DAY(28, 15), "SOP-005": DAY(20)}
        findings = sample_findings()
        for f in findings:
            created = DAY(28, 15) if f["scan"] == "SCAN-002" else DAY(6)
            fid = one(conn, """INSERT INTO findings (organization_id, code, type, risk, status, title, explanation, why, authority, recommendation, topic, department,
                               fingerprint, owner_name, scan_code, reverified, created_at, updated_at)
                               VALUES (:o,:c,:t,:r,:s,:ti,:ex,:w,:a,:rec,:to,:de,:fp,:ow,:sc,:rv,:ca,:ua) RETURNING id""",
                      o=org, c=f["id"], t=f["type"], r=f["risk"], s=f["status"], ti=f["title"], ex=f["explanation"], w=f["why"], a=f["authority"],
                      rec=f["recommendation"], to=f["topic"], de=f["department"], fp=f["dedupKey"], ow=f["owner"], sc=f["scan"], rv=f["reverified"], ca=created,
                      ua=updated_on.get(f["id"], created))["id"]
            for i, e in enumerate(f["evidence"]):
                doc = docs.get(e["docId"])
                conn.execute(text("""INSERT INTO finding_evidence (organization_id, finding_id, ordinal, document_id, version_id, span_id, section_ref, page, quote, highlight, verified, baseline)
                                     VALUES (:o,:f,:i,:d,:v,:s,:r,:p,:q,:h,:ve,:b)"""),
                             {"o": org, "f": fid, "i": i, "d": doc["id"] if doc else None, "v": vers.get((doc["id"], e["version"])) if doc else None,
                              "s": span_ids.get(e["sectionId"]), "r": e["sectionRef"], "p": e["page"], "q": e["quote"], "h": e.get("highlight"),
                              "ve": e["verified"], "b": e.get("baseline")})
            for day, by, body in notes.get(f["id"], []):
                conn.execute(text("INSERT INTO comments (organization_id, finding_id, author, body, created_at) VALUES (:o,:f,:a,:b,:t)"),
                             {"o": org, "f": fid, "a": by, "b": body, "t": DAY(day)})
            if f["id"] == "SOP-004":
                conn.execute(text("""INSERT INTO revision_proposals (organization_id, finding_id, document_id, current_text, proposed_text, proposed_by, proposed_at,
                                     decision, decided_by, decided_at, new_version) VALUES (:o,:f,:d,:c,:p,'Ahmad Faris',:pa,'approved','Grace Tan',:da,'1.1')"""),
                             {"o": org, "f": fid, "d": docs["D-009"]["id"], "c": "Stock discrepancies above 5 units must be escalated.",
                              "p": "Stock discrepancies above 5 units must be escalated to the Area Supervisor.", "pa": DAY(22), "da": DAY(24)})
        conn.execute(text("UPDATE organizations SET seq = jsonb_set(jsonb_set(seq, '{finding}', CAST(:n AS jsonb)), '{scan}', '3') WHERE id = :o"),
                     {"o": org, "n": str(len(findings) + 1)})
        all_docs = [r["id"] for r in docs.values()]
        first, latest = demo_counts()
        for code, scan_name, day, by, rev, new, counts in [
            ("SCAN-001", "Initial audit, all documents", 6, name, None, [f["id"] for f in findings if f["scan"] == "SCAN-001"], first),
            ("SCAN-002", "Re-scan after inventory updates", 28, "Ahmad Faris", "SOP-004", ["SOP-006"], latest),
        ]:
            conn.execute(text("""INSERT INTO scan_jobs (organization_id, code, name, doc_ids, stage, counts, new_findings, reverify, started_by, started_at, finished_at)
                                 VALUES (:o,:c,:n,:d,'completed',CAST(:counts AS jsonb),:nf,:r,:b,:t,:t)"""),
                         {"o": org, "c": code, "n": scan_name, "d": all_docs, "counts": json.dumps(counts), "nf": new, "r": rev, "b": by, "t": DAY(day, 9)})
        for day, h, actor, action, target, href, detail in [
            (1, 9, name, "created the workspace", "Harbour & Co. Retail", None, None),
            (6, 9, name, "completed a scan", "SCAN-001", "/scans", f"{len(all_docs)} documents · {sum(f['scan'] == 'SCAN-001' for f in findings)} new findings"),
            (9, 11, "Ahmad Faris", "confirmed", "SOP-004", "/findings/SOP-004", None),
            (14, 10, "Ahmad Faris", "moved to review", "SOP-002", "/findings/SOP-002", None),
            (20, 10, "Marcus Lee", "moved to review", "SOP-005", "/findings/SOP-005", None),
            (24, 10, "Grace Tan", "approved the revision for", "SOP-004", "/findings/SOP-004", "Inventory Control SOP v1.1 published"),
            (28, 15, "Ahmad Faris", "verified and closed", "SOP-004", "/findings/SOP-004", None),
        ]:
            conn.execute(text("INSERT INTO audit_events (organization_id, actor, action, target, href, detail, created_at) VALUES (:o,:a,:ac,:t,:h,:d,:c)"),
                         {"o": org, "a": actor, "ac": action, "t": target, "h": href, "d": detail, "c": DAY(day, h)})
        conn.execute(text("INSERT INTO notifications (organization_id, body, href, created_at) VALUES (:o,:b,:h,:c)"),
                     {"o": org, "b": "New finding SOP-006: refund response time 24 hours vs 48 hours", "h": "/findings/SOP-006", "c": DAY(28, 15)})
        audit(conn, org, name, "opened", "the workspace", None, None, user_id)
    return org
