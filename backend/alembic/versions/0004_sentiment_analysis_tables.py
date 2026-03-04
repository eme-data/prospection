"""Create sentiment_analyses and sentiment_items tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sentiment_analyses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("query", sa.String(), nullable=False),
        sa.Column("sources", sa.String(), nullable=False),
        sa.Column("sentiment_score", sa.Float(), server_default="0.0"),
        sa.Column("sentiment_label", sa.String(), server_default="neutre"),
        sa.Column("total_items", sa.Integer(), server_default="0"),
        sa.Column("positive_count", sa.Integer(), server_default="0"),
        sa.Column("negative_count", sa.Integer(), server_default="0"),
        sa.Column("neutral_count", sa.Integer(), server_default="0"),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "sentiment_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("analysis_id", sa.Integer(), sa.ForeignKey("sentiment_analyses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("url", sa.String(), nullable=True),
        sa.Column("author", sa.String(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sentiment_score", sa.Float(), server_default="0.0"),
        sa.Column("sentiment_label", sa.String(), server_default="neutre"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index("ix_sentiment_analyses_user_id", "sentiment_analyses", ["user_id"])
    op.create_index("ix_sentiment_items_analysis_id", "sentiment_items", ["analysis_id"])


def downgrade() -> None:
    op.drop_index("ix_sentiment_items_analysis_id", table_name="sentiment_items")
    op.drop_index("ix_sentiment_analyses_user_id", table_name="sentiment_analyses")
    op.drop_table("sentiment_items")
    op.drop_table("sentiment_analyses")
