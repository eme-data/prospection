from fastapi import APIRouter, Query, Request
from app.http_client import gpu_client
from app.security import limiter
from app.logging_config import get_logger

router = APIRouter(
    prefix="/api/urbanisme",
    tags=["Urbanisme"]
)

logger = get_logger(__name__)

@router.get("/zonage")
@limiter.limit("20/minute")
async def get_zonage_plu(
    request: Request,
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
    lat: float = Query(..., ge=-90, le=90, description="Latitude")
):
    """Recupere le zonage PLU/PLUi pour une localisation"""
    try:
        geom = f"POINT({lon} {lat})"
        data = await gpu_client.get("/zone-urba", params={"geom": geom})

        zones = []
        for feature in data.get("features", []):
            props = feature.get("properties", {})
            zones.append({
                "libelle": props.get("libelle"),
                "libelong": props.get("libelong"),
                "typezone": props.get("typezone"),
                "destdomi": props.get("destdomi"),
                "nomfic": props.get("nomfic"),
                "urlfic": props.get("urlfic"),
                "partition": props.get("partition"),
            })

        return {"longitude": lon, "latitude": lat, "zonages": zones, "count": len(zones)}
    except Exception:
        return {"longitude": lon, "latitude": lat, "zonages": [], "count": 0}


@router.get("/prescriptions")
@limiter.limit("20/minute")
async def get_prescriptions_plu(
    request: Request,
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
    lat: float = Query(..., ge=-90, le=90, description="Latitude")
):
    """Recupere les prescriptions PLU pour une localisation"""
    try:
        geom = f"POINT({lon} {lat})"
        data = await gpu_client.get("/prescription-surf", params={"geom": geom})

        prescriptions = []
        for feature in data.get("features", []):
            props = feature.get("properties", {})
            prescriptions.append({
                "libelle": props.get("libelle"),
                "txt": props.get("txt"),
                "typepsc": props.get("typepsc"),
                "stypepsc": props.get("stypepsc"),
                "nomfic": props.get("nomfic"),
                "urlfic": props.get("urlfic"),
            })

        return {"longitude": lon, "latitude": lat, "prescriptions": prescriptions, "count": len(prescriptions)}
    except Exception:
        return {"longitude": lon, "latitude": lat, "prescriptions": [], "count": 0}
