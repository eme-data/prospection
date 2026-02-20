"""
API de Prospection Fonciere - Version Production
Agregue les donnees opendata francaises pour la prospection fonciere
"""

from contextlib import asynccontextmanager
import io
import json
from typing import Optional, List, Dict, Any

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
    geo_client,
    dvf_client,
    cadastre_client,
    APIError,
)
from app.report_generator import generate_prospection_report
from app.scoring import scorer
from app.prospection import prospection_manager
from app.fiches import fiches_manager
from app.search import create_search_engine
from app.activity import activity_manager, Activity
from app.insee import insee_manager, InseeData, TerritoryStats, InseeIndicator
from app.economic_layers import router as economic_router
from app.isochrones import router as isochrone_router
from app.routers import (
    auth,
    address,
    cadastre,
    dvf,
    geo,
    risks,
    urbanism,
    export,
    search,
    faisabilite,
    activities
)
from app.auth import get_current_active_user
from fastapi import Depends
from app.database import engine
from app.models.user import Base

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
    
    # Création des tables de la base de données
    Base.metadata.create_all(bind=engine)
    
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
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allow_headers=["*"],
    max_age=86400,
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# Routes publiques
app.include_router(health_router)
app.include_router(auth.router, prefix="/api")

# Dépendance globale pour le reste des routes métier (hors /, /docs, etc.)
protected_dep = [Depends(get_current_active_user)]

# Routes principales protégées (refactorees)
app.include_router(address.router, dependencies=protected_dep)
app.include_router(cadastre.router, dependencies=protected_dep)
app.include_router(dvf.router, dependencies=protected_dep)
app.include_router(geo.router, dependencies=protected_dep)
app.include_router(risks.router, dependencies=protected_dep)
app.include_router(urbanism.router, dependencies=protected_dep)
app.include_router(export.router, dependencies=protected_dep)
app.include_router(search.router, dependencies=protected_dep)
app.include_router(faisabilite.router, dependencies=protected_dep)
app.include_router(activities.router, dependencies=protected_dep)

# Routes existantes non refactorees protégées (a deplacer plus tard)
app.include_router(economic_router, dependencies=protected_dep)
app.include_router(isochrone_router, dependencies=protected_dep)


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


# ============== ENRICHISSEMENT ==============

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
