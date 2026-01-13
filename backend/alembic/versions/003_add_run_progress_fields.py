"""Add progress fields to runs table

Revision ID: 003_add_run_progress
Revises: 002_add_plugins
Create Date: 2024-01-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003_add_run_progress'
down_revision = '002_add_plugins'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add progress fields to runs table
    op.add_column('runs', sa.Column('total_cases', sa.Integer(), nullable=True))
    op.add_column('runs', sa.Column('processed_cases', sa.Integer(), nullable=True, server_default='0'))


def downgrade() -> None:
    op.drop_column('runs', 'processed_cases')
    op.drop_column('runs', 'total_cases')

