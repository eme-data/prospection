from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request
from app.http_client import cadastre_client, APIError
from app.security import limiter, validate_code_insee
from app.cache import cache_get, cache_set
from app.logging_config import get_logger

router = APIRouter(
    prefix="/api/cadastre",
    tags=["Cadastre"]
)

logger = get_logger(__name__)

@router.get("/parcelles")
@limiter.limit("20/minute")
async def get_parcelles(
    request: Request,
    code_insee: str = Query(..., min_length=5, max_length=5, description="Code INSEE de la commune"),
    section: Optional[str] = Query(None, max_length=10, description="Section cadastrale (ex: AB)"),
    numero: Optional[str] = Query(None, max_length=10, description="Numero de parcelle")
):
    """Recupere les parcelles cadastrales d'une commune"""
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    # Cache key
    cache_key = f"parcelles:{code_insee}"
    cached_data = await cache_get(cache_key)

    if cached_data:
        features = cached_data.get("features", [])
    else:
        try:
            url = f"/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"
            data = await cadastre_client.get(url)
            features = data.get("features", [])
            await cache_set(cache_key, data, ttl=600)  # Cache 10 min
        except APIError:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Erreur API Cadastre: {str(e)}")

    # Filtrage optionnel
    if section:
        features = [f for f in features if f.get("properties", {}).get("section", "").upper() == section.upper()]
    if numero:
        features = [f for f in features if f.get("properties", {}).get("numero", "") == numero]

    return {
        "type": "FeatureCollection",
        "features": features
    }


@router.get("/parcelle/{parcelle_id}")
@limiter.limit("30/minute")
async def get_parcelle_detail(request: Request, parcelle_id: str):
    """Recupere les details d'une parcelle specifique"""
    if len(parcelle_id) < 10:
        raise HTTPException(status_code=400, detail="Identifiant de parcelle invalide")

    code_insee = parcelle_id[:5]
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    # Cache key
    cache_key = f"parcelles:{code_insee}"
    cached_data = await cache_get(cache_key)

    if cached_data:
        features = cached_data.get("features", [])
    else:
        try:
            url = f"/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"
            data = await cadastre_client.get(url)
            features = data.get("features", [])
            await cache_set(cache_key, data, ttl=600)  # Cache 10 min
        except APIError:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Erreur API Cadastre: {str(e)}")

    for feature in features:
        if feature.get("properties", {}).get("id") == parcelle_id:
            return feature

    raise HTTPException(status_code=404, detail="Parcelle non trouvee")
