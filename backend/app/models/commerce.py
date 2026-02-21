"""
Modèles de base de données pour le module Commerce (CRM & Catalogue BTP)
"""

from sqlalchemy import Column, String, Boolean, Float, ForeignKey, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

# ---------------------------------------------------------
# Clients
# ---------------------------------------------------------
class ClientType(str, enum.Enum):
    PROSPECT = "prospect"
    CLIENT = "client"
    PARTNER = "partner"

class Client(Base):
    __tablename__ = "clients"
    
    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    client_type = Column(SQLEnum(ClientType), default=ClientType.PROSPECT, nullable=False)
    
    company_name = Column(String, nullable=False, index=True)
    siret = Column(String, nullable=True)
    vat_number = Column(String, nullable=True)
    
    contact_first_name = Column(String, nullable=True)
    contact_last_name = Column(String, nullable=True)
    contact_email = Column(String, nullable=True, index=True)
    contact_phone = Column(String, nullable=True)
    
    address_line1 = Column(String, nullable=True)
    address_line2 = Column(String, nullable=True)
    postal_code = Column(String, nullable=True)
    city = Column(String, nullable=True)
    country = Column(String, default="France", nullable=False)
    
    notes = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at = Column(String, default=lambda: datetime.utcnow().isoformat(), onupdate=lambda: datetime.utcnow().isoformat())

Index('ix_clients_active', Client.is_active)
Index('ix_clients_type', Client.client_type)

# ---------------------------------------------------------
# Catalogue - Matériaux
# ---------------------------------------------------------
class Material(Base):
    __tablename__ = "materials"
    
    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name_fr = Column(String, nullable=False)
    name_ro = Column(String, nullable=True)
    description = Column(String, nullable=True)
    
    unit = Column(String, nullable=False)
    price_eur = Column(Float, nullable=False)
    price_lei = Column(Float, nullable=True)
    
    price_date = Column(String, default=lambda: datetime.utcnow().isoformat())
    supplier = Column(String, nullable=True)
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at = Column(String, default=lambda: datetime.utcnow().isoformat(), onupdate=lambda: datetime.utcnow().isoformat())

Index('ix_materials_active', Material.is_active)

# ---------------------------------------------------------
# Catalogue - Services
# ---------------------------------------------------------
class Service(Base):
    __tablename__ = "services"
    
    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    
    unit = Column(String, nullable=False)
    
    price_net = Column(Float, nullable=False)
    price_gross = Column(Float, nullable=False)
    margin = Column(Float, nullable=False, default=0.0)
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at = Column(String, default=lambda: datetime.utcnow().isoformat(), onupdate=lambda: datetime.utcnow().isoformat())

Index('ix_services_active', Service.is_active)

# ---------------------------------------------------------
# Catalogue - Articles
# ---------------------------------------------------------
class Article(Base):
    __tablename__ = "articles"
    
    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    
    unit = Column(String, nullable=False)
    
    total_price = Column(Float, nullable=False)
    material_cost = Column(Float, nullable=False)
    labor_cost = Column(Float, nullable=False)
    
    margin = Column(Float, nullable=False, default=0.30)
    overhead = Column(Float, nullable=False, default=0.10)
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at = Column(String, default=lambda: datetime.utcnow().isoformat(), onupdate=lambda: datetime.utcnow().isoformat())
    
    materials = relationship("ArticleMaterial", back_populates="article", cascade="all, delete-orphan")

class ArticleMaterial(Base):
    __tablename__ = "article_materials"
    
    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    article_id = Column(String, ForeignKey("articles.id", ondelete="CASCADE"), nullable=False)
    material_id = Column(String, ForeignKey("materials.id"), nullable=False)
    
    quantity = Column(Float, nullable=False)
    waste_percent = Column(Float, default=0.0)
    
    article = relationship("Article", back_populates="materials")
    material = relationship("Material")

Index('ix_articles_active', Article.is_active)
Index('ix_article_materials_article', ArticleMaterial.article_id)

# ---------------------------------------------------------
# Catalogue - Compositions
# ---------------------------------------------------------
class CompositionItemType(str, enum.Enum):
    MATERIAL = "material"
    ARTICLE = "article"

class Composition(Base):
    __tablename__ = "compositions"
    
    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    
    unit = Column(String, nullable=False)
    total_price = Column(Float, nullable=False)
    
    margin = Column(Float, nullable=False, default=0.30)
    overhead = Column(Float, nullable=False, default=0.10)
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at = Column(String, default=lambda: datetime.utcnow().isoformat(), onupdate=lambda: datetime.utcnow().isoformat())
    
    items = relationship("CompositionItem", back_populates="composition", cascade="all, delete-orphan")

class CompositionItem(Base):
    __tablename__ = "composition_items"
    
    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    composition_id = Column(String, ForeignKey("compositions.id", ondelete="CASCADE"), nullable=False)
    
    item_type = Column(SQLEnum(CompositionItemType), nullable=False)
    item_id = Column(String, nullable=False) # UUID reference manual to either an article or material
    
    quantity = Column(Float, nullable=False)
    
    composition = relationship("Composition", back_populates="items")

Index('ix_compositions_active', Composition.is_active)
Index('ix_composition_items_composition', CompositionItem.composition_id)
