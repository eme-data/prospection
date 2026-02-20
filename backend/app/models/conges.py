from sqlalchemy import Column, String, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Conge(Base):
    __tablename__ = "conges"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    date_debut = Column(Date, nullable=False)
    date_fin = Column(Date, nullable=False)
    type_conge = Column(String, nullable=False) # CP, RTT, Maladie, etc.
    statut = Column(String, default="en_attente") # en_attente, approuve, refuse
    commentaire = Column(String, nullable=True)
    
    date_demande = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
