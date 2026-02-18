from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request
from app.http_client import dvf_client, APIError
from app.security import limiter, validate_code_insee
from app.logging_config import get_logger

router = APIRouter(
    prefix="/api/dvf",
    tags=["DVF"]
)

logger = get_logger(__name__)

@router.get("/transactions")
@limiter.limit("20/minute")
async def get_dvf_transactions(
    request: Request,
    code_insee: Optional[str] = Query(None, min_length=5, max_length=5, description="Code INSEE de la commune"),
    lon: Optional[float] = Query(None, ge=-180, le=180, description="Longitude du centre"),
    lat: Optional[float] = Query(None, ge=-90, le=90, description="Latitude du centre"),
    rayon: int = Query(500, ge=100, le=5000, description="Rayon de recherche en metres")
):
    """Recupere les transactions DVF (Demandes de Valeurs Foncieres)"""
    params = {}

    if code_insee:
        if not validate_code_insee(code_insee):
            raise HTTPException(status_code=400, detail="Code INSEE invalide")
        params["code_commune"] = code_insee
    elif lon is not None and lat is not None:
        params["lon"] = lon
        params["lat"] = lat
        params["dist"] = rayon
    else:
        raise HTTPException(
            status_code=400,
            detail="Veuillez fournir soit un code_insee, soit des coordonnees (lon, lat)"
        )

    try:
        data = await dvf_client.get("", params=params)

        features = []
        for transaction in data.get("resultats", [])[:200]:
            if transaction.get("longitude") and transaction.get("latitude"):
                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [
                            float(transaction.get("longitude", 0)),
                            float(transaction.get("latitude", 0))
                        ]
                    },
                    "properties": {
                        "date_mutation": transaction.get("date_mutation"),
                        "nature_mutation": transaction.get("nature_mutation"),
                        "valeur_fonciere": transaction.get("valeur_fonciere"),
                        "adresse": transaction.get("adresse_nom_voie"),
                        "code_postal": transaction.get("code_postal"),
                        "commune": transaction.get("nom_commune"),
                        "type_local": transaction.get("type_local"),
                        "surface_reelle_bati": transaction.get("surface_reelle_bati"),
                        "nombre_pieces": transaction.get("nombre_pieces_principales"),
                        "surface_terrain": transaction.get("surface_terrain")
                    }
                })

        return {
            "type": "FeatureCollection",
            "features": features,
            "count": len(features)
        }
    except APIError:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur API DVF: {str(e)}")


@router.get("/statistiques")
@limiter.limit("10/minute")
async def get_dvf_statistiques(
    request: Request,
    code_insee: str = Query(..., min_length=5, max_length=5, description="Code INSEE de la commune"),
    type_local: Optional[str] = Query(None, max_length=100, description="Type de local"),
    annee_min: Optional[int] = Query(None, ge=2014, le=2030, description="Annee minimum"),
    annee_max: Optional[int] = Query(None, ge=2014, le=2030, description="Annee maximum")
):
    """Calcule les statistiques des transactions DVF pour une commune"""
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    try:
        data = await dvf_client.get("", params={"code_commune": code_insee})
        transactions = data.get("resultats", [])

        # Filtrage
        if type_local:
            transactions = [t for t in transactions if t.get("type_local") == type_local]

        if annee_min or annee_max:
            filtered = []
            for t in transactions:
                date_str = t.get("date_mutation", "")
                if date_str:
                    try:
                        annee = int(date_str[:4])
                        if annee_min and annee < annee_min:
                            continue
                        if annee_max and annee > annee_max:
                            continue
                        filtered.append(t)
                    except (ValueError, IndexError):
                        continue
            transactions = filtered

        if not transactions:
            return {"code_insee": code_insee, "nb_transactions": 0, "statistiques": None}

        valeurs = [t.get("valeur_fonciere", 0) for t in transactions if t.get("valeur_fonciere")]
        surfaces = [t.get("surface_reelle_bati", 0) for t in transactions if t.get("surface_reelle_bati")]
        prix_m2 = []

        for t in transactions:
            val = t.get("valeur_fonciere", 0)
            surf = t.get("surface_reelle_bati", 0)
            if val and surf and surf > 0:
                prix_m2.append(val / surf)

        # Stats par annee
        par_annee = {}
        for t in transactions:
            date_str = t.get("date_mutation", "")
            if date_str:
                try:
                    annee = date_str[:4]
                    if annee not in par_annee:
                        par_annee[annee] = {"nb": 0, "valeurs": [], "prix_m2": []}
                    par_annee[annee]["nb"] += 1
                    if t.get("valeur_fonciere"):
                        par_annee[annee]["valeurs"].append(t["valeur_fonciere"])
                    if t.get("valeur_fonciere") and t.get("surface_reelle_bati") and t["surface_reelle_bati"] > 0:
                        par_annee[annee]["prix_m2"].append(t["valeur_fonciere"] / t["surface_reelle_bati"])
                except (ValueError, IndexError):
                    continue

        evolution = []
        for annee in sorted(par_annee.keys()):
            stats = par_annee[annee]
            evolution.append({
                "annee": annee,
                "nb_transactions": stats["nb"],
                "prix_moyen": sum(stats["valeurs"]) / len(stats["valeurs"]) if stats["valeurs"] else None,
                "prix_m2_moyen": sum(stats["prix_m2"]) / len(stats["prix_m2"]) if stats["prix_m2"] else None,
            })

        types_count = {}
        for t in transactions:
            type_bien = t.get("type_local", "Autre") or "Autre"
            types_count[type_bien] = types_count.get(type_bien, 0) + 1

        return {
            "code_insee": code_insee,
            "nb_transactions": len(transactions),
            "statistiques": {
                "prix_min": min(valeurs) if valeurs else None,
                "prix_max": max(valeurs) if valeurs else None,
                "prix_moyen": sum(valeurs) / len(valeurs) if valeurs else None,
                "prix_median": sorted(valeurs)[len(valeurs) // 2] if valeurs else None,
                "surface_moyenne": sum(surfaces) / len(surfaces) if surfaces else None,
                "prix_m2_moyen": sum(prix_m2) / len(prix_m2) if prix_m2 else None,
                "prix_m2_min": min(prix_m2) if prix_m2 else None,
                "prix_m2_max": max(prix_m2) if prix_m2 else None,
            },
            "evolution": evolution,
            "repartition_types": types_count
        }
    except APIError:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur API DVF: {str(e)}")
