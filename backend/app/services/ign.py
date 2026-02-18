import json
from typing import List, Dict, Any
from app.http_client import ign_client, APIError
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

    # Paramètres pour requête WFS
    # Layer: BDTOPO_V3:batiment
    # CQL Filter: code_insee='XXXXX' (si disponible) ou usage d'une bbox
    # Note: Le champ code_insee exact dépend de la version de la BD TOPO distribuée par data.geopf.fr
    # Souvent c'est 'code_insee' ou 'code_insee_table'
    # On tente 'code_insee' standard.
    
    params = {
        "SERVICE": "WFS",
        "VERSION": "2.0.0",
        "REQUEST": "GetFeature",
        "TYPENAME": "BDTOPO_V3:batiment",
        "OUTPUTFORMAT": "application/json",
        "CQL_FILTER": f"code_insee='{code_insee}'",
        # S'assurer de ne pas tout récupérer si c'est énorme, mais par commune ça devrait aller (pagination?)
        # WFS a souvent une limite (ex: 1000 features).
        # On peut demander COUNT d'abord ou paginer.
        # Pour une commune moyenne, ça peut dépasser 1000.
        "COUNT": 5000 # Limite de sécurité
    }

    try:
        data = await ign_client.get("", params=params)
        features = data.get("features", [])
        
        # Filtrer / Nettoyer si nécessaire (garder juste geometry pour l'intersection ?)
        # On garde tout pour l'instant
        
        await cache_set(cache_key, features, ttl=3600 * 24) # Cache 24h
        return features

    except APIError as e:
        logger.error(f"Erreur recuperation batiments IGN: {e}")
        return []
    except Exception as e:
        logger.error(f"Erreur inattendue IGN: {e}")
        return []
