"""
API tests run against the kerosop_test database with signed test tokens
("test:<uid>:<email>", accepted only when KEROSOP_ALLOW_TEST_TOKENS=1).
"""
import os
import tempfile

os.environ.setdefault("KEROSOP_DATABASE_URL", "postgresql+psycopg://localhost:5433/kerosop_test")
os.environ.setdefault("KEROSOP_APP_DATABASE_URL", "postgresql+psycopg://kerosop_app:kerosop_app@localhost:5433/kerosop_test")
os.environ["KEROSOP_ALLOW_TEST_TOKENS"] = "1"
os.environ.setdefault("KEROSOP_LLM_ENABLED", "0")
# only administrators reach the dashboard, so the workspace tests sign in as one
os.environ["KEROSOP_ADMIN_EMAILS"] = "admin@example.com,alice@acme.example"
os.environ["KEROSOP_STORAGE_DIR"] = tempfile.mkdtemp(prefix="kerosop-test-")

import time  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db import system  # noqa: E402
from app.main import app  # noqa: E402

TABLES = "notifications, audit_events, revision_proposals, comments, finding_evidence, findings, scan_jobs, policy_baselines, extracted_rules, source_spans, document_versions, documents, invitations, memberships, access_requests, organizations, users"


@pytest.fixture(autouse=True)
def clean_db():
    with system() as conn:
        conn.execute(text(f"TRUNCATE {TABLES} CASCADE"))
    yield


@pytest.fixture
def client():
    return TestClient(app)


class User:
    def __init__(self, client, uid, email):
        self.c, self.h, self.org = client, {"Authorization": f"Bearer test:{uid}:{email}"}, None

    def headers(self):
        return {**self.h, **({"X-Org-Id": self.org} if self.org else {})}

    def get(self, path, **kw):
        return self.c.get(path, headers=self.headers(), **kw)

    def post(self, path, json=None, **kw):
        return self.c.post(path, json=json, headers=self.headers(), **kw)

    def patch(self, path, json=None):
        return self.c.patch(path, json=json, headers=self.headers())

    def put(self, path, json=None):
        return self.c.put(path, json=json, headers=self.headers())

    def upload(self, name, content: bytes, **meta):
        import json as j
        r = self.c.post("/v1/documents", files={"file": (name, content)}, data={"meta": j.dumps({"approval": "approved", **meta})}, headers=self.headers())
        assert r.status_code == 201, r.text
        return r.json()

    def scan(self, doc_ids=None, use_ai=False, timeout=120):
        ws = self.get("/v1/workspace").json()
        ids = doc_ids or [d["id"] for d in ws["docs"]]
        code = self.post("/v1/scans", {"name": "Test scan", "docIds": ids, "useAi": use_ai}).json()["id"]
        return self.wait(code, timeout)

    def wait(self, code, timeout=120):
        end = time.time() + timeout
        while time.time() < end:
            s = next(s for s in self.get("/v1/workspace").json()["scans"] if s["id"] == code)
            if s["stage"] in ("completed", "partially_completed", "failed"):
                return s
            time.sleep(0.2)
        raise AssertionError("scan did not finish")


@pytest.fixture
def admin(client):
    return User(client, "admin-uid", "admin@example.com")


def approved_user(client, admin, uid, email, company):
    u = User(client, uid, email)
    assert u.post("/v1/access-requests", {"name": uid, "company": company, "companySize": "50-199", "jobTitle": "Ops lead", "region": "Singapore"}).status_code == 201
    u.org = u.get("/v1/me").json()["orgs"][0]["id"]
    return u


@pytest.fixture
def alice(client, admin):
    return approved_user(client, admin, "alice", "alice@acme.example", "Acme Retail")
