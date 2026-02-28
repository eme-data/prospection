from sqlalchemy import Column, String, Boolean, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(String, default="user")
    is_active = Column(Boolean, default=True)
    
    # Permissions des modules
    module_faisabilite = Column(Boolean, default=True)
    module_commerce = Column(Boolean, default=False)
    module_sav = Column(Boolean, default=False)
    module_conges = Column(Boolean, default=False)
    module_communication = Column(Boolean, default=False)
    module_autobot = Column(Boolean, default=False)
    module_secondaryBrain = Column(Boolean, default=True)
    
    # Congés et Hiérarchie
    manager_id = Column(String, ForeignKey("users.id"), nullable=True)
    solde_conges = Column(Float, default=25.0)
    
    # Communication
    posts = relationship("app.models.communication.Post", back_populates="user", cascade="all, delete-orphan")
    social_accounts = relationship("app.models.communication.SocialAccount", back_populates="user", cascade="all, delete-orphan")
    
    # Tracking d'activité
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
