# KeroSOP API

FastAPI service behind the dashboard: documents, rule extraction, scans (rules engine + Qwen3), findings and their review workflow, demo requests and the audit log. PostgreSQL 17 with pgvector and row-level security; Firebase Authentication as the identity provider.

## Run locally

```sh
brew install postgresql@17 pgvector ollama        # Postgres on port 5433 (see below), Ollama on 11434
createdb -p 5433 kerosop && createdb -p 5433 kerosop_test
ollama pull qwen3:8b && ollama pull qwen3-embedding:0.6b
python3.14 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/alembic upgrade head
.venv/bin/alembic -x url=postgresql+psycopg://localhost:5433/kerosop_test upgrade head
.venv/bin/uvicorn app.main:app --port 8000          # API docs: http://localhost:8000/docs
```

Postgres 17 runs on port 5433 so it sits beside an existing Postgres 16 on 5432: set `port = 5433` in `/opt/homebrew/var/postgresql@17/postgresql.conf`, then `brew services start postgresql@17`.

The web app (`../`) reads `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).

### Demo request emails

Sending the "Book a demo" form opens the company's workspace straight away and emails everyone in `KEROSOP_ADMIN_EMAILS`. Set SMTP to deliver it (without it the email is only logged):

```sh
KEROSOP_SMTP_HOST=smtp.gmail.com
KEROSOP_SMTP_PORT=587
KEROSOP_SMTP_USER=ngclaire75@gmail.com
KEROSOP_SMTP_PASSWORD=<Gmail app password>
KEROSOP_SMTP_FROM="KeroSOP <ngclaire75@gmail.com>"
```

## Tests

```sh
.venv/bin/python -m pytest -q                                 # engine + API acceptance tests
KEROSOP_LLM_ENABLED=1 .venv/bin/python -m pytest tests/test_ai.py   # end-to-end with the real model
.venv/bin/python ml/scripts/validate_dataset.py ml/datasets/kerosop_sop_seed.jsonl
```

See `ml/RESULTS.md` for model evaluation numbers.

## How a scan works

1. **Parse:** PDF (pdfplumber), DOCX (python-docx), TXT/Markdown into numbered sections with page numbers. Pages without text become `needs_ocr`; nothing is guessed.
2. **Extract:** `app/engine.py` turns sentences into typed rules: topic, subject, event, actor, modality, value/unit/period, conditions, scope. Unknowns stay unknown.
3. **Match:** only rules about the same topic, subject and event with overlapping scope and period are compared. Units are normalised; business days are never converted to calendar days.
4. **AI review:** pairs the rules cannot decide, plus semantically close clauses found with Qwen3-Embedding across English and Chinese, go to Qwen3-8B with a JSON schema. The answer must cite the supplied span ids.
5. **Verify:** every quote is matched against the stored span text before a finding exists. Findings are fingerprinted, so a repeat is not duplicated and a dismissed one stays suppressed.

## Security model

- Every tenant table has `organization_id` with **forced** row-level security; the app connects as `kerosop_app` (no `BYPASSRLS`). Tests prove cross-tenant reads and writes fail at the database.
- `audit_events` is append-only (database trigger).
- Roles: owner, admin, editor, reviewer, approver, viewer. Separation of duties: a revision cannot be approved by its author.
- Uploaded text is data: the model has no tools, its output is schema-validated, and it can only propose findings.
- Only allowlisted GitHub hosts can be imported (no requests to internal addresses).

## Status against the master specification

Built and tested: phases 1–2 and most of 3 (secure upload, versions, rule registry, scans with AI review, evidence verification, finding state machine, revisions with approval and re-scan, baselines and missing-step detection, audit log, reports, access requests).

Not built yet:
- OCR (PaddleOCR) and Docling layout extraction
- Google Drive and Microsoft Graph sync, Teams, email delivery, Jira and Linear
- Billing
- SSO/SCIM
- Background workers on Celery (scans run in API threads with persisted stages)
- S3 storage (files are stored on local disk)
- Language toggle for zh-CN and zh-TW
- Fine-tuning
