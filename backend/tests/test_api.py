"""Acceptance tests from the master specification, through the HTTP API and the database."""
import io

import pytest
from sqlalchemy import text

from app.db import tenant
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
    # sending the form twice does not create a second workspace or a second email
    assert bob.post("/v1/access-requests", req).json()["organization"] == r.json()["organization"]
    assert len(bob.get("/v1/me").json()["orgs"]) == 1 and len(sent) == 1
    assert bob.get("/v1/admin/access-requests").status_code == 404


def test_demo_request_creates_workspace(alice):
    me = alice.get("/v1/me").json()
    assert me["access"] == "approved" and me["orgs"][0]["name"] == "Acme Retail" and me["orgs"][0]["role"] == "owner"
    ws = alice.get("/v1/workspace").json()
    assert ws["sample"] is False and len(ws["baselines"]) == 2


def test_github_import_rejects_non_allowlisted_hosts(alice):
    for url in ["http://raw.githubusercontent.com/x/y/z.md", "https://169.254.169.254/latest/meta-data", "https://evil.example/a.md", "file:///etc/passwd"]:
        assert alice.post("/v1/import/url", {"url": url}).status_code == 422


def test_admin_demo_workspace_is_flagged(admin):
    org = admin.post("/v1/admin/demo").json()["organization"]
    admin.org = org
    ws = admin.get("/v1/workspace").json()
    assert ws["sample"] is True and len(ws["docs"]) == 10
    assert [f["id"] for f in ws["findings"]][:1] and {f["id"] for f in ws["findings"]} == {f"SOP-00{i}" for i in range(1, 7)}
    assert all(e["verified"] for f in ws["findings"] for e in f["evidence"])


def test_owner_can_delete_workspace_created_from_request(alice):
    assert alice.c.delete("/v1/workspace", headers=alice.headers()).status_code == 200
    assert alice.get("/v1/me").json()["orgs"] == []
