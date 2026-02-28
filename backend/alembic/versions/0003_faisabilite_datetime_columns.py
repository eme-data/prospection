"""Faisabilite datetime columns — VARCHAR vers DateTime(timezone=True)

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-28

Supporte PostgreSQL (USING cast) et SQLite (batch_alter_table).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Colonnes à migrer : (table, colonne)
_COLUMNS = [
    ('faisabilite_favorites', 'added_at'),
    ('faisabilite_history', 'searched_at'),
    ('faisabilite_projects', 'created_at'),
    ('faisabilite_projects', 'updated_at'),
]


def upgrade() -> None:
    dialect = op.get_bind().dialect.name

    if dialect == 'sqlite':
        # SQLite : batch mode (recrée la table)
        for table, col in _COLUMNS:
            with op.batch_alter_table(table) as batch_op:
                batch_op.alter_column(col,
                                      existing_type=sa.String(),
                                      type_=sa.DateTime(timezone=True),
                                      existing_nullable=True,
                                      server_default=sa.func.now())
    else:
        # PostgreSQL : ALTER COLUMN avec USING cast
        for table, col in _COLUMNS:
            op.alter_column(table, col,
                            existing_type=sa.String(),
                            type_=sa.DateTime(timezone=True),
                            existing_nullable=True,
                            server_default=sa.func.now(),
                            postgresql_using=f"{col}::timestamp with time zone")


def downgrade() -> None:
    dialect = op.get_bind().dialect.name

    if dialect == 'sqlite':
        for table, col in reversed(_COLUMNS):
            with op.batch_alter_table(table) as batch_op:
                batch_op.alter_column(col,
                                      existing_type=sa.DateTime(timezone=True),
                                      type_=sa.String(),
                                      existing_nullable=True,
                                      server_default=None)
    else:
        for table, col in reversed(_COLUMNS):
            op.alter_column(table, col,
                            existing_type=sa.DateTime(timezone=True),
                            type_=sa.String(),
                            existing_nullable=True,
                            server_default=None,
                            postgresql_using=f"{col}::text")
