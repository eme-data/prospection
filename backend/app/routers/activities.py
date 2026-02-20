from fastapi import APIRouter, HTTPException, Query, Request
from typing import Optional, List, Dict, Any
from app.activity import activity_manager, Activity
from app.logging_config import get_logger
from app.security import sanitize_string

router = APIRouter(prefix="/api/activities", tags=["Activities"])
logger = get_logger(__name__)

@router.get("/rappels/list")
async def list_rappels(limit: int = Query(50, le=100)):
    try:
        return activity_manager.get_rappels(limit=limit)
    except Exception as e:
        logger.error(f"Error rappels list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats/overview")
async def get_activities_stats():
    return activity_manager.get_stats()

@router.get("/{parcelle_id}")
async def get_activities(parcelle_id: str):
    parcelle_id = sanitize_string(parcelle_id)
    return activity_manager.get_activities(parcelle_id=parcelle_id)

@router.post("")
async def create_activity(
    parcelle_id: str = Query(..., alias="parcelle_id"),
    type: str = Query(...),
    titre: str = Query(...),
    description: str = Query(""),
    auteur: str = Query("Système"),
    prochaine_action: Optional[str] = Query(None),
    date_rappel: Optional[str] = Query(None)
):
    try:
        return activity_manager.create_activity(
            parcelle_id=sanitize_string(parcelle_id),
            type=sanitize_string(type),
            titre=sanitize_string(titre),
            description=sanitize_string(description),
            auteur=sanitize_string(auteur),
            prochaine_action=sanitize_string(prochaine_action) if prochaine_action else None,
            date_rappel=sanitize_string(date_rappel) if date_rappel else None
        )
    except Exception as e:
        logger.error(f"Error create_activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{activity_id}")
async def update_activity(
    activity_id: str,
    titre: Optional[str] = Query(None),
    description: Optional[str] = Query(None),
    prochaine_action: Optional[str] = Query(None),
    date_rappel: Optional[str] = Query(None)
):
    try:
        activity = activity_manager.update_activity(
            activity_id=sanitize_string(activity_id),
            titre=sanitize_string(titre) if titre else None,
            description=sanitize_string(description) if description else None,
            prochaine_action=sanitize_string(prochaine_action) if prochaine_action else None,
            date_rappel=sanitize_string(date_rappel) if date_rappel else None
        )
        if not activity:
            raise HTTPException(status_code=404, detail="Activité non trouvée")
        return activity
    except Exception as e:
         logger.error(f"Error update activity: {e}")
         raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{activity_id}")
async def delete_activity(activity_id: str):
    success = activity_manager.delete_activity(sanitize_string(activity_id))
    if not success:
        raise HTTPException(status_code=404, detail="Activité non trouvée")
    return {"success": True}
