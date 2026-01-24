"""
Système de scoring intelligent des parcelles
Calcule un score de 0 à 100 basé sur plusieurs critères
"""
from typing import Dict, Any, List, Optional
from datetime import datetime


class ParcelleScorer:
    """Calcule le score de potentiel d'une parcelle"""

    def __init__(self):
        # Poids des critères (total = 100)
        self.weights = {
            'prix': 25,  # Rapport qualité/prix
            'surface': 20,  # Taille optimale
            'localisation': 25,  # Proximité services, densité
            'marche': 15,  # Dynamisme du marché
            'plu': 15,  # Potentiel constructible
        }

    def calculate_score(
        self,
        parcelle: Dict[str, Any],
        stats_marche: Optional[Dict[str, Any]] = None,
        demographics: Optional[Dict[str, Any]] = None,
        transactions: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Calcule le score complet d'une parcelle

        Args:
            parcelle: Données de la parcelle
            stats_marche: Statistiques du marché local
            demographics: Données démographiques de la commune
            transactions: Transactions DVF récentes

        Returns:
            Dict contenant le score et les détails
        """
        details = {
            'prix': self._score_prix(parcelle, stats_marche, transactions),
            'surface': self._score_surface(parcelle),
            'localisation': self._score_localisation(demographics),
            'marche': self._score_marche(stats_marche),
            'plu': self._score_plu(parcelle),
        }

        # Score total pondéré
        score_total = sum(details[k] for k in details.keys())
        score_total = min(100, max(0, int(score_total)))

        # Déterminer le niveau
        if score_total >= 80:
            niveau = 'excellent'
            color = '#10b981'  # vert
        elif score_total >= 65:
            niveau = 'bon'
            color = '#3b82f6'  # bleu
        elif score_total >= 45:
            niveau = 'moyen'
            color = '#f59e0b'  # orange
        else:
            niveau = 'faible'
            color = '#ef4444'  # rouge

        # Générer des recommandations
        recommandations = self._generate_recommandations(score_total, details)

        return {
            'parcelleId': parcelle.get('properties', {}).get('id', ''),
            'score': score_total,
            'details': details,
            'niveau': niveau,
            'color': color,
            'recommandations': recommandations,
        }

    def _score_prix(
        self,
        parcelle: Dict[str, Any],
        stats_marche: Optional[Dict[str, Any]],
        transactions: Optional[List[Dict[str, Any]]],
    ) -> float:
        """Score basé sur le rapport qualité/prix (0-25 points)"""
        if not transactions or not stats_marche:
            return 12.5  # Score neutre

        # Récupérer les transactions liées à cette parcelle
        parcelle_transactions = [
            t for t in transactions
            if t.get('properties', {}).get('code_parcelle') == parcelle.get('properties', {}).get('id')
        ]

        if not parcelle_transactions:
            return 12.5  # Pas de données de prix

        # Prix moyen de la parcelle
        prix_parcelle = sum(
            t.get('properties', {}).get('valeur_fonciere', 0)
            for t in parcelle_transactions
        ) / len(parcelle_transactions)

        # Prix moyen du marché
        prix_marche = stats_marche.get('statistiques', {}).get('prix_moyen', prix_parcelle)

        if prix_marche == 0:
            return 12.5

        # Ratio prix parcelle / prix marché
        ratio = prix_parcelle / prix_marche

        # Scoring : mieux c'est moins cher que le marché
        if ratio < 0.7:  # 30% moins cher
            return 25
        elif ratio < 0.85:  # 15% moins cher
            return 20
        elif ratio < 1.0:  # Légèrement moins cher
            return 15
        elif ratio < 1.15:  # Légèrement plus cher
            return 10
        elif ratio < 1.30:  # Significativement plus cher
            return 5
        else:
            return 0

    def _score_surface(self, parcelle: Dict[str, Any]) -> float:
        """Score basé sur la surface (0-20 points)"""
        surface = parcelle.get('properties', {}).get('contenance', 0)

        if surface == 0:
            return 0

        # Surface optimale : 500-2000 m²
        if 500 <= surface <= 2000:
            return 20
        elif 300 <= surface < 500 or 2000 < surface <= 3000:
            return 15
        elif 200 <= surface < 300 or 3000 < surface <= 5000:
            return 10
        elif 100 <= surface < 200 or 5000 < surface <= 10000:
            return 5
        else:
            return 2

    def _score_localisation(self, demographics: Optional[Dict[str, Any]]) -> float:
        """Score basé sur la localisation (0-25 points)"""
        if not demographics:
            return 12.5  # Score neutre

        score = 0

        # Densité de population (indicateur de demande)
        densite = demographics.get('densite', 0)
        if 1000 <= densite <= 5000:  # Zone urbaine dense idéale
            score += 10
        elif 500 <= densite < 1000 or 5000 < densite <= 8000:
            score += 7
        elif 100 <= densite < 500:
            score += 5
        else:
            score += 2

        # Population totale (taille du marché)
        population = demographics.get('population', 0)
        if population > 50000:  # Grande ville
            score += 10
        elif population > 20000:  # Ville moyenne
            score += 7
        elif population > 5000:  # Petite ville
            score += 5
        else:
            score += 2

        # Dynamique démographique (si disponible)
        # À implémenter avec données historiques
        score += 5  # Score par défaut

        return min(25, score)

    def _score_marche(self, stats_marche: Optional[Dict[str, Any]]) -> float:
        """Score basé sur le dynamisme du marché (0-15 points)"""
        if not stats_marche:
            return 7.5  # Score neutre

        score = 0

        # Nombre de transactions (liquidité du marché)
        nb_transactions = stats_marche.get('nb_transactions', 0)
        if nb_transactions > 100:
            score += 7
        elif nb_transactions > 50:
            score += 5
        elif nb_transactions > 20:
            score += 3
        else:
            score += 1

        # Évolution des prix (tendance)
        evolution = stats_marche.get('evolution', [])
        if len(evolution) >= 2:
            recent = evolution[-1].get('prix_moyen', 0)
            previous = evolution[-2].get('prix_moyen', 0)

            if recent and previous:
                croissance = ((recent - previous) / previous) * 100

                if 2 <= croissance <= 10:  # Croissance saine
                    score += 8
                elif 0 <= croissance < 2 or 10 < croissance <= 15:
                    score += 5
                elif croissance > 15:  # Surchauffe
                    score += 3
                else:  # Baisse
                    score += 1
            else:
                score += 4
        else:
            score += 4

        return min(15, score)

    def _score_plu(self, parcelle: Dict[str, Any]) -> float:
        """Score basé sur le potentiel PLU/constructibilité (0-15 points)"""
        # À implémenter avec données PLU réelles
        # Pour l'instant, score par défaut
        return 10

    def _generate_recommandations(
        self, score_total: int, details: Dict[str, float]
    ) -> List[str]:
        """Génère des recommandations basées sur le score"""
        recommendations = []

        if score_total >= 80:
            recommendations.append("Excellent potentiel - À prioriser pour prospection")
            recommendations.append("Profil idéal pour développement rapide")
        elif score_total >= 65:
            recommendations.append("Bon potentiel - Opportunité intéressante")
            recommendations.append("Analyser en détail avant de contacter")
        elif score_total >= 45:
            recommendations.append("Potentiel modéré - Évaluer les contraintes")
            recommendations.append("Peut convenir selon le projet spécifique")
        else:
            recommendations.append("Potentiel limité - Approche sélective")
            recommendations.append("Vérifier si conditions particulières")

        # Recommandations spécifiques par critère
        if details['prix'] < 10:
            recommendations.append("⚠️ Prix élevé par rapport au marché")
        elif details['prix'] > 20:
            recommendations.append("💰 Prix attractif - Bon rapport qualité/prix")

        if details['surface'] < 10:
            recommendations.append("⚠️ Surface peu optimale pour le développement")
        elif details['surface'] > 15:
            recommendations.append("📐 Surface adaptée au développement")

        if details['localisation'] < 12:
            recommendations.append("📍 Zone moins dynamique - Étudier accessibilité")
        elif details['localisation'] > 20:
            recommendations.append("🌆 Excellente localisation - Zone recherchée")

        if details['marche'] < 7:
            recommendations.append("📉 Marché peu actif - Prudence sur liquidité")
        elif details['marche'] > 12:
            recommendations.append("📈 Marché dynamique - Forte demande")

        return recommendations[:6]  # Maximum 6 recommandations


# Instance globale
scorer = ParcelleScorer()
