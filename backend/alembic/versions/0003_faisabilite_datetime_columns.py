"""Faisabilite datetime columns — VARCHAR vers DateTime(timezone=True)

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-28

SQLite ne supporte pas ALTER COLUMN, on utilise batch_alter_table
qui recrée la table avec le bon schéma.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('faisabilite_favorites') as batch_op:
        batch_op.alter_column('added_at',
                              existing_type=sa.String(),
                              type_=sa.DateTime(timezone=True),
                              existing_nullable=True,
                              server_default=sa.func.now())

    with op.batch_alter_table('faisabilite_history') as batch_op:
        batch_op.alter_column('searched_at',
                              existing_type=sa.String(),
                              type_=sa.DateTime(timezone=True),
                              existing_nullable=True,
                              server_default=sa.func.now())

    with op.batch_alter_table('faisabilite_projects') as batch_op:
        batch_op.alter_column('created_at',
                              existing_type=sa.String(),
                              type_=sa.DateTime(timezone=True),
                              existing_nullable=True,
                              server_default=sa.func.now())
        batch_op.alter_column('updated_at',
                              existing_type=sa.String(),
                              type_=sa.DateTime(timezone=True),
                              existing_nullable=True,
                              server_default=sa.func.now())


def downgrade() -> None:
    with op.batch_alter_table('faisabilite_projects') as batch_op:
        batch_op.alter_column('updated_at',
                              existing_type=sa.DateTime(timezone=True),
                              type_=sa.String(),
                              existing_nullable=True,
                              server_default=None)
        batch_op.alter_column('created_at',
                              existing_type=sa.DateTime(timezone=True),
                              type_=sa.String(),
                              existing_nullable=True,
                              server_default=None)

    with op.batch_alter_table('faisabilite_history') as batch_op:
        batch_op.alter_column('searched_at',
                              existing_type=sa.DateTime(timezone=True),
                              type_=sa.String(),
                              existing_nullable=True,
                              server_default=None)

    with op.batch_alter_table('faisabilite_favorites') as batch_op:
        batch_op.alter_column('added_at',
                              existing_type=sa.DateTime(timezone=True),
                              type_=sa.String(),
                              existing_nullable=True,
                              server_default=None)
