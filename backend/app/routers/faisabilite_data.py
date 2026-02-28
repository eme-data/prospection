"""
Routes API pour la persistance des données Faisabilité
(favoris, projets, historique de recherche)
"""

import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
from sqlalchemy.orm import Session

from app.auth import get_current_active_user
from app.models.user import User
from app.models.faisabilite import FaisabiliteFavorite, FaisabiliteProject, FaisabiliteSearchHistory
from app.database import get_db

router = APIRouter(prefix="/faisabilite", tags=["faisabilite"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _json_or_none(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False)


# ── Schémas Pydantic ──────────────────────────────────────────────────────────

class FavoriteCreateRequest(BaseModel):
    parcelle_id: str
    parcelle_json: Any        # GeoJSON feature
    note: Optional[str] = None
    transactions_json: Optional[Any] = None


class FavoriteUpdateRequest(BaseModel):
    note: Optional[str] = None


class ProjectCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#3b82f6"
    status: Optional[str] = "active"
    parcelles_json: Optional[Any] = None


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None
    parcelles_json: Optional[Any] = None


class HistoryCreateRequest(BaseModel):
    query: str
    address_json: Any          # AddressResult
    filters_json: Optional[Any] = None


# ── Favoris ───────────────────────────────────────────────────────────────────

@router.get("/favorites")
def get_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    records = (
        db.query(FaisabiliteFavorite)
        .filter_by(user_id=current_user.id)
        .order_by(FaisabiliteFavorite.added_at.desc())
        .all()
    )
    result = []
    for r in records:
        try:
            parcelle = json.loads(r.parcelle_json)
        except (json.JSONDecodeError, TypeError):
            parcelle = {}
        try:
            transactions = json.loads(r.transactions_json) if r.transactions_json else None
        except (json.JSONDecodeError, TypeError):
            transactions = None
        result.append({
            "id": r.id,
            "parcelle_id": r.parcelle_id,
            "parcelle": parcelle,
            "note": r.note,
            "addedAt": r.added_at,
            "transactions": transactions,
        })
    return result


@router.post("/favorites")
def add_favorite(
    body: FavoriteCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Évite les doublons
    existing = db.query(FaisabiliteFavorite).filter_by(
        user_id=current_user.id,
        parcelle_id=body.parcelle_id,
    ).first()
    if existing:
        return {"id": existing.id, "already_exists": True}

    record = FaisabiliteFavorite(
        user_id=current_user.id,
        parcelle_id=body.parcelle_id,
        parcelle_json=_json_or_none(body.parcelle_json),
        note=body.note,
        transactions_json=_json_or_none(body.transactions_json),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"id": record.id, "added_at": record.added_at}


@router.put("/favorites/{fav_id}")
def update_favorite(
    fav_id: str,
    body: FavoriteUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = db.query(FaisabiliteFavorite).filter_by(id=fav_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Favori introuvable.")
    if record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès interdit.")
    record.note = body.note
    db.commit()
    return {"success": True}


@router.delete("/favorites/{fav_id}")
def delete_favorite(
    fav_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = db.query(FaisabiliteFavorite).filter_by(id=fav_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Favori introuvable.")
    if record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès interdit.")
    db.delete(record)
    db.commit()
    return {"success": True}


# ── Projets ───────────────────────────────────────────────────────────────────

@router.get("/projects")
def get_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    records = (
        db.query(FaisabiliteProject)
        .filter_by(user_id=current_user.id)
        .order_by(FaisabiliteProject.updated_at.desc())
        .all()
    )
    result = []
    for r in records:
        try:
            parcelles = json.loads(r.parcelles_json or "[]")
        except (json.JSONDecodeError, TypeError):
            parcelles = []
        result.append({
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "color": r.color,
            "status": r.status,
            "parcelles": parcelles,
            "createdAt": r.created_at,
            "updatedAt": r.updated_at,
        })
    return result


@router.post("/projects")
def create_project(
    body: ProjectCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = FaisabiliteProject(
        user_id=current_user.id,
        name=body.name,
        description=body.description,
        color=body.color or "#3b82f6",
        status=body.status or "active",
        parcelles_json=_json_or_none(body.parcelles_json) or "[]",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "id": record.id,
        "name": record.name,
        "description": record.description,
        "color": record.color,
        "status": record.status,
        "parcelles": json.loads(record.parcelles_json or "[]"),
        "createdAt": record.created_at,
        "updatedAt": record.updated_at,
    }


@router.put("/projects/{project_id}")
def update_project(
    project_id: str,
    body: ProjectUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = db.query(FaisabiliteProject).filter_by(id=project_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    if record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès interdit.")
    if body.name is not None:
        record.name = body.name
    if body.description is not None:
        record.description = body.description
    if body.color is not None:
        record.color = body.color
    if body.status is not None:
        record.status = body.status
    if body.parcelles_json is not None:
        record.parcelles_json = _json_or_none(body.parcelles_json) or "[]"
    record.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return {
        "id": record.id,
        "name": record.name,
        "description": record.description,
        "color": record.color,
        "status": record.status,
        "parcelles": json.loads(record.parcelles_json or "[]"),
        "createdAt": record.created_at,
        "updatedAt": record.updated_at,
    }


@router.delete("/projects/{project_id}")
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = db.query(FaisabiliteProject).filter_by(id=project_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    if record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès interdit.")
    db.delete(record)
    db.commit()
    return {"success": True}


# ── Historique de recherche ───────────────────────────────────────────────────

@router.get("/history")
def get_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    records = (
        db.query(FaisabiliteSearchHistory)
        .filter_by(user_id=current_user.id)
        .order_by(FaisabiliteSearchHistory.searched_at.desc())
        .limit(limit)
        .all()
    )
    result = []
    for r in records:
        try:
            address = json.loads(r.address_json)
        except (json.JSONDecodeError, TypeError):
            address = {}
        try:
            filters = json.loads(r.filters_json) if r.filters_json else None
        except (json.JSONDecodeError, TypeError):
            filters = None
        result.append({
            "id": r.id,
            "query": r.query,
            "address": address,
            "filters": filters,
            "timestamp": r.searched_at,
        })
    return result


@router.post("/history")
def add_history(
    body: HistoryCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = FaisabiliteSearchHistory(
        user_id=current_user.id,
        query=body.query,
        address_json=_json_or_none(body.address_json),
        filters_json=_json_or_none(body.filters_json),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    # Garder uniquement les 50 derniers
    old_records = (
        db.query(FaisabiliteSearchHistory)
        .filter_by(user_id=current_user.id)
        .order_by(FaisabiliteSearchHistory.searched_at.desc())
        .offset(50)
        .all()
    )
    for old in old_records:
        db.delete(old)
    db.commit()
    return {"id": record.id, "searched_at": record.searched_at}


@router.delete("/history/{history_id}")
def delete_history(
    history_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = db.query(FaisabiliteSearchHistory).filter_by(id=history_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Entrée introuvable.")
    if record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès interdit.")
    db.delete(record)
    db.commit()
    return {"success": True}
