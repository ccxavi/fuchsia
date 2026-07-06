"""remove wardrobe quantity column

Revision ID: e5c7811ff083
Revises: d4b660ff9871
Create Date: 2026-07-05 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e5c7811ff083'
down_revision = 'd4b660ff9871'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the quantity column from wardrobes table
    op.drop_column('wardrobes', 'quantity')


def downgrade() -> None:
    # Re-add the quantity column
    op.add_column('wardrobes', sa.Column('quantity', sa.Integer(), nullable=False, server_default='0'))
