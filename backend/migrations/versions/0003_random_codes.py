"""Move every workspace from sequential codes (D-001, SCAN-001, SOP-001, R-0001) to random
six-digit ones (S482913, D207554, F640381, R115927), rewriting every reference to them.
The audit trail is append-only and keeps its old codes; code_aliases maps them to the new ones."""
from alembic import op
from sqlalchemy import text

from app.codes import renumber_org

revision = "0003_random_codes"
down_revision = "0002_access_request_org_set_null"


def upgrade():
    op.execute("""CREATE TABLE code_aliases (
                    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                    old text NOT NULL,
                    new text NOT NULL,
                    PRIMARY KEY (organization_id, old))""")
    op.execute("ALTER TABLE code_aliases ENABLE ROW LEVEL SECURITY; ALTER TABLE code_aliases FORCE ROW LEVEL SECURITY;")
    op.execute("CREATE POLICY tenant_isolation ON code_aliases USING (organization_id = app_org()) WITH CHECK (organization_id = app_org());")
    op.execute("GRANT SELECT, INSERT ON code_aliases TO kerosop_app;")
    conn = op.get_bind()
    for (org,) in conn.execute(text("SELECT id FROM organizations")).all():
        # scope row-level security to this workspace, as the app does, in case the owner does not bypass it
        conn.execute(text("SELECT set_config('app.org_id', :o, true)"), {"o": str(org)})
        renumber_org(conn, org)


def downgrade():
    # The old sequence numbers are not restored; records keep their new codes.
    op.execute("DROP TABLE code_aliases")
