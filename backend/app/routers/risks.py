from fastapi import APIRouter, HTTPException, Query, Request
from app.http_client import georisques_client, APIError
from app.security import limiter, validate_code_insee
from app.logging_config import get_logger

router = APIRouter(
    prefix="/api/risques",
    tags=["Risques"]
)

logger = get_logger(__name__)

@router.get("/commune/{code_insee}")
@limiter.limit("20/minute")
async def get_risques_commune(request: Request, code_insee: str):
    """Recupere les risques naturels et technologiques d'une commune"""
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    try:
        data = await georisques_client.get("/gaspar/risques", params={"code_insee": code_insee})

        risques = []
        for item in data.get("data", []):
            risques.append({
                "code": item.get("code_risque"),
                "libelle": item.get("libelle_risque_long"),
                "niveau": item.get("niveau_risque"),
            })

        return {
            "code_insee": code_insee,
            "risques": risques,
            "count": len(risques)
        }
    except APIError:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur API Georisques: {str(e)}")


@router.get("/parcelle")
@limiter.limit("20/minute")
async def get_risques_parcelle(
    request: Request,
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
    lat: float = Query(..., ge=-90, le=90, description="Latitude")
):
    """Recupere les risques pour une localisation precise"""
    try:
        data = await georisques_client.get(
            "/gaspar/risques",
            params={"latlon": f"{lat},{lon}", "rayon": 1000}
        )

        risques = []
        for item in data.get("data", []):
            risques.append({
                "code": item.get("code_risque"),
                "libelle": item.get("libelle_risque_long"),
                "niveau": item.get("niveau_risque"),
                "commune": item.get("libelle_commune"),
            })

        return {
            "longitude": lon,
            "latitude": lat,
            "risques": risques,
            "count": len(risques)
        }
    except Exception:
        return {"longitude": lon, "latitude": lat, "risques": [], "count": 0}


@router.get("/inondation")
@limiter.limit("20/minute")
async def get_risques_inondation(
    request: Request,
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
    lat: float = Query(..., ge=-90, le=90, description="Latitude")
):
    """Recupere les zones inondables autour d'un point"""
    try:
        data = await georisques_client.get(
            "/gaspar/azi",
            params={"latlon": f"{lat},{lon}", "rayon": 500}
        )
        return {
            "longitude": lon,
            "latitude": lat,
            "zones_inondables": data.get("data", []),
            "count": len(data.get("data", []))
        }
    except Exception:
        return {"longitude": lon, "latitude": lat, "zones_inondables": [], "count": 0}
