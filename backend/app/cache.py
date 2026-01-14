"""
Systeme de cache pour les reponses API
Support Redis (production) et cache memoire (fallback)
"""

import json
import hashlib
from typing import Any, Optional, Callable
from functools import wraps

from cachetools import TTLCache

from app.config import settings
from app.logging_config import get_logger

logger = get_logger(__name__)

# Cache memoire local (fallback si Redis non disponible)
_memory_cache: TTLCache = TTLCache(maxsize=1000, ttl=settings.cache_ttl)

# Client Redis (initialise a la demande)
_redis_client = None


def get_redis_client():
    """Retourne le client Redis, le cree si necessaire"""
    global _redis_client

    if _redis_client is not None:
        return _redis_client

    if not settings.redis_url:
        return None

    try:
        import redis
        _redis_client = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
        # Test de connexion
        _redis_client.ping()
        logger.info("redis_connected", url=settings.redis_url)
        return _redis_client
    except Exception as e:
        logger.warning("redis_connection_failed", error=str(e))
        return None


def _generate_cache_key(prefix: str, *args, **kwargs) -> str:
    """Genere une cle de cache unique"""
    key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
    key_hash = hashlib.md5(key_data.encode()).hexdigest()[:16]
    return f"prospection:{prefix}:{key_hash}"


async def cache_get(key: str) -> Optional[Any]:
    """Recupere une valeur du cache"""
    if not settings.cache_enabled:
        return None

    redis_client = get_redis_client()

    if redis_client:
        try:
            value = redis_client.get(key)
            if value:
                logger.debug("cache_hit", key=key, backend="redis")
                return json.loads(value)
        except Exception as e:
            logger.warning("cache_get_error", key=key, error=str(e))

    # Fallback sur cache memoire
    value = _memory_cache.get(key)
    if value:
        logger.debug("cache_hit", key=key, backend="memory")
        return value

    logger.debug("cache_miss", key=key)
    return None


async def cache_set(key: str, value: Any, ttl: Optional[int] = None) -> bool:
    """Stocke une valeur dans le cache"""
    if not settings.cache_enabled:
        return False

    ttl = ttl or settings.cache_ttl
    redis_client = get_redis_client()

    if redis_client:
        try:
            redis_client.setex(key, ttl, json.dumps(value, default=str))
            logger.debug("cache_set", key=key, ttl=ttl, backend="redis")
            return True
        except Exception as e:
            logger.warning("cache_set_error", key=key, error=str(e))

    # Fallback sur cache memoire
    _memory_cache[key] = value
    logger.debug("cache_set", key=key, ttl=ttl, backend="memory")
    return True


async def cache_delete(key: str) -> bool:
    """Supprime une valeur du cache"""
    redis_client = get_redis_client()

    if redis_client:
        try:
            redis_client.delete(key)
        except Exception:
            pass

    _memory_cache.pop(key, None)
    return True


def cached(prefix: str, ttl: Optional[int] = None):
    """
    Decorateur pour mettre en cache les resultats d'une fonction async

    Usage:
        @cached("parcelles", ttl=600)
        async def get_parcelles(code_insee: str):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generation de la cle
            cache_key = _generate_cache_key(prefix, *args, **kwargs)

            # Tentative de recuperation du cache
            cached_value = await cache_get(cache_key)
            if cached_value is not None:
                return cached_value

            # Appel de la fonction
            result = await func(*args, **kwargs)

            # Mise en cache
            await cache_set(cache_key, result, ttl)

            return result
        return wrapper
    return decorator


def clear_cache_pattern(pattern: str) -> int:
    """Supprime toutes les cles correspondant a un pattern"""
    count = 0
    redis_client = get_redis_client()

    if redis_client:
        try:
            keys = redis_client.keys(f"prospection:{pattern}:*")
            if keys:
                count = redis_client.delete(*keys)
        except Exception as e:
            logger.warning("cache_clear_error", pattern=pattern, error=str(e))

    # Nettoyage du cache memoire
    keys_to_delete = [k for k in _memory_cache.keys() if pattern in k]
    for key in keys_to_delete:
        _memory_cache.pop(key, None)
        count += 1

    logger.info("cache_cleared", pattern=pattern, count=count)
    return count
