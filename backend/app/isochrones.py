"""
Router FastAPI pour les isochrones
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List
from app.isochrone_service import calculate_isochrone, get_available_profiles

router = APIRouter(prefix="/api/isochrones", tags=["isochrones"])


@router.get("/calculate")
async def get_isochrone(
    lon: float = Query(..., description="Longitude du point central"),
    lat: float = Query(..., description="Latitude du point central"),
    profile: str = Query("driving-car", description="Profil de transport"),
    ranges: str = Query("300,600,900,1800", description="Durées en secondes (séparées par virgules)")
):
    """
    Calcule les isochrones pour un point donné
    
    Exemple:
    /api/isochrones/calculate?lon=2.3522&lat=48.8566&profile=driving-car&ranges=300,600,900
    
    Returns:
        GeoJSON FeatureCollection avec les polygones d'isochrones
    """
    
    try:
        # Parser les ranges
        range_list = [int(r.strip()) for r in ranges.split(",")]
        
        # Valider les ranges (max 3600s = 60min)
        if any(r > 3600 or r <= 0 for r in range_list):
            raise HTTPException(
                status_code=400,
                detail="Les durées doivent être entre 1 et 3600 secondes (60 min)"
            )
        
        # Valider les coordonnées
        if not (-180 <= lon <= 180) or not (-90 <= lat <= 90):
            raise HTTPException(
                status_code=400,
                detail="Coordonnées invalides"
            )
        
        # Calculer les isochrones
        result = await calculate_isochrone(
            lon=lon,
            lat=lat,
            profile=profile,
            ranges=range_list
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors du calcul des isochrones: {str(e)}"
        )


@router.get("/profiles")
async def list_profiles():
    """
    Liste les profils de transport disponibles
    
    Returns:
        Liste des profils avec id, nom et icône
    """
    return {
        "profiles": get_available_profiles()
    }
