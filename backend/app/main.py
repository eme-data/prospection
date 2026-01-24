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
from app.report_generator import generate_prospection_report
from app.scoring import scorer
from app.prospection import prospection_manager
from app.fiches import fiches_manager
from app.search import create_search_engine
from app.activity import activity_manager, Activity
from app.insee import insee_manager, InseeData, TerritoryStats, InseeIndicator

# Configuration du logging
setup_logging()
logger = get_logger(__name__)

# Créer le moteur de recherche
search_engine = create_search_engine(scorer, prospection_manager, fiches_manager)


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


@app.get("/api/enrichissement/demographics/{code_insee}")
@limiter.limit("30/minute")
async def get_demographics(request: Request, code_insee: str):
    """Récupère les données démographiques d'une commune"""
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    cache_key = f"demographics:{code_insee}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    try:
        # Récupérer les données de la commune
        commune_data = await geo_client.get(f"/communes/{code_insee}?fields=nom,code,population,surface,codesPostaux,centre,departement")

        result = {
            "code_insee": code_insee,
            "nom": commune_data.get("nom", ""),
            "population": commune_data.get("population", 0),
            "surface_km2": round(commune_data.get("surface", 0) / 100, 2),
            "densite": round(commune_data.get("population", 0) / (commune_data.get("surface", 1) / 100), 1) if commune_data.get("surface") else 0,
            "codes_postaux": commune_data.get("codesPostaux", []),
            "departement": commune_data.get("departement", {}),
        }

        await cache_set(cache_key, result, ttl=3600)
        return result
    except APIError:
        raise
    except Exception as e:
        logger.error("demographics_error", error=str(e), code_insee=code_insee)
        raise HTTPException(status_code=500, detail=f"Erreur démographiques: {str(e)}")


@app.get("/api/enrichissement/aerial-photos")
@limiter.limit("20/minute")
async def get_aerial_photos(
    request: Request,
    lon: float = Query(..., ge=-180, le=180),
    lat: float = Query(..., ge=-90, le=90),
):
    """Récupère les informations sur les photos aériennes disponibles"""
    if not validate_coordinates(lon, lat):
        raise HTTPException(status_code=400, detail="Coordonnées invalides")

    result = {
        "longitude": lon,
        "latitude": lat,
        "wms_url": "https://data.geopf.fr/wms-r",
        "tile_url": f"https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={{z}}&TILEROW={{y}}&TILECOL={{x}}&FORMAT=image/jpeg",
    }
    return result


@app.get("/api/enrichissement/potential/{code_insee}")
@limiter.limit("30/minute")
async def get_development_potential(request: Request, code_insee: str):
    """Calcule le potentiel de développement d'une commune"""
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    cache_key = f"potential:{code_insee}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    try:
        commune_data = await geo_client.get(f"/communes/{code_insee}?fields=nom,population,surface")
        dvf_stats_url = f"/dvf?code_insee={code_insee}"
        dvf_stats = await dvf_client.get(f"/statistiques?{dvf_stats_url.split('?')[1]}")

        score = 0
        factors = []

        nb_transactions = dvf_stats.get("nb_transactions", 0)
        if nb_transactions > 100:
            score += 30
            factors.append({"name": "Marché très actif", "score": 30})
        elif nb_transactions > 50:
            score += 20
            factors.append({"name": "Marché actif", "score": 20})

        evolution = dvf_stats.get("evolution", [])
        if len(evolution) >= 2:
            recent = evolution[-1].get("prix_moyen")
            previous = evolution[-2].get("prix_moyen")
            if recent and previous:
                growth = ((recent - previous) / previous) * 100
                if growth > 5:
                    score += 25
                    factors.append({"name": "Forte hausse", "score": 25})

        max_score = 55
        normalized = min(100, int((score / max_score) * 100)) if max_score > 0 else 0

        level = "excellent" if normalized >= 75 else "good" if normalized >= 60 else "moderate" if normalized >= 40 else "limited"
        color = "#10b981" if level == "excellent" else "#3b82f6" if level == "good" else "#f59e0b" if level == "moderate" else "#ef4444"

        result = {
            "code_insee": code_insee,
            "commune": commune_data.get("nom", ""),
            "score": normalized,
            "level": level,
            "color": color,
            "factors": factors,
        }

        await cache_set(cache_key, result, ttl=3600)
        return result
    except APIError:
        raise
    except Exception as e:
        logger.error("potential_error", error=str(e), code_insee=code_insee)
        raise HTTPException(status_code=500, detail=f"Erreur potentiel: {str(e)}")


@app.post("/api/reports/generate")
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
        # Récupérer le nom de la commune
        commune_data = await geo_client.get(f"/communes/{code_insee}")
        commune_name = commune_data.get('nom', code_insee)

        # Récupérer les statistiques
        cache_key = f"stats:{code_insee}:{type_local}:{prix_min}:{prix_max}:{surface_min}:{surface_max}:{annee_min}:{annee_max}"
        stats = await cache_get(cache_key)

        if not stats:
            url = f"/dvf?code_insee={code_insee}"
            filters_params = []
            if type_local:
                filters_params.append(f"type_local={type_local}")
            if prix_min:
                filters_params.append(f"prix_min={prix_min}")
            if prix_max:
                filters_params.append(f"prix_max={prix_max}")
            if surface_min:
                filters_params.append(f"surface_min={surface_min}")
            if surface_max:
                filters_params.append(f"surface_max={surface_max}")
            if annee_min:
                filters_params.append(f"annee_min={annee_min}")
            if annee_max:
                filters_params.append(f"annee_max={annee_max}")

            if filters_params:
                url += "&" + "&".join(filters_params)

            stats = await dvf_client.get(f"/statistiques?{url.split('?')[1]}")
            await cache_set(cache_key, stats, ttl=settings.cache_ttl)

        # Récupérer les parcelles
        parcelles_data = await cadastre_client.get(f"/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles")
        parcelles = parcelles_data.get('features', [])[:100]  # Limiter à 100 parcelles

        # Préparer les filtres pour le rapport
        filters = {}
        if type_local:
            filters['typeLocal'] = type_local
        if prix_min:
            filters['prixMin'] = prix_min
        if prix_max:
            filters['prixMax'] = prix_max
        if surface_min:
            filters['surfaceMin'] = surface_min
        if surface_max:
            filters['surfaceMax'] = surface_max
        if annee_min:
            filters['anneeMin'] = annee_min
        if annee_max:
            filters['anneeMax'] = annee_max

        # Générer le PDF
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
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except APIError:
        raise
    except Exception as e:
        logger.error("report_generation_error", error=str(e), code_insee=code_insee)
        raise HTTPException(status_code=500, detail=f"Erreur lors de la génération du rapport: {str(e)}")


# ============== PHASE 1 : SCORING DES PARCELLES ==============

@app.get("/api/scoring/parcelle/{parcelle_id}")
@limiter.limit("60/minute")
async def score_parcelle(
    request: Request,
    parcelle_id: str,
    code_insee: str = Query(..., min_length=5, max_length=5)
):
    """Calcule le score d'une parcelle spécifique"""
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    try:
        # Récupérer les données de la parcelle
        parcelles_data = await cadastre_client.get(
            f"/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"
        )
        parcelles = parcelles_data.get('features', [])

        parcelle = next(
            (p for p in parcelles if p.get('properties', {}).get('id') == parcelle_id),
            None
        )

        if not parcelle:
            raise HTTPException(status_code=404, detail="Parcelle non trouvée")

        # Récupérer les données de contexte
        stats_marche = await cache_get(f"stats:{code_insee}")
        if not stats_marche:
            dvf_stats_url = f"/dvf?code_insee={code_insee}"
            stats_marche = await dvf_client.get(f"/statistiques?{dvf_stats_url.split('?')[1]}")
            await cache_set(f"stats:{code_insee}", stats_marche, ttl=3600)

        demographics = await cache_get(f"demographics:{code_insee}")
        if not demographics:
            commune_data = await geo_client.get(
                f"/communes/{code_insee}?fields=nom,code,population,surface"
            )
            demographics = {
                "population": commune_data.get("population", 0),
                "surface_km2": commune_data.get("surface", 0) / 100,
                "densite": commune_data.get("population", 0) / (commune_data.get("surface", 1) / 100)
            }
            await cache_set(f"demographics:{code_insee}", demographics, ttl=3600)

        # Récupérer les transactions
        transactions_data = await dvf_client.get(f"/dvf?code_insee={code_insee}")
        transactions = transactions_data.get('resultats', [])

        # Calculer le score
        score_result = scorer.calculate_score(
            parcelle=parcelle,
            stats_marche=stats_marche,
            demographics=demographics,
            transactions=transactions
        )

        return score_result

    except APIError:
        raise
    except Exception as e:
        logger.error("scoring_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur scoring: {str(e)}")


@app.post("/api/scoring/batch")
@limiter.limit("30/minute")
async def score_parcelles_batch(
    request: Request,
    body: dict
):
    """Calcule les scores de plusieurs parcelles"""
    parcelle_ids = body.get('parcelle_ids', [])
    code_insee = body.get('code_insee')

    if not code_insee or not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    if len(parcelle_ids) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 parcelles par requête")

    try:
        # Récupérer toutes les parcelles
        parcelles_data = await cadastre_client.get(
            f"/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"
        )
        all_parcelles = parcelles_data.get('features', [])

        # Filtrer les parcelles demandées
        parcelles = [
            p for p in all_parcelles
            if p.get('properties', {}).get('id') in parcelle_ids
        ]

        # Récupérer les données de contexte (une seule fois)
        stats_marche = await cache_get(f"stats:{code_insee}")
        if not stats_marche:
            dvf_stats_url = f"/dvf?code_insee={code_insee}"
            stats_marche = await dvf_client.get(f"/statistiques?{dvf_stats_url.split('?')[1]}")
            await cache_set(f"stats:{code_insee}", stats_marche, ttl=3600)

        demographics = await cache_get(f"demographics:{code_insee}")
        if not demographics:
            commune_data = await geo_client.get(
                f"/communes/{code_insee}?fields=nom,code,population,surface"
            )
            demographics = {
                "population": commune_data.get("population", 0),
                "surface_km2": commune_data.get("surface", 0) / 100,
                "densite": commune_data.get("population", 0) / (commune_data.get("surface", 1) / 100)
            }
            await cache_set(f"demographics:{code_insee}", demographics, ttl=3600)

        transactions_data = await dvf_client.get(f"/dvf?code_insee={code_insee}")
        transactions = transactions_data.get('resultats', [])

        # Calculer le score pour chaque parcelle
        scores = []
        for parcelle in parcelles:
            score_result = scorer.calculate_score(
                parcelle=parcelle,
                stats_marche=stats_marche,
                demographics=demographics,
                transactions=transactions
            )
            scores.append(score_result)

        return {
            "scores": scores,
            "total": len(scores),
            "code_insee": code_insee
        }

    except APIError:
        raise
    except Exception as e:
        logger.error("batch_scoring_error", error=str(e), code_insee=code_insee)
        raise HTTPException(status_code=500, detail=f"Erreur batch scoring: {str(e)}")


@app.get("/api/scoring/commune/{code_insee}")
@limiter.limit("10/minute")
async def score_commune(request: Request, code_insee: str, limit: int = Query(50, le=200)):
    """Calcule et retourne les parcelles scorées d'une commune, triées par score décroissant"""
    if not validate_code_insee(code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")

    cache_key = f"commune_scores:{code_insee}:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    try:
        # Récupérer les parcelles
        parcelles_data = await cadastre_client.get(
            f"/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"
        )
        parcelles = parcelles_data.get('features', [])[:limit]

        # Récupérer les données de contexte
        stats_marche = await cache_get(f"stats:{code_insee}")
        if not stats_marche:
            dvf_stats_url = f"/dvf?code_insee={code_insee}"
            stats_marche = await dvf_client.get(f"/statistiques?{dvf_stats_url.split('?')[1]}")
            await cache_set(f"stats:{code_insee}", stats_marche, ttl=3600)

        demographics = await cache_get(f"demographics:{code_insee}")
        if not demographics:
            commune_data = await geo_client.get(
                f"/communes/{code_insee}?fields=nom,code,population,surface"
            )
            demographics = {
                "population": commune_data.get("population", 0),
                "surface_km2": commune_data.get("surface", 0) / 100,
                "densite": commune_data.get("population", 0) / (commune_data.get("surface", 1) / 100)
            }
            await cache_set(f"demographics:{code_insee}", demographics, ttl=3600)

        transactions_data = await dvf_client.get(f"/dvf?code_insee={code_insee}")
        transactions = transactions_data.get('resultats', [])

        # Calculer les scores
        scores = []
        for parcelle in parcelles:
            score_result = scorer.calculate_score(
                parcelle=parcelle,
                stats_marche=stats_marche,
                demographics=demographics,
                transactions=transactions
            )
            scores.append({
                "parcelle": parcelle,
                "score": score_result
            })

        # Trier par score décroissant
        scores.sort(key=lambda x: x['score']['score'], reverse=True)

        result = {
            "code_insee": code_insee,
            "total_parcelles": len(scores),
            "parcelles_scorees": scores,
            "stats": {
                "score_moyen": sum(s['score']['score'] for s in scores) / len(scores) if scores else 0,
                "excellent": sum(1 for s in scores if s['score']['niveau'] == 'excellent'),
                "bon": sum(1 for s in scores if s['score']['niveau'] == 'bon'),
                "moyen": sum(1 for s in scores if s['score']['niveau'] == 'moyen'),
                "faible": sum(1 for s in scores if s['score']['niveau'] == 'faible'),
            }
        }

        await cache_set(cache_key, result, ttl=1800)  # Cache 30 min
        return result

    except APIError:
        raise
    except Exception as e:
        logger.error("commune_scoring_error", error=str(e), code_insee=code_insee)
        raise HTTPException(status_code=500, detail=f"Erreur scoring commune: {str(e)}")


# ============== PROSPECTION ENDPOINTS ==============

@app.get("/api/prospection/{parcelle_id}")
@limiter.limit("30/minute")
async def get_prospection(request: Request, parcelle_id: str):
    """Récupère les informations de prospection d'une parcelle"""
    parcelle_id = sanitize_string(parcelle_id)

    prospection = prospection_manager.get_prospection(parcelle_id)

    if not prospection:
        raise HTTPException(status_code=404, detail="Prospection non trouvée")

    return prospection


@app.post("/api/prospection")
@limiter.limit("20/minute")
async def create_prospection(request: Request):
    """Crée une nouvelle fiche de prospection"""
    try:
        body = await request.json()
        parcelle_id = sanitize_string(body.get('parcelleId', ''))

        if not parcelle_id:
            raise HTTPException(status_code=400, detail="parcelleId requis")

        # Vérifier si existe déjà
        existing = prospection_manager.get_prospection(parcelle_id)
        if existing:
            raise HTTPException(status_code=409, detail="Prospection déjà existante")

        statut = body.get('statut', 'a_prospecter')
        notes_contact = sanitize_string(body.get('notesContact', ''))
        interlocuteur = sanitize_string(body.get('interlocuteur', '')) if body.get('interlocuteur') else None
        telephone = sanitize_string(body.get('telephone', '')) if body.get('telephone') else None
        email = sanitize_string(body.get('email', '')) if body.get('email') else None

        prospection = prospection_manager.create_prospection(
            parcelle_id=parcelle_id,
            statut=statut,
            notes_contact=notes_contact,
            interlocuteur=interlocuteur,
            telephone=telephone,
            email=email
        )

        logger.info("prospection_created", parcelle_id=parcelle_id, statut=statut)
        return prospection

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("create_prospection_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur création prospection: {str(e)}")


@app.put("/api/prospection/{parcelle_id}/statut")
@limiter.limit("30/minute")
async def update_statut(request: Request, parcelle_id: str):
    """Met à jour le statut d'une prospection"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        body = await request.json()

        nouveau_statut = body.get('statut')
        if not nouveau_statut:
            raise HTTPException(status_code=400, detail="statut requis")

        notes = sanitize_string(body.get('notes', ''))
        date_contact = body.get('dateContact')
        date_relance = body.get('dateRelance')

        prospection = prospection_manager.update_statut(
            parcelle_id=parcelle_id,
            nouveau_statut=nouveau_statut,
            notes=notes,
            date_contact=date_contact,
            date_relance=date_relance
        )

        logger.info("prospection_statut_updated", parcelle_id=parcelle_id, statut=nouveau_statut)
        return prospection

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("update_statut_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur mise à jour statut: {str(e)}")


@app.put("/api/prospection/{parcelle_id}/contact")
@limiter.limit("30/minute")
async def update_contact(request: Request, parcelle_id: str):
    """Met à jour les informations de contact d'une prospection"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        body = await request.json()

        interlocuteur = sanitize_string(body.get('interlocuteur', '')) if body.get('interlocuteur') else None
        telephone = sanitize_string(body.get('telephone', '')) if body.get('telephone') else None
        email = sanitize_string(body.get('email', '')) if body.get('email') else None
        notes = sanitize_string(body.get('notes', '')) if body.get('notes') else None

        prospection = prospection_manager.update_contact_info(
            parcelle_id=parcelle_id,
            interlocuteur=interlocuteur,
            telephone=telephone,
            email=email,
            notes=notes
        )

        logger.info("prospection_contact_updated", parcelle_id=parcelle_id)
        return prospection

    except Exception as e:
        logger.error("update_contact_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur mise à jour contact: {str(e)}")


@app.post("/api/prospection/{parcelle_id}/notes")
@limiter.limit("30/minute")
async def add_note(request: Request, parcelle_id: str):
    """Ajoute une note à l'historique de prospection"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        body = await request.json()

        notes = sanitize_string(body.get('notes', ''))
        if not notes:
            raise HTTPException(status_code=400, detail="notes requis")

        prospection = prospection_manager.add_note(parcelle_id=parcelle_id, notes=notes)

        logger.info("prospection_note_added", parcelle_id=parcelle_id)
        return prospection

    except Exception as e:
        logger.error("add_note_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur ajout note: {str(e)}")


@app.delete("/api/prospection/{parcelle_id}")
@limiter.limit("10/minute")
async def delete_prospection(request: Request, parcelle_id: str):
    """Supprime une fiche de prospection"""
    try:
        parcelle_id = sanitize_string(parcelle_id)

        deleted = prospection_manager.delete_prospection(parcelle_id)

        if not deleted:
            raise HTTPException(status_code=404, detail="Prospection non trouvée")

        logger.info("prospection_deleted", parcelle_id=parcelle_id)
        return {"success": True, "message": "Prospection supprimée"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("delete_prospection_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur suppression: {str(e)}")


@app.get("/api/prospection")
@limiter.limit("20/minute")
async def list_prospections(
    request: Request,
    statut: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0)
):
    """Liste toutes les prospections avec filtres optionnels"""
    try:
        if statut and statut not in prospection_manager.STATUTS:
            raise HTTPException(status_code=400, detail=f"Statut invalide: {statut}")

        prospections = prospection_manager.get_all_prospections(
            statut=statut,
            limit=limit,
            offset=offset
        )

        return {
            "prospections": prospections,
            "count": len(prospections),
            "limit": limit,
            "offset": offset,
            "statut_filter": statut
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("list_prospections_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur listage: {str(e)}")


@app.get("/api/prospection/stats/global")
@limiter.limit("20/minute")
async def get_prospection_stats(request: Request):
    """Récupère les statistiques globales de prospection"""
    try:
        stats = prospection_manager.get_stats()
        return stats

    except Exception as e:
        logger.error("prospection_stats_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur stats: {str(e)}")


# ============== FICHES TERRAIN ENRICHIES ==============

@app.get("/api/fiches/{parcelle_id}")
@limiter.limit("30/minute")
async def get_fiche(request: Request, parcelle_id: str):
    """Récupère la fiche terrain enrichie d'une parcelle"""
    parcelle_id = sanitize_string(parcelle_id)

    fiche = fiches_manager.get_fiche(parcelle_id)

    if not fiche:
        # Retourner une fiche vide
        return {
            'parcelleId': parcelle_id,
            'photos': [],
            'documents': [],
            'notes': [],
            'tags': [],
        }

    return fiche


@app.post("/api/fiches/{parcelle_id}/photos")
@limiter.limit("20/minute")
async def add_photo(request: Request, parcelle_id: str):
    """Ajoute une photo à la fiche terrain"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        body = await request.json()

        url = sanitize_string(body.get('url', ''))
        if not url:
            raise HTTPException(status_code=400, detail="url requis")

        photo_type = body.get('type', 'terrain')
        description = sanitize_string(body.get('description', '')) if body.get('description') else None
        source = sanitize_string(body.get('source', '')) if body.get('source') else None

        fiche = fiches_manager.add_photo(
            parcelle_id=parcelle_id,
            url=url,
            photo_type=photo_type,
            description=description,
            source=source
        )

        logger.info("photo_added", parcelle_id=parcelle_id, type=photo_type)
        return fiche

    except HTTPException:
        raise
    except Exception as e:
        logger.error("add_photo_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur ajout photo: {str(e)}")


@app.delete("/api/fiches/{parcelle_id}/photos/{photo_id}")
@limiter.limit("20/minute")
async def delete_photo(request: Request, parcelle_id: str, photo_id: str):
    """Supprime une photo de la fiche terrain"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        photo_id = sanitize_string(photo_id)

        deleted = fiches_manager.delete_photo(parcelle_id, photo_id)

        if not deleted:
            raise HTTPException(status_code=404, detail="Photo non trouvée")

        logger.info("photo_deleted", parcelle_id=parcelle_id, photo_id=photo_id)
        return {"success": True, "message": "Photo supprimée"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("delete_photo_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur suppression photo: {str(e)}")


@app.post("/api/fiches/{parcelle_id}/documents")
@limiter.limit("20/minute")
async def add_document(request: Request, parcelle_id: str):
    """Ajoute un document à la fiche terrain"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        body = await request.json()

        nom = sanitize_string(body.get('nom', ''))
        url = sanitize_string(body.get('url', ''))

        if not nom or not url:
            raise HTTPException(status_code=400, detail="nom et url requis")

        doc_type = body.get('type', 'autre')
        taille = body.get('taille')

        fiche = fiches_manager.add_document(
            parcelle_id=parcelle_id,
            nom=nom,
            url=url,
            doc_type=doc_type,
            taille=taille
        )

        logger.info("document_added", parcelle_id=parcelle_id, type=doc_type)
        return fiche

    except HTTPException:
        raise
    except Exception as e:
        logger.error("add_document_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur ajout document: {str(e)}")


@app.delete("/api/fiches/{parcelle_id}/documents/{document_id}")
@limiter.limit("20/minute")
async def delete_document(request: Request, parcelle_id: str, document_id: str):
    """Supprime un document de la fiche terrain"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        document_id = sanitize_string(document_id)

        deleted = fiches_manager.delete_document(parcelle_id, document_id)

        if not deleted:
            raise HTTPException(status_code=404, detail="Document non trouvé")

        logger.info("document_deleted", parcelle_id=parcelle_id, document_id=document_id)
        return {"success": True, "message": "Document supprimé"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("delete_document_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur suppression document: {str(e)}")


@app.post("/api/fiches/{parcelle_id}/notes")
@limiter.limit("30/minute")
async def add_fiche_note(request: Request, parcelle_id: str):
    """Ajoute une note à la fiche terrain"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        body = await request.json()

        contenu = sanitize_string(body.get('contenu', ''))
        if not contenu:
            raise HTTPException(status_code=400, detail="contenu requis")

        auteur = sanitize_string(body.get('auteur', '')) if body.get('auteur') else None
        tags = body.get('tags', [])

        fiche = fiches_manager.add_note(
            parcelle_id=parcelle_id,
            contenu=contenu,
            auteur=auteur,
            tags=tags
        )

        logger.info("fiche_note_added", parcelle_id=parcelle_id)
        return fiche

    except HTTPException:
        raise
    except Exception as e:
        logger.error("add_fiche_note_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur ajout note: {str(e)}")


@app.put("/api/fiches/{parcelle_id}/notes/{note_id}")
@limiter.limit("30/minute")
async def update_fiche_note(request: Request, parcelle_id: str, note_id: str):
    """Met à jour une note de la fiche terrain"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        note_id = sanitize_string(note_id)
        body = await request.json()

        contenu = sanitize_string(body.get('contenu', ''))
        if not contenu:
            raise HTTPException(status_code=400, detail="contenu requis")

        tags = body.get('tags')

        fiche = fiches_manager.update_note(
            parcelle_id=parcelle_id,
            note_id=note_id,
            contenu=contenu,
            tags=tags
        )

        if not fiche:
            raise HTTPException(status_code=404, detail="Note non trouvée")

        logger.info("fiche_note_updated", parcelle_id=parcelle_id, note_id=note_id)
        return fiche

    except HTTPException:
        raise
    except Exception as e:
        logger.error("update_fiche_note_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur mise à jour note: {str(e)}")


@app.delete("/api/fiches/{parcelle_id}/notes/{note_id}")
@limiter.limit("20/minute")
async def delete_fiche_note(request: Request, parcelle_id: str, note_id: str):
    """Supprime une note de la fiche terrain"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        note_id = sanitize_string(note_id)

        deleted = fiches_manager.delete_note(parcelle_id, note_id)

        if not deleted:
            raise HTTPException(status_code=404, detail="Note non trouvée")

        logger.info("fiche_note_deleted", parcelle_id=parcelle_id, note_id=note_id)
        return {"success": True, "message": "Note supprimée"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("delete_fiche_note_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur suppression note: {str(e)}")


@app.post("/api/fiches/{parcelle_id}/tags")
@limiter.limit("30/minute")
async def add_tag(request: Request, parcelle_id: str):
    """Ajoute un tag à la fiche terrain"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        body = await request.json()

        tag = sanitize_string(body.get('tag', ''))
        if not tag:
            raise HTTPException(status_code=400, detail="tag requis")

        fiche = fiches_manager.add_tag(parcelle_id, tag)

        logger.info("tag_added", parcelle_id=parcelle_id, tag=tag)
        return fiche

    except HTTPException:
        raise
    except Exception as e:
        logger.error("add_tag_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur ajout tag: {str(e)}")


@app.delete("/api/fiches/{parcelle_id}/tags/{tag}")
@limiter.limit("30/minute")
async def remove_tag(request: Request, parcelle_id: str, tag: str):
    """Retire un tag de la fiche terrain"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        tag = sanitize_string(tag)

        fiche = fiches_manager.remove_tag(parcelle_id, tag)

        logger.info("tag_removed", parcelle_id=parcelle_id, tag=tag)
        return fiche

    except Exception as e:
        logger.error("remove_tag_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur suppression tag: {str(e)}")


@app.put("/api/fiches/{parcelle_id}/tags")
@limiter.limit("30/minute")
async def set_tags(request: Request, parcelle_id: str):
    """Définit les tags de la fiche terrain (remplace tous les tags)"""
    try:
        parcelle_id = sanitize_string(parcelle_id)
        body = await request.json()

        tags = body.get('tags', [])
        tags = [sanitize_string(tag) for tag in tags]

        fiche = fiches_manager.set_tags(parcelle_id, tags)

        logger.info("tags_set", parcelle_id=parcelle_id, count=len(tags))
        return fiche

    except Exception as e:
        logger.error("set_tags_error", error=str(e), parcelle_id=parcelle_id)
        raise HTTPException(status_code=500, detail=f"Erreur définition tags: {str(e)}")


@app.get("/api/fiches")
@limiter.limit("20/minute")
async def search_fiches(
    request: Request,
    tags: Optional[str] = None,
    has_notes: Optional[bool] = None,
    has_photos: Optional[bool] = None,
    has_documents: Optional[bool] = None,
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0)
):
    """Recherche les fiches terrain avec filtres"""
    try:
        tags_list = [sanitize_string(t.strip()) for t in tags.split(',')] if tags else None

        fiches = fiches_manager.search_fiches(
            tags=tags_list,
            has_notes=has_notes,
            has_photos=has_photos,
            has_documents=has_documents,
            limit=limit,
            offset=offset
        )

        return {
            "fiches": fiches,
            "count": len(fiches),
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        logger.error("search_fiches_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur recherche: {str(e)}")


@app.get("/api/fiches/stats/global")
@limiter.limit("20/minute")
async def get_fiches_stats(request: Request):
    """Récupère les statistiques globales des fiches terrain"""
    try:
        stats = fiches_manager.get_stats()
        return stats

    except Exception as e:
        logger.error("fiches_stats_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur stats: {str(e)}")


@app.get("/api/fiches/tags/all")
@limiter.limit("30/minute")
async def get_all_tags(request: Request):
    """Récupère tous les tags utilisés"""
    try:
        tags = fiches_manager.get_all_tags()
        return {"tags": tags}

    except Exception as e:
        logger.error("get_all_tags_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur récupération tags: {str(e)}")


# ============== RECHERCHE AVANCÉE ==============

@app.post("/api/search/advanced")
@limiter.limit("10/minute")
async def advanced_search(request: Request):
    """Recherche avancée avec combinaison de filtres"""
    try:
        body = await request.json()

        # Extraire les paramètres
        code_insee = body.get('code_insee')
        if not code_insee or not validate_code_insee(code_insee):
            raise HTTPException(status_code=400, detail="code_insee requis et valide")

        # Récupérer les parcelles
        limit_parcelles = body.get('limit_parcelles', 200)
        parcelles_data = await cadastre_client.get(
            f"/bundler/cadastre-etalab/communes/{code_insee}/geojson/parcelles"
        )
        parcelles = parcelles_data.get('features', [])[:limit_parcelles]

        # Récupérer les données de contexte
        stats_marche = None
        demographics = None
        transactions = None

        if body.get('include_score', True):
            # Récupérer stats marché
            stats_marche = await cache_get(f"stats:{code_insee}")
            if not stats_marche:
                dvf_stats_url = f"/dvf?code_insee={code_insee}"
                stats_marche = await dvf_client.get(f"/statistiques?{dvf_stats_url.split('?')[1]}")
                await cache_set(f"stats:{code_insee}", stats_marche, ttl=3600)

            # Récupérer démographie
            demographics = await cache_get(f"demographics:{code_insee}")
            if not demographics:
                commune_data = await geo_client.get(
                    f"/communes/{code_insee}?fields=nom,code,population,surface"
                )
                demographics = {
                    "population": commune_data.get("population", 0),
                    "surface_km2": commune_data.get("surface", 0) / 100,
                    "densite": commune_data.get("population", 0) / (commune_data.get("surface", 1) / 100)
                }
                await cache_set(f"demographics:{code_insee}", demographics, ttl=3600)

            # Récupérer transactions DVF
            transactions_data = await dvf_client.get(f"/dvf?code_insee={code_insee}")
            transactions = transactions_data.get('resultats', [])

        # Préparer les filtres
        filters = {
            # Pagination
            'page': body.get('page', 1),
            'per_page': body.get('per_page', 50),

            # Tri
            'sort_by': body.get('sort_by', 'score'),

            # Options
            'include_score': body.get('include_score', True),

            # Filtres parcelle
            'surface_parcelle_min': body.get('surface_parcelle_min'),
            'surface_parcelle_max': body.get('surface_parcelle_max'),
            'section': body.get('section'),
            'communes_codes': body.get('communes_codes'),

            # Filtres scoring
            'score_min': body.get('score_min'),
            'score_max': body.get('score_max'),
            'niveau_score': body.get('niveau_score'),

            # Filtres prospection
            'statuts': body.get('statuts'),
            'date_contact_min': body.get('date_contact_min'),
            'date_contact_max': body.get('date_contact_max'),

            # Filtres fiche
            'tags': body.get('tags'),
            'avec_notes': body.get('avec_notes'),
            'avec_photos': body.get('avec_photos'),
            'avec_documents': body.get('avec_documents'),
        }

        # Effectuer la recherche
        results = await search_engine.search(
            parcelles=parcelles,
            filters=filters,
            stats_marche=stats_marche,
            demographics=demographics,
            transactions=transactions
        )

        logger.info("advanced_search_completed", code_insee=code_insee, total=results['total'])
        return results

    except APIError:
        raise
    except HTTPException:
        raise
    except Exception as e:
        logger.error("advanced_search_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur recherche avancée: {str(e)}")


# ============== ACTIVITÉS CRM ==============

@app.post("/api/activities")
@limiter.limit("30/minute")
async def create_activity(
    request: Request,
    parcelle_id: str = Query(..., description="ID de la parcelle"),
    type: str = Query(..., description="Type d'activité (appel, email, rdv, note, document)"),
    titre: str = Query(..., max_length=200, description="Titre de l'activité"),
    description: str = Query(default="", description="Description détaillée"),
    auteur: str = Query(default="Système", description="Nom de l'utilisateur"),
    statut_avant: Optional[str] = Query(None, description="Statut avant l'activité"),
    statut_apres: Optional[str] = Query(None, description="Statut après l'activité"),
    prochaine_action: Optional[str] = Query(None, description="Prochaine action à effectuer"),
    date_rappel: Optional[str] = Query(None, description="Date du rappel (ISO format)")
):
    """Crée une nouvelle activité CRM pour une parcelle"""
    try:
        activity = activity_manager.create_activity(
            parcelle_id=parcelle_id,
            type=type,
            titre=titre,
            description=description,
            auteur=auteur,
            statut_avant=statut_avant,
            statut_apres=statut_apres,
            prochaine_action=prochaine_action,
            date_rappel=date_rappel
        )
        
        logger.info("activity_created", parcelle_id=parcelle_id, activity_id=activity.id, type=type)
        return activity.model_dump()
    
    except Exception as e:
        logger.error("activity_creation_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur création activité: {str(e)}")


@app.get("/api/activities/{parcelle_id}")
@limiter.limit("60/minute")
async def get_activities(
    request: Request,
    parcelle_id: str,
    type: Optional[str] = Query(None, description="Filtrer par type d'activité"),
    limit: int = Query(100, ge=1, le=500, description="Nombre maximum d'activités"),
    offset: int = Query(0, ge=0, description="Décalage pour pagination")
):
    """Récupère les activités d'une parcelle"""
    try:
        activities = activity_manager.get_activities(
            parcelle_id=parcelle_id,
            type=type,
            limit=limit,
            offset=offset
        )
        
        return {
            "parcelle_id": parcelle_id,
            "activities": [a.model_dump() for a in activities],
            "count": len(activities)
        }
    
    except Exception as e:
        logger.error("get_activities_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur récupération activités: {str(e)}")


@app.get("/api/activities/detail/{activity_id}")
@limiter.limit("60/minute")
async def get_activity_detail(request: Request, activity_id: str):
    """Récupère les détails d'une activité spécifique"""
    try:
        activity = activity_manager.get_activity(activity_id)
        
        if not activity:
            raise HTTPException(status_code=404, detail="Activité non trouvée")
        
        return activity.model_dump()
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_activity_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur récupération activité: {str(e)}")


@app.put("/api/activities/{activity_id}")
@limiter.limit("30/minute")
async def update_activity(
    request: Request,
    activity_id: str,
    titre: Optional[str] = Query(None, max_length=200, description="Nouveau titre"),
    description: Optional[str] = Query(None, description="Nouvelle description"),
    prochaine_action: Optional[str] = Query(None, description="Nouvelle prochaine action"),
    date_rappel: Optional[str] = Query(None, description="Nouvelle date de rappel")
):
    """Met à jour une activité"""
    try:
        activity = activity_manager.update_activity(
            activity_id=activity_id,
            titre=titre,
            description=description,
            prochaine_action=prochaine_action,
            date_rappel=date_rappel
        )
        
        if not activity:
            raise HTTPException(status_code=404, detail="Activité non trouvée")
        
        logger.info("activity_updated", activity_id=activity_id)
        return activity.model_dump()
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("activity_update_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur mise à jour activité: {str(e)}")


@app.delete("/api/activities/{activity_id}")
@limiter.limit("20/minute")
async def delete_activity(request: Request, activity_id: str):
    """Supprime une activité"""
    try:
        success = activity_manager.delete_activity(activity_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Activité non trouvée")
        
        logger.info("activity_deleted", activity_id=activity_id)
        return {"success": True, "message": "Activité supprimée"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("activity_deletion_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur suppression activité: {str(e)}")


@app.get("/api/activities/rappels/list")
@limiter.limit("30/minute")
async def get_rappels(
    request: Request,
    date_debut: Optional[str] = Query(None, description="Date de début (ISO format)"),
    date_fin: Optional[str] = Query(None, description="Date de fin (ISO format)"),
    limit: int = Query(100, ge=1, le=500, description="Nombre maximum de rappels")
):
    """Récupère les rappels à venir"""
    try:
        rappels = activity_manager.get_rappels(
            date_debut=date_debut,
            date_fin=date_fin,
            limit=limit
        )
        
        return {
            "rappels": [r.model_dump() for r in rappels],
            "count": len(rappels)
        }
    
    except Exception as e:
        logger.error("get_rappels_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur récupération rappels: {str(e)}")


@app.get("/api/activities/stats")
@limiter.limit("20/minute")
async def get_activities_stats(request: Request):
    """Récupère les statistiques des activités"""
    try:
        stats = activity_manager.get_stats()
        return stats
    
    except Exception as e:
        logger.error("get_activities_stats_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur récupération statistiques: {str(e)}")


# =============================================================================
# ENDPOINTS INSEE - Données Socio-Économiques
# =============================================================================

@app.get(
    "/api/insee/commune/{code_commune}",
    response_model=InseeData,
    tags=["INSEE"],
    summary="Récupérer les données INSEE d'une commune"
)
async def get_insee_commune(code_commune: str) -> InseeData:
    """
    Récupère les données socio-économiques INSEE pour une commune donnée.
    
    Args:
        code_commune: Code INSEE de la commune (5 chiffres)
    
    Returns:
        Données socio-économiques de la commune
    """
    try:
        data = insee_manager.get_commune(code_commune)
        if not data:
            raise HTTPException(
                status_code=404,
                detail=f"Données INSEE non disponibles pour la commune {code_commune}"
            )
        return data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur récupération données INSEE commune {code_commune}: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur récupération données: {str(e)}")


@app.get(
    "/api/insee/communes",
    response_model=List[InseeData],
    tags=["INSEE"],
    summary="Récupérer les données INSEE de plusieurs communes"
)
async def get_insee_communes(
    codes_commune: List[str] = Query(..., description="Liste des codes INSEE")
) -> List[InseeData]:
    """
    Récupère les données socio-économiques INSEE pour plusieurs communes.
    
    Args:
        codes_commune: Liste de codes INSEE (5 chiffres chacun)
    
    Returns:
        Liste des données socio-économiques disponibles
    """
    try:
        return insee_manager.get_communes(codes_commune)
    except Exception as e:
        logger.error(f"Erreur récupération données INSEE communes: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur récupération données: {str(e)}")


@app.get(
    "/api/insee/stats-territoire",
    response_model=TerritoryStats,
    tags=["INSEE"],
    summary="Statistiques agrégées pour un territoire"
)
async def get_territory_stats(
    codes_commune: List[str] = Query(..., description="Liste des codes INSEE du territoire")
) -> TerritoryStats:
    """
    Calcule les statistiques socio-économiques agrégées pour un territoire.
    
    Args:
        codes_commune: Liste de codes INSEE formant le territoire
    
    Returns:
        Statistiques agrégées (moyennes pondérées, distributions, ranges)
    """
    try:
        return insee_manager.get_territory_stats(codes_commune)
    except Exception as e:
        logger.error(f"Erreur calcul statistiques territoire: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur calcul statistiques: {str(e)}")


@app.post(
    "/api/insee/commune",
    response_model=dict,
    tags=["INSEE"],
    summary="Ajouter/mettre à jour des données INSEE"
)
async def add_insee_data(data: InseeData) -> dict:
    """
    Ajoute ou met à jour les données socio-économiques d'une commune.
    
    Args:
        data: Données INSEE à ajouter
    
    Returns:
        Confirmation de l'ajout
    """
    try:
        success = insee_manager.add_commune_data(data)
        if not success:
            raise HTTPException(status_code=500, detail="Échec de l'ajout des données")
        
        return {
            "success": True,
            "message": f"Données INSEE ajoutées pour commune {data.code_commune}",
            "code_commune": data.code_commune
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur ajout données INSEE: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur ajout données: {str(e)}")


@app.get(
    "/api/insee/cache-info",
    response_model=dict,
    tags=["INSEE"],
    summary="Informations sur le cache INSEE"
)
async def get_insee_cache_info() -> dict:
    """
    Récupère des informations sur l'état du cache INSEE.
    
    Returns:
        Informations sur le cache (nombre de communes, date de MAJ, etc.)
    """
    try:
        return insee_manager.get_cache_info()
    except Exception as e:
        logger.error(f"Erreur récupération info cache INSEE: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur récupération info: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
