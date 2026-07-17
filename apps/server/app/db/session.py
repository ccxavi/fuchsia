from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    return create_engine(
        settings.require_database_url(),
        pool_pre_ping=True,
        poolclass=NullPool,
        # Disable psycopg3 server-side prepared statements. Behind a
        # transaction-mode pooler (Supabase/Supavisor, PgBouncer) a logical
        # connection is multiplexed across rotating backends, so a reused
        # prepared-statement name (e.g. "_pg3_0") collides with one already
        # prepared on another backend, raising DuplicatePreparedStatement and
        # aborting the whole transaction.
        connect_args={"prepare_threshold": None},
    )


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(
        bind=get_engine(),
        autoflush=False,
        expire_on_commit=False,
        class_=Session,
    )


def get_db_session() -> Iterator[Session]:
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()
