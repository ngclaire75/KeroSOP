"""Deleting a workspace keeps the access request it came from, minus the link."""
from alembic import op

revision = "0002_access_request_org_set_null"
down_revision = "0001_initial"


def upgrade():
    op.execute("""ALTER TABLE access_requests DROP CONSTRAINT access_requests_organization_id_fkey,
                  ADD CONSTRAINT access_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL""")


def downgrade():
    op.execute("""ALTER TABLE access_requests DROP CONSTRAINT access_requests_organization_id_fkey,
                  ADD CONSTRAINT access_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id)""")
