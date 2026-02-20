import asyncio
from fastapi import APIRouter, HTTPException, Request
from app.services.faisabilite import faisabilite_service
from app.security import limiter
from app.logging_config import get_logger
from app.routers.search import search_parcelles, SearchFilters

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

@router.get("/top10/{code_insee}")
@limiter.limit("5/minute")
async def get_top10_faisabilite(request: Request, code_insee: str):
    """
    Récupère les 10 meilleures parcelles d'une commune et génère leur rapport de faisabilité.
    """
    try:
        # 1. Obtenir le top 10 via search
        filters = SearchFilters(
            code_insee=code_insee,
            include_score=True,
            sort_by="score",
            page=1,
            per_page=10
        )
        # Appel interne
        search_result = await search_parcelles(request, filters)
        top10_parcelles = search_result.get("parcelles", [])
        
        if not top10_parcelles:
            return []

        # 2. Générer les rapports de faisabilité en parallèle
        async def fetch_report(p):
            parcelle_id = p["parcelle"].get("properties", {}).get("id")
            if not parcelle_id:
                return None
            try:
                report = await faisabilite_service.generate_report(parcelle_id)
                return {
                    "parcelleId": parcelle_id,
                    "score": p.get("score"),
                    "parcelle_info": p["parcelle"],
                    "report": report
                }
            except Exception as e:
                logger.error(f"Top 10: Erreur faisabilité {parcelle_id}: {e}")
                return {
                    "parcelleId": parcelle_id,
                    "score": p.get("score"),
                    "parcelle_info": p["parcelle"],
                    "report": None,
                    "error": str(e)
                }

        results = await asyncio.gather(*(fetch_report(p) for p in top10_parcelles))
        
        return [r for r in results if r is not None]

    except Exception as e:
        logger.error(f"Erreur top 10 faisabilité {code_insee}: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la génération du top 10")
