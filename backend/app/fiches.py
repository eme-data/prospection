"""
Gestion des fiches terrain enrichies
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import os
from pathlib import Path
import uuid


class FichesManager:
    """Gère les fiches terrain enrichies avec photos, documents, notes, tags"""

    def __init__(self, data_dir: str = '/data/fiches'):
        """
        Initialise le gestionnaire de fiches

        Args:
            data_dir: Répertoire de stockage des données
        """
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.fiches_file = self.data_dir / 'fiches.json'
        self.uploads_dir = self.data_dir / 'uploads'
        self.uploads_dir.mkdir(exist_ok=True)
        self._load_data()

    def _load_data(self):
        """Charge les données depuis le fichier"""
        if self.fiches_file.exists():
            with open(self.fiches_file, 'r', encoding='utf-8') as f:
                self.fiches = json.load(f)
        else:
            self.fiches = {}

    def _save_data(self):
        """Sauvegarde les données dans le fichier"""
        with open(self.fiches_file, 'w', encoding='utf-8') as f:
            json.dump(self.fiches, f, ensure_ascii=False, indent=2)

    def get_fiche(self, parcelle_id: str) -> Optional[Dict[str, Any]]:
        """
        Récupère une fiche terrain

        Args:
            parcelle_id: ID de la parcelle

        Returns:
            Fiche terrain ou None
        """
        return self.fiches.get(parcelle_id)

    def create_or_update_fiche(self, parcelle_id: str) -> Dict[str, Any]:
        """
        Crée ou met à jour une fiche terrain

        Args:
            parcelle_id: ID de la parcelle

        Returns:
            Fiche terrain
        """
        now = datetime.now().isoformat()

        if parcelle_id not in self.fiches:
            # Créer nouvelle fiche
            self.fiches[parcelle_id] = {
                'parcelleId': parcelle_id,
                'photos': [],
                'documents': [],
                'notes': [],
                'tags': [],
                'createdAt': now,
                'updatedAt': now,
            }
        else:
            # Mettre à jour timestamp
            self.fiches[parcelle_id]['updatedAt'] = now

        self._save_data()
        return self.fiches[parcelle_id]

    # ============== PHOTOS ==============

    def add_photo(
        self,
        parcelle_id: str,
        url: str,
        photo_type: str = 'terrain',
        description: Optional[str] = None,
        source: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Ajoute une photo à la fiche

        Args:
            parcelle_id: ID de la parcelle
            url: URL de la photo
            photo_type: Type (aerienne, terrain, environnement, autre)
            description: Description de la photo
            source: Source de la photo

        Returns:
            Fiche mise à jour
        """
        fiche = self.create_or_update_fiche(parcelle_id)

        photo = {
            'id': str(uuid.uuid4()),
            'url': url,
            'type': photo_type,
            'date': datetime.now().isoformat(),
            'description': description,
            'source': source,
        }

        fiche['photos'].append(photo)
        fiche['updatedAt'] = datetime.now().isoformat()

        self._save_data()
        return fiche

    def delete_photo(self, parcelle_id: str, photo_id: str) -> bool:
        """
        Supprime une photo

        Args:
            parcelle_id: ID de la parcelle
            photo_id: ID de la photo

        Returns:
            True si supprimé, False sinon
        """
        fiche = self.get_fiche(parcelle_id)
        if not fiche:
            return False

        initial_len = len(fiche['photos'])
        fiche['photos'] = [p for p in fiche['photos'] if p['id'] != photo_id]

        if len(fiche['photos']) < initial_len:
            fiche['updatedAt'] = datetime.now().isoformat()
            self._save_data()
            return True

        return False

    # ============== DOCUMENTS ==============

    def add_document(
        self,
        parcelle_id: str,
        nom: str,
        url: str,
        doc_type: str = 'autre',
        taille: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Ajoute un document à la fiche

        Args:
            parcelle_id: ID de la parcelle
            nom: Nom du document
            url: URL du document
            doc_type: Type (plu, cadastre, courrier, contrat, etude, autre)
            taille: Taille en octets

        Returns:
            Fiche mise à jour
        """
        fiche = self.create_or_update_fiche(parcelle_id)

        document = {
            'id': str(uuid.uuid4()),
            'nom': nom,
            'type': doc_type,
            'url': url,
            'dateAjout': datetime.now().isoformat(),
            'taille': taille,
        }

        fiche['documents'].append(document)
        fiche['updatedAt'] = datetime.now().isoformat()

        self._save_data()
        return fiche

    def delete_document(self, parcelle_id: str, document_id: str) -> bool:
        """
        Supprime un document

        Args:
            parcelle_id: ID de la parcelle
            document_id: ID du document

        Returns:
            True si supprimé, False sinon
        """
        fiche = self.get_fiche(parcelle_id)
        if not fiche:
            return False

        initial_len = len(fiche['documents'])
        fiche['documents'] = [d for d in fiche['documents'] if d['id'] != document_id]

        if len(fiche['documents']) < initial_len:
            fiche['updatedAt'] = datetime.now().isoformat()
            self._save_data()
            return True

        return False

    # ============== NOTES ==============

    def add_note(
        self,
        parcelle_id: str,
        contenu: str,
        auteur: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Ajoute une note à la fiche

        Args:
            parcelle_id: ID de la parcelle
            contenu: Contenu de la note
            auteur: Auteur de la note
            tags: Tags associés

        Returns:
            Fiche mise à jour
        """
        fiche = self.create_or_update_fiche(parcelle_id)

        note = {
            'id': str(uuid.uuid4()),
            'contenu': contenu,
            'auteur': auteur,
            'date': datetime.now().isoformat(),
            'tags': tags or [],
        }

        fiche['notes'].append(note)
        fiche['updatedAt'] = datetime.now().isoformat()

        self._save_data()
        return fiche

    def update_note(
        self,
        parcelle_id: str,
        note_id: str,
        contenu: str,
        tags: Optional[List[str]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Met à jour une note

        Args:
            parcelle_id: ID de la parcelle
            note_id: ID de la note
            contenu: Nouveau contenu
            tags: Nouveaux tags

        Returns:
            Fiche mise à jour ou None
        """
        fiche = self.get_fiche(parcelle_id)
        if not fiche:
            return None

        for note in fiche['notes']:
            if note['id'] == note_id:
                note['contenu'] = contenu
                if tags is not None:
                    note['tags'] = tags
                fiche['updatedAt'] = datetime.now().isoformat()
                self._save_data()
                return fiche

        return None

    def delete_note(self, parcelle_id: str, note_id: str) -> bool:
        """
        Supprime une note

        Args:
            parcelle_id: ID de la parcelle
            note_id: ID de la note

        Returns:
            True si supprimé, False sinon
        """
        fiche = self.get_fiche(parcelle_id)
        if not fiche:
            return False

        initial_len = len(fiche['notes'])
        fiche['notes'] = [n for n in fiche['notes'] if n['id'] != note_id]

        if len(fiche['notes']) < initial_len:
            fiche['updatedAt'] = datetime.now().isoformat()
            self._save_data()
            return True

        return False

    # ============== TAGS ==============

    def add_tag(self, parcelle_id: str, tag: str) -> Dict[str, Any]:
        """
        Ajoute un tag à la fiche

        Args:
            parcelle_id: ID de la parcelle
            tag: Tag à ajouter

        Returns:
            Fiche mise à jour
        """
        fiche = self.create_or_update_fiche(parcelle_id)

        if tag not in fiche['tags']:
            fiche['tags'].append(tag)
            fiche['updatedAt'] = datetime.now().isoformat()
            self._save_data()

        return fiche

    def remove_tag(self, parcelle_id: str, tag: str) -> Dict[str, Any]:
        """
        Retire un tag de la fiche

        Args:
            parcelle_id: ID de la parcelle
            tag: Tag à retirer

        Returns:
            Fiche mise à jour
        """
        fiche = self.get_fiche(parcelle_id)
        if not fiche:
            return self.create_or_update_fiche(parcelle_id)

        if tag in fiche['tags']:
            fiche['tags'].remove(tag)
            fiche['updatedAt'] = datetime.now().isoformat()
            self._save_data()

        return fiche

    def set_tags(self, parcelle_id: str, tags: List[str]) -> Dict[str, Any]:
        """
        Définit les tags de la fiche (remplace tous les tags existants)

        Args:
            parcelle_id: ID de la parcelle
            tags: Liste des tags

        Returns:
            Fiche mise à jour
        """
        fiche = self.create_or_update_fiche(parcelle_id)

        fiche['tags'] = tags
        fiche['updatedAt'] = datetime.now().isoformat()
        self._save_data()

        return fiche

    # ============== RECHERCHE ==============

    def search_fiches(
        self,
        tags: Optional[List[str]] = None,
        has_notes: Optional[bool] = None,
        has_photos: Optional[bool] = None,
        has_documents: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Recherche les fiches avec filtres

        Args:
            tags: Filtrer par tags (au moins un tag doit matcher)
            has_notes: Filtrer par présence de notes
            has_photos: Filtrer par présence de photos
            has_documents: Filtrer par présence de documents
            limit: Limite de résultats
            offset: Décalage pour pagination

        Returns:
            Liste des fiches correspondantes
        """
        fiches = list(self.fiches.values())

        # Appliquer les filtres
        if tags:
            fiches = [
                f for f in fiches
                if any(tag in f.get('tags', []) for tag in tags)
            ]

        if has_notes is not None:
            if has_notes:
                fiches = [f for f in fiches if len(f.get('notes', [])) > 0]
            else:
                fiches = [f for f in fiches if len(f.get('notes', [])) == 0]

        if has_photos is not None:
            if has_photos:
                fiches = [f for f in fiches if len(f.get('photos', [])) > 0]
            else:
                fiches = [f for f in fiches if len(f.get('photos', [])) == 0]

        if has_documents is not None:
            if has_documents:
                fiches = [f for f in fiches if len(f.get('documents', [])) > 0]
            else:
                fiches = [f for f in fiches if len(f.get('documents', [])) == 0]

        # Trier par date de mise à jour (plus récent en premier)
        fiches.sort(key=lambda x: x.get('updatedAt', ''), reverse=True)

        # Pagination
        return fiches[offset:offset + limit]

    def get_all_tags(self) -> List[str]:
        """
        Récupère tous les tags utilisés

        Returns:
            Liste unique de tous les tags
        """
        all_tags = set()
        for fiche in self.fiches.values():
            all_tags.update(fiche.get('tags', []))
        return sorted(list(all_tags))

    def get_stats(self) -> Dict[str, Any]:
        """
        Récupère les statistiques des fiches

        Returns:
            Statistiques globales
        """
        total = len(self.fiches)
        with_photos = sum(1 for f in self.fiches.values() if len(f.get('photos', [])) > 0)
        with_documents = sum(1 for f in self.fiches.values() if len(f.get('documents', [])) > 0)
        with_notes = sum(1 for f in self.fiches.values() if len(f.get('notes', [])) > 0)
        with_tags = sum(1 for f in self.fiches.values() if len(f.get('tags', [])) > 0)

        total_photos = sum(len(f.get('photos', [])) for f in self.fiches.values())
        total_documents = sum(len(f.get('documents', [])) for f in self.fiches.values())
        total_notes = sum(len(f.get('notes', [])) for f in self.fiches.values())

        return {
            'total_fiches': total,
            'with_photos': with_photos,
            'with_documents': with_documents,
            'with_notes': with_notes,
            'with_tags': with_tags,
            'total_photos': total_photos,
            'total_documents': total_documents,
            'total_notes': total_notes,
            'all_tags': self.get_all_tags(),
        }

    def delete_fiche(self, parcelle_id: str) -> bool:
        """
        Supprime complètement une fiche

        Args:
            parcelle_id: ID de la parcelle

        Returns:
            True si supprimé, False sinon
        """
        if parcelle_id in self.fiches:
            del self.fiches[parcelle_id]
            self._save_data()
            return True
        return False


# Instance globale
fiches_manager = FichesManager()
