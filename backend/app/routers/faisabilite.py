from fastapi import APIRouter, HTTPException, Request
from app.services.faisabilite import faisabilite_service
from app.security import limiter
from app.logging_config import get_logger

router = APIRouter(
    prefix="/api/faisabilite",
    tags=["Faisabilit\u00e9"]
)

logger = get_logger(__name__)

@router.get("/{parcelle_id}")
@limiter.limit("10/minute")
async def get_faisabilite_report(request: Request, parcelle_id: str):
    """
    Génère un rapport de faisabilité complet pour une parcelle.
    """
    try:
        report = await faisabilite_service.generate_report(parcelle_id)
        return report
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur rapport faisabilité {parcelle_id}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la génération du rapport")
