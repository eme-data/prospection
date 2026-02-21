"""
Routes API pour le module Commerce (Catalogue BTP)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime

from app.database import get_db
from app.auth import get_current_active_user
from app.models.user import User

from app.schemas.commerce import (
    Material, MaterialCreate, MaterialUpdate,
    Service, ServiceCreate, ServiceUpdate,
    Article, ArticleCreate, ArticleUpdate,
    Composition, CompositionCreate, CompositionUpdate
)
from app.models.commerce import (
    Material as MaterialModel,
    Service as ServiceModel,
    Article as ArticleModel, ArticleMaterial,
    Composition as CompositionModel, CompositionItem
)
from app.commerce_service import CommercePriceCalculator
from app.utils.excel_parser import run_import

router = APIRouter(prefix="/commerce", tags=["commerce"])

def generate_uuid():
    return str(uuid.uuid4())

# ==========================================
# IMPORT CATALOGUE EXCEL
# ==========================================
@router.post("/import")
async def import_catalogue(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Veuillez fournir un fichier Excel valide (.xlsx ou .xls)")
        
    try:
        content = await file.read()
        import_result = run_import(content)
        
        if not import_result.get("success"):
            raise HTTPException(status_code=400, detail={"message": "Erreurs lors de l'analyse", "errors": import_result.get("errors")})
            
        data = import_result.get("data", {})
        
        # Save Materials
        for m_data in data.get("materials", []):
            existing = db.query(MaterialModel).filter(MaterialModel.code == m_data["code"]).first()
            if existing:
                existing.name_fr = m_data["name_fr"]
                existing.unit = m_data["unit"]
                existing.internal_price = m_data["internal_price"]
                existing.price_eur = m_data["internal_price"] # Assuming internal equals eur for now
            else:
                new_mat = MaterialModel(
                    id=generate_uuid(),
                    code=m_data["code"],
                    name_fr=m_data["name_fr"],
                    unit=m_data["unit"],
                    internal_price=m_data["internal_price"],
                    price_eur=m_data["internal_price"]
                )
                db.add(new_mat)

        # Save Articles
        for a_data in data.get("articles", []):
            existing = db.query(ArticleModel).filter(ArticleModel.code == a_data["code"]).first()
            if existing:
                existing.name = a_data["name_fr"]
                existing.unit = a_data["unit"]
                existing.labor_cost = a_data["installation_time"] * 22.0 # Estimate
            else:
                new_art = ArticleModel(
                    id=generate_uuid(),
                    code=a_data["code"],
                    name=a_data["name_fr"],
                    unit=a_data["unit"],
                    labor_cost=a_data["installation_time"] * 22.0,
                    margin=0, overhead=0, material_cost=0, total_price=0
                )
                db.add(new_art)
                
        # Save Compositions
        for c_data in data.get("compositions", []):
            existing = db.query(CompositionModel).filter(CompositionModel.code == c_data["code"]).first()
            if existing:
                existing.name = c_data["name_fr"]
                existing.unit = c_data["unit"]
            else:
                new_comp = CompositionModel(
                    id=generate_uuid(),
                    code=c_data["code"],
                    name=c_data["name_fr"],
                    unit=c_data["unit"],
                    labor_cost=0, margin=0, overhead=0, material_cost=0, total_price=0
                )
                db.add(new_comp)

        db.commit()
        return import_result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur interne lors de l'import : {str(e)}")

# ==========================================
# MATERIAUX
# ==========================================
@router.get("/materials", response_model=List[Material])
async def list_materials(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    active_only: bool = True,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(MaterialModel)
    if active_only:
        query = query.filter(MaterialModel.is_active == True)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (MaterialModel.code.ilike(search_filter)) |
            (MaterialModel.name_fr.ilike(search_filter))
        )
    return query.offset(skip).limit(limit).all()

@router.get("/materials/{material_id}", response_model=Material)
async def get_material(
    material_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    material = db.query(MaterialModel).filter(MaterialModel.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Matériau non trouvé")
    return material

@router.post("/materials", response_model=Material, status_code=status.HTTP_201_CREATED)
async def create_material(
    material_data: MaterialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    existing = db.query(MaterialModel).filter(MaterialModel.code == material_data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ce code matériel existe déjà")
        
    material = MaterialModel(
        id=generate_uuid(),
        **material_data.model_dump()
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return material

@router.put("/materials/{material_id}", response_model=Material)
async def update_material(
    material_id: str,
    material_data: MaterialUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    material = db.query(MaterialModel).filter(MaterialModel.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Matériau non trouvé")
        
    update_data = material_data.model_dump(exclude_unset=True)
    if 'price_eur' in update_data:
        update_data['price_date'] = datetime.utcnow().isoformat()
        
    for field, value in update_data.items():
        setattr(material, field, value)
        
    db.commit()
    db.refresh(material)
    return material

@router.delete("/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_material(
    material_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    material = db.query(MaterialModel).filter(MaterialModel.id == material_id).first()
    if material:
        material.is_active = False
        db.commit()
    return None

# ==========================================
# SERVICES
# ==========================================
@router.get("/services", response_model=List[Service])
async def list_services(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    active_only: bool = True,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(ServiceModel)
    if active_only:
        query = query.filter(ServiceModel.is_active == True)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(ServiceModel.name.ilike(search_filter))
    return query.offset(skip).limit(limit).all()

@router.post("/services", response_model=Service, status_code=status.HTTP_201_CREATED)
async def create_service(
    service_data: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    margin = CommercePriceCalculator.calculate_service_margin(service_data.price_net, service_data.price_gross)
    service = ServiceModel(
        id=generate_uuid(),
        **service_data.model_dump(),
        margin=margin
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service

@router.put("/services/{service_id}", response_model=Service)
async def update_service(
    service_id: str,
    service_data: ServiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = db.query(ServiceModel).filter(ServiceModel.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service non trouvé")
        
    update_data = service_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(service, field, value)
        
    if 'price_net' in update_data or 'price_gross' in update_data:
        service.margin = CommercePriceCalculator.calculate_service_margin(service.price_net, service.price_gross)
        
    db.commit()
    db.refresh(service)
    return service

@router.delete("/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = db.query(ServiceModel).filter(ServiceModel.id == service_id).first()
    if service:
        service.is_active = False
        db.commit()
    return None

# ==========================================
# ARTICLES
# ==========================================
@router.get("/articles", response_model=List[Article])
async def list_articles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    active_only: bool = True,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(ArticleModel)
    if active_only:
        query = query.filter(ArticleModel.is_active == True)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(ArticleModel.name.ilike(search_filter))
    return query.offset(skip).limit(limit).all()

@router.get("/articles/{article_id}", response_model=Article)
async def get_article(
    article_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    article = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article non trouvé")
    return article

@router.post("/articles", response_model=Article, status_code=status.HTTP_201_CREATED)
async def create_article(
    article_data: ArticleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    article = ArticleModel(
        id=generate_uuid(),
        code=article_data.code,
        name=article_data.name,
        description=article_data.description,
        unit=article_data.unit,
        labor_cost=article_data.labor_cost,
        margin=article_data.margin,
        overhead=article_data.overhead,
        material_cost=0,
        total_price=0
    )
    db.add(article)
    db.flush()
    
    for mat_data in article_data.materials:
        material = db.query(MaterialModel).filter(MaterialModel.id == mat_data.material_id).first()
        if not material:
            raise HTTPException(status_code=400, detail=f"Matériau {mat_data.material_id} non trouvé")
            
        rel = ArticleMaterial(
            id=generate_uuid(),
            article_id=article.id,
            material_id=mat_data.material_id,
            quantity=mat_data.quantity,
            waste_percent=mat_data.waste_percent
        )
        db.add(rel)
        
    db.flush()
    prices = CommercePriceCalculator.calculate_article_price(article, db)
    article.material_cost = prices['material_cost']
    article.total_price = prices['total_price']
    
    db.commit()
    db.refresh(article)
    return article

@router.delete("/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_article(
    article_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    article = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
    if article:
        article.is_active = False
        db.commit()
    return None
