from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request
import httpx
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


@router.get("/pois")
@limiter.limit("20/minute")
async def get_pois(
    request: Request,
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    radius: int = Query(500, le=2000, description="Rayon en mètres (max 2000)")
):
    """
    Récupère les Points d'Intérêt (POIs) aux alentours via Overpass API (OpenStreetMap)
    - Transport en commun
    - Commodités (écoles, commerces, santé)
    """
    cache_key = f"pois:{lat}:{lon}:{radius}"
    cached_data = await cache_get(cache_key)

    if cached_data:
        return cached_data

    # Overpass QL Query
    overpass_query = f"""
    [out:json][timeout:10];
    (
      node["amenity"](around:{radius},{lat},{lon});
      node["public_transport"](around:{radius},{lat},{lon});
      node["highway"="bus_stop"](around:{radius},{lat},{lon});
      way["amenity"](around:{radius},{lat},{lon});
    );
    out center;
    """

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://overpass-api.de/api/interpreter",
                data=overpass_query
            )
            response.raise_for_status()
            data = response.json()
            
            # Format minimaliste pour le frontend
            elements = data.get("elements", [])
            formatted_pois = []
            
            for el in elements:
                tags = el.get("tags", {})
                
                # Catégorisation simplifiée
                category = "other"
                amenity = tags.get("amenity")
                if amenity in ["school", "college", "kindergarten", "university"]:
                    category = "education"
                elif amenity in ["clinic", "hospital", "doctors", "pharmacy", "dentist"]:
                    category = "health"
                elif amenity in ["restaurant", "cafe", "fast_food", "bar"]:
                    category = "food"
                elif amenity in ["marketplace", "supermarket", "convenience", "bakery"]:
                    category = "shopping"
                elif "public_transport" in tags or tags.get("highway") == "bus_stop":
                    category = "transport"
                elif amenity in ["bank", "post_office", "police"]:
                    category = "services"
                elif amenity:
                    category = amenity
                else:
                    category = "transport" # Si fallback

                name = tags.get("name") or tags.get("brand") or tags.get("operator") or category

                poi = {
                    "id": el.get("id"),
                    "type": category,
                    "name": name.capitalize(),
                    "lat": el.get("lat") or el.get("center", {}).get("lat"),
                    "lon": el.get("lon") or el.get("center", {}).get("lon"),
                    "distance": None # A calculer en frontend si besoin
                }
                formatted_pois.append(poi)

            result = {"pois": formatted_pois}
            await cache_set(cache_key, result, ttl=86400) # Cache 24h (rarement modifié)
            return result

    except Exception as e:
        logger.error(f"Erreur Overpass API: {str(e)}")
        # Ne pas bloquer l'app si Overpass est down
        return {"pois": [], "error": "Service indisponible"}
