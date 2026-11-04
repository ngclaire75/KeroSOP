"""
Scan jobs, run in a background thread with every stage persisted:
queued → parsing → extracting → matching → validating → completed
(or partially_completed when some model calls failed, or failed).

1. parsing     documents with parse issues are excluded as insufficient evidence
2. extracting  rules exist per version; embeddings are added when AI review is on
3. matching    deterministic engine (scope, event, units, thresholds, exceptions)
4. validating  Qwen3 classifies pairs the rules could not decide (no comparable
               numbers, or semantically close clauses across languages); every
               quote is re-verified against the stored span before a finding exists
5. findings are merged by fingerprint: a repeat updates nothing, a dismissed one
   stays suppressed, a closed one that reappears is opened again as new.
"""
from __future__ import annotations

import json
import threading
import traceback
from uuid import UUID

from sqlalchemy import text

from . import engine, llm
from .config import settings
from .db import tenant
from .service import audit, load_docs, load_rules, baselines, next_code, notify, one, org_settings, rows

AI_TYPE = {
    "direct_conflict": "contradiction", "deadline_mismatch": "contradiction", "threshold_mismatch": "contradiction",
    "permission_prohibition_conflict": "prohibition", "actor_ownership_conflict": "responsibility", "ambiguous_requirement": "ambiguity",
    "version_drift": "outdated", "missing_documented_step": "missing_step",
}
AI_LABEL = {
    "direct_conflict": "Possible direct conflict", "deadline_mismatch": "Possible deadline mismatch", "threshold_mismatch": "Possible threshold mismatch",
    "permission_prohibition_conflict": "Possible permission conflict", "actor_ownership_conflict": "Possible ownership conflict",
    "ambiguous_requirement": "Possibly ambiguous requirement", "version_drift": "Possible outdated instruction",
    "missing_documented_step": "Possible missing step",
}


def _stage(org, user, job, stage, **extra):
    with tenant(org, user) as conn:
        sets = ["stage = :s"] + [f"{k} = CAST(:{k} AS jsonb)" if k in ("counts", "model") else f"{k} = :{k}" for k in extra]
        if stage in ("completed", "partially_completed", "failed"):
            sets.append("finished_at = now()")
        params = {"s": stage, "j": job, **{k: json.dumps(v) if k in ("counts", "model") else v for k, v in extra.items()}}
        conn.execute(text(f"UPDATE scan_jobs SET {', '.join(sets)} WHERE id = :j"), params)


def _insert_finding(conn, org, d: dict, scan_code: str, docs: list[dict], source: str = "rules", ai: dict | None = None, note: str | None = None) -> str:
    code = next_code(conn, org, "finding")
    fid = one(conn, """INSERT INTO findings (organization_id, code, type, risk, status, title, explanation, why, authority, recommendation, topic, department,
                       fingerprint, scan_code, source, ai) VALUES (:o,:c,:t,:r,'detected',:ti,:ex,:w,:a,:rec,:to,:de,:fp,:sc,:src,CAST(:ai AS jsonb)) RETURNING id""",
              o=org, c=code, t=d["type"], r=d["risk"], ti=d["title"], ex=d["explanation"], w=d["why"], a=d["authority"], rec=d["recommendation"],
              to=d["topic"], de=d["department"], fp=d["dedupKey"], sc=scan_code, src=source, ai=json.dumps(ai) if ai else None)["id"]
    by_code = {x["id"]: x for x in docs}
    for i, e in enumerate(d["evidence"]):
        doc = by_code.get(e["docId"])
        ver = next((v for v in doc["versions"] if v["version"] == e["version"]), None) if doc else None
        conn.execute(text("""INSERT INTO finding_evidence (organization_id, finding_id, ordinal, document_id, version_id, span_id, section_ref, page, quote, highlight, verified, baseline)
                             VALUES (:o,:f,:i,:d,:v,:s,:r,:p,:q,:h,:ve,:b)"""),
                     {"o": org, "f": fid, "i": i, "d": doc["uuid"] if doc else None, "v": ver["uuid"] if ver else None,
                      "s": UUID(e["sectionId"]) if e.get("sectionId") else None, "r": e["sectionRef"], "p": e["page"], "q": e["quote"],
                      "h": e.get("highlight"), "ve": e["verified"], "b": e.get("baseline")})
    if note:
        conn.execute(text("INSERT INTO comments (organization_id, finding_id, author, body) VALUES (:o,:f,'System',:b)"), {"o": org, "f": fid, "b": note})
    audit(conn, org, "System", "detected", code, f"/findings/{code}", d["title"])
    return code


def _embed_missing(org, user) -> int:
    with tenant(org, user) as conn:
        todo = rows(conn, "SELECT id, quote FROM extracted_rules WHERE embedding IS NULL AND historical = false LIMIT 400")
    done = 0
    for i in range(0, len(todo), 32):
        batch = todo[i:i + 32]
        vecs = llm.embed([r["quote"] for r in batch])
        if not vecs:
            break
        with tenant(org, user) as conn:
            for r, v in zip(batch, vecs):
                conn.execute(text("UPDATE extracted_rules SET embedding = CAST(:v AS vector) WHERE id = :i"), {"v": str(v), "i": r["id"]})
        done += len(batch)
    return done


def _neighbour_pairs(org, user, doc_ids: list[UUID], limit: int) -> list[tuple[str, str]]:
    """Semantically close clauses in different documents that the rules engine did not compare (other topic or no topic)."""
    with tenant(org, user) as conn:
        found = rows(conn, """
            SELECT a.code AS a, b.code AS b, a.embedding <=> b.embedding AS dist
            FROM extracted_rules a JOIN extracted_rules b
              ON a.document_id < b.document_id AND a.code <> b.code
             AND (a.topic = 'general' OR b.topic = 'general' OR a.topic <> b.topic)
            WHERE a.historical = false AND b.historical = false AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
              AND a.document_id = ANY(:ids) AND b.document_id = ANY(:ids)
              AND a.embedding <=> b.embedding < 0.22
            ORDER BY dist LIMIT :lim""", ids=doc_ids, lim=limit)
    return [(r["a"], r["b"]) for r in found]


def run(org: UUID, user: UUID, job: UUID) -> None:
    try:
        with tenant(org, user) as conn:
            j = one(conn, "SELECT * FROM scan_jobs WHERE id = :j", j=job)
            sets = org_settings(conn, org)
            docs = load_docs(conn, org)
        selected = [d for d in docs if d["uuid"] in j["doc_ids"]]
        codes = [d["id"] for d in selected]
        _stage(org, user, job, "parsing")
        _stage(org, user, job, "extracting")
        model = {}
        if j["use_ai"]:
            st = llm.status()
            if st.get("ready"):
                _embed_missing(org, user)
                model = {"reasoning": st["reasoning"], "embedding": st["embedding"], "digest": st["digest"], "prompt": llm.PROMPT_VERSION}
            else:
                model = {"unavailable": st.get("reason", "Model server not ready.")}
        _stage(org, user, job, "matching", model=model)
        with tenant(org, user) as conn:
            rules = load_rules(conn)
            bases = baselines(conn)
        result = engine.detect(docs, rules, sets, bases, codes)
        counts = {**result["counts"], "suppressed": 0, "ai_reviewed": 0, "ai_flagged": 0, "ai_failed": 0, "ai_total": 0}
        _stage(org, user, job, "validating", counts=counts)

        drafts = list(result["drafts"])
        ai_meta: dict[str, dict] = {}
        if model.get("reasoning"):
            by_code = {r["id"]: r for r in rules}
            by_doc = {d["id"]: d for d in docs}
            pairs = [(p["a"], p["b"]) for p in result["pairs"]][: settings.llm_max_pairs]
            if len(pairs) < settings.llm_max_pairs:
                for a, b in _neighbour_pairs(org, user, [d["uuid"] for d in selected], settings.llm_max_pairs - len(pairs)):
                    pairs.append((by_code[a], by_code[b]))
            counts["ai_total"] = len(pairs)
            _stage(org, user, job, "validating", counts=counts)
            for a, b in pairs:
                da, db = by_doc[a["docId"]], by_doc[b["docId"]]
                if da.get("parseIssue") or db.get("parseIssue"):
                    continue
                verdict, err = llm.compare(a, da, b, db)
                counts["ai_reviewed"] += 1
                if err:
                    counts["ai_failed"] += 1
                elif verdict.classification in AI_TYPE and verdict.review_required is not False:
                    type_ = AI_TYPE[verdict.classification]
                    topic = a["topic"] if a["topic"] != "general" else b["topic"]
                    auth = engine._authority(da, db, sets)
                    ev = [engine._evidence(a, by_doc), engine._evidence(b, by_doc)]
                    if all(e["verified"] for e in ev):
                        counts["ai_flagged"] += 1
                        key = f"ai|{type_}|{'+'.join(sorted([a['sectionId'] + a['quote'][:40], b['sectionId'] + b['quote'][:40]]))}"
                        drafts.append({
                            "dedupKey": key, "type": type_, "risk": engine._risk(type_, topic, sets),
                            "title": f"{AI_LABEL[verdict.classification]}: {da['title']} vs {db['title']}",
                            "explanation": verdict.rationale,
                            "why": "Proposed by the AI reviewer from the two quoted clauses. A person must confirm it before anyone acts on it.",
                            "authority": auth["text"],
                            "recommendation": "Read both clauses side by side and confirm or dismiss."
                            + (f" Facts that would settle it: {'; '.join(verdict.missing_information)}." if verdict.missing_information else ""),
                            "evidence": ev, "topic": topic, "department": (auth["other"] if auth["governing"] else db)["department"],
                        })
                        ai_meta[key] = {**model, "classification": verdict.classification, "overlap": verdict.overlap_checks.model_dump(),
                                        "missing": verdict.missing_information, "severityProposed": verdict.candidate_severity}
                if counts["ai_reviewed"] % 3 == 0:
                    _stage(org, user, job, "validating", counts=counts)

        with tenant(org, user) as conn:
            fresh = []
            keys = {d["dedupKey"] for d in drafts}
            for d in drafts:
                same = rows(conn, "SELECT code, status FROM findings WHERE fingerprint = :fp", fp=d["dedupKey"])
                if any(s["status"] == "dismissed" for s in same):
                    counts["suppressed"] += 1
                    continue
                if any(s["status"] != "closed" for s in same):
                    continue
                note = f"Same issue as {same[0]['code']}, which had been closed. It is present again." if same else None
                fresh.append(_insert_finding(conn, org, d, j["code"], docs, "ai" if d["dedupKey"] in ai_meta else "rules", ai_meta.get(d["dedupKey"]), note))
            if j["reverify"]:
                f = one(conn, "SELECT id, fingerprint FROM findings WHERE code = :c", c=j["reverify"])
                if f:
                    state = "still_present" if f["fingerprint"] in keys else "resolved"
                    conn.execute(text("UPDATE findings SET reverified = :r, status = 'rescanned', updated_at = now() WHERE id = :i"), {"r": state, "i": f["id"]})
                    audit(conn, org, j["started_by"], "re-scanned", j["reverify"], f"/findings/{j['reverify']}",
                          "Issue no longer detected" if state == "resolved" else "Issue still present")
                    notify(conn, org, f"{j['reverify']} re-scan: " + ("no longer detected, ready to close" if state == "resolved" else "still present"), f"/findings/{j['reverify']}")
            conn.execute(text("UPDATE scan_jobs SET new_findings = :n WHERE id = :j"), {"n": fresh, "j": job})
            audit(conn, org, j["started_by"], "completed a scan", j["code"], "/scans", f"{len(selected)} documents · {len(fresh)} new finding{'s' if len(fresh) != 1 else ''}")
            if sets.get("notifyScans", True):
                notify(conn, org, f"{j['name']} finished: {len(fresh)} new finding{'s' if len(fresh) != 1 else ''}", f"/findings/{fresh[0]}" if fresh else "/scans")
        _stage(org, user, job, "partially_completed" if counts["ai_failed"] else "completed", counts=counts,
               error=f"{counts['ai_failed']} model call(s) failed; those pairs were left unreviewed." if counts["ai_failed"] else None)
    except Exception as exc:  # the job records the failure instead of disappearing
        traceback.print_exc()
        _stage(org, user, job, "failed", error=f"{type(exc).__name__}: {exc}"[:500])


def start(org: UUID, user: UUID, job: UUID, wait: bool = False) -> None:
    t = threading.Thread(target=run, args=(org, user, job), daemon=True)
    t.start()
    if wait:
        t.join()
