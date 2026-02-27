"""
Router Fiches Terrain
Gestion des fiches terrain enrichies (photos, documents, notes)
"""

from fastapi import APIRouter, HTTPException, Request

from app.logging_config import get_logger
from app.security import limiter, sanitize_string
from app.fiches import fiches_manager

router = APIRouter(prefix="/api/fiches", tags=["fiches"])
logger = get_logger(__name__)


@router.get("/{parcelle_id}")
@limiter.limit("30/minute")
async def get_fiche(request: Request, parcelle_id: str):
    """Récupère la fiche terrain enrichie d'une parcelle"""
    parcelle_id = sanitize_string(parcelle_id)
    fiche = fiches_manager.get_fiche(parcelle_id)
    if not fiche:
        return {
            "parcelleId": parcelle_id,
            "photos": [],
            "documents": [],
            "notes": [],
            "tags": [],
        }
    return fiche


@router.post("/{parcelle_id}/photos")
@limiter.limit("20/minute")
async def add_photo(request: Request, parcelle_id: str):
    """Ajoute une photo à la fiche terrain"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        body = await request.json()
        url = sanitize_string(body.get("url", ""))
        if not url:
            raise HTTPException(status_code=400, detail="url requis")

        fiche = fiches_manager.add_photo(
            parcelle_id=parcelle_id,
            url=url,
            photo_type=body.get("type", "terrain"),
            description=sanitize_string(body.get("description", "")) or None,
            source=sanitize_string(body.get("source", "")) or None,
        )
        logger.info("photo_added", parcelle_id=parcelle_id)
        return fiche
    except HTTPException:
        raise
    except Exception as e:
        logger.error("add_photo_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur ajout photo: {str(e)}")


@router.delete("/{parcelle_id}/photos/{photo_id}")
@limiter.limit("20/minute")
async def delete_photo(request: Request, parcelle_id: str, photo_id: str):
    """Supprime une photo de la fiche terrain"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        photo_id = sanitize_string(photo_id)
        if not fiches_manager.delete_photo(parcelle_id, photo_id):
            raise HTTPException(status_code=404, detail="Photo non trouvée")
        logger.info("photo_deleted", parcelle_id=parcelle_id, photo_id=photo_id)
        return {"success": True, "message": "Photo supprimée"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("delete_photo_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur suppression photo: {str(e)}")


@router.post("/{parcelle_id}/documents")
@limiter.limit("20/minute")
async def add_document(request: Request, parcelle_id: str):
    """Ajoute un document à la fiche terrain"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        body = await request.json()
        nom = sanitize_string(body.get("nom", ""))
        url = sanitize_string(body.get("url", ""))
        if not nom or not url:
            raise HTTPException(status_code=400, detail="nom et url requis")

        fiche = fiches_manager.add_document(
            parcelle_id=parcelle_id,
            nom=nom,
            url=url,
            doc_type=body.get("type", "autre"),
            taille=body.get("taille"),
        )
        logger.info("document_added", parcelle_id=parcelle_id)
        return fiche
    except HTTPException:
        raise
    except Exception as e:
        logger.error("add_document_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur ajout document: {str(e)}")
