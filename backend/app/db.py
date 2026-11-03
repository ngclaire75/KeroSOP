"""
Database access. Every request runs in one transaction on the application
role, with the caller's organisation and user set as transaction-local
settings that the row-level security policies read. Queries never rely on
application-side filtering alone for tenant isolation.
"""
from contextlib import contextmanager
from typing import Iterator
from uuid import UUID

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection

from .config import settings

owner_engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
app_engine = create_engine(settings.app_database_url, pool_pre_ping=True, future=True)


@contextmanager
def tenant(org_id: UUID | None, user_id: UUID | None) -> Iterator[Connection]:
    """A transaction scoped to one organisation (RLS) and user."""
    with app_engine.begin() as conn:
        conn.execute(text("SELECT set_config('app.org_id', :o, true), set_config('app.user_id', :u, true)"),
                     {"o": str(org_id) if org_id else "", "u": str(user_id) if user_id else ""})
        yield conn


@contextmanager
def system() -> Iterator[Connection]:
    """Owner transaction for identity bookkeeping and admin decisions only."""
    with owner_engine.begin() as conn:
        yield conn
