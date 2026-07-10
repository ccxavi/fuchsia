"""add agent_invocations table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-10 09:30:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('agent_invocations',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('provider', sa.String(length=50), nullable=False),
    sa.Column('model', sa.String(length=100), nullable=False),
    sa.Column('user_message', sa.Text(), nullable=True),
    sa.Column('response_message', sa.Text(), nullable=True),
    sa.Column('prompt_tokens', sa.Integer(), server_default=sa.text('0'), nullable=False),
    sa.Column('completion_tokens', sa.Integer(), server_default=sa.text('0'), nullable=False),
    sa.Column('total_tokens', sa.Integer(), server_default=sa.text('0'), nullable=False),
    sa.Column('llm_call_count', sa.Integer(), server_default=sa.text('0'), nullable=False),
    sa.Column('tool_call_count', sa.Integer(), server_default=sa.text('0'), nullable=False),
    sa.Column('temperature', sa.Float(), nullable=True),
    sa.Column('max_tokens', sa.Integer(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('error_detail', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_agent_invocations_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_agent_invocations'))
    )
    op.create_index(op.f('ix_agent_invocations_user_id'), 'agent_invocations', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_agent_invocations_user_id'), table_name='agent_invocations')
    op.drop_table('agent_invocations')
