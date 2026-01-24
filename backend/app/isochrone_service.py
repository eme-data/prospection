"""
Service de calcul des isochrones via OpenRouteService API
"""

import httpx
import os
from typing import List, Dict, Any, Optional
from app.cache import cached

# Configuration API
OPENROUTESERVICE_API_URL = "https://api.openrouteservice.org/v2/isochrones"
OPENROUTESERVICE_API_KEY = os.getenv("OPENROUTESERVICE_API_KEY", "")

# Mapping des profils de transport
PROFILE_MAPPING = {
    "driving-car": "driving-car",
    "cycling-regular": "cycling-regular",
    "foot-walking": "foot-walking"
}


@cached(prefix="isochrone", ttl=86400)  # Cache 24h
async def calculate_isochrone(
    lon: float,
    lat: float,
    profile: str = "driving-car",
    ranges: List[int] = [300, 600, 900, 1800]  # secondes
) -> Dict[str, Any]:
    """
    Calcule les isochrones pour un point donné
    
    Args:
        lon: Longitude du point central
        lat: Latitude du point central
        profile: Profil de transport (driving-car, cycling-regular, foot-walking)
        ranges: Liste des durées en secondes (ex: [300, 600] = 5min, 10min)
    
    Returns:
        GeoJSON FeatureCollection avec les polygones d'isochrones
    """
    
    if not OPENROUTESERVICE_API_KEY:
        raise ValueError("OPENROUTESERVICE_API_KEY n'est pas configuré")
    
    if profile not in PROFILE_MAPPING:
        raise ValueError(f"Profil invalide: {profile}. Profiles supportés: {list(PROFILE_MAPPING.keys())}")
    
    # Limiter à 6 plages max (limite API + performance)
    if len(ranges) > 6:
        ranges = ranges[:6]
    
    # Construction de la requête
    url = f"{OPENROUTESERVICE_API_URL}/{profile}"
    
    headers = {
        "Authorization": OPENROUTESERVICE_API_KEY,
        "Content-Type": "application/json"
    }
    
    payload = {
        "locations": [[lon, lat]],
        "range": ranges,
        "range_type": "time"  # en secondes
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            
            data = response.json()
            
            # Enrichir avec métadonnées
            if "features" in data:
                for i, feature in enumerate(data["features"]):
                    if "properties" not in feature:
                        feature["properties"] = {}
                    
                    feature["properties"]["value"] = ranges[i] if i < len(ranges) else 0
                    feature["properties"]["center"] = [lon, lat]
                    feature["properties"]["profile"] = profile
            
            # Ajouter métadonnées globales
            data["metadata"] = {
                "profile": profile,
                "center": [lon, lat],
                "ranges": ranges,
                "attribution": "openrouteservice.org"
            }
            
            return data
            
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            raise ValueError("Limite de requêtes API dépassée (2000/jour)")
        elif e.response.status_code == 403:
            raise ValueError("Clé API invalide ou non autorisée")
        else:
            raise ValueError(f"Erreur API OpenRouteService: {e.response.status_code}")
    
    except httpx.TimeoutException:
        raise ValueError("Timeout lors du calcul des isochrones (>30s)")
    
    except Exception as e:
        raise ValueError(f"Erreur lors du calcul des isochrones: {str(e)}")


def get_available_profiles() -> List[Dict[str, str]]:
    """
    Retourne la liste des profils de transport disponibles
    """
    return [
        {"id": "driving-car", "name": "Voiture", "icon": "🚗"},
        {"id": "cycling-regular", "name": "Vélo", "icon": "🚴"},
        {"id": "foot-walking", "name": "À pied", "icon": "🚶"}
    ]
