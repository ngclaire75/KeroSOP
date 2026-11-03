from alembic import context
from sqlalchemy import create_engine

from app.config import settings

url = context.get_x_argument(as_dictionary=True).get("url", settings.database_url)
with create_engine(url).connect() as connection:
    context.configure(connection=connection)
    with context.begin_transaction():
        context.run_migrations()
