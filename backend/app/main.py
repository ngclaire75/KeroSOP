"""KeroSOP HTTP API (FastAPI). OpenAPI docs at /docs."""
from __future__ import annotations

import json
import re
from datetime import date
from typing import Literal
from urllib.parse import urlparse
from uuid import UUID

import httpx
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import text

from . import llm, mailer, scans, service
from .auth import Identity, identify
from .config import settings
from .db import system, tenant
from .demo import create_demo
from .parsing import ParseError, parse
from .service import Denied, Invalid, audit, one, rows

app = FastAPI(title="KeroSOP API", version="0.2.0", description="Evidence-first SOP integrity auditing.")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_origin_regex=settings.cors_origin_regex or None, allow_methods=["*"], allow_headers=["*"], allow_credentials=False)


@app.exception_handler(Denied)
def _denied(_: Request, exc: Denied):
    return JSONResponse({"error": str(exc)}, status_code=403)


@app.exception_handler(Invalid)
def _invalid(_: Request, exc: Invalid):
    return JSONResponse({"error": str(exc)}, status_code=422)


@app.exception_handler(HTTPException)
def _http(_: Request, exc: HTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


class Ctx:
    def __init__(self, me: Identity, org: UUID, role: str):
        self.me, self.org, self.role = me, org, role


def workspace(me: Identity = Depends(identify), x_org_id: str = Header(default="")) -> Ctx:
    """The caller's role in the organisation named by X-Org-Id (membership checked, then RLS-scoped)."""
    try:
        org = UUID(x_org_id)
    except ValueError:
        raise HTTPException(400, "Choose a workspace.")
    with system() as conn:
        m = one(conn, "SELECT role FROM memberships WHERE organization_id = :o AND user_id = :u", o=org, u=me.user_id)
    if not m:
        raise HTTPException(403, "You do not have access to this workspace.")
    return Ctx(me, org, m["role"])


def admin_only(me: Identity = Depends(identify)) -> Identity:
    if not me.is_admin:
        raise HTTPException(403, "Only KeroSOP administrators can do this.")
    return me


# ---------- health, identity, access ----------

@app.get("/v1/health")
def health():
    with system() as conn:
        conn.execute(text("SELECT 1"))
    return {"ok": True, "ai": llm.status()}


@app.get("/v1/ai/status")
def ai_status(_: Identity = Depends(identify)):
    return llm.status()


@app.get("/v1/me")
def me_(me: Identity = Depends(identify)):
    with system() as conn:
        # an invitation by email becomes a membership the first time that person signs in
        conn.execute(text("UPDATE memberships SET user_id = :u WHERE user_id IS NULL AND lower(email) = :e"), {"u": me.user_id, "e": me.email})
        orgs = rows(conn, """SELECT o.id, o.name, o.is_demo, m.role FROM memberships m JOIN organizations o ON o.id = m.organization_id
                             WHERE m.user_id = :u ORDER BY o.is_demo, o.created_at""", u=me.user_id)
    return {
        "user": {"id": str(me.user_id), "email": me.email, "name": me.name},
        "isAdmin": me.is_admin,
        "access": "approved" if orgs or me.is_admin else "none",
        "orgs": [{"id": str(o["id"]), "name": o["name"], "isDemo": o["is_demo"], "role": o["role"]} for o in orgs],
    }


class AccessRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    company: str = Field(min_length=1, max_length=160)
    companySize: Literal["1-49", "50-199", "200-999", "1000-4999", "5000+"]
    jobTitle: str = Field(min_length=1, max_length=120)
    region: str = Field(min_length=1, max_length=80)
    languages: list[str] = []
    useCase: str = Field(default="", max_length=2000)


@app.post("/v1/access-requests", status_code=201)
def request_access(body: AccessRequest, tasks: BackgroundTasks, me: Identity = Depends(identify)):
    """A demo request: opens the company's workspace straight away and emails the KeroSOP team. No approval step."""
    with system() as conn:
        existing = one(conn, "SELECT organization_id FROM memberships WHERE user_id = :u AND role = 'owner' LIMIT 1", u=me.user_id)
        if existing:
            return {"ok": True, "organization": str(existing["organization_id"])}
        org = one(conn, "INSERT INTO organizations (name) VALUES (:n) RETURNING id", n=body.company)["id"]
        conn.execute(text("INSERT INTO memberships (organization_id, user_id, name, email, role) VALUES (:o,:u,:n,:e,'owner')"),
                     {"o": org, "u": me.user_id, "n": body.name, "e": me.email})
        conn.execute(text("""INSERT INTO access_requests (user_id, email, name, company, company_size, job_title, region, languages, use_case,
                                                          status, decided_at, organization_id)
                             VALUES (:u,:e,:n,:c,:s,:j,:r,:l,:uc,'approved',now(),:o)"""),
                     {"u": me.user_id, "e": me.email, "n": body.name, "c": body.company, "s": body.companySize, "j": body.jobTitle,
                      "r": body.region, "l": body.languages, "uc": body.useCase, "o": org})
    with tenant(org, me.user_id) as conn:
        service.default_org_rows(conn, org, body.company)
        audit(conn, org, body.name, "created the workspace", body.company, None, "Demo requested", me.user_id)
    tasks.add_task(mailer.demo_request, {**body.model_dump(), "email": me.email})
    return {"ok": True, "organization": str(org)}


@app.post("/v1/admin/demo")
def open_demo(me: Identity = Depends(admin_only)):
    with system() as conn:
        existing = one(conn, """SELECT o.id FROM organizations o JOIN memberships m ON m.organization_id = o.id
                                WHERE o.is_demo AND m.user_id = :u LIMIT 1""", u=me.user_id)
    return {"organization": str(existing["id"] if existing else create_demo(me.user_id, me.name, me.email))}


@app.delete("/v1/workspace")
def delete_workspace(ctx: Ctx = Depends(workspace)):
    """Deletes a whole organisation (owner only). Used to reset the demo."""
    service.require(ctx.role, "admin")
    with system() as conn:
        conn.execute(text("DELETE FROM organizations WHERE id = :o"), {"o": ctx.org})
    return {"ok": True}


# ---------- workspace ----------

@app.get("/v1/workspace")
def get_workspace(ctx: Ctx = Depends(workspace)):
    with tenant(ctx.org, ctx.me.user_id) as conn:
        snap = service.snapshot(conn, ctx.org, ctx.me.user_id)
    snap["me"] = {"id": str(ctx.me.user_id), "name": ctx.me.name, "email": ctx.me.email, "role": ctx.role, "isAdmin": ctx.me.is_admin}
    return snap


def _store(org: UUID, vid: UUID, name: str, data: bytes) -> str:
    folder = settings.storage_dir / str(org)
    folder.mkdir(parents=True, exist_ok=True)
    key = f"{org}/{vid}{'.' + name.rsplit('.', 1)[-1].lower() if '.' in name else ''}"
    (settings.storage_dir / key).write_bytes(data)
    return key


def _ingest(ctx: Ctx, name: str, data: bytes, meta: dict) -> dict:
    service.require(ctx.role, "edit_docs")
    try:
        p = parse(name, data, settings.max_upload_mb)
    except ParseError as exc:
        raise Invalid(str(exc))
    if not p.sections and not p.issue:
        raise Invalid("The file has no readable text.")
    with tenant(ctx.org, ctx.me.user_id) as conn:
        dup = one(conn, "SELECT d.code, v.version FROM document_versions v JOIN documents d ON d.id = v.document_id WHERE v.checksum = :c", c=p.checksum)
        if dup:
            raise Invalid(f"This exact file is already in the library as {dup['code']} v{dup['version']}.")
        status = "needs_ocr" if p.issue and not p.sections else "ready"
        lang = meta.get("language") or service.engine.detect_lang(" ".join(s["text"] for s in p.sections)[:4000])
        if meta.get("versionOf"):
            doc = one(conn, "SELECT id, code, title FROM documents WHERE code = :c", c=meta["versionOf"])
            if not doc:
                raise Invalid("The document to replace was not found.")
            last = one(conn, "SELECT version FROM document_versions WHERE document_id = :d ORDER BY uploaded_at DESC LIMIT 1", d=doc["id"])
            version = service.bump(last["version"])
            conn.execute(text("UPDATE documents SET file_name = :f, parse_issue = :p WHERE id = :d"), {"f": name, "p": p.issue, "d": doc["id"]})
            code, title, doc_id = doc["code"], doc["title"], doc["id"]
            action = "uploaded a new version of"
        else:
            code = service.next_code(conn, ctx.org, "doc", "D")
            title = (meta.get("title") or re.sub(r"\.[^.]+$", "", name)).strip()[:200]
            doc_id = one(conn, """INSERT INTO documents (organization_id, code, title, file_name, kind, owner_name, department, authority, approval, language, scope, parse_issue, created_by)
                                  VALUES (:o,:c,:t,:f,:k,:ow,:de,:a,:ap,:l,:s,:p,:u) RETURNING id""",
                             o=ctx.org, c=code, t=title, f=name, k=p.kind, ow=meta.get("owner", ""), de=meta.get("department", ""),
                             a=meta.get("authority", "department_sop"), ap=meta.get("approval", "draft"), l=lang, s=meta.get("scope") or "All regions",
                             p=p.issue, u=ctx.me.user_id)["id"]
            version = "1.0"
            action = "uploaded"
        vid = service.add_version(conn, ctx.org, doc_id, version, p.sections, p.checksum, p.size, ctx.me.name, meta.get("note", ""),
                                  meta.get("effectiveDate") or None, p.pages, None, status)
        key = _store(ctx.org, vid, name, data)
        conn.execute(text("UPDATE document_versions SET storage_key = :k WHERE id = :v"), {"k": key, "v": vid})
        n = service.rebuild_rules(conn, ctx.org, doc_id)
        audit(conn, ctx.org, ctx.me.name, action, f"{title} v{version}", f"/documents?doc={code}", f"{len(p.sections)} sections · {n} rules" + (f" · {p.issue}" if p.issue else ""), ctx.me.user_id)
    return {"id": code, "version": version, "sections": len(p.sections), "issue": p.issue}


@app.post("/v1/documents", status_code=201)
async def upload(file: UploadFile = File(...), meta: str = Form("{}"), ctx: Ctx = Depends(workspace)):
    data = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    return _ingest(ctx, file.filename or "upload", data, json.loads(meta))


ALLOWED_IMPORT_HOSTS = {"raw.githubusercontent.com", "gist.githubusercontent.com", "github.com"}


class ImportUrl(BaseModel):
    url: str
    meta: dict = {}


@app.post("/v1/import/url", status_code=201)
def import_url(body: ImportUrl, ctx: Ctx = Depends(workspace)):
    """Imports a public Markdown/TXT/PDF/DOCX file from GitHub. Only allowlisted hosts (no SSRF to internal addresses)."""
    u = urlparse(body.url.strip())
    if u.scheme != "https" or u.hostname not in ALLOWED_IMPORT_HOSTS:
        raise Invalid("Paste a public https://github.com or raw.githubusercontent.com file link.")
    url = body.url.strip()
    m = re.match(r"https://github\.com/([^/]+)/([^/]+)/blob/(.+)", url)
    if m:
        url = f"https://raw.githubusercontent.com/{m.group(1)}/{m.group(2)}/{m.group(3)}"
    name = url.rsplit("/", 1)[-1].split("?")[0] or "import.md"
    try:
        r = httpx.get(url, timeout=15, follow_redirects=False)
    except httpx.HTTPError:
        raise Invalid("Could not reach that address.")
    if r.status_code != 200:
        raise Invalid(f"GitHub answered {r.status_code}. Is the file public?")
    if len(r.content) > settings.max_upload_mb * 1024 * 1024:
        raise Invalid("File too large.")
    out = _ingest(ctx, name, r.content, {"approval": "draft", **body.meta, "note": f"Imported from {url}"})
    return out


class DocPatch(BaseModel):
    title: str | None = None
    owner: str | None = None
    department: str | None = None
    authority: Literal["corporate_policy", "department_sop", "training", "template"] | None = None
    approval: Literal["approved", "draft", "archived"] | None = None
    language: str | None = None
    scope: str | None = None


@app.patch("/v1/documents/{code}")
def patch_doc(code: str, body: DocPatch, ctx: Ctx = Depends(workspace)):
    service.require(ctx.role, "edit_docs")
    cols = {"title": "title", "owner": "owner_name", "department": "department", "authority": "authority", "approval": "approval", "language": "language", "scope": "scope"}
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        return {"ok": True}
    with tenant(ctx.org, ctx.me.user_id) as conn:
        d = one(conn, "SELECT id, title, approval FROM documents WHERE code = :c", c=code)
        if not d:
            raise Invalid("Document not found.")
        conn.execute(text(f"UPDATE documents SET {', '.join(f'{cols[k]} = :{k}' for k in patch)} WHERE id = :id"), {**patch, "id": d["id"]})
        service.rebuild_rules(conn, ctx.org, d["id"])
        changed = patch.get("approval") and patch["approval"] != d["approval"]
        audit(conn, ctx.org, ctx.me.name, ("archived" if patch["approval"] == "archived" else f"marked {patch['approval']}") if changed else "edited details of",
              d["title"], f"/documents?doc={code}", ", ".join(patch), ctx.me.user_id)
    return {"ok": True}


@app.delete("/v1/documents/{code}")
def delete_doc(code: str, ctx: Ctx = Depends(workspace)):
    service.require(ctx.role, "admin")
    with tenant(ctx.org, ctx.me.user_id) as conn:
        d = one(conn, "SELECT id, title FROM documents WHERE code = :c", c=code)
        if not d:
            raise Invalid("Document not found.")
        if one(conn, "SELECT 1 FROM finding_evidence WHERE document_id = :d LIMIT 1", d=d["id"]):
            raise Invalid("Findings cite this document, so it is kept for the audit trail. Archive it instead.")
        conn.execute(text("DELETE FROM documents WHERE id = :d"), {"d": d["id"]})
        audit(conn, ctx.org, ctx.me.name, "deleted", d["title"], None, None, ctx.me.user_id)
    return {"ok": True}


@app.get("/v1/documents/{code}/versions/{version}/file")
def download(code: str, version: str, ctx: Ctx = Depends(workspace)):
    with tenant(ctx.org, ctx.me.user_id) as conn:
        v = one(conn, """SELECT v.storage_key, d.file_name FROM document_versions v JOIN documents d ON d.id = v.document_id
                         WHERE d.code = :c AND v.version = :v""", c=code, v=version)
    if not v or not v["storage_key"]:
        raise HTTPException(404, "No original file is stored for this version.")
    return FileResponse(settings.storage_dir / v["storage_key"], filename=v["file_name"])


# ---------- scans ----------

class ScanBody(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    docIds: list[str]
    reverify: str | None = None
    useAi: bool = True


@app.post("/v1/scans", status_code=202)
def start_scan(body: ScanBody, ctx: Ctx = Depends(workspace)):
    service.require(ctx.role, "scan")
    with tenant(ctx.org, ctx.me.user_id) as conn:
        ids = [r["id"] for r in rows(conn, "SELECT id FROM documents WHERE code = ANY(:c)", c=body.docIds)]
        if not ids:
            raise Invalid("Choose at least one document.")
        code = service.next_code(conn, ctx.org, "scan", "SCAN")
        job = one(conn, """INSERT INTO scan_jobs (organization_id, code, name, doc_ids, reverify, use_ai, started_by, counts)
                           VALUES (:o,:c,:n,:d,:r,:ai,:b,'{}'::jsonb) RETURNING id""",
                  o=ctx.org, c=code, n=body.name, d=ids, r=body.reverify, ai=body.useAi and settings.llm_enabled, b=ctx.me.name)["id"]
        audit(conn, ctx.org, ctx.me.name, "started a re-scan for" if body.reverify else "started a scan", body.reverify or code, "/scans", None, ctx.me.user_id)
    scans.start(ctx.org, ctx.me.user_id, job)
    return {"id": code}


# ---------- findings ----------

class StatusBody(BaseModel):
    status: Literal["detected", "under_review", "confirmed", "dismissed", "closed"]
    note: str | None = None


@app.post("/v1/findings/{code}/status")
def finding_status(code: str, body: StatusBody, ctx: Ctx = Depends(workspace)):
    with tenant(ctx.org, ctx.me.user_id) as conn:
        service.set_status(conn, ctx.org, ctx.me, ctx.role, code, body.status, body.note)
    return {"ok": True}


class AssignBody(BaseModel):
    owner: str = Field(min_length=1)
    dueDate: date | None = None


@app.post("/v1/findings/{code}/assign")
def finding_assign(code: str, body: AssignBody, ctx: Ctx = Depends(workspace)):
    with tenant(ctx.org, ctx.me.user_id) as conn:
        service.assign(conn, ctx.org, ctx.me, ctx.role, code, body.owner, body.dueDate.isoformat() if body.dueDate else None)
    return {"ok": True}


class CommentBody(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


@app.post("/v1/findings/{code}/comments")
def finding_comment(code: str, body: CommentBody, ctx: Ctx = Depends(workspace)):
    if ctx.role == "viewer":
        raise Denied("Viewers cannot comment.")
    with tenant(ctx.org, ctx.me.user_id) as conn:
        service.add_comment(conn, ctx.org, ctx.me, code, body.text)
    return {"ok": True}


class ProposeBody(BaseModel):
    docId: str
    sectionId: str
    current: str = Field(min_length=1)
    proposed: str = Field(min_length=1, max_length=8000)


@app.post("/v1/findings/{code}/revisions")
def finding_propose(code: str, body: ProposeBody, ctx: Ctx = Depends(workspace)):
    with tenant(ctx.org, ctx.me.user_id) as conn:
        service.propose(conn, ctx.org, ctx.me, ctx.role, code, body.docId, body.sectionId, body.current, body.proposed)
    return {"ok": True}


class DecideBody(BaseModel):
    approve: bool
    note: str | None = None


@app.post("/v1/findings/{code}/revisions/decide")
def finding_decide(code: str, body: DecideBody, ctx: Ctx = Depends(workspace)):
    with tenant(ctx.org, ctx.me.user_id) as conn:
        version = service.decide(conn, ctx.org, ctx.me, ctx.role, code, body.approve, body.note)
    return {"ok": True, "version": version}


@app.post("/v1/findings/{code}/reverify", status_code=202)
def finding_reverify(code: str, ctx: Ctx = Depends(workspace)):
    with tenant(ctx.org, ctx.me.user_id) as conn:
        f = one(conn, "SELECT status FROM findings WHERE code = :c", c=code)
        if not f or f["status"] not in ("approved", "rejected", "assigned", "confirmed", "rescanned"):
            raise Invalid("Re-scan after a revision has been approved.")
        docs = [r["code"] for r in rows(conn, "SELECT code FROM documents WHERE approval <> 'archived'")]
    return start_scan(ScanBody(name=f"Re-scan for {code}", docIds=docs, reverify=code, useAi=False), ctx)


# ---------- settings, members, notifications ----------

@app.patch("/v1/settings")
def patch_settings(body: dict, ctx: Ctx = Depends(workspace)):
    service.require(ctx.role, "admin")
    allowed = {"company", "departments", "languages", "regions", "hierarchy", "topicRisk", "retentionDays", "notifyEmail", "notifyAssigned",
               "notifyScans", "webhook", "separationOfDuties"}
    patch = {k: v for k, v in body.items() if k in allowed}
    if "webhook" in patch and patch["webhook"] and not str(patch["webhook"]).startswith("https://"):
        raise Invalid("Webhook addresses must start with https://")
    with tenant(ctx.org, ctx.me.user_id) as conn:
        conn.execute(text("UPDATE organizations SET settings = settings || CAST(:p AS jsonb) WHERE id = :o"), {"p": json.dumps(patch), "o": ctx.org})
        if "company" in patch:
            conn.execute(text("UPDATE organizations SET name = :n WHERE id = :o"), {"n": patch["company"], "o": ctx.org})
        audit(conn, ctx.org, ctx.me.name, "updated settings", ", ".join(patch) or "—", "/settings", None, ctx.me.user_id)
    return {"ok": True}


@app.put("/v1/baselines")
def put_baselines(body: list[dict], ctx: Ctx = Depends(workspace)):
    service.require(ctx.role, "admin")
    with tenant(ctx.org, ctx.me.user_id) as conn:
        conn.execute(text("DELETE FROM policy_baselines"))
        for b in body:
            conn.execute(text("INSERT INTO policy_baselines (organization_id, key, topic, name, steps, approved) VALUES (:o,:k,:t,:n,CAST(:s AS jsonb),:a)"),
                         {"o": ctx.org, "k": b["id"], "t": b["topic"], "n": b["name"], "s": json.dumps(b["steps"]), "a": b.get("approved", True)})
        audit(conn, ctx.org, ctx.me.name, "updated policy baselines", f"{len(body)} baselines", "/settings", None, ctx.me.user_id)
    return {"ok": True}


class Invite(BaseModel):
    name: str = Field(min_length=1)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    role: Literal["admin", "editor", "reviewer", "approver", "viewer"]
    department: str = ""


@app.post("/v1/members", status_code=201)
def invite(body: Invite, ctx: Ctx = Depends(workspace)):
    service.require(ctx.role, "admin")
    with tenant(ctx.org, ctx.me.user_id) as conn:
        if one(conn, "SELECT 1 FROM memberships WHERE lower(email) = lower(:e)", e=body.email):
            raise Invalid("That person is already a member.")
        conn.execute(text("INSERT INTO memberships (organization_id, name, email, role, department) VALUES (:o,:n,:e,:r,:d)"),
                     {"o": ctx.org, "n": body.name, "e": body.email.lower(), "r": body.role, "d": body.department})
        audit(conn, ctx.org, ctx.me.name, "gave access to", body.email, "/settings", body.role, ctx.me.user_id)
    return {"ok": True}


class RoleBody(BaseModel):
    role: Literal["owner", "admin", "editor", "reviewer", "approver", "viewer"]


@app.patch("/v1/members/{mid}")
def set_role(mid: str, body: RoleBody, ctx: Ctx = Depends(workspace)):
    service.require(ctx.role, "admin")
    with tenant(ctx.org, ctx.me.user_id) as conn:
        m = one(conn, "SELECT id, name FROM memberships WHERE id::text = :i OR user_id::text = :i", i=mid)
        if not m:
            raise Invalid("Member not found.")
        conn.execute(text("UPDATE memberships SET role = :r WHERE id = :i"), {"r": body.role, "i": m["id"]})
        audit(conn, ctx.org, ctx.me.name, "changed the role of", m["name"], "/settings", body.role, ctx.me.user_id)
    return {"ok": True}


@app.delete("/v1/members/{mid}")
def remove_member(mid: str, ctx: Ctx = Depends(workspace)):
    service.require(ctx.role, "admin")
    with tenant(ctx.org, ctx.me.user_id) as conn:
        m = one(conn, "SELECT id, name, user_id FROM memberships WHERE id::text = :i OR user_id::text = :i", i=mid)
        if not m or m["user_id"] == ctx.me.user_id:
            raise Invalid("You cannot remove yourself.")
        conn.execute(text("DELETE FROM memberships WHERE id = :i"), {"i": m["id"]})
        audit(conn, ctx.org, ctx.me.name, "removed", m["name"], "/settings", None, ctx.me.user_id)
    return {"ok": True}


class ReadBody(BaseModel):
    id: str | None = None


@app.post("/v1/notifications/read")
def mark_read(body: ReadBody, ctx: Ctx = Depends(workspace)):
    with tenant(ctx.org, ctx.me.user_id) as conn:
        if body.id:
            conn.execute(text("UPDATE notifications SET read = true WHERE id::text = :i"), {"i": body.id})
        else:
            conn.execute(text("UPDATE notifications SET read = true"))
    return {"ok": True}


class ExportBody(BaseModel):
    kind: str = Field(max_length=120)


@app.post("/v1/audit/exports")
def log_export(body: ExportBody, ctx: Ctx = Depends(workspace)):
    with tenant(ctx.org, ctx.me.user_id) as conn:
        audit(conn, ctx.org, ctx.me.name, "exported", body.kind, "/reports", None, ctx.me.user_id)
    return {"ok": True}
