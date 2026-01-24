"""
Module de gestion des données socio-économiques INSEE

Ce module permet de récupérer, mettre en cache et exposer les données
socio-économiques de l'INSEE pour enrichir l'analyse de prospection.
"""

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
from enum import Enum

import httpx
from pydantic import BaseModel, Field, validator

logger = logging.getLogger(__name__)


class CSPCategory(str, Enum):
    """Catégories socio-professionnelles"""
    AGRICULTEURS = "agriculteurs"
    ARTISANS_COMMERCANTS = "artisans_commercants"
    CADRES = "cadres"
    PROFESSIONS_INTERMEDIAIRES = "professions_intermediaires"
    EMPLOYES = "employes"
    OUVRIERS = "ouvriers"
    RETRAITES = "retraites"
    AUTRES = "autres"


class InseeIndicator(str, Enum):
    """Indicateurs INSEE disponibles"""
    REVENU_MEDIAN = "revenu_median"
    REVENU_MOYEN = "revenu_moyen"
    TAUX_PAUVRETE = "taux_pauvrete"
    TAUX_CHOMAGE = "taux_chomage"
    DENSITE = "densite"
    POPULATION = "population"
    TAUX_PROPRIETAIRES = "taux_proprietaires"


class InseeData(BaseModel):
    """Modèle des données socio-économiques INSEE pour une commune"""
    
    # Identification
    code_commune: str = Field(..., description="Code INSEE de la commune")
    nom_commune: str = Field(..., description="Nom de la commune")
    code_departement: str = Field(..., description="Code du département")
    code_iris: Optional[str] = Field(None, description="Code IRIS si disponible")
    
    # Revenus (en euros)
    revenu_median: Optional[float] = Field(None, description="Revenu médian par UC")
    revenu_moyen: Optional[float] = Field(None, description="Revenu moyen par UC")
    taux_pauvrete: Optional[float] = Field(None, ge=0, le=100, description="Taux de pauvreté en %")
    decile_1: Optional[float] = Field(None, description="1er décile de revenus")
    decile_9: Optional[float] = Field(None, description="9e décile de revenus")
    
    # Emploi (en %)
    taux_chomage: Optional[float] = Field(None, ge=0, le=100, description="Taux de chômage")
    taux_activite: Optional[float] = Field(None, ge=0, le=100, description="Taux d'activité")
    
    # Catégories socio-professionnelles (en %)
    csp_agriculteurs: Optional[float] = Field(None, ge=0, le=100)
    csp_artisans_commercants: Optional[float] = Field(None, ge=0, le=100)
    csp_cadres: Optional[float] = Field(None, ge=0, le=100)
    csp_professions_intermediaires: Optional[float] = Field(None, ge=0, le=100)
    csp_employes: Optional[float] = Field(None, ge=0, le=100)
    csp_ouvriers: Optional[float] = Field(None, ge=0, le=100)
    csp_retraites: Optional[float] = Field(None, ge=0, le=100)
    csp_autres: Optional[float] = Field(None, ge=0, le=100)
    
    # Démographie
    population: Optional[int] = Field(None, ge=0, description="Population totale")
    densite: Optional[float] = Field(None, ge=0, description="Densité (hab/km²)")
    superficie: Optional[float] = Field(None, ge=0, description="Superficie en km²")
    age_moyen: Optional[float] = Field(None, ge=0, le=120, description="Âge moyen")
    moins_20_ans: Optional[float] = Field(None, ge=0, le=100, description="% moins de 20 ans")
    plus_60_ans: Optional[float] = Field(None, ge=0, le=100, description="% plus de 60 ans")
    
    # Logement
    nombre_logements: Optional[int] = Field(None, ge=0, description="Nombre total de logements")
    logements_vacants: Optional[float] = Field(None, ge=0, le=100, description="% logements vacants")
    residences_principales: Optional[float] = Field(None, ge=0, le=100, description="% résidences principales")
    taux_proprietaires: Optional[float] = Field(None, ge=0, le=100, description="% propriétaires")
    taux_hlm: Optional[float] = Field(None, ge=0, le=100, description="% logements HLM")
    prix_m2_moyen: Optional[float] = Field(None, ge=0, description="Prix moyen m² en €")
    
    # Métadonnées
    annee_reference: int = Field(..., description="Année de référence des données")
    date_maj: datetime = Field(default_factory=datetime.now, description="Date de mise à jour")
    source: str = Field(default="INSEE", description="Source des données")
    
    @validator('code_commune')
    def validate_code_commune(cls, v):
        """Valide le format du code commune INSEE"""
        if not v or len(v) != 5 or not v.isdigit():
            raise ValueError("Le code commune doit être composé de 5 chiffres")
        return v
    
    @validator('code_departement')
    def validate_code_departement(cls, v):
        """Valide le format du code département"""
        if not v or (len(v) not in [2, 3]) or not v.isdigit():
            raise ValueError("Le code département doit être composé de 2 ou 3 chiffres")
        return v
    
    def get_csp_dominant(self) -> Optional[CSPCategory]:
        """Retourne la catégorie socio-professionnelle dominante"""
        csp_values = {
            CSPCategory.AGRICULTEURS: self.csp_agriculteurs or 0,
            CSPCategory.ARTISANS_COMMERCANTS: self.csp_artisans_commercants or 0,
            CSPCategory.CADRES: self.csp_cadres or 0,
            CSPCategory.PROFESSIONS_INTERMEDIAIRES: self.csp_professions_intermediaires or 0,
            CSPCategory.EMPLOYES: self.csp_employes or 0,
            CSPCategory.OUVRIERS: self.csp_ouvriers or 0,
            CSPCategory.RETRAITES: self.csp_retraites or 0,
        }
        
        if max(csp_values.values()) == 0:
            return None
        
        return max(csp_values, key=csp_values.get)
    
    def get_profil_economique(self) -> str:
        """Retourne un profil économique simplifié"""
        if not self.revenu_median:
            return "Données insuffisantes"
        
        if self.revenu_median > 25000:
            return "Aisé"
        elif self.revenu_median > 20000:
            return "Confortable"
        elif self.revenu_median > 15000:
            return "Moyen"
        else:
            return "Modeste"


class TerritoryStats(BaseModel):
    """Statistiques agrégées pour un territoire"""
    
    codes_commune: List[str] = Field(..., description="Codes des communes du territoire")
    nombre_communes: int = Field(..., description="Nombre de communes")
    
    # Moyennes pondérées
    population_totale: int = Field(0, description="Population totale")
    revenu_median_moyen: Optional[float] = Field(None, description="Revenu médian moyen pondéré")
    taux_chomage_moyen: Optional[float] = Field(None, description="Taux de chômage moyen")
    densite_moyenne: Optional[float] = Field(None, description="Densité moyenne")
    prix_m2_moyen: Optional[float] = Field(None, description="Prix m² moyen")
    
    # Distribution
    csp_distribution: Dict[str, float] = Field(default_factory=dict, description="Distribution des CSP")
    
    # Ranges
    revenu_min: Optional[float] = None
    revenu_max: Optional[float] = None
    
    annee_reference: int = Field(..., description="Année de référence")


class InseeManager:
    """Gestionnaire des données socio-économiques INSEE"""
    
    def __init__(self, data_dir: str = "/data/insee", cache_ttl_days: int = 30):
        """
        Initialise le gestionnaire INSEE
        
        Args:
            data_dir: Répertoire de stockage des données
            cache_ttl_days: Durée de validité du cache en jours
        """
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.cache_ttl = timedelta(days=cache_ttl_days)
        
        # Fichiers de stockage
        self.communes_file = self.data_dir / "communes.json"
        self.metadata_file = self.data_dir / "metadata.json"
        
        # Cache en mémoire
        self._cache: Dict[str, InseeData] = {}
        self._load_cache()
        
        logger.info(f"InseeManager initialisé avec répertoire: {self.data_dir}")
    
    def _load_cache(self):
        """Charge les données du cache depuis le fichier"""
        if self.communes_file.exists():
            try:
                with open(self.communes_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for code, commune_data in data.items():
                        self._cache[code] = InseeData(**commune_data)
                logger.info(f"{len(self._cache)} communes chargées depuis le cache")
            except Exception as e:
                logger.error(f"Erreur lors du chargement du cache: {e}")
                self._cache = {}
    
    def _save_cache(self):
        """Sauvegarde le cache dans le fichier"""
        try:
            data = {
                code: commune.dict()
                for code, commune in self._cache.items()
            }
            with open(self.communes_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, default=str, ensure_ascii=False)
            
            # Sauvegarder les métadonnées
            metadata = {
                "last_update": datetime.now().isoformat(),
                "communes_count": len(self._cache),
                "cache_ttl_days": self.cache_ttl.days
            }
            with open(self.metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2)
            
            logger.info(f"Cache sauvegardé: {len(self._cache)} communes")
        except Exception as e:
            logger.error(f"Erreur lors de la sauvegarde du cache: {e}")
    
    def get_commune(self, code_commune: str) -> Optional[InseeData]:
        """
        Récupère les données d'une commune
        
        Args:
            code_commune: Code INSEE de la commune
            
        Returns:
            Données INSEE ou None si non trouvées
        """
        # Vérifier le cache
        if code_commune in self._cache:
            commune = self._cache[code_commune]
            # Vérifier si les données ne sont pas trop anciennes
            if datetime.now() - commune.date_maj < self.cache_ttl:
                return commune
        
        # TODO: Récupérer depuis l'API INSEE si pas en cache
        # Pour l'instant, retourner None
        logger.warning(f"Données INSEE non disponibles pour commune {code_commune}")
        return None
    
    def get_communes(self, codes_commune: List[str]) -> List[InseeData]:
        """
        Récupère les données de plusieurs communes
        
        Args:
            codes_commune: Liste de codes INSEE
            
        Returns:
            Liste des données INSEE disponibles
        """
        results = []
        for code in codes_commune:
            data = self.get_commune(code)
            if data:
                results.append(data)
        return results
    
    def add_commune_data(self, data: InseeData) -> bool:
        """
        Ajoute ou met à jour les données d'une commune
        
        Args:
            data: Données INSEE à ajouter
            
        Returns:
            True si succès
        """
        try:
            data.date_maj = datetime.now()
            self._cache[data.code_commune] = data
            self._save_cache()
            return True
        except Exception as e:
            logger.error(f"Erreur lors de l'ajout de données: {e}")
            return False
    
    def get_territory_stats(self, codes_commune: List[str]) -> TerritoryStats:
        """
        Calcule les statistiques agrégées pour un territoire
        
        Args:
            codes_commune: Liste de codes INSEE
            
        Returns:
            Statistiques du territoire
        """
        communes = self.get_communes(codes_commune)
        
        if not communes:
            return TerritoryStats(
                codes_commune=codes_commune,
                nombre_communes=0,
                annee_reference=datetime.now().year
            )
        
        # Calculer les statistiques
        population_totale = sum(c.population or 0 for c in communes)
        
        # Moyennes pondérées par population
        revenu_weighted = sum(
            (c.revenu_median or 0) * (c.population or 0)
            for c in communes if c.revenu_median
        )
        revenu_median_moyen = revenu_weighted / population_totale if population_totale > 0 else None
        
        chomage_weighted = sum(
            (c.taux_chomage or 0) * (c.population or 0)
            for c in communes if c.taux_chomage
        )
        taux_chomage_moyen = chomage_weighted / population_totale if population_totale > 0 else None
        
        # Distribution CSP
        csp_distribution = {}
        for csp in CSPCategory:
            csp_attr = f"csp_{csp.value}"
            csp_weighted = sum(
                (getattr(c, csp_attr) or 0) * (c.population or 0)
                for c in communes if getattr(c, csp_attr) is not None
            )
            csp_distribution[csp.value] = csp_weighted / population_totale if population_totale > 0 else 0
        
        # Ranges
        revenus = [c.revenu_median for c in communes if c.revenu_median]
        revenu_min = min(revenus) if revenus else None
        revenu_max = max(revenus) if revenus else None
        
        return TerritoryStats(
            codes_commune=codes_commune,
            nombre_communes=len(communes),
            population_totale=population_totale,
            revenu_median_moyen=revenu_median_moyen,
            taux_chomage_moyen=taux_chomage_moyen,
            csp_distribution=csp_distribution,
            revenu_min=revenu_min,
            revenu_max=revenu_max,
            annee_reference=communes[0].annee_reference if communes else datetime.now().year
        )
    
    def get_cache_info(self) -> Dict[str, Any]:
        """Retourne des informations sur le cache"""
        metadata = {}
        if self.metadata_file.exists():
            with open(self.metadata_file, 'r') as f:
                metadata = json.load(f)
        
        return {
            "communes_cached": len(self._cache),
            "cache_ttl_days": self.cache_ttl.days,
            "last_update": metadata.get("last_update"),
            "data_dir": str(self.data_dir)
        }


# Instance globale
insee_manager = InseeManager()
