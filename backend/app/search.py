"""
Recherche avancée avec combinaison de filtres
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import json


class AdvancedSearch:
    """Moteur de recherche avancée pour parcelles"""

    def __init__(self, scorer, prospection_manager, fiches_manager):
        self.scorer = scorer
        self.prospection_manager = prospection_manager
        self.fiches_manager = fiches_manager

    async def search(
        self,
        parcelles: List[Dict[str, Any]],
        filters: Dict[str, Any],
        stats_marche: Optional[Dict[str, Any]] = None,
        demographics: Optional[Dict[str, Any]] = None,
        transactions: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Recherche avancée avec filtres combinés

        Args:
            parcelles: Liste des parcelles brutes
            filters: Dictionnaire de filtres
            stats_marche: Stats du marché
            demographics: Données démographiques
            transactions: Transactions DVF

        Returns:
            Résultats avec parcelles enrichies et facettes
        """
        # Liste pour stocker les résultats enrichis
        results = []

        # Récupérer toutes les prospections et fiches pour optimiser
        all_prospections = {
            p['parcelleId']: p
            for p in self.prospection_manager.prospections.values()
        }
        all_fiches = {
            f['parcelleId']: f
            for f in self.fiches_manager.fiches.values()
        }

        # Traiter chaque parcelle
        for parcelle in parcelles:
            parcelle_id = parcelle.get('properties', {}).get('id', '')

            # Enrichir la parcelle avec toutes les données
            enriched = {
                'parcelle': parcelle,
                'score': None,
                'prospection': all_prospections.get(parcelle_id),
                'fiche': all_fiches.get(parcelle_id),
            }

            # Calculer le score si demandé
            if filters.get('include_score', True):
                score = self.scorer.calculate_score(
                    parcelle=parcelle,
                    stats_marche=stats_marche,
                    demographics=demographics,
                    transactions=transactions
                )
                enriched['score'] = score

            # Appliquer tous les filtres
            if self._matches_filters(enriched, filters):
                results.append(enriched)

        # Trier les résultats
        results = self._sort_results(results, filters.get('sort_by', 'score'))

        # Pagination
        page = filters.get('page', 1)
        per_page = filters.get('per_page', 50)
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page

        paginated_results = results[start_idx:end_idx]

        # Calculer les facettes
        facettes = self._calculate_facettes(results)

        return {
            'parcelles': paginated_results,
            'total': len(results),
            'page': page,
            'per_page': per_page,
            'total_pages': (len(results) + per_page - 1) // per_page,
            'facettes': facettes,
        }

    def _matches_filters(self, enriched: Dict[str, Any], filters: Dict[str, Any]) -> bool:
        """Vérifie si une parcelle enrichie correspond aux filtres"""
        parcelle = enriched['parcelle']
        props = parcelle.get('properties', {})
        score = enriched.get('score')
        prospection = enriched.get('prospection')
        fiche = enriched.get('fiche')

        # ============== FILTRES PARCELLE ==============

        # Surface parcelle
        surface = props.get('contenance', 0)
        if filters.get('surface_parcelle_min') and surface < filters['surface_parcelle_min']:
            return False
        if filters.get('surface_parcelle_max') and surface > filters['surface_parcelle_max']:
            return False

        # Section
        if filters.get('section'):
            if props.get('section') != filters['section']:
                return False

        # Commune
        if filters.get('communes_codes'):
            commune_code = props.get('commune', '')
            if commune_code not in filters['communes_codes']:
                return False

        # ============== FILTRES SCORING ==============

        if score:
            # Score min/max
            if filters.get('score_min') and score['score'] < filters['score_min']:
                return False
            if filters.get('score_max') and score['score'] > filters['score_max']:
                return False

            # Niveau de score
            if filters.get('niveau_score'):
                if score['niveau'] not in filters['niveau_score']:
                    return False

        # ============== FILTRES PROSPECTION ==============

        # Statut prospection
        if filters.get('statuts'):
            if not prospection:
                return False
            if prospection.get('statut') not in filters['statuts']:
                return False

        # Dates de contact
        if prospection:
            date_contact = prospection.get('dateContact')
            if date_contact:
                if filters.get('date_contact_min') and date_contact < filters['date_contact_min']:
                    return False
                if filters.get('date_contact_max') and date_contact > filters['date_contact_max']:
                    return False

        # ============== FILTRES FICHE ==============

        if fiche:
            # Tags
            if filters.get('tags'):
                fiche_tags = set(fiche.get('tags', []))
                filter_tags = set(filters['tags'])
                # Au moins un tag doit matcher
                if not fiche_tags.intersection(filter_tags):
                    return False

            # Avec notes
            if filters.get('avec_notes') is not None:
                has_notes = len(fiche.get('notes', [])) > 0
                if filters['avec_notes'] != has_notes:
                    return False

            # Avec photos
            if filters.get('avec_photos') is not None:
                has_photos = len(fiche.get('photos', [])) > 0
                if filters['avec_photos'] != has_photos:
                    return False

            # Avec documents
            if filters.get('avec_documents') is not None:
                has_documents = len(fiche.get('documents', [])) > 0
                if filters['avec_documents'] != has_documents:
                    return False

        # ============== FILTRES DVF ==============

        # Prix (si on a des données DVF sur cette parcelle)
        # Note: nécessiterait un matching parcelle-transaction plus robuste
        # Pour l'instant, on skip ces filtres

        # Tous les filtres passent
        return True

    def _sort_results(
        self,
        results: List[Dict[str, Any]],
        sort_by: str
    ) -> List[Dict[str, Any]]:
        """Trie les résultats"""
        if sort_by == 'score':
            # Trier par score décroissant
            return sorted(
                results,
                key=lambda x: x.get('score', {}).get('score', 0) if x.get('score') else 0,
                reverse=True
            )
        elif sort_by == 'surface':
            # Trier par surface décroissante
            return sorted(
                results,
                key=lambda x: x['parcelle'].get('properties', {}).get('contenance', 0),
                reverse=True
            )
        elif sort_by == 'date_contact':
            # Trier par date de contact récente
            def get_date(x):
                prosp = x.get('prospection')
                if prosp and prosp.get('dateContact'):
                    return prosp['dateContact']
                return ''
            return sorted(results, key=get_date, reverse=True)
        elif sort_by == 'updated':
            # Trier par date de mise à jour de la fiche
            def get_updated(x):
                fiche = x.get('fiche')
                if fiche and fiche.get('updatedAt'):
                    return fiche['updatedAt']
                return ''
            return sorted(results, key=get_updated, reverse=True)
        else:
            # Tri par défaut: score
            return sorted(
                results,
                key=lambda x: x.get('score', {}).get('score', 0) if x.get('score') else 0,
                reverse=True
            )

    def _calculate_facettes(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calcule les facettes pour affichage"""
        facettes = {
            'statuts': {},
            'scores': {
                'excellent': 0,
                'bon': 0,
                'moyen': 0,
                'faible': 0,
            },
            'communes': {},
            'tags': {},
        }

        for result in results:
            # Facette statuts
            prospection = result.get('prospection')
            if prospection:
                statut = prospection.get('statut', 'a_prospecter')
                facettes['statuts'][statut] = facettes['statuts'].get(statut, 0) + 1

            # Facette scores
            score = result.get('score')
            if score:
                niveau = score.get('niveau', 'faible')
                facettes['scores'][niveau] += 1

            # Facette communes
            commune = result['parcelle'].get('properties', {}).get('commune', '')
            if commune:
                facettes['communes'][commune] = facettes['communes'].get(commune, 0) + 1

            # Facette tags
            fiche = result.get('fiche')
            if fiche:
                for tag in fiche.get('tags', []):
                    facettes['tags'][tag] = facettes['tags'].get(tag, 0) + 1

        return facettes


# Fonction helper pour créer l'instance
def create_search_engine(scorer, prospection_manager, fiches_manager):
    """Crée une instance du moteur de recherche"""
    return AdvancedSearch(scorer, prospection_manager, fiches_manager)
