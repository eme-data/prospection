"""
Gestion des statuts de prospection et du suivi client
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import os
from pathlib import Path


class ProspectionManager:
    """Gère les informations de prospection des parcelles"""

    # Définition des statuts possibles et leur workflow
    STATUTS = [
        'a_prospecter',
        'en_cours',
        'contacte',
        'interesse',
        'en_negociation',
        'promesse_signee',
        'acquis',
        'refuse',
        'abandonne',
    ]

    # Couleurs associées aux statuts
    STATUT_COLORS = {
        'a_prospecter': '#94a3b8',      # gray
        'en_cours': '#3b82f6',          # blue
        'contacte': '#8b5cf6',          # purple
        'interesse': '#10b981',         # green
        'en_negociation': '#f59e0b',    # orange
        'promesse_signee': '#14b8a6',   # teal
        'acquis': '#22c55e',            # green-success
        'refuse': '#ef4444',            # red
        'abandonne': '#6b7280',         # gray-dark
    }

    # Labels français
    STATUT_LABELS = {
        'a_prospecter': 'À prospecter',
        'en_cours': 'En cours',
        'contacte': 'Contacté',
        'interesse': 'Intéressé',
        'en_negociation': 'En négociation',
        'promesse_signee': 'Promesse signée',
        'acquis': 'Acquis',
        'refuse': 'Refusé',
        'abandonne': 'Abandonné',
    }

    def __init__(self, data_dir: str = None):
        """
        Initialise le gestionnaire de prospection

        Args:
            data_dir: Répertoire de stockage des données
        """
        if data_dir is None:
            base_dir = os.getenv("DATA_DIR", "./data")
            data_dir = os.path.join(base_dir, "prospection")
            
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.prospections_file = self.data_dir / 'prospections.json'
        self._load_data()

    def _load_data(self):
        """Charge les données depuis le fichier"""
        if self.prospections_file.exists():
            with open(self.prospections_file, 'r', encoding='utf-8') as f:
                self.prospections = json.load(f)
        else:
            self.prospections = {}

    def _save_data(self):
        """Sauvegarde les données dans le fichier"""
        with open(self.prospections_file, 'w', encoding='utf-8') as f:
            json.dump(self.prospections, f, ensure_ascii=False, indent=2)

    def get_prospection(self, parcelle_id: str) -> Optional[Dict[str, Any]]:
        """
        Récupère les informations de prospection d'une parcelle

        Args:
            parcelle_id: ID de la parcelle

        Returns:
            Informations de prospection ou None
        """
        return self.prospections.get(parcelle_id)

    def create_prospection(
        self,
        parcelle_id: str,
        statut: str = 'a_prospecter',
        notes_contact: str = '',
        interlocuteur: Optional[str] = None,
        telephone: Optional[str] = None,
        email: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Crée une nouvelle fiche de prospection

        Args:
            parcelle_id: ID de la parcelle
            statut: Statut initial
            notes_contact: Notes de contact
            interlocuteur: Nom de l'interlocuteur
            telephone: Téléphone
            email: Email

        Returns:
            Fiche de prospection créée
        """
        if statut not in self.STATUTS:
            raise ValueError(f"Statut invalide: {statut}")

        now = datetime.now().isoformat()

        prospection = {
            'parcelleId': parcelle_id,
            'statut': statut,
            'dateContact': None,
            'dateRelance': None,
            'notesContact': notes_contact,
            'interlocuteur': interlocuteur,
            'telephone': telephone,
            'email': email,
            'historique': [
                {
                    'id': f"{parcelle_id}_{now}",
                    'date': now,
                    'action': 'Création de la fiche',
                    'statut': statut,
                    'notes': notes_contact or 'Fiche créée',
                }
            ],
            'createdAt': now,
            'updatedAt': now,
        }

        self.prospections[parcelle_id] = prospection
        self._save_data()

        return prospection

    def update_statut(
        self,
        parcelle_id: str,
        nouveau_statut: str,
        notes: str = '',
        date_contact: Optional[str] = None,
        date_relance: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Met à jour le statut d'une prospection

        Args:
            parcelle_id: ID de la parcelle
            nouveau_statut: Nouveau statut
            notes: Notes sur le changement
            date_contact: Date du contact
            date_relance: Date de relance

        Returns:
            Prospection mise à jour
        """
        if nouveau_statut not in self.STATUTS:
            raise ValueError(f"Statut invalide: {nouveau_statut}")

        # Créer la prospection si elle n'existe pas
        if parcelle_id not in self.prospections:
            return self.create_prospection(parcelle_id, statut=nouveau_statut, notes_contact=notes)

        prospection = self.prospections[parcelle_id]
        ancien_statut = prospection['statut']
        now = datetime.now().isoformat()

        # Mettre à jour le statut
        prospection['statut'] = nouveau_statut
        prospection['updatedAt'] = now

        if date_contact:
            prospection['dateContact'] = date_contact
        elif nouveau_statut in ['contacte', 'interesse', 'en_negociation']:
            prospection['dateContact'] = now

        if date_relance:
            prospection['dateRelance'] = date_relance

        # Ajouter à l'historique
        prospection['historique'].append({
            'id': f"{parcelle_id}_{now}",
            'date': now,
            'action': f"Changement de statut: {self.STATUT_LABELS.get(ancien_statut, ancien_statut)} → {self.STATUT_LABELS.get(nouveau_statut, nouveau_statut)}",
            'statut': nouveau_statut,
            'notes': notes or f"Passage en statut {self.STATUT_LABELS.get(nouveau_statut, nouveau_statut)}",
        })

        self._save_data()
        return prospection

    def update_contact_info(
        self,
        parcelle_id: str,
        interlocuteur: Optional[str] = None,
        telephone: Optional[str] = None,
        email: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Met à jour les informations de contact

        Args:
            parcelle_id: ID de la parcelle
            interlocuteur: Nom de l'interlocuteur
            telephone: Téléphone
            email: Email
            notes: Notes additionnelles

        Returns:
            Prospection mise à jour
        """
        # Créer la prospection si elle n'existe pas
        if parcelle_id not in self.prospections:
            return self.create_prospection(
                parcelle_id,
                interlocuteur=interlocuteur,
                telephone=telephone,
                email=email,
                notes_contact=notes or '',
            )

        prospection = self.prospections[parcelle_id]
        now = datetime.now().isoformat()

        # Mettre à jour les champs fournis
        if interlocuteur is not None:
            prospection['interlocuteur'] = interlocuteur
        if telephone is not None:
            prospection['telephone'] = telephone
        if email is not None:
            prospection['email'] = email
        if notes is not None:
            prospection['notesContact'] = notes

        prospection['updatedAt'] = now

        # Ajouter à l'historique
        prospection['historique'].append({
            'id': f"{parcelle_id}_{now}",
            'date': now,
            'action': 'Mise à jour des informations de contact',
            'statut': prospection['statut'],
            'notes': notes or 'Informations de contact mises à jour',
        })

        self._save_data()
        return prospection

    def add_note(
        self,
        parcelle_id: str,
        notes: str,
    ) -> Dict[str, Any]:
        """
        Ajoute une note à l'historique

        Args:
            parcelle_id: ID de la parcelle
            notes: Notes à ajouter

        Returns:
            Prospection mise à jour
        """
        # Créer la prospection si elle n'existe pas
        if parcelle_id not in self.prospections:
            return self.create_prospection(parcelle_id, notes_contact=notes)

        prospection = self.prospections[parcelle_id]
        now = datetime.now().isoformat()

        # Ajouter à l'historique
        prospection['historique'].append({
            'id': f"{parcelle_id}_{now}",
            'date': now,
            'action': 'Note ajoutée',
            'statut': prospection['statut'],
            'notes': notes,
        })

        prospection['updatedAt'] = now

        self._save_data()
        return prospection

    def delete_prospection(self, parcelle_id: str) -> bool:
        """
        Supprime une fiche de prospection

        Args:
            parcelle_id: ID de la parcelle

        Returns:
            True si supprimé, False sinon
        """
        if parcelle_id in self.prospections:
            del self.prospections[parcelle_id]
            self._save_data()
            return True
        return False

    def get_all_prospections(
        self,
        statut: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Récupère toutes les prospections avec filtres optionnels

        Args:
            statut: Filtrer par statut
            limit: Nombre maximum de résultats
            offset: Décalage pour pagination

        Returns:
            Liste des prospections
        """
        prospections = list(self.prospections.values())

        # Filtrer par statut si demandé
        if statut and statut in self.STATUTS:
            prospections = [p for p in prospections if p['statut'] == statut]

        # Trier par date de mise à jour (plus récent en premier)
        prospections.sort(key=lambda x: x['updatedAt'], reverse=True)

        # Pagination
        return prospections[offset:offset + limit]

    def get_stats(self) -> Dict[str, Any]:
        """
        Récupère les statistiques de prospection

        Returns:
            Statistiques globales
        """
        total = len(self.prospections)
        stats_par_statut = {}

        for statut in self.STATUTS:
            count = sum(1 for p in self.prospections.values() if p['statut'] == statut)
            stats_par_statut[statut] = count

        # Calculer des métriques supplémentaires
        en_cours = sum(
            stats_par_statut.get(s, 0)
            for s in ['en_cours', 'contacte', 'interesse', 'en_negociation']
        )

        reussis = stats_par_statut.get('acquis', 0) + stats_par_statut.get('promesse_signee', 0)

        echoues = stats_par_statut.get('refuse', 0) + stats_par_statut.get('abandonne', 0)

        taux_reussite = (reussis / total * 100) if total > 0 else 0

        return {
            'total': total,
            'par_statut': stats_par_statut,
            'en_cours': en_cours,
            'reussis': reussis,
            'echoues': echoues,
            'taux_reussite': round(taux_reussite, 1),
        }


# Instance globale
prospection_manager = ProspectionManager()
