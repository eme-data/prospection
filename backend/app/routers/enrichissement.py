"""
Router Enrichissement
Données démographiques, photos aériennes et potentiel de développement
"""

from fastapi import APIRouter, HTTPException, Query, Request

from app.config import settings
from app.logging_config import get_logger
from app.security import limiter, validate_code_insee, validate_coordinates
from app.cache import cache_get, cache_set
from app.http_client import geo_client, dvf_client, APIError

router = APIRouter(prefix="/api/enrichissement", tags=["enrichissement"])
logger = get_logger(__name__)


@router.get("/demographics/{code_insee}")
@limiter.limit("30/minute")
async def get_demographics(request: Request, code_insee: str):
    """Récupère les données démographiques d'une commune"""
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    cache_key = f"demographics:{code_insee}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    try:
        commune_data = await geo_client.get(
            f"/communes/{code_insee}?fields=nom,code,population,surface,codesPostaux,centre,departement"
        )
        result = {
            "code_insee": code_insee,
            "nom": commune_data.get("nom", ""),
            "population": commune_data.get("population", 0),
            "surface_km2": round(commune_data.get("surface", 0) / 100, 2),
            "densite": round(
                commune_data.get("population", 0) / (commune_data.get("surface", 1) / 100), 1
            ) if commune_data.get("surface") else 0,
            "codes_postaux": commune_data.get("codesPostaux", []),
            "departement": commune_data.get("departement", {}),
        }
        await cache_set(cache_key, result, ttl=3600)
        return result
    except APIError:
        raise
    except Exception as e:
        logger.error("demographics_error", error=str(e), code_insee=code_insee)
        raise HTTPException(status_code=500, detail=f"Erreur démographiques: {str(e)}")


@router.get("/aerial-photos")
@limiter.limit("20/minute")
async def get_aerial_photos(
    request: Request,
    lon: float = Query(..., ge=-180, le=180),
    lat: float = Query(..., ge=-90, le=90),
):
    """Récupère les informations sur les photos aériennes disponibles"""
    if not validate_coordinates(lon, lat):
        raise HTTPException(status_code=400, detail="Coordonnées invalides")

    return {
        "longitude": lon,
        "latitude": lat,
        "wms_url": "https://data.geopf.fr/wms-r",
        "tile_url": (
            "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0"
            "&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM"
            "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg"
        ),
    }


@router.get("/potential/{code_insee}")
@limiter.limit("30/minute")
async def get_development_potential(request: Request, code_insee: str):
    """Calcule le potentiel de développement d'une commune"""
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    cache_key = f"potential:{code_insee}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    try:
        commune_data = await geo_client.get(f"/communes/{code_insee}?fields=nom,population,surface")
        dvf_stats = await dvf_client.get(f"/statistiques?code_insee={code_insee}")

        score = 0
        factors = []

        nb_transactions = dvf_stats.get("nb_transactions", 0)
        if nb_transactions > 100:
            score += 30
            factors.append({"name": "Marché très actif", "score": 30})
        elif nb_transactions > 50:
            score += 20
            factors.append({"name": "Marché actif", "score": 20})

        evolution = dvf_stats.get("evolution", [])
        if len(evolution) >= 2:
            recent = evolution[-1].get("prix_moyen")
            previous = evolution[-2].get("prix_moyen")
            if recent and previous and previous > 0:
                growth = ((recent - previous) / previous) * 100
                if growth > 5:
                    score += 25
                    factors.append({"name": "Forte hausse des prix", "score": 25})
                elif growth > 2:
                    score += 15
                    factors.append({"name": "Hausse modérée des prix", "score": 15})

        max_score = 55
        normalized = min(100, int((score / max_score) * 100)) if max_score > 0 else 0
        level = (
            "excellent" if normalized >= 75 else
            "good" if normalized >= 60 else
            "moderate" if normalized >= 40 else
            "limited"
        )
        color = {
            "excellent": "#10b981",
            "good": "#3b82f6",
            "moderate": "#f59e0b",
            "limited": "#ef4444",
        }[level]

        result = {
            "code_insee": code_insee,
            "commune": commune_data.get("nom", ""),
            "score": normalized,
            "level": level,
            "color": color,
            "factors": factors,
        }
        await cache_set(cache_key, result, ttl=3600)
        return result
    except APIError:
        raise
    except Exception as e:
        logger.error("potential_error", error=str(e), code_insee=code_insee)
        raise HTTPException(status_code=500, detail=f"Erreur potentiel: {str(e)}")
