"""drop user currency column

Revision ID: 0007_drop_user_currency
Revises: 0006_user_preferences
Create Date: 2026-06-24 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0007_drop_user_currency"
down_revision = "0006_user_preferences"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("users", "currency")


def downgrade() -> None:
    op.add_column(
        "users", sa.Column("currency", sa.String(length=3), nullable=True)
    )
