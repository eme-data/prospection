"""
Schémas Pydantic pour le module Commerce (Catalogue BTP)
"""

from pydantic import BaseModel, Field
from typing import Optional, List


# ========== MATERIALS ==========

class MaterialBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name_fr: str = Field(..., min_length=1)
    name_ro: Optional[str] = None
    description: Optional[str] = None
    unit: str = Field(..., min_length=1, max_length=20)
    price_eur: float = Field(..., ge=0)
    price_lei: Optional[float] = Field(None, ge=0)
    supplier: Optional[str] = None


class MaterialCreate(MaterialBase):
    pass


class MaterialUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    name_fr: Optional[str] = Field(None, min_length=1)
    name_ro: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = Field(None, min_length=1, max_length=20)
    price_eur: Optional[float] = Field(None, ge=0)
    price_lei: Optional[float] = Field(None, ge=0)
    supplier: Optional[str] = None
    is_active: Optional[bool] = None


class Material(MaterialBase):
    id: str
    price_date: str
    is_active: bool
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


# ========== ARTICLES ==========

class ArticleMaterialBase(BaseModel):
    material_id: str
    quantity: float = Field(..., gt=0)
    waste_percent: float = Field(default=0.0, ge=0, le=1)


class ArticleMaterialCreate(ArticleMaterialBase):
    pass


class ArticleMaterial(ArticleMaterialBase):
    id: str
    article_id: str
    material: Optional[Material] = None
    
    class Config:
        from_attributes = True


class ArticleBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    unit: str = Field(..., min_length=1, max_length=20)
    margin: float = Field(default=0.30, ge=0, le=1)
    overhead: float = Field(default=0.10, ge=0, le=1)


class ArticleCreate(ArticleBase):
    labor_cost: float = Field(default=0.0, ge=0)
    materials: List[ArticleMaterialCreate] = []


class ArticleUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    unit: Optional[str] = Field(None, min_length=1, max_length=20)
    labor_cost: Optional[float] = Field(None, ge=0)
    margin: Optional[float] = Field(None, ge=0, le=1)
    overhead: Optional[float] = Field(None, ge=0, le=1)
    is_active: Optional[bool] = None


class Article(ArticleBase):
    id: str
    total_price: float
    material_cost: float
    labor_cost: float
    is_active: bool
    created_at: str
    updated_at: str
    materials: List[ArticleMaterial] = []
    
    class Config:
        from_attributes = True


# ========== COMPOSITIONS ==========

class CompositionItemBase(BaseModel):
    item_type: str = Field(..., pattern='^(material|article)$')
    item_id: str
    quantity: float = Field(..., gt=0)


class CompositionItemCreate(CompositionItemBase):
    pass


class CompositionItem(CompositionItemBase):
    id: str
    composition_id: str
    
    class Config:
        from_attributes = True


class CompositionBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    unit: str = Field(..., min_length=1, max_length=20)
    margin: float = Field(default=0.30, ge=0, le=1)
    overhead: float = Field(default=0.10, ge=0, le=1)


class CompositionCreate(CompositionBase):
    items: List[CompositionItemCreate] = []


class CompositionUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    unit: Optional[str] = Field(None, min_length=1, max_length=20)
    margin: Optional[float] = Field(None, ge=0, le=1)
    overhead: Optional[float] = Field(None, ge=0, le=1)
    is_active: Optional[bool] = None


class Composition(CompositionBase):
    id: str
    total_price: float
    is_active: bool
    created_at: str
    updated_at: str
    items: List[CompositionItem] = []
    
    class Config:
        from_attributes = True


# ========== SERVICES ==========

class ServiceBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    unit: str = Field(..., min_length=1, max_length=20)
    price_net: float = Field(..., ge=0)
    price_gross: float = Field(..., ge=0)


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    unit: Optional[str] = Field(None, min_length=1, max_length=20)
    price_net: Optional[float] = Field(None, ge=0)
    price_gross: Optional[float] = Field(None, ge=0)
    is_active: Optional[bool] = None


class Service(ServiceBase):
    id: str
    margin: float
    is_active: bool
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True
