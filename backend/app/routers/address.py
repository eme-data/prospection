from fastapi import APIRouter, HTTPException, Query, Request
from app.http_client import ban_client, APIError
from app.security import limiter, sanitize_string
from app.logging_config import get_logger

router = APIRouter(
    prefix="/api/address",
    tags=["Adresse"]
)

logger = get_logger(__name__)

@router.get("/search")
@limiter.limit("30/minute")
async def search_address(
    request: Request,
    q: str = Query(..., min_length=3, max_length=200, description="Adresse a rechercher")
):
    """Recherche d'adresse via la Base Adresse Nationale (BAN)"""
    q = sanitize_string(q)

    try:
        data = await ban_client.get("/search/", params={"q": q, "limit": 10})

        results = []
        for feature in data.get("features", []):
            props = feature.get("properties", {})
            coords = feature.get("geometry", {}).get("coordinates", [0, 0])
            results.append({
                "label": props.get("label", ""),
                "score": props.get("score", 0),
                "housenumber": props.get("housenumber"),
                "street": props.get("street"),
                "postcode": props.get("postcode"),
                "citycode": props.get("citycode"),
                "city": props.get("city"),
                "context": props.get("context"),
                "longitude": coords[0],
                "latitude": coords[1]
            })

        return {"results": results}
    except APIError:
        raise
    except Exception as e:
        logger.exception("address_search_error", query=q)
        raise HTTPException(status_code=502, detail=f"Erreur API BAN: {str(e)}")


@router.get("/reverse")
@limiter.limit("60/minute")
async def reverse_geocode(
    request: Request,
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
    lat: float = Query(..., ge=-90, le=90, description="Latitude")
):
    """Geocodage inverse - trouve l'adresse a partir de coordonnees"""
    try:
        data = await ban_client.get("/reverse/", params={"lon": lon, "lat": lat})

        features = data.get("features", [])
        if not features:
            return {"result": None}

        feature = features[0]
        props = feature.get("properties", {})
        coords = feature.get("geometry", {}).get("coordinates", [0, 0])

        return {
            "result": {
                "label": props.get("label", ""),
                "housenumber": props.get("housenumber"),
                "street": props.get("street"),
                "postcode": props.get("postcode"),
                "citycode": props.get("citycode"),
                "city": props.get("city"),
                "longitude": coords[0],
                "latitude": coords[1]
            }
        }
    except APIError:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur API BAN: {str(e)}")
