from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request
from app.http_client import geo_client, APIError
from app.security import limiter, sanitize_string, validate_code_insee
from app.cache import cache_get, cache_set
from app.logging_config import get_logger

router = APIRouter(
    prefix="/api/geo",
    tags=["Geo"]
)

logger = get_logger(__name__)

@router.get("/communes")
@limiter.limit("30/minute")
async def search_communes(
    request: Request,
    nom: Optional[str] = Query(None, max_length=100, description="Nom de la commune"),
    code_postal: Optional[str] = Query(None, max_length=5, description="Code postal"),
    code_departement: Optional[str] = Query(None, max_length=3, description="Code departement")
):
    """Recherche de communes via l'API Geo"""
    params = {"fields": "nom,code,codesPostaux,centre,contour,population,departement"}

    if nom:
        params["nom"] = sanitize_string(nom, 100)
    if code_postal:
        params["codePostal"] = code_postal
    if code_departement:
        params["codeDepartement"] = code_departement

    try:
        communes = await geo_client.get("/communes", params=params)
        return {"communes": communes[:20] if isinstance(communes, list) else []}
    except APIError:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur API Geo: {str(e)}")


@router.get("/commune/{code_insee}")
@limiter.limit("30/minute")
async def get_commune(request: Request, code_insee: str):
    """Recupere les details d'une commune par son code INSEE"""
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    try:
        return await geo_client.get(
            f"/communes/{code_insee}",
            params={"fields": "nom,code,codesPostaux,centre,contour,population,departement,region,surface"}
        )
    except APIError:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur API Geo: {str(e)}")


@router.get("/departements")
@limiter.limit("10/minute")
async def get_departements(request: Request):
    """Liste tous les departements francais"""
    cache_key = "departements:all"
    cached_data = await cache_get(cache_key)

    if cached_data:
        return cached_data

    try:
        data = await geo_client.get("/departements", params={"fields": "nom,code,codeRegion"})
        result = {"departements": data if isinstance(data, list) else []}
        await cache_set(cache_key, result, ttl=3600)  # Cache 1h
        return result
    except APIError:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur API Geo: {str(e)}")
