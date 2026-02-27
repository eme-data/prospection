"""
Modèle SQLAlchemy pour la galerie des logos générés
"""

from sqlalchemy import Column, String, Text, ForeignKey, Index
from datetime import datetime
import uuid

from app.database import Base


def _gen_uuid():
    return str(uuid.uuid4())


class LogoGenerated(Base):
    __tablename__ = "logos_generated"

    id = Column(String, primary_key=True, default=_gen_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Paramètres de génération
    company_name = Column(String, nullable=False)
    sector = Column(String, nullable=True)
    style = Column(String, nullable=True)
    colors = Column(String, nullable=True)

    # Contenu SVG brut
    svg_content = Column(Text, nullable=False)

    created_at = Column(String, default=lambda: datetime.utcnow().isoformat(), index=True)

    __table_args__ = (
        Index("ix_logos_generated_user_created", "user_id", "created_at"),
    )
