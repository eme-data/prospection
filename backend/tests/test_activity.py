"""
Tests unitaires pour le module activity
"""
import pytest
from datetime import datetime, timedelta
from app.activity import ActivityManager, Activity, ActivityType


@pytest.fixture
def activity_manager(tmp_path):
    """Fixture pour créer un ActivityManager avec un répertoire temporaire"""
    return ActivityManager(data_dir=str(tmp_path / "activities"))


def test_create_activity(activity_manager):
    """Test de création d'une activité"""
    activity = activity_manager.create_activity(
        parcelle_id="75101000AB0001",
        type=ActivityType.APPEL,
        titre="Premier appel propriétaire",
        description="Appel pour présenter notre projet",
        auteur="Jean Dupont"
    )
    
    assert activity.id.startswith("ACT_")
    assert activity.parcelle_id == "75101000AB0001"
    assert activity.type == ActivityType.APPEL
    assert activity.titre == "Premier appel propriétaire"
    assert activity.auteur == "Jean Dupont"


def test_get_activities(activity_manager):
    """Test de récupération des activités d'une parcelle"""
    parcelle_id = "75101000AB0001"
    
    # Créer plusieurs activités
    activity_manager.create_activity(
        parcelle_id=parcelle_id,
        type=ActivityType.APPEL,
        titre="Appel 1"
    )
    activity_manager.create_activity(
        parcelle_id=parcelle_id,
        type=ActivityType.EMAIL,
        titre="Email 1"
    )
    activity_manager.create_activity(
        parcelle_id=parcelle_id,
        type=ActivityType.RDV,
        titre="RDV 1"
    )
    
    # Récupérer toutes les activités
    activities = activity_manager.get_activities(parcelle_id)
    assert len(activities) == 3
    
    # Filtrer par type
    appels = activity_manager.get_activities(parcelle_id, type=ActivityType.APPEL)
    assert len(appels) == 1
    assert appels[0].type == ActivityType.APPEL


def test_get_activity(activity_manager):
    """Test de récupération d'une activité spécifique"""
    activity = activity_manager.create_activity(
        parcelle_id="75101000AB0001",
        type=ActivityType.NOTE,
        titre="Note importante"
    )
    
    retrieved = activity_manager.get_activity(activity.id)
    assert retrieved is not None
    assert retrieved.id == activity.id
    assert retrieved.titre == "Note importante"
    
    # Test avec un ID inexistant
    not_found = activity_manager.get_activity("ACT_INEXISTANT")
    assert not_found is None


def test_update_activity(activity_manager):
    """Test de mise à jour d'une activité"""
    activity = activity_manager.create_activity(
        parcelle_id="75101000AB0001",
        type=ActivityType.APPEL,
        titre="Titre original"
    )
    
    # Mettre à jour
    updated = activity_manager.update_activity(
        activity_id=activity.id,
        titre="Titre modifié",
        description="Nouvelle description",
        prochaine_action="Rappeler dans 1 semaine"
    )
    
    assert updated is not None
    assert updated.titre == "Titre modifié"
    assert updated.description == "Nouvelle description"
    assert updated.prochaine_action == "Rappeler dans 1 semaine"


def test_delete_activity(activity_manager):
    """Test de suppression d'une activité"""
    activity = activity_manager.create_activity(
        parcelle_id="75101000AB0001",
        type=ActivityType.NOTE,
        titre="À supprimer"
    )
    
    # Vérifier que l'activité existe
    assert activity_manager.get_activity(activity.id) is not None
    
    # Supprimer
    success = activity_manager.delete_activity(activity.id)
    assert success is True
    
    # Vérifier que l'activité n'existe plus
    assert activity_manager.get_activity(activity.id) is None
    
    # Tenter de supprimer à nouveau
    success = activity_manager.delete_activity(activity.id)
    assert success is False


def test_get_rappels(activity_manager):
    """Test de récupération des rappels"""
    now = datetime.now()
    tomorrow = (now + timedelta(days=1)).isoformat()
    next_week = (now + timedelta(days=7)).isoformat()
    
    # Créer des activités avec rappels
    activity_manager.create_activity(
        parcelle_id="75101000AB0001",
        type=ActivityType.APPEL,
        titre="Rappel demain",
        date_rappel=tomorrow
    )
    activity_manager.create_activity(
        parcelle_id="75101000AB0002",
        type=ActivityType.RDV,
        titre="Rappel semaine prochaine",
        date_rappel=next_week
    )
    activity_manager.create_activity(
        parcelle_id="75101000AB0003",
        type=ActivityType.NOTE,
        titre="Sans rappel"
    )
    
    # Récupérer tous les rappels
    rappels = activity_manager.get_rappels()
    assert len(rappels) == 2
    
    # Vérifier l'ordre (triés par date)
    assert rappels[0].date_rappel < rappels[1].date_rappel


def test_get_stats(activity_manager):
    """Test de récupération des statistiques"""
    # Créer des activités sur différentes parcelles
    activity_manager.create_activity(
        parcelle_id="75101000AB0001",
        type=ActivityType.APPEL,
        titre="Appel 1"
    )
    activity_manager.create_activity(
        parcelle_id="75101000AB0001",
        type=ActivityType.EMAIL,
        titre="Email 1"
    )
    activity_manager.create_activity(
        parcelle_id="75101000AB0002",
        type=ActivityType.RDV,
        titre="RDV 1",
        date_rappel=(datetime.now() + timedelta(days=1)).isoformat()
    )
    
    stats = activity_manager.get_stats()
    
    assert stats['total_activities'] == 3
    assert stats['total_parcelles'] == 2
    assert stats['by_type'][ActivityType.APPEL] == 1
    assert stats['by_type'][ActivityType.EMAIL] == 1
    assert stats['by_type'][ActivityType.RDV] == 1
    assert stats['rappels_actifs'] == 1


def test_pagination(activity_manager):
    """Test de la pagination"""
    parcelle_id = "75101000AB0001"
    
    # Créer 10 activités
    for i in range(10):
        activity_manager.create_activity(
            parcelle_id=parcelle_id,
            type=ActivityType.NOTE,
            titre=f"Note {i}"
        )
    
    # Récupérer avec limite
    activities = activity_manager.get_activities(parcelle_id, limit=5)
    assert len(activities) == 5
    
    # Récupérer avec offset
    activities_page2 = activity_manager.get_activities(parcelle_id, limit=5, offset=5)
    assert len(activities_page2) == 5
    
    # Vérifier qu'il n'y a pas de doublons
    ids_page1 = {a.id for a in activities}
    ids_page2 = {a.id for a in activities_page2}
    assert len(ids_page1.intersection(ids_page2)) == 0


def test_activity_with_statut_change(activity_manager):
    """Test d'une activité avec changement de statut"""
    activity = activity_manager.create_activity(
        parcelle_id="75101000AB0001",
        type=ActivityType.CHANGEMENT_STATUT,
        titre="Passage en négociation",
        statut_avant="interesse",
        statut_apres="en_negociation"
    )
    
    assert activity.statut_avant == "interesse"
    assert activity.statut_apres == "en_negociation"


def test_persistence(tmp_path):
    """Test de la persistance des données"""
    data_dir = str(tmp_path / "activities")
    
    # Créer un manager et une activité
    manager1 = ActivityManager(data_dir=data_dir)
    activity = manager1.create_activity(
        parcelle_id="75101000AB0001",
        type=ActivityType.APPEL,
        titre="Test persistance"
    )
    activity_id = activity.id
    
    # Créer un nouveau manager (simule un redémarrage)
    manager2 = ActivityManager(data_dir=data_dir)
    
    # Vérifier que l'activité existe toujours
    retrieved = manager2.get_activity(activity_id)
    assert retrieved is not None
    assert retrieved.titre == "Test persistance"
