"""
Modèle SQLAlchemy pour l'historique des analyses de devis
"""

from sqlalchemy import Column, String, Text, ForeignKey, Index
from datetime import datetime
import uuid

from app.database import Base


def _gen_uuid():
    return str(uuid.uuid4())


class DevisAnalyse(Base):
    __tablename__ = "devis_analyses"

    id = Column(String, primary_key=True, default=_gen_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Métadonnées utilisateur
    nom_projet = Column(String, nullable=True)

    # Infos fichiers analysés (JSON : [{name, size_bytes}, ...])
    fichiers_info = Column(Text, nullable=False, default="[]")

    # Résultat complet de l'analyse (JSON stringifié)
    result_json = Column(Text, nullable=False)

    created_at = Column(String, default=lambda: datetime.utcnow().isoformat(), index=True)

    __table_args__ = (
        Index("ix_devis_analyses_user_created", "user_id", "created_at"),
    )
