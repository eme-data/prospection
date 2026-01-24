"""
Module pour les calques économiques - Heatmaps et analyses DVF
"""

from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import asyncio
import httpx
from app.cache import cached
from app.config import get_settings

router = APIRouter(prefix="/api/layers/economic", tags=["economic-layers"])
settings = get_settings()


def create_grid(min_lon: float, min_lat: float, max_lon: float, max_lat: float, granularity: int = 200) -> List[Dict]:
    """
    Créer une grille régulière de carreaux pour la heatmap.
    Granularité en mètres.
    """
    # Approximation: 1 degré ≈ 111km
    lat_step = (granularity / 1000) / 111
    lon_step = (granularity / 1000) / (111 * abs(min_lat + max_lat) / 2)
    
    grid_cells = []
    lat = min_lat
    while lat < max_lat:
        lon = min_lon
        while lon < max_lon:
            cell = {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [lon, lat],
                        [lon + lon_step, lat],
                        [lon + lon_step, lat + lat_step],
                        [lon, lat + lat_step],
                        [lon, lat]
                    ]]
                },
                "properties": {
                    "center_lon": lon + lon_step / 2,
                    "center_lat": lat + lat_step / 2,
                    "prix_m2": 0,
                    "count": 0
                }
            }
            grid_cells.append(cell)
            lon += lon_step
        lat += lat_step
    
    return grid_cells


async def fetch_dvf_transactions(bbox: str) -> List[Dict]:
    """Récupérer les transactions DVF dans une bbox."""
    min_lon, min_lat, max_lon, max_lat = map(float, bbox.split(','))
    
    # API DVF de Christian Quest
    url = "https://apidf-preprod.geo.data.gouv.fr/dvf"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(
                url,
                params={
                    "lat": (min_lat + max_lat) / 2,
                    "lon": (min_lon + max_lon) / 2,
                    "dist": 5000  # 5km radius
                }
            )
            response.raise_for_status()
            data = response.json()
            
            if isinstance(data, dict) and 'features' in data:
                return data['features']
            return []
        except Exception as e:
            print(f"Error fetching DVF data: {e}")
            return []


def calculate_prix_m2_for_grid(grid: List[Dict], transactions: List[Dict]) -> List[Dict]:
    """Calculer le prix au m² moyen par carreau de grille."""
    
    for cell in grid:
        center_lon = cell['properties']['center_lon']
        center_lat = cell['properties']['center_lat']
        
        # Trouver les transactions dans ce carreau (approximation simple)
        nearby_transactions = []
        for transaction in transactions:
            if 'geometry' not in transaction or not transaction['geometry']:
                continue
                
            coords = transaction['geometry'].get('coordinates', [])
            if len(coords) == 2:
                tx_lon, tx_lat = coords
                # Distance approximative
                dist = ((tx_lon - center_lon) ** 2 + (tx_lat - center_lat) ** 2) ** 0.5
                if dist < 0.01:  # ~1km
                    props = transaction.get('properties', {})
                    if props.get('valeur_fonciere') and props.get('surface_reelle_bati'):
                        nearby_transactions.append(props)
        
        # Calculer prix moyen au m²
        if nearby_transactions:
            total_prix_m2 = 0
            valid_count = 0
            
            for tx in nearby_transactions:
                try:
                    prix = float(tx['valeur_fonciere'])
                    surface = float(tx['surface_reelle_bati'])
                    if surface > 0:
                        prix_m2 = prix / surface
                        if 100 < prix_m2 < 20000:  # Filtrer valeurs aberrantes
                            total_prix_m2 += prix_m2
                            valid_count += 1
                except (ValueError, TypeError, ZeroDivisionError):
                    continue
            
            if valid_count > 0:
                cell['properties']['prix_m2'] = round(total_prix_m2 / valid_count, 2)
                cell['properties']['count'] = valid_count
    
    # Filtrer les cellules sans données
    return [cell for cell in grid if cell['properties']['count'] > 0]


@router.get("/prix-m2")
@cached(ttl=3600)
async def get_prix_m2_heatmap(
    bbox: str = Query(..., description="min_lon,min_lat,max_lon,max_lat"),
    granularity: int = Query(200, ge=100, le=1000, description="Taille carreau en mètres")
) -> Dict[str, Any]:
    """
    Génère une heatmap des prix au m² par zone.
    Données agrégées depuis DVF sur une grille régulière.
    
    Exemple: /api/layers/economic/prix-m2?bbox=2.3,48.85,2.4,48.88&granularity=200
    """
    try:
        # Parser bbox
        coords = list(map(float, bbox.split(',')))
        if len(coords) != 4:
            raise ValueError("bbox doit contenir 4 coordonnées")
        
        min_lon, min_lat, max_lon, max_lat = coords
        
        # Créer grille
        grid = create_grid(min_lon, min_lat, max_lon, max_lat, granularity)
        
        # Récupérer transactions DVF
        transactions = await fetch_dvf_transactions(bbox)
        
        # Calculer prix au m² par carreau
        grid_with_prices = calculate_prix_m2_for_grid(grid, transactions)
        
        # Calculer statistiques globales
        if grid_with_prices:
            all_prices = [cell['properties']['prix_m2'] for cell in grid_with_prices]
            min_price = min(all_prices)
            max_price = max(all_prices)
            avg_price = sum(all_prices) / len(all_prices)
        else:
            min_price = max_price = avg_price = 0
        
        return {
            "type": "FeatureCollection",
            "features": grid_with_prices,
            "metadata": {
                "granularity_m": granularity,
                "bbox": bbox,
                "total_cells": len(grid_with_prices),
                "min_prix_m2": round(min_price, 2),
                "max_prix_m2": round(max_price, 2),
                "avg_prix_m2": round(avg_price, 2),
                "generated_at": datetime.now().isoformat()
            }
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")


@router.get("/evolution-prix")
@cached(ttl=7200)
async def get_evolution_prix(
    code_insee: str = Query(..., description="Code INSEE de la commune"),
    years: int = Query(5, ge=1, le=10, description="Nombre d'années")
) -> List[Dict[str, Any]]:
    """
    Évolution des prix sur N années pour une commune.
    
    Exemple: /api/layers/economic/evolution-prix?code_insee=75056&years=5
    """
    try:
        # TODO: Implémenter requête DVF groupée par année
        # Pour l'instant, retourne des données de test
        
        current_year = datetime.now().year
        evolution_data = []
        
        for i in range(years):
            year = current_year - i
            evolution_data.append({
                "year": year,
                "prix_moyen": 350000 + (i * 15000),  # Simulé
                "prix_m2_moyen": 5500 - (i * 200),  # Simulé
                "nombre_transactions": 120 + (i * 10),  # Simulé
                "surface_moyenne": 65
            })
        
        return list(reversed(evolution_data))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")


@router.get("/volume-transactions")
@cached(ttl=3600)
async def get_volume_transactions(
    bbox: str = Query(..., description="min_lon,min_lat,max_lon,max_lat"),
    period: str = Query("month", regex="^(day|week|month|year)$")
) -> Dict[str, Any]:
    """
    Volume de transactions par période dans une zone.
    
    Exemple: /api/layers/economic/volume-transactions?bbox=2.3,48.85,2.4,48.88&period=month
    """
    try:
        transactions = await fetch_dvf_transactions(bbox)
        
        # Grouper par période
        volume_by_period = {}
        
        for tx in transactions:
            props = tx.get('properties', {})
            date_str = props.get('date_mutation')
            
            if date_str:
                try:
                    date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    
                    if period == "year":
                        key = str(date.year)
                    elif period == "month":
                        key = date.strftime("%Y-%m")
                    elif period == "week":
                        key = date.strftime("%Y-W%U")
                    else:  # day
                        key = date.strftime("%Y-%m-%d")
                    
                    volume_by_period[key] = volume_by_period.get(key, 0) + 1
                except Exception:
                    continue
        
        # Trier par période
        sorted_data = sorted(volume_by_period.items())
        
        return {
            "period": period,
            "bbox": bbox,
            "data": [
                {"period": key, "count": count}
                for key, count in sorted_data
            ],
            "total_transactions": len(transactions)
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")
