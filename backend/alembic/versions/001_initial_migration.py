"""Initial migration: runs and run_details tables

Revision ID: 001_initial
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create runs table
    op.create_table(
        'runs',
        sa.Column('run_id', sa.String(), nullable=False),
        sa.Column('plugin_name', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='running'),
        sa.Column('config', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('accuracy', sa.Float(), nullable=True),
        sa.Column('coverage', sa.Float(), nullable=True),
        sa.Column('error_rate', sa.Float(), nullable=True),
        sa.Column('confusion_matrix', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint('run_id')
    )
    
    # Create run_details table
    op.create_table(
        'run_details',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('run_id', sa.String(), nullable=False),
        sa.Column('case_id', sa.String(), nullable=False),
        sa.Column('case_data', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('truth', sa.String(), nullable=True),
        sa.Column('pred_value', sa.String(), nullable=True),
        sa.Column('pred_ok', sa.Boolean(), nullable=False),
        sa.Column('pred_status', sa.String(), nullable=False),
        sa.Column('pred_raw', sa.Text(), nullable=True),
        sa.Column('pred_meta', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('match', sa.Boolean(), nullable=False),
        sa.Column('mismatch_reason', sa.Text(), nullable=True),
        sa.Column('compare_detail', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('tag', sa.String(), nullable=True),
        sa.Column('reviewed', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['run_id'], ['runs.run_id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_run_details_run_id'), 'run_details', ['run_id'], unique=False)
    op.create_index(op.f('ix_run_details_case_id'), 'run_details', ['case_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_run_details_case_id'), table_name='run_details')
    op.drop_index(op.f('ix_run_details_run_id'), table_name='run_details')
    op.drop_table('run_details')
    op.drop_table('runs')
