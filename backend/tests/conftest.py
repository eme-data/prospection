"""
Configuration pytest et fixtures pour les tests
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient
from fastapi.testclient import TestClient

# Mock les settings avant d'importer l'app
import sys
sys.modules['app.config'] = MagicMock()

from app.config import settings

# Configuration des settings pour les tests
settings.environment = "test"
settings.debug = True
settings.cors_origins = ["http://localhost:3000"]
settings.rate_limit_requests = 1000
settings.rate_limit_window = 60
settings.redis_url = None
settings.cache_enabled = False
settings.cache_ttl = 60
settings.api_timeout = 5.0
settings.api_max_retries = 1
settings.log_level = "DEBUG"
settings.log_format = "console"
settings.host = "127.0.0.1"
settings.port = 8000
settings.app_name = "Prospection Fonciere API - Test"
settings.app_version = "2.0.0-test"
settings.is_production = False
settings.api_adresse_url = "https://api-adresse.data.gouv.fr"
settings.api_cadastre_url = "https://cadastre.data.gouv.fr"
settings.api_geo_url = "https://geo.api.gouv.fr"
settings.api_dvf_url = "https://api.cquest.org/dvf"
settings.api_georisques_url = "https://georisques.gouv.fr/api/v1"
settings.api_gpu_url = "https://apicarto.ign.fr/api/gpu"


@pytest.fixture
def test_client():
    """Client de test synchrone pour FastAPI"""
    from app.main import app
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


@pytest.fixture
async def async_client():
    """Client de test asynchrone pour FastAPI"""
    from app.main import app
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
def mock_ban_response():
    """Reponse simulee de l'API BAN"""
    return {
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [2.3488, 48.8534]},
                "properties": {
                    "label": "1 Rue de la Paix, 75002 Paris",
                    "score": 0.95,
                    "housenumber": "1",
                    "street": "Rue de la Paix",
                    "postcode": "75002",
                    "citycode": "75102",
                    "city": "Paris",
                    "context": "75, Paris, Ile-de-France"
                }
            }
        ]
    }


@pytest.fixture
def mock_cadastre_response():
    """Reponse simulee de l'API Cadastre"""
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[2.348, 48.853], [2.349, 48.853], [2.349, 48.854], [2.348, 48.854], [2.348, 48.853]]]
                },
                "properties": {
                    "id": "75102000AB0001",
                    "commune": "75102",
                    "prefixe": "000",
                    "section": "AB",
                    "numero": "0001",
                    "contenance": 500
                }
            }
        ]
    }


@pytest.fixture
def mock_dvf_response():
    """Reponse simulee de l'API DVF"""
    return {
        "resultats": [
            {
                "date_mutation": "2023-05-15",
                "nature_mutation": "Vente",
                "valeur_fonciere": 450000,
                "adresse_nom_voie": "Rue de la Paix",
                "code_postal": "75002",
                "nom_commune": "Paris",
                "type_local": "Appartement",
                "surface_reelle_bati": 65,
                "nombre_pieces_principales": 3,
                "surface_terrain": 0,
                "longitude": 2.3488,
                "latitude": 48.8534
            },
            {
                "date_mutation": "2023-06-20",
                "nature_mutation": "Vente",
                "valeur_fonciere": 320000,
                "adresse_nom_voie": "Avenue de l'Opera",
                "code_postal": "75002",
                "nom_commune": "Paris",
                "type_local": "Appartement",
                "surface_reelle_bati": 45,
                "nombre_pieces_principales": 2,
                "surface_terrain": 0,
                "longitude": 2.3320,
                "latitude": 48.8700
            }
        ]
    }


@pytest.fixture
def mock_geo_communes_response():
    """Reponse simulee de l'API Geo communes"""
    return [
        {
            "nom": "Paris",
            "code": "75056",
            "codesPostaux": ["75001", "75002"],
            "population": 2161000,
            "departement": {"code": "75", "nom": "Paris"}
        }
    ]


@pytest.fixture
def mock_georisques_response():
    """Reponse simulee de l'API Georisques"""
    return {
        "data": [
            {
                "code_risque": "INOND",
                "libelle_risque_long": "Inondation",
                "niveau_risque": "modere"
            },
            {
                "code_risque": "SISMI",
                "libelle_risque_long": "Seisme",
                "niveau_risque": "faible"
            }
        ]
    }


@pytest.fixture
def mock_gpu_response():
    """Reponse simulee de l'API GPU (urbanisme)"""
    return {
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "libelle": "U",
                    "libelong": "Zone urbaine",
                    "typezone": "U",
                    "destdomi": "Habitat",
                    "nomfic": "reglement.pdf",
                    "urlfic": "https://example.com/reglement.pdf",
                    "partition": "DU_75056"
                }
            }
        ]
    }


@pytest.fixture
def mock_http_client():
    """Mock du client HTTP robuste"""
    with patch('app.http_client.RobustHTTPClient') as mock:
        yield mock


@pytest.fixture
def mock_cache():
    """Mock du systeme de cache"""
    with patch('app.cache.cache_get', new_callable=AsyncMock) as mock_get, \
         patch('app.cache.cache_set', new_callable=AsyncMock) as mock_set:
        mock_get.return_value = None
        mock_set.return_value = True
        yield {"get": mock_get, "set": mock_set}
