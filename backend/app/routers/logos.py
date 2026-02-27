"""
Routes API pour la galerie des logos SVG générés
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.auth import get_current_active_user
from app.models.user import User
from app.models.logo import LogoGenerated
from app.database import get_db

router = APIRouter(prefix="/communication/logos", tags=["communication"])


class SaveLogoRequest(BaseModel):
    company_name: str
    sector: Optional[str] = None
    style: Optional[str] = None
    colors: Optional[str] = None
    svg_content: str


@router.post("/")
def save_logo(
    body: SaveLogoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Sauvegarde un logo SVG en galerie."""
    record = LogoGenerated(
        user_id=current_user.id,
        company_name=body.company_name,
        sector=body.sector,
        style=body.style,
        colors=body.colors,
        svg_content=body.svg_content,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"id": record.id, "created_at": record.created_at}


@router.get("/")
def list_logos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Liste les logos sauvegardés de l'utilisateur."""
    records = (
        db.query(LogoGenerated)
        .filter_by(user_id=current_user.id)
        .order_by(LogoGenerated.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "company_name": r.company_name,
            "sector": r.sector,
            "style": r.style,
            "colors": r.colors,
            "svg_content": r.svg_content,
            "created_at": r.created_at,
        }
        for r in records
    ]


@router.delete("/{logo_id}")
def delete_logo(
    logo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Supprime un logo de la galerie."""
    record = db.query(LogoGenerated).filter_by(id=logo_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Logo introuvable.")
    if record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès interdit.")
    db.delete(record)
    db.commit()
    return {"success": True}
