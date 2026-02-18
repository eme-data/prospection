from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Body, Request
from pydantic import BaseModel

from app.search import create_search_engine
from app.scoring import scorer
from app.prospection import prospection_manager
from app.fiches import fiches_manager
from app.http_client import cadastre_client, dvf_client, geo_client, gpu_client
from app.cache import cache_get, cache_set
from app.security import limiter, validate_code_insee
from app.logging_config import get_logger

# Initialisation du moteur de recherche
search_engine = create_search_engine(scorer, prospection_manager, fiches_manager)

router = APIRouter(
    prefix="/api/search",
    tags=["Recherche"]
)

logger = get_logger(__name__)

class SearchFilters(BaseModel):
    # Filtres Commune
    code_insee: str
    
    # Filtres Parcelle
    section: Optional[str] = None
    surface_min: Optional[float] = None
    surface_max: Optional[float] = None
    
    # Filtres Urbanisme (Nouveau)
    zone_types: Optional[List[str]] = None  # Ex: ['U', 'AU']
    
    # Filtres Scoring
    score_min: Optional[float] = None
    include_score: bool = True
    
    # Filtres Prospection
    statuts: Optional[List[str]] = None
    
    # Pagination / Tri
    page: int = 1
    per_page: int = 50
    sort_by: str = "score"

@router.post("")
@limiter.limit("20/minute")
async def search_parcelles(
    request: Request,
    filters: SearchFilters
):
    """
    Recherche avancée de parcelles avec filtres croisés (Cadastre, PLU, Scoring)
    """
    if not validate_code_insee(filters.code_insee):
        raise HTTPException(status_code=400, detail="Code INSEE invalide")
        
    try:
        # 1. Récupérer les parcelles de la commune (avec Cache)
        parcelles_cache_key = f"all_parcelles:{filters.code_insee}"
        parcelles_data = await cache_get(parcelles_cache_key)
        
        if not parcelles_data:
            url = f"/bundler/cadastre-etalab/communes/{filters.code_insee}/geojson/parcelles"
            parcelles_data = await cadastre_client.get(url)
            # On met en cache pour 1h car c'est lourd
            await cache_set(parcelles_cache_key, parcelles_data, ttl=3600)
            
        all_parcelles = parcelles_data.get("features", [])
        
        # 2. Récupérer le contexte pour le scoring (si demandé)
        stats_marche = None
        demographics = None
        transactions = None
        
        if filters.include_score:
            # Stats Marché
            stats_marche = await cache_get(f"stats:{filters.code_insee}")
            if not stats_marche:
                try:
                    stats_marche = await dvf_client.get(f"/statistiques?code_insee={filters.code_insee}")
                    await cache_set(f"stats:{filters.code_insee}", stats_marche, ttl=3600)
                except Exception:
                    logger.warning("Impossible de récupérer stats marché", code_insee=filters.code_insee)

            # Démographie
            demographics = await cache_get(f"demographics:{filters.code_insee}")
            if not demographics:
                try:
                    commune_data = await geo_client.get(f"/communes/{filters.code_insee}?fields=population,surface")
                    if commune_data:
                         demographics = {
                            "population": commune_data.get("population", 0),
                            "surface_km2": commune_data.get("surface", 0) / 100,
                            "densite": 0
                        }
                    await cache_set(f"demographics:{filters.code_insee}", demographics, ttl=3600)
                except Exception:
                     logger.warning("Impossible de récupérer démographie", code_insee=filters.code_insee)

        # 3. Récupérer les zones PLU (si filtre actif)
        zones = []
        if filters.zone_types:
            try:
                # Récupération des zones de la commune via GPU
                # Partition = DU_codeinsee (standard GPU)
                gpu_data = await gpu_client.get("/zone-urba", params={"partition": f"DU_{filters.code_insee}"})
                zones = gpu_data.get("features", [])
            except Exception as e:
                logger.warning(f"Impossible de récupérer les zones PLU: {str(e)}", extra={"code_insee": filters.code_insee})

        # 4. Lancer la recherche via le moteur
        results = await search_engine.search(
            parcelles=all_parcelles,
            filters=filters.model_dump(),
            stats_marche=stats_marche,
            demographics=demographics,
            transactions=transactions,
            zones=zones
        )
        
        return results

    except Exception as e:
        logger.error("search_error", error=str(e), code_insee=filters.code_insee)
        raise HTTPException(status_code=500, detail=f"Erreur lors de la recherche: {str(e)}")
