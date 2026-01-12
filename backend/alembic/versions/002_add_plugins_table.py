"""Add plugins table

Revision ID: 002_add_plugins
Revises: 001_initial
Create Date: 2024-01-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_add_plugins'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create plugins table
    op.create_table(
        'plugins',
        sa.Column('plugin_name', sa.String(), nullable=False),
        sa.Column('display_name', sa.String(), nullable=False),
        sa.Column('code', sa.Text(), nullable=False),
        sa.Column('config_schema', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('status', sa.String(), nullable=False, server_default='active'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('last_test_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('plugin_name')
    )


def downgrade() -> None:
    op.drop_table('plugins')
