"""
Router Reports
Génération de rapports PDF de prospection
"""

import io
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.config import settings
from app.logging_config import get_logger
from app.security import limiter, validate_code_insee, sanitize_string
from app.cache import cache_get, cache_set
from app.http_client import geo_client, dvf_client, cadastre_client, APIError
from app.report_generator import generate_prospection_report

router = APIRouter(prefix="/api/reports", tags=["reports"])
logger = get_logger(__name__)


@router.post("/generate")
@limiter.limit("5/minute")
async def generate_report(
    request: Request,
    project_name: str = Query(..., description="Nom du projet"),
    code_insee: str = Query(..., min_length=5, max_length=5, description="Code INSEE"),
    type_local: Optional[str] = Query(None),
    prix_min: Optional[float] = Query(None),
    prix_max: Optional[float] = Query(None),
    surface_min: Optional[float] = Query(None),
    surface_max: Optional[float] = Query(None),
    annee_min: Optional[int] = Query(None),
    annee_max: Optional[int] = Query(None),
):
    """Génère un rapport PDF de prospection"""
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    try:
        commune_data = await geo_client.get(f"/communes/{code_insee}")
        commune_name = commune_data.get("nom", code_insee)

        # Construire les paramètres de filtres
        filters_params = []
        filters = {}
        for key, val in [
            ("type_local", type_local), ("prix_min", prix_min), ("prix_max", prix_max),
            ("surface_min", surface_min), ("surface_max", surface_max),
            ("annee_min", annee_min), ("annee_max", annee_max),
        ]:
            if val is not None:
                filters_params.append(f"{key}={val}")
                filters[key] = val

        cache_key = f"stats:{code_insee}:{':'.join(filters_params)}"
        stats = await cache_get(cache_key)
        if not stats:
            query = f"code_insee={code_insee}"
            if filters_params:
                query += "&" + "&".join(filters_params)
            stats = await dvf_client.get(f"/statistiques?{query}")
            await cache_set(cache_key, stats, ttl=settings.cache_ttl)

        parcelles_data = await cadastre_client.get(
            f"/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"
        )
        parcelles = parcelles_data.get("features", [])[:100]

        pdf_content = generate_prospection_report(
            project_name=project_name,
            code_insee=code_insee,
            commune_name=commune_name,
            stats=stats,
            parcelles=parcelles,
            filters=filters if filters else None,
        )

        filename = f"rapport_{sanitize_string(project_name)}_{code_insee}.pdf"
        return StreamingResponse(
            io.BytesIO(pdf_content),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except APIError:
        raise
    except Exception as e:
        logger.error("report_generation_error", error=str(e), code_insee=code_insee)
        raise HTTPException(status_code=500, detail=f"Erreur génération rapport: {str(e)}")
