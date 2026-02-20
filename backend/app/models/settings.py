from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from app.database import Base

class SystemSettings(Base):
    """
    Stocke les paramètres de configuration globaux (SMTP, clés API...)
    Modèle clé-valeur pour un ajout de paramètres sans migration de schéma complexe.
    """
    __tablename__ = "system_settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)
    
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
