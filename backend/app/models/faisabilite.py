"""
Modèles SQLAlchemy pour la persistance des données du module Faisabilité
(favoris, projets, historique de recherche)
"""

from sqlalchemy import Column, String, Text, ForeignKey, Index
from datetime import datetime
import uuid

from app.database import Base


def _gen_uuid():
    return str(uuid.uuid4())


class FaisabiliteFavorite(Base):
    __tablename__ = "faisabilite_favorites"

    id = Column(String, primary_key=True, default=_gen_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    parcelle_id = Column(String, nullable=False)
    parcelle_json = Column(Text, nullable=False)        # GeoJSON feature complet
    note = Column(Text, nullable=True)
    transactions_json = Column(Text, nullable=True)    # JSON array de DVFTransaction

    added_at = Column(String, default=lambda: datetime.utcnow().isoformat(), index=True)

    __table_args__ = (
        Index("ix_fav_user_parcelle", "user_id", "parcelle_id"),
    )


class FaisabiliteProject(Base):
    __tablename__ = "faisabilite_projects"

    id = Column(String, primary_key=True, default=_gen_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String, default="#3b82f6")
    status = Column(String, default="active")          # active | archived | completed
    parcelles_json = Column(Text, nullable=False, default="[]")  # JSON array of parcelle IDs

    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at = Column(
        String,
        default=lambda: datetime.utcnow().isoformat(),
        onupdate=lambda: datetime.utcnow().isoformat(),
    )

    __table_args__ = (
        Index("ix_projects_user", "user_id"),
    )


class FaisabiliteSearchHistory(Base):
    __tablename__ = "faisabilite_history"

    id = Column(String, primary_key=True, default=_gen_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    query = Column(String, nullable=False)
    address_json = Column(Text, nullable=False)        # AddressResult JSON
    filters_json = Column(Text, nullable=True)         # DVFFilters JSON

    searched_at = Column(String, default=lambda: datetime.utcnow().isoformat(), index=True)

    __table_args__ = (
        Index("ix_history_user_searched", "user_id", "searched_at"),
    )
