import json
from typing import List, Dict, Any
from app.http_client import ign_client, cadastre_client, APIError
from app.logging_config import get_logger
from app.cache import cache_get, cache_set

logger = get_logger(__name__)

async def get_batiments_by_insee(code_insee: str) -> List[Dict[str, Any]]:
    """
    Récupère les bâtiments de la BD TOPO pour une commune donnée via WFS.
    """
    cache_key = f"ign:batiments:{code_insee}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    try:
        url = f"/bundler/cadastre-etalab/communes/{code_insee}/geojson/batiments"
        data = await cadastre_client.get(url)
        features = data.get("features", [])
        
        await cache_set(cache_key, features, ttl=3600 * 24) # Cache 24h
        return features

    except APIError as e:
        logger.error(f"Erreur recuperation batiments Cadastre: {e}")
        return []
    except Exception as e:
        logger.error(f"Erreur inattendue IGN: {e}")
        return []
