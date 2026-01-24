"""
Clustering intelligent de parcelles
Regroupe les parcelles proches avec des caractéristiques similaires
"""
from typing import Dict, Any, List, Optional, Tuple
import math
from collections import defaultdict


class ParcelleClusterer:
    """Algorithme de clustering pour regrouper les parcelles"""

    def __init__(self, scorer):
        self.scorer = scorer

    def cluster_parcelles(
        self,
        parcelles: List[Dict[str, Any]],
        method: str = 'score',
        distance_threshold: float = 0.01,  # ~1km
        min_cluster_size: int = 2,
        stats_marche: Optional[Dict[str, Any]] = None,
        demographics: Optional[Dict[str, Any]] = None,
        transactions: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Crée des clusters de parcelles

        Args:
            parcelles: Liste des parcelles
            method: Méthode de clustering (score, proximity, mixed)
            distance_threshold: Distance max pour regroupement (en degrés)
            min_cluster_size: Taille minimale d'un cluster
            stats_marche: Stats du marché
            demographics: Données démographiques
            transactions: Transactions DVF

        Returns:
            Clusters avec statistiques agrégées
        """
        # Enrichir les parcelles avec leurs centres et scores
        enriched_parcelles = []
        for parcelle in parcelles:
            center = self._get_parcel_center(parcelle)
            if not center:
                continue

            # Calculer le score si nécessaire
            score = None
            if method in ['score', 'mixed']:
                score_result = self.scorer.calculate_score(
                    parcelle=parcelle,
                    stats_marche=stats_marche,
                    demographics=demographics,
                    transactions=transactions
                )
                score = score_result['score']

            enriched_parcelles.append({
                'parcelle': parcelle,
                'center': center,
                'score': score,
            })

        # Créer les clusters selon la méthode
        if method == 'proximity':
            clusters = self._cluster_by_proximity(enriched_parcelles, distance_threshold)
        elif method == 'score':
            clusters = self._cluster_by_score(enriched_parcelles, distance_threshold)
        elif method == 'mixed':
            clusters = self._cluster_mixed(enriched_parcelles, distance_threshold)
        else:
            raise ValueError(f"Méthode de clustering inconnue: {method}")

        # Filtrer les clusters trop petits
        clusters = [c for c in clusters if len(c['parcelles']) >= min_cluster_size]

        # Calculer les statistiques pour chaque cluster
        for cluster in clusters:
            cluster['stats'] = self._calculate_cluster_stats(cluster)

        # Générer le GeoJSON
        return self._clusters_to_geojson(clusters, method)

    def _get_parcel_center(self, parcelle: Dict[str, Any]) -> Optional[Tuple[float, float]]:
        """Calcule le centre d'une parcelle"""
        geom = parcelle.get('geometry', {})
        coords = geom.get('coordinates', [])

        if not coords:
            return None

        # Gérer Polygon et MultiPolygon
        if geom.get('type') == 'Polygon':
            ring = coords[0]
        elif geom.get('type') == 'MultiPolygon':
            if len(coords) > 0 and len(coords[0]) > 0:
                ring = coords[0][0]
            else:
                return None
        else:
            return None

        if not ring or len(ring) < 3:
            return None

        # Centroïde simple
        sum_lon = sum(point[0] for point in ring)
        sum_lat = sum(point[1] for point in ring)
        return (sum_lon / len(ring), sum_lat / len(ring))

    def _distance(self, p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
        """Calcule la distance euclidienne entre deux points"""
        return math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)

    def _cluster_by_proximity(
        self,
        parcelles: List[Dict[str, Any]],
        distance_threshold: float
    ) -> List[Dict[str, Any]]:
        """Clustering basé uniquement sur la proximité géographique"""
        clusters = []
        used = set()

        for i, p1 in enumerate(parcelles):
            if i in used:
                continue

            # Créer un nouveau cluster
            cluster_parcelles = [p1]
            used.add(i)

            # Trouver toutes les parcelles proches
            for j, p2 in enumerate(parcelles):
                if j in used:
                    continue

                # Vérifier la distance au centre du cluster
                cluster_center = self._calculate_center([p['center'] for p in cluster_parcelles])
                if self._distance(cluster_center, p2['center']) <= distance_threshold:
                    cluster_parcelles.append(p2)
                    used.add(j)

            clusters.append({
                'id': f"cluster_{len(clusters)}",
                'parcelles': cluster_parcelles,
            })

        return clusters

    def _cluster_by_score(
        self,
        parcelles: List[Dict[str, Any]],
        distance_threshold: float
    ) -> List[Dict[str, Any]]:
        """Clustering basé sur le score ET la proximité"""
        # D'abord regrouper par tranche de score
        score_groups = defaultdict(list)
        for p in parcelles:
            if p['score'] is None:
                continue
            # Regrouper par tranches de 20 points
            score_bin = (p['score'] // 20) * 20
            score_groups[score_bin].append(p)

        # Ensuite appliquer le clustering géographique dans chaque groupe
        clusters = []
        for score_bin, group_parcelles in score_groups.items():
            group_clusters = self._cluster_by_proximity(group_parcelles, distance_threshold)
            clusters.extend(group_clusters)

        return clusters

    def _cluster_mixed(
        self,
        parcelles: List[Dict[str, Any]],
        distance_threshold: float
    ) -> List[Dict[str, Any]]:
        """Clustering mixte: proximité + similarité de score"""
        clusters = []
        used = set()

        for i, p1 in enumerate(parcelles):
            if i in used or p1['score'] is None:
                continue

            cluster_parcelles = [p1]
            used.add(i)

            for j, p2 in enumerate(parcelles):
                if j in used or p2['score'] is None:
                    continue

                # Vérifier distance ET similarité de score (±15 points)
                cluster_center = self._calculate_center([p['center'] for p in cluster_parcelles])
                avg_score = sum(p['score'] for p in cluster_parcelles) / len(cluster_parcelles)

                distance_ok = self._distance(cluster_center, p2['center']) <= distance_threshold
                score_ok = abs(p2['score'] - avg_score) <= 15

                if distance_ok and score_ok:
                    cluster_parcelles.append(p2)
                    used.add(j)

            clusters.append({
                'id': f"cluster_{len(clusters)}",
                'parcelles': cluster_parcelles,
            })

        return clusters

    def _calculate_center(self, points: List[Tuple[float, float]]) -> Tuple[float, float]:
        """Calcule le centre d'un ensemble de points"""
        if not points:
            return (0, 0)
        avg_lon = sum(p[0] for p in points) / len(points)
        avg_lat = sum(p[1] for p in points) / len(points)
        return (avg_lon, avg_lat)

    def _calculate_cluster_stats(self, cluster: Dict[str, Any]) -> Dict[str, Any]:
        """Calcule les statistiques d'un cluster"""
        parcelles = cluster['parcelles']

        if not parcelles:
            return {}

        # Centre géographique
        centers = [p['center'] for p in parcelles]
        cluster_center = self._calculate_center(centers)

        # Statistiques de base
        surfaces = [
            p['parcelle'].get('properties', {}).get('contenance', 0)
            for p in parcelles
        ]
        surface_totale = sum(surfaces)
        surface_moyenne = surface_totale / len(surfaces) if surfaces else 0

        stats = {
            'count': len(parcelles),
            'center': {
                'lon': cluster_center[0],
                'lat': cluster_center[1],
            },
            'surface_totale': surface_totale,
            'surface_moyenne': round(surface_moyenne, 2),
        }

        # Statistiques de score si disponibles
        scores = [p['score'] for p in parcelles if p['score'] is not None]
        if scores:
            stats['score_moyen'] = round(sum(scores) / len(scores), 1)
            stats['score_min'] = min(scores)
            stats['score_max'] = max(scores)

            # Répartition par niveau
            stats['niveaux'] = {
                'excellent': sum(1 for s in scores if s >= 80),
                'bon': sum(1 for s in scores if 65 <= s < 80),
                'moyen': sum(1 for s in scores if 45 <= s < 65),
                'faible': sum(1 for s in scores if s < 45),
            }

        return stats

    def _clusters_to_geojson(
        self,
        clusters: List[Dict[str, Any]],
        method: str
    ) -> Dict[str, Any]:
        """Convertit les clusters en GeoJSON"""
        features = []

        for cluster in clusters:
            stats = cluster['stats']

            # Créer un cercle autour du centre du cluster
            center = stats['center']
            radius = self._calculate_cluster_radius(cluster)

            # Générer un polygone circulaire approximatif
            circle_points = []
            num_points = 32
            for i in range(num_points + 1):
                angle = (2 * math.pi * i) / num_points
                lat = center['lat'] + radius * math.sin(angle)
                lon = center['lon'] + radius * math.cos(angle)
                circle_points.append([lon, lat])

            features.append({
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [circle_points]
                },
                'properties': {
                    'cluster_id': cluster['id'],
                    'count': stats['count'],
                    'center_lon': center['lon'],
                    'center_lat': center['lat'],
                    'surface_totale': stats['surface_totale'],
                    'surface_moyenne': stats['surface_moyenne'],
                    'score_moyen': stats.get('score_moyen'),
                    'score_min': stats.get('score_min'),
                    'score_max': stats.get('score_max'),
                    'niveaux': stats.get('niveaux'),
                    'radius': radius,
                    'method': method,
                }
            })

        return {
            'type': 'FeatureCollection',
            'features': features,
            'metadata': {
                'method': method,
                'total_clusters': len(features),
                'total_parcelles': sum(f['properties']['count'] for f in features),
            }
        }

    def _calculate_cluster_radius(self, cluster: Dict[str, Any]) -> float:
        """Calcule le rayon d'un cluster basé sur sa dispersion"""
        parcelles = cluster['parcelles']
        center = cluster['stats']['center']
        center_point = (center['lon'], center['lat'])

        # Calculer la distance max au centre
        max_distance = 0
        for p in parcelles:
            distance = self._distance(center_point, p['center'])
            max_distance = max(max_distance, distance)

        # Ajouter une marge de 20%
        return max_distance * 1.2 if max_distance > 0 else 0.005


# Instance globale
def create_clusterer(scorer):
    """Crée une instance du clusterer"""
    return ParcelleClusterer(scorer)
