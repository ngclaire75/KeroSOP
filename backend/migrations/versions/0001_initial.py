"""Initial schema: tenants, documents, rules, scans, findings, remediation, audit. RLS on every tenant table."""
from alembic import op

revision = "0001_initial"
down_revision = None

TENANT_TABLES = [
    "memberships", "invitations", "documents", "document_versions", "source_spans", "extracted_rules",
    "policy_baselines", "scan_jobs", "findings", "finding_evidence", "comments", "revision_proposals",
    "audit_events", "notifications",
]

SCHEMA = """
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kerosop_app') THEN
    CREATE ROLE kerosop_app LOGIN PASSWORD 'kerosop_app' NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION app_org() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('app.org_id', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION app_user() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text UNIQUE NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  seq jsonb NOT NULL DEFAULT '{"finding": 1, "doc": 1, "scan": 1}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  email text NOT NULL,
  name text NOT NULL,
  company text NOT NULL,
  company_size text NOT NULL,
  job_title text NOT NULL,
  region text NOT NULL,
  languages text[] NOT NULL DEFAULT '{}',
  use_case text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  decided_by uuid REFERENCES users(id),
  decided_at timestamptz,
  decision_note text,
  organization_id uuid REFERENCES organizations(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX access_requests_one_open ON access_requests(user_id) WHERE status = 'pending';

CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','admin','editor','reviewer','approver','viewer')),
  department text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL,
  invited_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  file_name text NOT NULL,
  kind text NOT NULL,
  owner_name text NOT NULL DEFAULT '',
  department text NOT NULL DEFAULT '',
  authority text NOT NULL CHECK (authority IN ('corporate_policy','department_sop','training','template')),
  approval text NOT NULL CHECK (approval IN ('approved','draft','archived')),
  language text NOT NULL,
  scope text NOT NULL DEFAULT 'All regions',
  current_version_id uuid,
  parse_issue text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version text NOT NULL,
  checksum text NOT NULL,
  size integer NOT NULL,
  storage_key text,
  note text NOT NULL DEFAULT '',
  effective_date date,
  pages integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('parsing','needs_ocr','ready','failed')),
  uploaded_by text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);
ALTER TABLE documents ADD CONSTRAINT documents_current_fk FOREIGN KEY (current_version_id) REFERENCES document_versions(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE source_spans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  ordinal integer NOT NULL,
  ref text NOT NULL,
  heading text NOT NULL,
  page integer NOT NULL,
  text text NOT NULL,
  UNIQUE (version_id, ref)
);

CREATE TABLE extracted_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  span_id uuid NOT NULL REFERENCES source_spans(id) ON DELETE CASCADE,
  historical boolean NOT NULL DEFAULT false,
  quote text NOT NULL,
  lang text NOT NULL,
  topic text NOT NULL,
  subject text NOT NULL DEFAULT '',
  event text NOT NULL,
  actor text NOT NULL,
  action text NOT NULL,
  modality text NOT NULL CHECK (modality IN ('must','must_not','may','should')),
  value double precision,
  unit text,
  value_text text,
  unit_class text,
  norm double precision,
  period text,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  scope text NOT NULL,
  extractor text NOT NULL DEFAULT 'rules-1',
  embedding vector(1024)
);
CREATE INDEX extracted_rules_doc ON extracted_rules(document_id);

CREATE TABLE policy_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  topic text NOT NULL,
  name text NOT NULL,
  steps jsonb NOT NULL,
  approved boolean NOT NULL DEFAULT true,
  UNIQUE (organization_id, key)
);

CREATE TABLE scan_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  doc_ids uuid[] NOT NULL,
  stage text NOT NULL DEFAULT 'queued',
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_findings text[] NOT NULL DEFAULT '{}',
  reverify text,
  use_ai boolean NOT NULL DEFAULT false,
  model jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_by text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (organization_id, code)
);

CREATE TABLE findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  type text NOT NULL,
  risk text NOT NULL,
  status text NOT NULL,
  title text NOT NULL,
  explanation text NOT NULL,
  why text NOT NULL,
  authority text NOT NULL,
  recommendation text NOT NULL,
  topic text NOT NULL,
  department text NOT NULL,
  fingerprint text NOT NULL,
  owner_name text,
  due_date date,
  scan_code text NOT NULL,
  reverified text,
  source text NOT NULL DEFAULT 'rules',
  ai jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
CREATE INDEX findings_fingerprint ON findings(organization_id, fingerprint);

CREATE TABLE finding_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  finding_id uuid NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  ordinal integer NOT NULL,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  version_id uuid REFERENCES document_versions(id) ON DELETE SET NULL,
  span_id uuid REFERENCES source_spans(id) ON DELETE SET NULL,
  section_ref text NOT NULL,
  page integer NOT NULL,
  quote text NOT NULL,
  highlight text,
  verified boolean NOT NULL,
  baseline text
);

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  finding_id uuid NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  author text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE revision_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  finding_id uuid NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  span_id uuid REFERENCES source_spans(id) ON DELETE SET NULL,
  current_text text NOT NULL,
  proposed_text text NOT NULL,
  proposed_by text NOT NULL,
  proposed_by_user uuid REFERENCES users(id),
  proposed_at timestamptz NOT NULL DEFAULT now(),
  decision text CHECK (decision IN ('approved','rejected')),
  decided_by text,
  decided_at timestamptz,
  new_version text
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor text NOT NULL,
  actor_user uuid,
  action text NOT NULL,
  target text NOT NULL,
  detail text,
  href text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_org_time ON audit_events(organization_id, created_at DESC);

-- Audit events are append-only.
CREATE OR REPLACE FUNCTION audit_events_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = OLD.organization_id) THEN
    RETURN OLD; -- the whole organisation is being deleted
  END IF;
  RAISE EXCEPTION 'audit_events is append-only';
END $$;
CREATE TRIGGER audit_events_no_update BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION audit_events_immutable();

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  body text NOT NULL,
  href text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
"""

GRANTS = """
GRANT USAGE ON SCHEMA public TO kerosop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kerosop_app;
REVOKE UPDATE, DELETE ON audit_events FROM kerosop_app;
REVOKE ALL ON access_requests FROM kerosop_app;
GRANT SELECT ON users TO kerosop_app;
GRANT SELECT ON organizations TO kerosop_app;
GRANT UPDATE (settings, seq, name) ON organizations TO kerosop_app;
"""


def upgrade():
    op.execute(SCHEMA)
    for t in TENANT_TABLES:
        op.execute(f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY; ALTER TABLE {t} FORCE ROW LEVEL SECURITY;")
        op.execute(f"CREATE POLICY tenant_isolation ON {t} USING (organization_id = app_org()) WITH CHECK (organization_id = app_org());")
    # A user may always read their own memberships (to list the organisations they can open).
    op.execute("CREATE POLICY own_memberships ON memberships FOR SELECT USING (user_id = app_user());")
    op.execute("ALTER TABLE organizations ENABLE ROW LEVEL SECURITY; ALTER TABLE organizations FORCE ROW LEVEL SECURITY;")
    op.execute(
        "CREATE POLICY org_visible ON organizations USING (id = app_org() OR id IN (SELECT organization_id FROM memberships WHERE user_id = app_user()));"
    )
    op.execute(GRANTS)


def downgrade():
    op.execute(
        """DROP TABLE IF EXISTS notifications, audit_events, revision_proposals, comments, finding_evidence, findings,
           scan_jobs, policy_baselines, extracted_rules, source_spans, document_versions, documents, invitations,
           memberships, access_requests, organizations, users CASCADE;
           DROP FUNCTION IF EXISTS audit_events_immutable, app_org, app_user;"""
    )
