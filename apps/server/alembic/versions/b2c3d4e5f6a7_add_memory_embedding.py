"""add embedding column to memories

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-08 10:15:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None

# Must match EMBEDDING_DIMENSIONS in app/services/embeddings.py.
EMBEDDING_DIMENSIONS = 768


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
        op.add_column(
            "memories",
            sa.Column("embedding", Vector(EMBEDDING_DIMENSIONS), nullable=True),
        )
    else:
        # SQLite (tests/dev) has no pgvector; store the vector as a JSON list so
        # the schema still builds and round-trips.
        op.add_column("memories", sa.Column("embedding", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("memories", "embedding")
