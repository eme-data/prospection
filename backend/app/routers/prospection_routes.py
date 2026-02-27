"""
Router Prospection
Gestion du workflow de prospection foncière par parcelle
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request

from app.logging_config import get_logger
from app.security import limiter, sanitize_string
from app.prospection import prospection_manager

router = APIRouter(prefix="/api/prospection", tags=["prospection"])
logger = get_logger(__name__)


@router.get("/stats/global")
@limiter.limit("20/minute")
async def get_prospection_stats(request: Request):
    """Récupère les statistiques globales de prospection"""
    try:
        return prospection_manager.get_stats()
    except Exception as e:
        logger.error("prospection_stats_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur stats: {str(e)}")


@router.get("")
@limiter.limit("20/minute")
async def list_prospections(
    request: Request,
    statut: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
):
    """Liste toutes les prospections avec filtres optionnels"""
    try:
        if statut and statut not in prospection_manager.STATUTS:
            raise HTTPException(status_code=400, detail=f"Statut invalide: {statut}")
        prospections = prospection_manager.get_all_prospections(
            statut=statut, limit=limit, offset=offset
        )
        return {
            "prospections": prospections,
            "count": len(prospections),
            "limit": limit,
            "offset": offset,
            "statut_filter": statut,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("list_prospections_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur listage: {str(e)}")


@router.get("/{parcelle_id}")
@limiter.limit("30/minute")
async def get_prospection(request: Request, parcelle_id: str):
    """Récupère les informations de prospection d'une parcelle"""
    parcelle_id = sanitize_string(parcelle_id)
    prospection = prospection_manager.get_prospection(parcelle_id)
    if not prospection:
        raise HTTPException(status_code=404, detail="Prospection non trouvée")
    return prospection


@router.post("")
@limiter.limit("20/minute")
async def create_prospection(request: Request):
    """Crée une nouvelle fiche de prospection"""
    try:
        body = await request.json()
        parcelle_id = sanitize_string(body.get("parcelleId", ""))
        if not parcelle_id:
            raise HTTPException(status_code=400, detail="parcelleId requis")

        if prospection_manager.get_prospection(parcelle_id):
            raise HTTPException(status_code=409, detail="Prospection déjà existante")

        prospection = prospection_manager.create_prospection(
            parcelle_id=parcelle_id,
            statut=body.get("statut", "a_prospecter"),
            notes_contact=sanitize_string(body.get("notesContact", "")),
            interlocuteur=sanitize_string(body.get("interlocuteur", "")) or None,
            telephone=sanitize_string(body.get("telephone", "")) or None,
            email=sanitize_string(body.get("email", "")) or None,
        )
        logger.info("prospection_created", parcelle_id=parcelle_id)
        return prospection
    except (HTTPException, ValueError):
        raise
    except Exception as e:
        logger.error("create_prospection_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur création: {str(e)}")


@router.put("/{parcelle_id}/statut")
@limiter.limit("30/minute")
async def update_statut(request: Request, parcelle_id: str):
    """Met à jour le statut d'une prospection"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        body = await request.json()
        nouveau_statut = body.get("statut")
        if not nouveau_statut:
            raise HTTPException(status_code=400, detail="statut requis")

        prospection = prospection_manager.update_statut(
            parcelle_id=parcelle_id,
            nouveau_statut=nouveau_statut,
            notes=sanitize_string(body.get("notes", "")),
            date_contact=body.get("dateContact"),
            date_relance=body.get("dateRelance"),
        )
        logger.info("prospection_statut_updated", parcelle_id=parcelle_id, statut=nouveau_statut)
        return prospection
    except (HTTPException, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e)) if isinstance(e, ValueError) else e
    except Exception as e:
        logger.error("update_statut_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur mise à jour statut: {str(e)}")


@router.put("/{parcelle_id}/contact")
@limiter.limit("30/minute")
async def update_contact(request: Request, parcelle_id: str):
    """Met à jour les informations de contact d'une prospection"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        body = await request.json()
        prospection = prospection_manager.update_contact_info(
            parcelle_id=parcelle_id,
            interlocuteur=sanitize_string(body.get("interlocuteur", "")) or None,
            telephone=sanitize_string(body.get("telephone", "")) or None,
            email=sanitize_string(body.get("email", "")) or None,
            notes=sanitize_string(body.get("notes", "")) or None,
        )
        logger.info("prospection_contact_updated", parcelle_id=parcelle_id)
        return prospection
    except Exception as e:
        logger.error("update_contact_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur mise à jour contact: {str(e)}")


@router.post("/{parcelle_id}/notes")
@limiter.limit("30/minute")
async def add_note(request: Request, parcelle_id: str):
    """Ajoute une note à l'historique de prospection"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        body = await request.json()
        notes = sanitize_string(body.get("notes", ""))
        if not notes:
            raise HTTPException(status_code=400, detail="notes requis")
        prospection = prospection_manager.add_note(parcelle_id=parcelle_id, notes=notes)
        logger.info("prospection_note_added", parcelle_id=parcelle_id)
        return prospection
    except HTTPException:
        raise
    except Exception as e:
        logger.error("add_note_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur ajout note: {str(e)}")


@router.delete("/{parcelle_id}")
@limiter.limit("10/minute")
async def delete_prospection(request: Request, parcelle_id: str):
    """Supprime une fiche de prospection"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        if not prospection_manager.delete_prospection(parcelle_id):
            raise HTTPException(status_code=404, detail="Prospection non trouvée")
        logger.info("prospection_deleted", parcelle_id=parcelle_id)
        return {"success": True, "message": "Prospection supprimée"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("delete_prospection_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur suppression: {str(e)}")
