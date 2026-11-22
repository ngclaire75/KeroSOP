"""Allow demo requests from visitors without an account."""
from alembic import op

revision = "0004_public_demo_requests"
down_revision = "0003_random_codes"


def upgrade():
    op.execute("ALTER TABLE access_requests ALTER COLUMN user_id DROP NOT NULL")


def downgrade():
    op.execute("ALTER TABLE access_requests ALTER COLUMN user_id SET NOT NULL")
