import csv
import io
import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from app.http_client import dvf_client, cadastre_client, APIError
from app.security import limiter, validate_code_insee
from app.logging_config import get_logger

router = APIRouter(
    prefix="/api/export",
    tags=["Export"]
)

logger = get_logger(__name__)

@router.get("/dvf/csv")
@limiter.limit("5/minute")
async def export_dvf_csv(
    request: Request,
    code_insee: str = Query(..., min_length=5, max_length=5, description="Code INSEE"),
    type_local: Optional[str] = Query(None, description="Filtrer par type de local"),
    prix_min: Optional[float] = Query(None, ge=0, description="Prix minimum"),
    prix_max: Optional[float] = Query(None, ge=0, description="Prix maximum"),
    surface_min: Optional[float] = Query(None, ge=0, description="Surface minimum"),
    surface_max: Optional[float] = Query(None, ge=0, description="Surface maximum")
):
    """Exporte les transactions DVF en CSV avec filtres"""
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    try:
        data = await dvf_client.get("", params={"code_commune": code_insee})
        transactions = data.get("resultats", [])

        # Filtrage
        if type_local:
            transactions = [t for t in transactions if t.get("type_local") == type_local]
        if prix_min is not None:
            transactions = [t for t in transactions if (t.get("valeur_fonciere") or 0) >= prix_min]
        if prix_max is not None:
            transactions = [t for t in transactions if (t.get("valeur_fonciere") or 0) <= prix_max]
        if surface_min is not None:
            transactions = [t for t in transactions if (t.get("surface_reelle_bati") or 0) >= surface_min]
        if surface_max is not None:
            transactions = [t for t in transactions if (t.get("surface_reelle_bati") or 0) <= surface_max]

        # Generation CSV
        output = io.StringIO()
        writer = csv.writer(output, delimiter=';')
        writer.writerow([
            "Date mutation", "Nature mutation", "Valeur fonciere", "Adresse",
            "Code postal", "Commune", "Type local", "Surface bati",
            "Nombre pieces", "Surface terrain", "Longitude", "Latitude", "Prix m2"
        ])

        for t in transactions:
            valeur = t.get("valeur_fonciere", 0) or 0
            surface = t.get("surface_reelle_bati", 0) or 0
            prix_m2 = round(valeur / surface, 2) if surface > 0 else ""

            writer.writerow([
                t.get("date_mutation", ""), t.get("nature_mutation", ""), valeur,
                t.get("adresse_nom_voie", ""), t.get("code_postal", ""),
                t.get("nom_commune", ""), t.get("type_local", ""), surface,
                t.get("nombre_pieces_principales", ""), t.get("surface_terrain", ""),
                t.get("longitude", ""), t.get("latitude", ""), prix_m2
            ])

        output.seek(0)
        filename = f"dvf_{code_insee}_{datetime.now().strftime('%Y%m%d')}.csv"

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except APIError:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur API DVF: {str(e)}")


@router.get("/dvf/geojson")
@limiter.limit("5/minute")
async def export_dvf_geojson(
    request: Request,
    code_insee: str = Query(..., min_length=5, max_length=5, description="Code INSEE"),
    type_local: Optional[str] = Query(None, description="Filtrer par type de local"),
    prix_min: Optional[float] = Query(None, ge=0, description="Prix minimum"),
    prix_max: Optional[float] = Query(None, ge=0, description="Prix maximum")
):
    """Exporte les transactions DVF en GeoJSON"""
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    try:
        data = await dvf_client.get("", params={"code_commune": code_insee})
        transactions = data.get("resultats", [])

        if type_local:
            transactions = [t for t in transactions if t.get("type_local") == type_local]
        if prix_min is not None:
            transactions = [t for t in transactions if (t.get("valeur_fonciere") or 0) >= prix_min]
        if prix_max is not None:
            transactions = [t for t in transactions if (t.get("valeur_fonciere") or 0) <= prix_max]

        features = []
        for t in transactions:
            if t.get("longitude") and t.get("latitude"):
                valeur = t.get("valeur_fonciere", 0) or 0
                surface = t.get("surface_reelle_bati", 0) or 0
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [float(t["longitude"]), float(t["latitude"])]},
                    "properties": {
                        "date_mutation": t.get("date_mutation"),
                        "valeur_fonciere": valeur,
                        "type_local": t.get("type_local"),
                        "surface_reelle_bati": surface,
                        "prix_m2": round(valeur / surface, 2) if surface > 0 else None
                    }
                })

        geojson = {"type": "FeatureCollection", "features": features}
        filename = f"dvf_{code_insee}_{datetime.now().strftime('%Y%m%d')}.geojson"

        return StreamingResponse(
            iter([json.dumps(geojson, ensure_ascii=False, indent=2)]),
            media_type="application/geo+json",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except APIError:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur API DVF: {str(e)}")


@router.get("/parcelles/geojson")
@limiter.limit("5/minute")
async def export_parcelles_geojson(
    request: Request,
    code_insee: str = Query(..., min_length=5, max_length=5, description="Code INSEE"),
    section: Optional[str] = Query(None, max_length=10, description="Section cadastrale")
):
    """Exporte les parcelles cadastrales en GeoJSON"""
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    try:
        url = f"/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"
        data = await cadastre_client.get(url)
        features = data.get("features", [])

        if section:
            features = [f for f in features if f.get("properties", {}).get("section", "").upper() == section.upper()]

        geojson = {"type": "FeatureCollection", "features": features}
        section_suffix = f"_{section}" if section else ""
        filename = f"parcelles_{code_insee}{section_suffix}.geojson"

        return StreamingResponse(
            iter([json.dumps(geojson, ensure_ascii=False)]),
            media_type="application/geo+json",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except APIError:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur API Cadastre: {str(e)}")
