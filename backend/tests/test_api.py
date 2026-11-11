"""Acceptance tests from the master specification, through the HTTP API and the database."""
import io
import re

import pytest
from sqlalchemy import text

from app.db import system, tenant
from conftest import User, approved_user

POLICY = b"# Refund Policy\n## 3.1 Refund window\nCustomers may submit new refund requests within 7 calendar days of delivery.\n"
SOP_ZH = "# 客服操作规程\n## 2.3 受理期限\n客服人员可受理发货后14个自然日内提交的新退款申请。\n".encode()


def finding_types(u):
    return sorted(f["type"] for f in u.get("/v1/workspace").json()["findings"])


# ---------- access ----------

def test_demo_request_opens_workspace_and_emails_admin(client, monkeypatch):
    sent = []
    monkeypatch.setattr("app.mailer.send", lambda to, subject, body, reply_to=None: sent.append((to, subject, reply_to)) or True)
    bob = User(client, "bob", "bob@example.com")
    me = bob.get("/v1/me").json()
    assert me["access"] == "none" and me["orgs"] == []
    req = {"name": "Bob", "company": "Bob Co", "companySize": "1-49", "jobTitle": "Owner", "region": "Malaysia"}
    r = bob.post("/v1/access-requests", req)
    assert r.status_code == 201
    me = bob.get("/v1/me").json()
    assert me["access"] == "approved" and me["orgs"][0]["name"] == "Bob Co" and me["orgs"][0]["role"] == "owner"
    assert sent == [(["admin@example.com"], "Demo request: Bob Co (Bob)", "bob@example.com")]
    # sending the form again books another demo (the team is emailed again) but opens the same workspace
    assert bob.post("/v1/access-requests", req).json()["organization"] == r.json()["organization"]
    assert len(bob.get("/v1/me").json()["orgs"]) == 1 and len(sent) == 2
    assert bob.get("/v1/admin/access-requests").status_code == 404


def test_demo_request_creates_workspace(alice):
    me = alice.get("/v1/me").json()
    assert me["access"] == "approved" and me["orgs"][0]["name"] == "Acme Retail" and me["orgs"][0]["role"] == "owner"
    ws = alice.get("/v1/workspace").json()
    assert ws["sample"] is False and len(ws["baselines"]) == 2


def test_repeat_export_clicks_log_once(alice):
    for _ in range(5):
        assert alice.post("/v1/audit/exports", {"kind": "Audit report (PDF)"}).status_code == 200
    alice.post("/v1/audit/exports", {"kind": "Findings (CSV)"})
    with system() as conn:
        rows = conn.execute(text("SELECT target FROM audit_events WHERE action = 'exported' ORDER BY target")).scalars().all()
    assert rows == ["Audit report (PDF)", "Findings (CSV)"]


def test_github_import_rejects_non_allowlisted_hosts(alice):
    for url in ["http://raw.githubusercontent.com/x/y/z.md", "https://169.254.169.254/latest/meta-data", "https://evil.example/a.md", "file:///etc/passwd"]:
        assert alice.post("/v1/import/url", {"url": url}).status_code == 422


def test_admin_demo_workspace_is_flagged(admin):
    org = admin.post("/v1/admin/demo").json()["organization"]
    admin.org = org
    ws = admin.get("/v1/workspace").json()
    assert ws["sample"] is True and len(ws["docs"]) == 40
    # every record carries a random six-digit code, and the history links follow the renamed records
    assert all(re.fullmatch(r"F\d{6}", f["id"]) for f in ws["findings"]) and len({f["id"] for f in ws["findings"]}) == len(ws["findings"])
    assert all(re.fullmatch(r"S\d{6}", d["id"]) for d in ws["docs"]) and all(re.fullmatch(r"D\d{6}", s["id"]) for s in ws["scans"])
    assert all(re.fullmatch(r"R\d{6}", r["id"]) for r in ws["rules"])
    assert not any(re.search(r"\b(?:SOP|SCAN|D)-\d", f"{a['target']} {a['href'] or ''}") for a in ws["audit"])
    assert all(e["verified"] for f in ws["findings"] for e in f["evidence"])


def test_outdated_demo_is_rebuilt_when_the_admin_signs_in(admin):
    first = admin.post("/v1/admin/demo").json()["organization"]
    with system() as conn:  # pretend the demo was built from older demo data
        conn.execute(text("UPDATE organizations SET settings = settings - 'demoVersion' WHERE id = :o"), {"o": first})
    orgs = admin.get("/v1/me").json()["orgs"]
    demo = next(o for o in orgs if o["isDemo"])
    assert demo["id"] != first and sum(o["isDemo"] for o in orgs) == 1
    admin.org = demo["id"]
    ws = admin.get("/v1/workspace").json()
    assert len(ws["docs"]) == 40 and len(ws["findings"]) == 22
    assert admin.get("/v1/me").json()["orgs"] == orgs  # an up-to-date demo is left alone


def test_owner_can_delete_workspace_created_from_request(alice):
    assert alice.c.delete("/v1/workspace", headers=alice.headers()).status_code == 200
    assert alice.get("/v1/me").json()["orgs"] == []
