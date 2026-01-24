"""
Génération de heatmaps pour visualisation cartographique
"""
from typing import Dict, Any, List, Optional, Tuple
import math
from collections import defaultdict


class HeatmapGenerator:
    """Génère des données de heatmap pour différents indicateurs"""

    def __init__(self, scorer):
        self.scorer = scorer

    def generate_heatmap(
        self,
        parcelles: List[Dict[str, Any]],
        heatmap_type: str = 'score',
        grid_size: float = 0.01,  # ~1km
        stats_marche: Optional[Dict[str, Any]] = None,
        demographics: Optional[Dict[str, Any]] = None,
        transactions: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Génère une heatmap basée sur les parcelles

        Args:
            parcelles: Liste des parcelles
            heatmap_type: Type de heatmap (score, prix, potentiel, densite)
            grid_size: Taille de la grille en degrés
            stats_marche: Stats du marché
            demographics: Données démographiques
            transactions: Transactions DVF

        Returns:
            Données de heatmap au format GeoJSON
        """
        if heatmap_type == 'score':
            return self._generate_score_heatmap(
                parcelles, grid_size, stats_marche, demographics, transactions
            )
        elif heatmap_type == 'prix':
            return self._generate_prix_heatmap(parcelles, transactions, grid_size)
        elif heatmap_type == 'potentiel':
            return self._generate_potentiel_heatmap(
                parcelles, grid_size, stats_marche, demographics, transactions
            )
        elif heatmap_type == 'densite':
            return self._generate_densite_heatmap(parcelles, grid_size)
        else:
            raise ValueError(f"Type de heatmap inconnu: {heatmap_type}")

    def _get_cell_key(self, lon: float, lat: float, grid_size: float) -> Tuple[float, float]:
        """Calcule la clé de cellule de grille pour des coordonnées"""
        cell_lon = math.floor(lon / grid_size) * grid_size
        cell_lat = math.floor(lat / grid_size) * grid_size
        return (cell_lon, cell_lat)

    def _get_parcel_center(self, parcelle: Dict[str, Any]) -> Optional[Tuple[float, float]]:
        """Calcule le centre d'une parcelle"""
        geom = parcelle.get('geometry', {})
        coords = geom.get('coordinates', [])

        if not coords:
            return None

        # Gérer Polygon et MultiPolygon
        if geom.get('type') == 'Polygon':
            # coords[0] est le ring extérieur
            ring = coords[0]
        elif geom.get('type') == 'MultiPolygon':
            # Prendre le premier polygone
            if len(coords) > 0 and len(coords[0]) > 0:
                ring = coords[0][0]
            else:
                return None
        else:
            return None

        if not ring or len(ring) < 3:
            return None

        # Calculer le centroïde simple (moyenne des coordonnées)
        sum_lon = sum(point[0] for point in ring)
        sum_lat = sum(point[1] for point in ring)
        center_lon = sum_lon / len(ring)
        center_lat = sum_lat / len(ring)

        return (center_lon, center_lat)

    def _generate_score_heatmap(
        self,
        parcelles: List[Dict[str, Any]],
        grid_size: float,
        stats_marche: Optional[Dict[str, Any]],
        demographics: Optional[Dict[str, Any]],
        transactions: Optional[List[Dict[str, Any]]],
    ) -> Dict[str, Any]:
        """Génère une heatmap basée sur les scores"""
        grid_data = defaultdict(lambda: {'scores': [], 'count': 0})

        # Calculer les scores et agréger par cellule
        for parcelle in parcelles:
            center = self._get_parcel_center(parcelle)
            if not center:
                continue

            # Calculer le score
            score_result = self.scorer.calculate_score(
                parcelle=parcelle,
                stats_marche=stats_marche,
                demographics=demographics,
                transactions=transactions
            )

            # Ajouter à la cellule
            cell_key = self._get_cell_key(center[0], center[1], grid_size)
            grid_data[cell_key]['scores'].append(score_result['score'])
            grid_data[cell_key]['count'] += 1

        # Convertir en features GeoJSON
        features = []
        for (lon, lat), data in grid_data.items():
            if data['count'] == 0:
                continue

            avg_score = sum(data['scores']) / len(data['scores'])

            # Créer un carré pour la cellule
            features.append({
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[
                        [lon, lat],
                        [lon + grid_size, lat],
                        [lon + grid_size, lat + grid_size],
                        [lon, lat + grid_size],
                        [lon, lat]
                    ]]
                },
                'properties': {
                    'value': round(avg_score, 1),
                    'count': data['count'],
                    'type': 'score',
                    'intensity': avg_score / 100  # Normaliser 0-1
                }
            })

        return {
            'type': 'FeatureCollection',
            'features': features,
            'metadata': {
                'type': 'score',
                'grid_size': grid_size,
                'total_cells': len(features),
                'total_parcelles': sum(f['properties']['count'] for f in features)
            }
        }

    def _generate_prix_heatmap(
        self,
        parcelles: List[Dict[str, Any]],
        transactions: Optional[List[Dict[str, Any]]],
        grid_size: float,
    ) -> Dict[str, Any]:
        """Génère une heatmap basée sur les prix DVF"""
        if not transactions:
            return {
                'type': 'FeatureCollection',
                'features': [],
                'metadata': {'type': 'prix', 'error': 'Aucune transaction disponible'}
            }

        grid_data = defaultdict(lambda: {'prix_m2': [], 'count': 0})

        # Agréger les prix par cellule
        for transaction in transactions:
            geom = transaction.get('geometry', {})
            coords = geom.get('coordinates', [])

            if not coords or len(coords) < 2:
                continue

            lon, lat = coords[0], coords[1]
            props = transaction.get('properties', {})

            # Calculer prix au m²
            valeur = props.get('valeur_fonciere', 0)
            surface = props.get('surface_terrain', 0) or props.get('surface_reelle_bati', 0)

            if surface and surface > 0 and valeur and valeur > 0:
                prix_m2 = valeur / surface

                # Filtrer les valeurs aberrantes
                if 10 <= prix_m2 <= 10000:
                    cell_key = self._get_cell_key(lon, lat, grid_size)
                    grid_data[cell_key]['prix_m2'].append(prix_m2)
                    grid_data[cell_key]['count'] += 1

        # Convertir en features GeoJSON
        features = []
        all_prix = []

        for (lon, lat), data in grid_data.items():
            if data['count'] == 0:
                continue

            avg_prix_m2 = sum(data['prix_m2']) / len(data['prix_m2'])
            all_prix.append(avg_prix_m2)

            features.append({
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[
                        [lon, lat],
                        [lon + grid_size, lat],
                        [lon + grid_size, lat + grid_size],
                        [lon, lat + grid_size],
                        [lon, lat]
                    ]]
                },
                'properties': {
                    'value': round(avg_prix_m2, 2),
                    'count': data['count'],
                    'type': 'prix',
                }
            })

        # Calculer l'intensité relative
        if all_prix:
            min_prix = min(all_prix)
            max_prix = max(all_prix)
            prix_range = max_prix - min_prix if max_prix > min_prix else 1

            for feature in features:
                value = feature['properties']['value']
                # Normaliser l'intensité 0-1
                intensity = (value - min_prix) / prix_range
                feature['properties']['intensity'] = intensity

        return {
            'type': 'FeatureCollection',
            'features': features,
            'metadata': {
                'type': 'prix',
                'grid_size': grid_size,
                'total_cells': len(features),
                'prix_moyen': round(sum(all_prix) / len(all_prix), 2) if all_prix else 0,
                'prix_min': round(min(all_prix), 2) if all_prix else 0,
                'prix_max': round(max(all_prix), 2) if all_prix else 0,
            }
        }

    def _generate_potentiel_heatmap(
        self,
        parcelles: List[Dict[str, Any]],
        grid_size: float,
        stats_marche: Optional[Dict[str, Any]],
        demographics: Optional[Dict[str, Any]],
        transactions: Optional[List[Dict[str, Any]]],
    ) -> Dict[str, Any]:
        """Génère une heatmap du potentiel global (score + attractivité prix)"""
        grid_data = defaultdict(lambda: {'potentiels': [], 'count': 0})

        # Calculer les potentiels par parcelle
        for parcelle in parcelles:
            center = self._get_parcel_center(parcelle)
            if not center:
                continue

            # Calculer le score
            score_result = self.scorer.calculate_score(
                parcelle=parcelle,
                stats_marche=stats_marche,
                demographics=demographics,
                transactions=transactions
            )

            # Le potentiel est une combinaison du score et des détails
            # Formule: score global + bonus si bon rapport qualité/prix
            potentiel = score_result['score']

            # Bonus si excellent rapport qualité/prix
            if score_result['details']['prix'] > 20:
                potentiel += 10

            # Bonus si excellente localisation
            if score_result['details']['localisation'] > 20:
                potentiel += 5

            # Normaliser à 0-100
            potentiel = min(100, potentiel)

            cell_key = self._get_cell_key(center[0], center[1], grid_size)
            grid_data[cell_key]['potentiels'].append(potentiel)
            grid_data[cell_key]['count'] += 1

        # Convertir en features GeoJSON
        features = []
        for (lon, lat), data in grid_data.items():
            if data['count'] == 0:
                continue

            avg_potentiel = sum(data['potentiels']) / len(data['potentiels'])

            features.append({
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[
                        [lon, lat],
                        [lon + grid_size, lat],
                        [lon + grid_size, lat + grid_size],
                        [lon, lat + grid_size],
                        [lon, lat]
                    ]]
                },
                'properties': {
                    'value': round(avg_potentiel, 1),
                    'count': data['count'],
                    'type': 'potentiel',
                    'intensity': avg_potentiel / 100
                }
            })

        return {
            'type': 'FeatureCollection',
            'features': features,
            'metadata': {
                'type': 'potentiel',
                'grid_size': grid_size,
                'total_cells': len(features),
                'total_parcelles': sum(f['properties']['count'] for f in features)
            }
        }

    def _generate_densite_heatmap(
        self,
        parcelles: List[Dict[str, Any]],
        grid_size: float,
    ) -> Dict[str, Any]:
        """Génère une heatmap de densité de parcelles"""
        grid_data = defaultdict(int)

        # Compter les parcelles par cellule
        for parcelle in parcelles:
            center = self._get_parcel_center(parcelle)
            if not center:
                continue

            cell_key = self._get_cell_key(center[0], center[1], grid_size)
            grid_data[cell_key] += 1

        # Trouver le max pour normalisation
        max_count = max(grid_data.values()) if grid_data else 1

        # Convertir en features GeoJSON
        features = []
        for (lon, lat), count in grid_data.items():
            features.append({
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[
                        [lon, lat],
                        [lon + grid_size, lat],
                        [lon + grid_size, lat + grid_size],
                        [lon, lat + grid_size],
                        [lon, lat]
                    ]]
                },
                'properties': {
                    'value': count,
                    'count': count,
                    'type': 'densite',
                    'intensity': count / max_count
                }
            })

        return {
            'type': 'FeatureCollection',
            'features': features,
            'metadata': {
                'type': 'densite',
                'grid_size': grid_size,
                'total_cells': len(features),
                'max_densite': max_count
            }
        }


# Instance globale
def create_heatmap_generator(scorer):
    """Crée une instance du générateur de heatmap"""
    return HeatmapGenerator(scorer)
