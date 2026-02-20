"""
Gestion des activités CRM pour le suivi de prospection
Permet de logger toutes les interactions avec les propriétaires
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
import json
import os
from pathlib import Path


class ActivityType:
    """Types d'activités possibles"""
    APPEL = "appel"
    EMAIL = "email"
    RDV = "rdv"
    NOTE = "note"
    DOCUMENT = "document"
    CHANGEMENT_STATUT = "changement_statut"


class Activity(BaseModel):
    """Modèle d'une activité CRM"""
    id: str
    parcelle_id: str
    type: str = Field(..., description="Type d'activité (appel, email, rdv, note, document)")
    date: str = Field(default_factory=lambda: datetime.now().isoformat())
    titre: str = Field(..., max_length=200)
    description: str = Field(default="")
    auteur: Optional[str] = Field(default="Système", description="Nom de l'utilisateur")
    statut_avant: Optional[str] = None
    statut_apres: Optional[str] = None
    prochaine_action: Optional[str] = None
    date_rappel: Optional[str] = None
    documents: List[str] = Field(default_factory=list, description="URLs des documents attachés")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Métadonnées supplémentaires")


class ActivityManager:
    """Gestionnaire des activités CRM"""
    
    def __init__(self, data_dir: str = "./data/activities"):
        """
        Initialise le gestionnaire d'activités
        
        Args:
            data_dir: Répertoire de stockage des données
        """
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.data_file = self.data_dir / "activities.json"
        self.activities: Dict[str, List[Dict[str, Any]]] = self._load_data()
    
    def _load_data(self) -> Dict[str, List[Dict[str, Any]]]:
        """Charge les données depuis le fichier"""
        if self.data_file.exists():
            with open(self.data_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    def _save_data(self):
        """Sauvegarde les données dans le fichier"""
        with open(self.data_file, 'w', encoding='utf-8') as f:
            json.dump(self.activities, f, ensure_ascii=False, indent=2)
    
    def create_activity(
        self,
        parcelle_id: str,
        type: str,
        titre: str,
        description: str = "",
        auteur: str = "Système",
        statut_avant: Optional[str] = None,
        statut_apres: Optional[str] = None,
        prochaine_action: Optional[str] = None,
        date_rappel: Optional[str] = None,
        documents: List[str] = None,
        metadata: Dict[str, Any] = None
    ) -> Activity:
        """
        Crée une nouvelle activité
        
        Args:
            parcelle_id: ID de la parcelle
            type: Type d'activité
            titre: Titre de l'activité
            description: Description détaillée
            auteur: Nom de l'utilisateur
            statut_avant: Statut avant l'activité
            statut_apres: Statut après l'activité
            prochaine_action: Prochaine action à effectuer
            date_rappel: Date du rappel (ISO format)
            documents: Liste des URLs de documents
            metadata: Métadonnées supplémentaires
            
        Returns:
            L'activité créée
        """
        activity_id = f"ACT_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        
        activity = Activity(
            id=activity_id,
            parcelle_id=parcelle_id,
            type=type,
            titre=titre,
            description=description,
            auteur=auteur,
            statut_avant=statut_avant,
            statut_apres=statut_apres,
            prochaine_action=prochaine_action,
            date_rappel=date_rappel,
            documents=documents or [],
            metadata=metadata or {}
        )
        
        # Ajouter à la liste des activités de la parcelle
        if parcelle_id not in self.activities:
            self.activities[parcelle_id] = []
        
        self.activities[parcelle_id].append(activity.model_dump())
        self._save_data()
        
        return activity
    
    def get_activities(
        self,
        parcelle_id: str,
        type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Activity]:
        """
        Récupère les activités d'une parcelle
        
        Args:
            parcelle_id: ID de la parcelle
            type: Filtrer par type d'activité
            limit: Nombre maximum d'activités
            offset: Décalage pour pagination
            
        Returns:
            Liste des activités
        """
        if parcelle_id not in self.activities:
            return []
        
        activities = self.activities[parcelle_id]
        
        # Filtrer par type si spécifié
        if type:
            activities = [a for a in activities if a.get('type') == type]
        
        # Trier par date décroissante (plus récent en premier)
        activities = sorted(
            activities,
            key=lambda x: x.get('date', ''),
            reverse=True
        )
        
        # Pagination
        activities = activities[offset:offset + limit]
        
        return [Activity(**a) for a in activities]
    
    def get_activity(self, activity_id: str) -> Optional[Activity]:
        """
        Récupère une activité par son ID
        
        Args:
            activity_id: ID de l'activité
            
        Returns:
            L'activité ou None
        """
        for parcelle_activities in self.activities.values():
            for activity_data in parcelle_activities:
                if activity_data.get('id') == activity_id:
                    return Activity(**activity_data)
        return None
    
    def update_activity(
        self,
        activity_id: str,
        titre: Optional[str] = None,
        description: Optional[str] = None,
        prochaine_action: Optional[str] = None,
        date_rappel: Optional[str] = None,
        documents: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[Activity]:
        """
        Met à jour une activité
        
        Args:
            activity_id: ID de l'activité
            titre: Nouveau titre
            description: Nouvelle description
            prochaine_action: Nouvelle prochaine action
            date_rappel: Nouvelle date de rappel
            documents: Nouveaux documents
            metadata: Nouvelles métadonnées
            
        Returns:
            L'activité mise à jour ou None
        """
        for parcelle_id, parcelle_activities in self.activities.items():
            for i, activity_data in enumerate(parcelle_activities):
                if activity_data.get('id') == activity_id:
                    # Mettre à jour les champs
                    if titre is not None:
                        activity_data['titre'] = titre
                    if description is not None:
                        activity_data['description'] = description
                    if prochaine_action is not None:
                        activity_data['prochaine_action'] = prochaine_action
                    if date_rappel is not None:
                        activity_data['date_rappel'] = date_rappel
                    if documents is not None:
                        activity_data['documents'] = documents
                    if metadata is not None:
                        activity_data['metadata'].update(metadata)
                    
                    self.activities[parcelle_id][i] = activity_data
                    self._save_data()
                    
                    return Activity(**activity_data)
        
        return None
    
    def delete_activity(self, activity_id: str) -> bool:
        """
        Supprime une activité
        
        Args:
            activity_id: ID de l'activité
            
        Returns:
            True si supprimé, False sinon
        """
        for parcelle_id, parcelle_activities in self.activities.items():
            for i, activity_data in enumerate(parcelle_activities):
                if activity_data.get('id') == activity_id:
                    del self.activities[parcelle_id][i]
                    self._save_data()
                    return True
        
        return False
    
    def get_rappels(
        self,
        date_debut: Optional[str] = None,
        date_fin: Optional[str] = None,
        limit: int = 100
    ) -> List[Activity]:
        """
        Récupère les rappels à venir
        
        Args:
            date_debut: Date de début (ISO format)
            date_fin: Date de fin (ISO format)
            limit: Nombre maximum de rappels
            
        Returns:
            Liste des activités avec rappel
        """
        rappels = []
        
        for parcelle_activities in self.activities.values():
            for activity_data in parcelle_activities:
                date_rappel = activity_data.get('date_rappel')
                if date_rappel:
                    # Filtrer par date si spécifié
                    if date_debut and date_rappel < date_debut:
                        continue
                    if date_fin and date_rappel > date_fin:
                        continue
                    
                    rappels.append(Activity(**activity_data))
        
        # Trier par date de rappel
        rappels = sorted(rappels, key=lambda x: x.date_rappel or '')
        
        return rappels[:limit]
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Récupère les statistiques des activités
        
        Returns:
            Statistiques globales
        """
        total_activities = sum(len(acts) for acts in self.activities.values())
        
        # Compter par type
        by_type = {}
        for parcelle_activities in self.activities.values():
            for activity_data in parcelle_activities:
                type_act = activity_data.get('type', 'unknown')
                by_type[type_act] = by_type.get(type_act, 0) + 1
        
        # Compter les rappels actifs
        now = datetime.now().isoformat()
        rappels_actifs = 0
        for parcelle_activities in self.activities.values():
            for activity_data in parcelle_activities:
                date_rappel = activity_data.get('date_rappel')
                if date_rappel and date_rappel >= now:
                    rappels_actifs += 1
        
        return {
            'total_activities': total_activities,
            'total_parcelles': len(self.activities),
            'by_type': by_type,
            'rappels_actifs': rappels_actifs
        }


# Instance globale
activity_manager = ActivityManager()
