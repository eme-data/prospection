"""
API de Prospection Fonciere - Version Production
Agregue les donnees opendata francaises pour la prospection fonciere
"""

from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional
import csv
import io
import json

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.logging_config import setup_logging, get_logger
from app.security import (
    limiter,
    rate_limit_exceeded_handler,
    SecurityHeadersMiddleware,
    RequestLoggingMiddleware,
    validate_code_insee,
    validate_coordinates,
    sanitize_string,
)
from app.health import router as health_router
from app.cache import cached, cache_get, cache_set
from app.http_client import (
    ban_client,
    cadastre_client,
    geo_client,
    dvf_client,
    georisques_client,
    gpu_client,
    APIError,
)

# Configuration du logging
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestion du cycle de vie de l'application"""
    logger.info(
        "application_starting",
        environment=settings.environment,
        version=settings.app_version,
    )
    yield
    logger.info("application_stopping")


# Application FastAPI
app = FastAPI(
    title=settings.app_name,
    description="API pour la prospection fonciere utilisant les donnees opendata francaises",
    version=settings.app_version,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    max_age=86400,
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# Routes de sante
app.include_router(health_router)


# ============== GESTION DES ERREURS ==============

@app.exception_handler(APIError)
async def api_error_handler(request: Request, exc: APIError):
    """Handler pour les erreurs d'API externes"""
    logger.error(
        "external_api_error",
        api=exc.api_name,
        status_code=exc.status_code,
        message=exc.message,
        path=request.url.path,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "Erreur de service externe",
            "detail": exc.message,
            "api": exc.api_name,
        }
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handler global pour les erreurs non gerees"""
    logger.exception(
        "unhandled_exception",
        path=request.url.path,
        error=str(exc),
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "Erreur interne du serveur",
            "detail": "Une erreur inattendue s'est produite" if settings.is_production else str(exc),
        }
    )


# ============== ENDPOINTS PRINCIPAUX ==============

@app.get("/")
async def root():
    """Point d'entree de l'API"""
    return {
        "message": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "documentation": "/docs" if settings.debug else "Disabled in production",
    }


@app.get("/api/address/search")
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


@app.get("/api/address/reverse")
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


@app.get("/api/cadastre/parcelles")
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
        "features": features[:100]
    }


@app.get("/api/cadastre/parcelle/{parcelle_id}")
@limiter.limit("30/minute")
async def get_parcelle_detail(request: Request, parcelle_id: str):
    """Recupere les details d'une parcelle specifique"""
    if len(parcelle_id) < 10:
        raise HTTPException(status_code=400, detail="Identifiant de parcelle invalide")

    code_insee = parcelle_id[:5]
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    try:
        url = f"/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"
        data = await cadastre_client.get(url)

        for feature in data.get("features", []):
            if feature.get("properties", {}).get("id") == parcelle_id:
                return feature

        raise HTTPException(status_code=404, detail="Parcelle non trouvee")
    except APIError:
        raise
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur API Cadastre: {str(e)}")


@app.get("/api/dvf/transactions")
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


@app.get("/api/geo/communes")
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


@app.get("/api/geo/commune/{code_insee}")
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


@app.get("/api/geo/departements")
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


# ============== RISQUES NATURELS ==============

@app.get("/api/risques/commune/{code_insee}")
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


@app.get("/api/risques/parcelle")
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


@app.get("/api/risques/inondation")
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


# ============== PLU / URBANISME ==============

@app.get("/api/urbanisme/zonage")
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


@app.get("/api/urbanisme/prescriptions")
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


# ============== STATISTIQUES DVF ==============

@app.get("/api/dvf/statistiques")
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


# ============== EXPORT DES DONNEES ==============

@app.get("/api/export/dvf/csv")
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


@app.get("/api/export/dvf/geojson")
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


@app.get("/api/export/parcelles/geojson")
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
