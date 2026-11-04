"""
Human-facing record codes: a letter prefix and a random, unique six-digit number
(S482913 for a document, D207554 for a scan, F640381 for a finding, R115927 for a
rule). Random numbers say nothing about how many records a workspace holds.

`renumber_org` moves a workspace from the old sequential codes (D-001, SCAN-001,
SOP-001, R-0001) to this form and rewrites every place a code is quoted, except the
audit trail: that is append-only, so the old codes stay in it and `code_aliases`
records what each became. The snapshot shows audit history with the new codes.
"""
from __future__ import annotations

import re
import secrets

from sqlalchemy import text

PREFIX = {"doc": "S", "scan": "D", "finding": "F", "rule": "R"}
TABLE = {"doc": "documents", "scan": "scan_jobs", "finding": "findings", "rule": "extracted_rules"}
CURRENT = {kind: re.compile(rf"^{p}\d{{6}}$") for kind, p in PREFIX.items()}
# old sequential codes, as they appear inside fingerprints, links, notes and history
OLD = re.compile(r"\b(?:SOP|SCAN|D|R)-\d+\b")


def _number() -> str:
    return str(100000 + secrets.randbelow(900000))


def new_code(conn, org, kind: str, taken: set[str] | None = None) -> str:
    """A code no record of this kind in the workspace uses yet."""
    while True:
        code = PREFIX[kind] + _number()
        if taken is not None and code in taken:
            continue
        clash = conn.execute(text(f"SELECT 1 FROM {TABLE[kind]} WHERE organization_id = :o AND code = :c"), {"o": org, "c": code}).first()
        if not clash:
            return code


def rewrite(value: str | None, mapping: dict[str, str]) -> str | None:
    """Swap every old code in a piece of text for its new one; unknown codes stay as they are."""
    if not value:
        return value
    return OLD.sub(lambda m: mapping.get(m.group(0), m.group(0)), value)


def rewrite_fingerprint(fp: str, mapping: dict[str, str]) -> str:
    """Fingerprints list document codes sorted and joined with '+'; keep them sorted after renaming,
    so a later scan of the same conflict still matches the stored finding."""
    parts = []
    for part in fp.split("|"):
        if "+" in part and OLD.search(part):
            parts.append("+".join(sorted(rewrite(p, mapping) or p for p in part.split("+"))))
        else:
            parts.append(rewrite(part, mapping) or part)
    return "|".join(parts)


def renumber_org(conn, org) -> dict[str, str]:
    """Give every record in the workspace still on an old code a new one, then update references."""
    mapping: dict[str, str] = {}
    for kind, table in TABLE.items():
        taken: set[str] = set()
        for r in conn.execute(text(f"SELECT id, code FROM {table} WHERE organization_id = :o"), {"o": org}).mappings().all():
            if CURRENT[kind].match(r["code"]):
                continue
            code = new_code(conn, org, kind, taken)
            taken.add(code)
            mapping[r["code"]] = code
            conn.execute(text(f"UPDATE {table} SET code = :c WHERE id = :i"), {"c": code, "i": r["id"]})
    if not mapping:
        return mapping

    def each(sql: str, cols: list[str], fix=rewrite):
        for r in conn.execute(text(sql), {"o": org}).mappings().all():
            new = {c: fix(r[c], mapping) for c in cols}
            if any(new[c] != r[c] for c in cols):
                sets = ", ".join(f"{c} = :{c}" for c in cols)
                conn.execute(text(f"UPDATE {sql.split(' FROM ')[1].split()[0]} SET {sets} WHERE id = :id"), {**new, "id": r["id"]})

    each("SELECT id, fingerprint FROM findings WHERE organization_id = :o", ["fingerprint"], rewrite_fingerprint)
    each("SELECT id, scan_code, title, explanation, why, authority, recommendation FROM findings WHERE organization_id = :o",
         ["scan_code", "title", "explanation", "why", "authority", "recommendation"])
    each("SELECT id, reverify FROM scan_jobs WHERE organization_id = :o", ["reverify"])
    each("SELECT id, body, href FROM notifications WHERE organization_id = :o", ["body", "href"])
    each("SELECT id, body FROM comments WHERE organization_id = :o", ["body"])
    each("SELECT id, note FROM document_versions WHERE organization_id = :o", ["note"])
    for r in conn.execute(text("SELECT id, new_findings FROM scan_jobs WHERE organization_id = :o"), {"o": org}).mappings().all():
        new = [mapping.get(c, c) for c in r["new_findings"]]
        if new != list(r["new_findings"]):
            conn.execute(text("UPDATE scan_jobs SET new_findings = :n WHERE id = :i"), {"n": new, "i": r["id"]})
    for old, new in mapping.items():
        conn.execute(text("INSERT INTO code_aliases (organization_id, old, new) VALUES (:o, :old, :new) ON CONFLICT DO NOTHING"), {"o": org, "old": old, "new": new})
    return mapping


def aliases(conn) -> dict[str, str]:
    """Old code -> current code for the workspace the connection is scoped to."""
    return {r["old"]: r["new"] for r in conn.execute(text("SELECT old, new FROM code_aliases")).mappings().all()}
