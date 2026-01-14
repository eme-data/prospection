"""
Module de securite
Rate limiting, headers securises, validation
"""

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import time
from typing import Callable

from app.config import settings
from app.logging_config import get_logger

logger = get_logger(__name__)

# Rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.rate_limit_requests}/{settings.rate_limit_window}seconds"],
    storage_uri=settings.redis_url if settings.redis_url else "memory://",
)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Handler pour les erreurs de rate limiting"""
    logger.warning(
        "rate_limit_exceeded",
        client_ip=get_remote_address(request),
        path=request.url.path,
    )
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "error": "Trop de requetes",
            "detail": "Vous avez depasse la limite de requetes. Veuillez reessayer plus tard.",
            "retry_after": settings.rate_limit_window,
        },
        headers={"Retry-After": str(settings.rate_limit_window)},
    )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware pour ajouter les headers de securite"""

    async def dispatch(self, request: Request, call_next: Callable):
        response = await call_next(request)

        # Headers de securite
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Content Security Policy (pour les reponses HTML)
        if "text/html" in response.headers.get("content-type", ""):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "font-src 'self'; "
                "connect-src 'self' https://api-adresse.data.gouv.fr https://cadastre.data.gouv.fr"
            )

        # HSTS en production
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware pour logger les requetes"""

    async def dispatch(self, request: Request, call_next: Callable):
        start_time = time.time()
        request_id = request.headers.get("X-Request-ID", str(time.time_ns()))

        # Log de la requete entrante
        logger.info(
            "request_started",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client_ip=get_remote_address(request),
        )

        try:
            response = await call_next(request)
            duration = time.time() - start_time

            # Log de la reponse
            logger.info(
                "request_completed",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round(duration * 1000, 2),
            )

            # Ajout du header de temps de reponse
            response.headers["X-Response-Time"] = f"{duration * 1000:.2f}ms"
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                "request_failed",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                error=str(e),
                duration_ms=round(duration * 1000, 2),
            )
            raise


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Middleware optionnel pour l'authentification par cle API"""

    async def dispatch(self, request: Request, call_next: Callable):
        # Si pas de cle API configuree, laisser passer
        if not settings.api_key:
            return await call_next(request)

        # Exclure certains endpoints
        excluded_paths = ["/", "/health", "/ready", "/docs", "/openapi.json", "/redoc"]
        if request.url.path in excluded_paths:
            return await call_next(request)

        # Verification de la cle API
        api_key = request.headers.get("X-API-Key")
        if api_key != settings.api_key:
            logger.warning(
                "invalid_api_key",
                client_ip=get_remote_address(request),
                path=request.url.path,
            )
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Cle API invalide ou manquante"},
            )

        return await call_next(request)


def validate_code_insee(code: str) -> bool:
    """Valide un code INSEE"""
    if not code:
        return False
    # Code INSEE: 5 chiffres
    if not code.isdigit() or len(code) != 5:
        return False
    return True


def validate_coordinates(lon: float, lat: float) -> bool:
    """Valide des coordonnees GPS (France metropolitaine)"""
    # Bornes approximatives de la France metropolitaine
    if not (-5.5 <= lon <= 10.0):
        return False
    if not (41.0 <= lat <= 51.5):
        return False
    return True


def sanitize_string(value: str, max_length: int = 200) -> str:
    """Nettoie une chaine de caracteres"""
    if not value:
        return ""
    # Suppression des caracteres de controle
    sanitized = "".join(c for c in value if c.isprintable())
    # Limitation de la longueur
    return sanitized[:max_length].strip()
