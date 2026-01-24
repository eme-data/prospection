"""
Analyse de l'évolution temporelle des prix DVF
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
from collections import defaultdict
import statistics


class EvolutionAnalyzer:
    """Analyse l'évolution temporelle des données DVF"""

    def analyze_evolution(
        self,
        transactions: List[Dict[str, Any]],
        grouping: str = 'month',  # month, quarter, year
        type_local: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Analyse l'évolution temporelle des transactions

        Args:
            transactions: Liste des transactions DVF
            grouping: Niveau d'agrégation (month, quarter, year)
            type_local: Filtrer par type de local (optionnel)

        Returns:
            Données d'évolution avec statistiques par période
        """
        # Filtrer par type si demandé
        if type_local:
            transactions = [
                t for t in transactions
                if t.get('properties', {}).get('type_local') == type_local
            ]

        if not transactions:
            return {
                'series': [],
                'stats': {'total_transactions': 0},
                'metadata': {'grouping': grouping, 'type_local': type_local}
            }

        # Grouper les transactions par période
        grouped_data = defaultdict(list)

        for transaction in transactions:
            props = transaction.get('properties', {})
            date_str = props.get('date_mutation')

            if not date_str:
                continue

            try:
                date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            except:
                continue

            # Déterminer la clé de période
            if grouping == 'month':
                period_key = date.strftime('%Y-%m')
                period_label = date.strftime('%b %Y')
            elif grouping == 'quarter':
                quarter = (date.month - 1) // 3 + 1
                period_key = f"{date.year}-Q{quarter}"
                period_label = f"Q{quarter} {date.year}"
            elif grouping == 'year':
                period_key = str(date.year)
                period_label = str(date.year)
            else:
                period_key = date.strftime('%Y-%m')
                period_label = date.strftime('%b %Y')

            # Calculer le prix au m² si possible
            valeur = props.get('valeur_fonciere', 0)
            surface = props.get('surface_terrain', 0) or props.get('surface_reelle_bati', 0)

            if valeur and valeur > 0:
                prix_m2 = valeur / surface if surface and surface > 0 else None

                grouped_data[period_key].append({
                    'period_key': period_key,
                    'period_label': period_label,
                    'date': date,
                    'valeur': valeur,
                    'surface': surface,
                    'prix_m2': prix_m2,
                    'type_local': props.get('type_local'),
                    'nb_pieces': props.get('nombre_pieces', 0),
                })

        # Calculer les statistiques par période
        series = []
        for period_key in sorted(grouped_data.keys()):
            period_transactions = grouped_data[period_key]

            if not period_transactions:
                continue

            valeurs = [t['valeur'] for t in period_transactions]
            prix_m2_list = [t['prix_m2'] for t in period_transactions if t['prix_m2']]

            # Filtrer les prix au m² aberrants
            prix_m2_filtered = [p for p in prix_m2_list if 10 <= p <= 10000]

            series.append({
                'period': period_key,
                'label': period_transactions[0]['period_label'],
                'count': len(period_transactions),
                'valeur_moyenne': round(statistics.mean(valeurs), 2) if valeurs else 0,
                'valeur_mediane': round(statistics.median(valeurs), 2) if valeurs else 0,
                'valeur_min': round(min(valeurs), 2) if valeurs else 0,
                'valeur_max': round(max(valeurs), 2) if valeurs else 0,
                'prix_m2_moyen': round(statistics.mean(prix_m2_filtered), 2) if prix_m2_filtered else None,
                'prix_m2_median': round(statistics.median(prix_m2_filtered), 2) if prix_m2_filtered else None,
                'prix_m2_min': round(min(prix_m2_filtered), 2) if prix_m2_filtered else None,
                'prix_m2_max': round(max(prix_m2_filtered), 2) if prix_m2_filtered else None,
            })

        # Calculer les statistiques globales
        all_values = [t['valeur'] for period_data in grouped_data.values() for t in period_data]
        all_prix_m2 = [
            t['prix_m2']
            for period_data in grouped_data.values()
            for t in period_data
            if t['prix_m2'] and 10 <= t['prix_m2'] <= 10000
        ]

        # Calculer la tendance (variation entre première et dernière période)
        tendance = None
        if len(series) >= 2:
            first_prix = series[0].get('prix_m2_moyen') or series[0].get('valeur_moyenne')
            last_prix = series[-1].get('prix_m2_moyen') or series[-1].get('valeur_moyenne')

            if first_prix and last_prix and first_prix > 0:
                variation = ((last_prix - first_prix) / first_prix) * 100
                tendance = {
                    'variation_pct': round(variation, 2),
                    'direction': 'hausse' if variation > 0 else 'baisse' if variation < 0 else 'stable',
                    'first_value': round(first_prix, 2),
                    'last_value': round(last_prix, 2),
                    'first_period': series[0]['label'],
                    'last_period': series[-1]['label'],
                }

        stats = {
            'total_transactions': len(all_values),
            'valeur_moyenne_globale': round(statistics.mean(all_values), 2) if all_values else 0,
            'valeur_mediane_globale': round(statistics.median(all_values), 2) if all_values else 0,
            'prix_m2_moyen_global': round(statistics.mean(all_prix_m2), 2) if all_prix_m2 else None,
            'prix_m2_median_global': round(statistics.median(all_prix_m2), 2) if all_prix_m2 else None,
            'tendance': tendance,
        }

        return {
            'series': series,
            'stats': stats,
            'metadata': {
                'grouping': grouping,
                'type_local': type_local,
                'nb_periods': len(series),
                'date_min': series[0]['period'] if series else None,
                'date_max': series[-1]['period'] if series else None,
            }
        }

    def analyze_by_type(
        self,
        transactions: List[Dict[str, Any]],
        grouping: str = 'year',
    ) -> Dict[str, Any]:
        """
        Analyse l'évolution par type de bien

        Args:
            transactions: Liste des transactions DVF
            grouping: Niveau d'agrégation

        Returns:
            Évolution par type de bien
        """
        # Identifier les types présents
        types_present = set()
        for t in transactions:
            type_local = t.get('properties', {}).get('type_local')
            if type_local:
                types_present.add(type_local)

        # Analyser chaque type
        evolutions_by_type = {}
        for type_local in types_present:
            evolution = self.analyze_evolution(
                transactions=transactions,
                grouping=grouping,
                type_local=type_local
            )
            evolutions_by_type[type_local] = evolution

        return {
            'types': list(types_present),
            'evolutions': evolutions_by_type,
            'metadata': {
                'grouping': grouping,
                'nb_types': len(types_present),
            }
        }


# Instance globale
evolution_analyzer = EvolutionAnalyzer()
