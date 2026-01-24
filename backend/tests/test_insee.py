"""
Tests unitaires pour le module INSEE
"""

import json
import pytest
from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import shutil

from app.insee import (
    InseeData,
    TerritoryStats,
    InseeManager,
    CSPCategory,
    InseeIndicator
)


@pytest.fixture
def temp_data_dir():
    """Crée un répertoire temporaire pour les tests"""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def insee_manager(temp_data_dir):
    """Crée une instance de InseeManager pour les tests"""
    return InseeManager(data_dir=temp_data_dir, cache_ttl_days=7)


@pytest.fixture
def sample_insee_data():
    """Données INSEE d'exemple pour les tests"""
    return InseeData(
        code_commune="75056",
        nom_commune="Paris",
        code_departement="75",
        revenu_median=25000.0,
        revenu_moyen=30000.0,
        taux_pauvrete=15.5,
        taux_chomage=8.5,
        taux_activite=72.0,
        csp_cadres=35.0,
        csp_professions_intermediaires=25.0,
        csp_employes=20.0,
       csp_ouvriers=10.0,
        csp_retraites=8.0,
        csp_autres=2.0,
        population=2200000,
        densite=20000.0,
        superficie=105.4,
        age_moyen=38.5,
        nombre_logements=1300000,
        taux_proprietaires=35.0,
        prix_m2_moyen=10000.0,
        annee_reference=2023
    )


class TestInseeDataModel:
    """Tests pour le modèle InseeData"""
    
    def test_create_valid_insee_data(self, sample_insee_data):
        """Test création de données INSEE valides"""
        assert sample_insee_data.code_commune == "75056"
        assert sample_insee_data.nom_commune == "Paris"
        assert sample_insee_data.population == 2200000
    
    def test_invalid_code_commune(self):
        """Test validation du code commune"""
        with pytest.raises(ValueError):
            InseeData(
                code_commune="123",  # Trop court
                nom_commune="Test",
                code_departement="12",
                annee_reference=2023
            )
    
    def test_invalid_code_departement(self):
        """Test validation du code département"""
        with pytest.raises(ValueError):
            InseeData(
                code_commune="12345",
                nom_commune="Test",
                code_departement="1",  # Trop court
                annee_reference=2023
            )
    
    def test_get_csp_dominant(self, sample_insee_data):
        """Test détermination de la CSP dominante"""
        csp = sample_insee_data.get_csp_dominant()
        assert csp == CSPCategory.CADRES
    
    def test_get_csp_dominant_no_data(self):
        """Test CSP dominante sans données"""
        data = InseeData(
            code_commune="12345",
            nom_commune="Test",
            code_departement="12",
            annee_reference=2023
        )
        assert data.get_csp_dominant() is None
    
    def test_get_profil_economique(self, sample_insee_data):
        """Test profil économique"""
        profil = sample_insee_data.get_profil_economique()
        assert profil == "Aisé"  # Revenu médian > 25000
    
    def test_get_profil_economique_moyen(self):
        """Test profil économique moyen"""
        data = InseeData(
            code_commune="12345",
            nom_commune="Test",
            code_departement="12",
            revenu_median=18000.0,
            annee_reference=2023
        )
        assert data.get_profil_economique() == "Moyen"
    
    def test_percentage_validation(self):
        """Test validation des pourcentages"""
        with pytest.raises(ValueError):
            InseeData(
                code_commune="12345",
                nom_commune="Test",
                code_departement="12",
                taux_pauvrete=150.0,  # > 100%
                annee_reference=2023
            )


class TestInseeManager:
    """Tests pour le gestionnaire INSEE"""
    
    def test_init_manager(self, insee_manager, temp_data_dir):
        """Test initialisation du manager"""
        assert insee_manager.data_dir == Path(temp_data_dir)
        assert insee_manager.data_dir.exists()
        assert insee_manager.cache_ttl.days == 7
    
    def test_add_commune_data(self, insee_manager, sample_insee_data):
        """Test ajout de données commune"""
        success = insee_manager.add_commune_data(sample_insee_data)
        assert success is True
        assert "75056" in insee_manager._cache
    
    def test_get_commune(self, insee_manager, sample_insee_data):
        """Test récupération données commune"""
        insee_manager.add_commune_data(sample_insee_data)
        data = insee_manager.get_commune("75056")
        assert data is not None
        assert data.nom_commune == "Paris"
    
    def test_get_commune_not_found(self, insee_manager):
        """Test récupération commune inexistante"""
        data = insee_manager.get_commune("99999")
        assert data is None
    
    def test_get_communes_multiple(self, insee_manager):
        """Test récupération de plusieurs communes"""
        # Ajouter plusieurs communes
        for code in ["75056", "69123", "13055"]:
            data = InseeData(
                code_commune=code,
                nom_commune=f"Commune {code}",
                code_departement=code[:2],
                population=100000,
                annee_reference=2023
            )
            insee_manager.add_commune_data(data)
        
        # Récupérer
        communes = insee_manager.get_communes(["75056", "69123", "13055"])
        assert len(communes) == 3
    
    def test_cache_persistence(self, insee_manager, sample_insee_data):
        """Test persistance du cache"""
        insee_manager.add_commune_data(sample_insee_data)
        
        # Créer un nouveau manager avec le même répertoire
        new_manager = InseeManager(data_dir=str(insee_manager.data_dir))
        data = new_manager.get_commune("75056")
        assert data is not None
        assert data.nom_commune == "Paris"
    
    def test_cache_expiry(self, insee_manager, sample_insee_data):
        """Test expiration du cache"""
        # Ajouter des données
        insee_manager.add_commune_data(sample_insee_data)
        
        # Modifier la date de mise à jour pour simuler l'expiration
        cached_data = insee_manager._cache["75056"]
        cached_data.date_maj = datetime.now() - timedelta(days=100)
        insee_manager._cache["75056"] = cached_data
        
        # Les données devraient être considérées comme expirées
        # (retour None car pas d'API réelle)
        data = insee_manager.get_commune("75056")
        assert data is None
    
    def test_get_cache_info(self, insee_manager, sample_insee_data):
        """Test récupération info cache"""
        insee_manager.add_commune_data(sample_insee_data)
        info = insee_manager.get_cache_info()
        
        assert info["communes_cached"] == 1
        assert info["cache_ttl_days"] == 7
        assert "last_update" in info


class TestTerritoryStats:
    """Tests pour les statistiques de territoire"""
    
    def test_territory_stats_empty(self, insee_manager):
        """Test statistiques territoire vide"""
        stats = insee_manager.get_territory_stats([])
        assert stats.nombre_communes == 0
        assert stats.population_totale == 0
    
    def test_territory_stats_single_commune(self, insee_manager, sample_insee_data):
        """Test statistiques territoire avec 1 commune"""
        insee_manager.add_commune_data(sample_insee_data)
        stats = insee_manager.get_territory_stats(["75056"])
        
        assert stats.nombre_communes == 1
        assert stats.population_totale == 2200000
        assert stats.revenu_median_moyen == 25000.0
    
    def test_territory_stats_multiple_communes(self, insee_manager):
        """Test statistiques territoire avec plusieurs communes"""
        # Créer plusieurs communes
        communes = [
            InseeData(
                code_commune="75056",
                nom_commune="Paris",
                code_departement="75",
                population=2200000,
                revenu_median=25000.0,
                taux_chomage=8.0,
                csp_cadres=35.0,
                annee_reference=2023
            ),
            InseeData(
                code_commune="69123",
                nom_commune="Lyon",
                code_departement="69",
                population=500000,
                revenu_median=22000.0,
                taux_chomage=9.0,
                csp_cadres=30.0,
                annee_reference=2023
            ),
            InseeData(
                code_commune="13055",
                nom_commune="Marseille",
                code_departement="13",
                population=870000,
                revenu_median=18000.0,
                taux_chomage=12.0,
                csp_cadres=20.0,
                annee_reference=2023
            )
        ]
        
        for commune in communes:
            insee_manager.add_commune_data(commune)
        
        # Calculer les stats
        stats = insee_manager.get_territory_stats(["75056", "69123", "13055"])
        
        assert stats.nombre_communes == 3
        assert stats.population_totale == 3570000
        assert stats.revenu_min == 18000.0
        assert stats.revenu_max == 25000.0
        
        # Vérifier moyenne pondérée du revenu
        expected_revenu = (
            (25000 * 2200000) + (22000 * 500000) + (18000 * 870000)
        ) / 3570000
        assert abs(stats.revenu_median_moyen - expected_revenu) < 0.01
    
    def test_csp_distribution(self, insee_manager):
        """Test distribution des CSP"""
        data = InseeData(
            code_commune="75056",
            nom_commune="Paris",
            code_departement="75",
            population=1000000,
            csp_cadres=40.0,
            csp_employes=30.0,
            csp_ouvriers=15.0,
            csp_retraites=10.0,
            csp_autres=5.0,
            annee_reference=2023
        )
        insee_manager.add_commune_data(data)
        
        stats = insee_manager.get_territory_stats(["75056"])
        distribution = stats.csp_distribution
        
        assert distribution[CSPCategory.CADRES.value] == 40.0
        assert distribution[CSPCategory.EMPLOYES.value] == 30.0


class TestEnums:
    """Tests pour les énumérations"""
    
    def test_csp_category_values(self):
        """Test valeurs CSP"""
        assert CSPCategory.CADRES.value == "cadres"
        assert CSPCategory.OUVRIERS.value == "ouvriers"
    
    def test_insee_indicator_values(self):
        """Test valeurs indicateurs"""
        assert InseeIndicator.REVENU_MEDIAN.value == "revenu_median"
        assert InseeIndicator.TAUX_CHOMAGE.value == "taux_chomage"


class TestDataValidation:
    """Tests de validation des données"""
    
    def test_negative_population(self):
        """Test population négative rejetée"""
        with pytest.raises(ValueError):
            InseeData(
                code_commune="12345",
                nom_commune="Test",
                code_departement="12",
                population=-1000,
                annee_reference=2023
            )
    
    def test_age_out_of_range(self):
        """Test âge hors limites"""
        with pytest.raises(ValueError):
            InseeData(
                code_commune="12345",
                nom_commune="Test",
                code_departement="12",
                age_moyen=150,  # > 120
                annee_reference=2023
            )
    
    def test_all_percentages_valid(self, sample_insee_data):
        """Test que tous les pourcentages sont valides"""
        # Tous les pourcentages doivent être entre 0 et 100
        percentage_fields = [
            'taux_pauvrete', 'taux_chomage', 'taux_activite',
            'csp_cadres', 'csp_employes', 'csp_ouvriers', 'csp_retraites',
            'moins_20_ans', 'plus_60_ans', 'logements_vacants',
            'taux_proprietaires', 'taux_hlm'
        ]
        
        for field in percentage_fields:
            value = getattr(sample_insee_data, field, None)
            if value is not None:
                assert 0 <= value <= 100, f"{field} hors limites: {value}"
