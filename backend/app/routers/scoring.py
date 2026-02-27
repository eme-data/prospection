"""
Router Scoring
Calcul du score d'opportunité des parcelles (0-100)
"""

from fastapi import APIRouter, HTTPException, Query, Request

from app.logging_config import get_logger
from app.security import limiter, validate_code_insee
from app.cache import cache_get, cache_set
from app.http_client import geo_client, dvf_client, cadastre_client, APIError
from app.scoring import scorer

router = APIRouter(prefix="/api/scoring", tags=["scoring"])
logger = get_logger(__name__)


async def _get_context(code_insee: str) -> tuple:
    """Récupère (stats_marche, demographics, transactions) avec cache mutualisé."""
    stats_marche = await cache_get(f"stats:{code_insee}")
    if not stats_marche:
        stats_marche = await dvf_client.get(f"/statistiques?code_insee={code_insee}")
        await cache_set(f"stats:{code_insee}", stats_marche, ttl=3600)

    demographics = await cache_get(f"demographics:{code_insee}")
    if not demographics:
        commune_data = await geo_client.get(f"/communes/{code_insee}?fields=nom,code,population,surface")
        surface = commune_data.get("surface", 1) or 1
        demographics = {
            "population": commune_data.get("population", 0),
            "surface_km2": surface / 100,
            "densite": commune_data.get("population", 0) / (surface / 100),
        }
        await cache_set(f"demographics:{code_insee}", demographics, ttl=3600)

    transactions_data = await dvf_client.get(f"/dvf?code_insee={code_insee}")
    transactions = transactions_data.get("resultats", [])

    return stats_marche, demographics, transactions


@router.get("/parcelle/{parcelle_id}")
@limiter.limit("60/minute")
async def score_parcelle(
    request: Request,
    parcelle_id: str,
    code_insee: str = Query(..., min_length=5, max_length=5),
):
    """Calcule le score d'une parcelle spécifique"""
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    try:
        parcelles_data = await cadastre_client.get(
            f"/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"
        )
        parcelles = parcelles_data.get("features", [])
        parcelle = next(
            (p for p in parcelles if p.get("properties", {}).get("id") == parcelle_id), None
        )
        if not parcelle:
            raise HTTPException(status_code=404, detail="Parcelle non trouvée")

        stats_marche, demographics, transactions = await _get_context(code_insee)
        return scorer.calculate_score(
            parcelle=parcelle,
            stats_marche=stats_marche,
            demographics=demographics,
            transactions=transactions,
        )
    except APIError:
        raise
    except HTTPException:
        raise
    except Exception as e:
        logger.error("scoring_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur scoring: {str(e)}")


@router.post("/batch")
@limiter.limit("30/minute")
async def score_parcelles_batch(request: Request, body: dict):
    """Calcule les scores de plusieurs parcelles (max 100)"""
    parcelle_ids = body.get("parcelle_ids", [])
    code_insee = body.get("code_insee")

    if not code_insee or not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")
    if len(parcelle_ids) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 parcelles par requête")

    try:
        parcelles_data = await cadastre_client.get(
            f"/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"
        )
        all_parcelles = parcelles_data.get("features", [])
        parcelles = [
            p for p in all_parcelles if p.get("properties", {}).get("id") in parcelle_ids
        ]

        stats_marche, demographics, transactions = await _get_context(code_insee)
        scores = [
            scorer.calculate_score(
                parcelle=p,
                stats_marche=stats_marche,
                demographics=demographics,
                transactions=transactions,
            )
            for p in parcelles
        ]
        return {"scores": scores, "total": len(scores), "code_insee": code_insee}
    except APIError:
        raise
    except Exception as e:
        logger.error("batch_scoring_error", error=str(e), code_insee=code_insee)
        raise HTTPException(status_code=500, detail=f"Erreur batch scoring: {str(e)}")


@router.get("/commune/{code_insee}")
@limiter.limit("10/minute")
async def score_commune(request: Request, code_insee: str, limit: int = Query(50, le=200)):
    """Retourne les parcelles scorées d'une commune, triées par score décroissant"""
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    cache_key = f"commune_scores:{code_insee}:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    try:
        parcelles_data = await cadastre_client.get(
            f"/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"
        )
        parcelles = parcelles_data.get("features", [])[:limit]

        stats_marche, demographics, transactions = await _get_context(code_insee)
        scores = [
            {
                "parcelle": p,
                "score": scorer.calculate_score(
                    parcelle=p,
                    stats_marche=stats_marche,
                    demographics=demographics,
                    transactions=transactions,
                ),
            }
            for p in parcelles
        ]
        scores.sort(key=lambda x: x["score"]["score"], reverse=True)

        result = {
            "code_insee": code_insee,
            "total_parcelles": len(scores),
            "parcelles_scorees": scores,
            "stats": {
                "score_moyen": sum(s["score"]["score"] for s in scores) / len(scores) if scores else 0,
                "excellent": sum(1 for s in scores if s["score"]["niveau"] == "excellent"),
                "bon": sum(1 for s in scores if s["score"]["niveau"] == "bon"),
                "moyen": sum(1 for s in scores if s["score"]["niveau"] == "moyen"),
                "faible": sum(1 for s in scores if s["score"]["niveau"] == "faible"),
            },
        }
        await cache_set(cache_key, result, ttl=1800)
        return result
    except APIError:
        raise
    except Exception as e:
        logger.error("commune_scoring_error", error=str(e), code_insee=code_insee)
        raise HTTPException(status_code=500, detail=f"Erreur scoring commune: {str(e)}")
