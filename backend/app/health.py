"""
Health checks et metriques
Endpoints pour le monitoring et les sondes Kubernetes
"""

import time
from datetime import datetime
from typing import Dict, Any

import httpx
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.config import settings
from app.cache import get_redis_client
from app.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Health"])

# Timestamp de demarrage
_start_time = time.time()

# Compteurs de metriques
_metrics = {
    "requests_total": 0,
    "requests_success": 0,
    "requests_error": 0,
    "cache_hits": 0,
    "cache_misses": 0,
}


def increment_metric(name: str, value: int = 1) -> None:
    """Incremente un compteur de metriques"""
    if name in _metrics:
        _metrics[name] += value


@router.get("/health")
async def health_check():
    """
    Health check simple pour les load balancers
    Retourne 200 si l'application est en vie
    """
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@router.get("/ready")
async def readiness_check():
    """
    Readiness check pour Kubernetes
    Verifie que l'application est prete a recevoir du trafic
    """
    checks = {
        "api": True,
        "redis": False,
        "external_apis": False,
    }

    # Check Redis
    try:
        redis_client = get_redis_client()
        if redis_client:
            redis_client.ping()
            checks["redis"] = True
    except Exception:
        checks["redis"] = False

    # Check API externe (BAN)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.api_adresse_url}/search/?q=test&limit=1")
            checks["external_apis"] = response.status_code == 200
    except Exception:
        checks["external_apis"] = False

    # Determine le statut global
    # L'app est ready meme sans Redis (cache optionnel)
    is_ready = checks["api"] and checks["external_apis"]

    if is_ready:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": "ready",
                "checks": checks,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )
    else:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "not_ready",
                "checks": checks,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )


@router.get("/live")
async def liveness_check():
    """
    Liveness check pour Kubernetes
    Verifie que l'application n'est pas bloquee
    """
    return {"status": "alive", "timestamp": datetime.utcnow().isoformat()}


@router.get("/metrics")
async def get_metrics():
    """
    Metriques de l'application
    Format simple, peut etre adapte pour Prometheus
    """
    uptime = time.time() - _start_time

    return {
        "uptime_seconds": round(uptime, 2),
        "environment": settings.environment,
        "version": settings.app_version,
        "counters": _metrics,
        "cache": {
            "enabled": settings.cache_enabled,
            "redis_connected": get_redis_client() is not None,
        },
        "config": {
            "rate_limit": f"{settings.rate_limit_requests}/{settings.rate_limit_window}s",
            "cache_ttl": settings.cache_ttl,
            "log_level": settings.log_level,
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/info")
async def get_info():
    """
    Informations sur l'application
    """
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "debug": settings.debug,
        "apis": {
            "adresse": settings.api_adresse_url,
            "cadastre": settings.api_cadastre_url,
            "geo": settings.api_geo_url,
            "dvf": settings.api_dvf_url,
            "georisques": settings.api_georisques_url,
            "gpu": settings.api_gpu_url,
        },
    }


async def check_external_api(name: str, url: str, timeout: float = 5.0) -> Dict[str, Any]:
    """Verifie la disponibilite d'une API externe"""
    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url)
            duration = time.time() - start
            return {
                "name": name,
                "status": "up" if response.status_code < 400 else "degraded",
                "status_code": response.status_code,
                "response_time_ms": round(duration * 1000, 2),
            }
    except Exception as e:
        duration = time.time() - start
        return {
            "name": name,
            "status": "down",
            "error": str(e),
            "response_time_ms": round(duration * 1000, 2),
        }


@router.get("/status")
async def detailed_status():
    """
    Statut detaille avec verification de toutes les dependances
    """
    # Verification des APIs externes
    api_checks = await check_all_apis()

    # Statut Redis
    redis_status = "connected" if get_redis_client() else "not_configured"

    # Calcul du statut global
    all_apis_up = all(check["status"] == "up" for check in api_checks)
    status_code = "healthy" if all_apis_up else "degraded"

    return {
        "status": status_code,
        "uptime_seconds": round(time.time() - _start_time, 2),
        "redis": redis_status,
        "external_apis": api_checks,
        "timestamp": datetime.utcnow().isoformat(),
    }


async def check_all_apis():
    """Verifie toutes les APIs externes"""
    apis = [
        ("BAN", f"{settings.api_adresse_url}/search/?q=test&limit=1"),
        ("Geo API", f"{settings.api_geo_url}/communes?nom=Paris&limit=1"),
    ]

    results = []
    for name, url in apis:
        result = await check_external_api(name, url)
        results.append(result)

    return results
