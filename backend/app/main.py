"""
API de Prospection Foncière — Point d'entrée
Agrège les données opendata françaises pour la prospection foncière
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.logging_config import setup_logging, get_logger
from app.security import (
    limiter,
    rate_limit_exceeded_handler,
    SecurityHeadersMiddleware,
    RequestLoggingMiddleware,
)
from app.health import router as health_router
from app.http_client import APIError
from app.scoring import scorer
from app.prospection import prospection_manager
from app.fiches import fiches_manager
from app.search import create_search_engine
from app.economic_layers import router as economic_router
from app.isochrones import router as isochrone_router
from app.auth import get_current_active_user
from app.database import engine
from app.models.user import Base

from app.routers import (
    auth,
    auth_microsoft,
    address,
    cadastre,
    dvf,
    geo,
    risks,
    urbanism,
    export,
    search,
    faisabilite,
    activities,
    settings as app_settings_router,
    conges,
    communication,
    commerce_crm,
    commerce_analyse,
)
from app.routers.enrichissement import router as enrichissement_router
from app.routers.reports import router as reports_router
from app.routers.scoring import router as scoring_router
from app.routers.prospection_routes import router as prospection_router
from app.routers.fiches_routes import router as fiches_router

setup_logging()
logger = get_logger(__name__)

search_engine = create_search_engine(scorer, prospection_manager, fiches_manager)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestion du cycle de vie de l'application"""
    logger.info(
        "application_starting",
        environment=settings.environment,
        version=settings.app_version,
    )

    Base.metadata.create_all(bind=engine)

    # Auto-migration SQLite pour les nouvelles colonnes
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result.fetchall()]

            migrations = [
                ("module_faisabilite", [
                    "ALTER TABLE users ADD COLUMN module_faisabilite BOOLEAN DEFAULT 1",
                    "ALTER TABLE users ADD COLUMN module_sav BOOLEAN DEFAULT 0",
                    "ALTER TABLE users ADD COLUMN module_conges BOOLEAN DEFAULT 0",
                ]),
                ("solde_conges", [
                    "ALTER TABLE users ADD COLUMN solde_conges FLOAT DEFAULT 25.0",
                    "ALTER TABLE users ADD COLUMN manager_id VARCHAR REFERENCES users(id)",
                ]),
                ("module_communication", [
                    "ALTER TABLE users ADD COLUMN module_communication BOOLEAN DEFAULT 0",
                ]),
                ("module_commerce", [
                    "ALTER TABLE users ADD COLUMN module_commerce BOOLEAN DEFAULT 0",
                ]),
            ]

            for column_check, statements in migrations:
                if column_check not in columns:
                    for stmt in statements:
                        conn.execute(text(stmt))
                    conn.commit()
                    logger.info(f"Migration OK: {column_check}")

    except Exception as e:
        logger.error(f"Migration error: {e}")

    yield
    logger.info("application_stopping")


# ============================================================
# Application FastAPI
# ============================================================

app = FastAPI(
    title=settings.app_name,
    description="API pour la prospection foncière — données opendata françaises",
    version=settings.app_version,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

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


# ============================================================
# Gestion des erreurs globales
# ============================================================

@app.exception_handler(APIError)
async def api_error_handler(request: Request, exc: APIError):
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
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("unhandled_exception", path=request.url.path, error=str(exc))
    return JSONResponse(
        status_code=500,
        content={
            "error": "Erreur interne du serveur",
            "detail": "Une erreur inattendue s'est produite" if settings.is_production else str(exc),
        },
    )


# ============================================================
# Routes
# ============================================================

@app.get("/")
async def root():
    return {
        "message": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "documentation": "/docs" if settings.debug else "Désactivée en production",
    }


# Santé (public — Docker healthcheck)
app.include_router(health_router)

# Authentification (public)
app.include_router(auth.router, prefix="/api")
app.include_router(auth_microsoft.router, prefix="/api")

# Routes métier protégées par JWT
protected = [Depends(get_current_active_user)]

app.include_router(address.router, dependencies=protected)
app.include_router(cadastre.router, dependencies=protected)
app.include_router(dvf.router, dependencies=protected)
app.include_router(geo.router, dependencies=protected)
app.include_router(risks.router, dependencies=protected)
app.include_router(urbanism.router, dependencies=protected)
app.include_router(export.router, dependencies=protected)
app.include_router(search.router, dependencies=protected)
app.include_router(faisabilite.router, dependencies=protected)
app.include_router(activities.router, dependencies=protected)
app.include_router(app_settings_router.router, prefix="/api", dependencies=protected)
app.include_router(conges.router, prefix="/api", dependencies=protected)
app.include_router(communication.router, prefix="/api", dependencies=protected)
app.include_router(commerce_crm.router, prefix="/api", dependencies=protected)
app.include_router(commerce_analyse.router, prefix="/api", dependencies=protected)
app.include_router(economic_router, dependencies=protected)
app.include_router(isochrone_router, dependencies=protected)
app.include_router(enrichissement_router, dependencies=protected)
app.include_router(reports_router, dependencies=protected)
app.include_router(scoring_router, dependencies=protected)
app.include_router(prospection_router, dependencies=protected)
app.include_router(fiches_router, dependencies=protected)
