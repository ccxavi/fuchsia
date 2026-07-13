"""add style_tips table

Revision ID: d5e6f7a8b9c0
Revises: c3d4e5f6a7b8
Create Date: 2026-07-13 10:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd5e6f7a8b9c0'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('style_tips',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('fingerprint', sa.String(length=64), nullable=False),
    sa.Column('tips', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_style_tips_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_style_tips')),
    sa.UniqueConstraint('user_id', name=op.f('uq_style_tips_user_id'))
    )
    op.create_index(op.f('ix_style_tips_user_id'), 'style_tips', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_style_tips_user_id'), table_name='style_tips')
    op.drop_table('style_tips')
