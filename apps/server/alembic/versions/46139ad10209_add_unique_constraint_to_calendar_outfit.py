"""add_unique_constraint_to_calendar_outfit

Revision ID: 46139ad10209
Revises: 6885634e8098
Create Date: 2026-07-08 11:44:25.729846
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '46139ad10209'
down_revision = '6885634e8098'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('calendar_outfits') as batch_op:
        batch_op.create_unique_constraint('uq_calendar_outfit_date', ['outfit_id', 'date'])


def downgrade() -> None:
    with op.batch_alter_table('calendar_outfits') as batch_op:
        batch_op.drop_constraint('uq_calendar_outfit_date', type_='unique')
