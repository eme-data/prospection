"""
Tests pour les endpoints de l'API
"""

import pytest
from unittest.mock import patch, AsyncMock
from fastapi import status


class TestRootEndpoint:
    """Tests pour l'endpoint racine"""

    def test_root_returns_api_info(self, test_client):
        """Verifie que l'endpoint racine retourne les infos de l'API"""
        response = test_client.get("/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert "version" in data
        assert "environment" in data


class TestHealthEndpoints:
    """Tests pour les endpoints de sante"""

    def test_health_endpoint(self, test_client):
        """Verifie l'endpoint /health"""
        response = test_client.get("/health")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "healthy"

    def test_live_endpoint(self, test_client):
        """Verifie l'endpoint /live"""
        response = test_client.get("/live")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "alive"


class TestAddressSearch:
    """Tests pour la recherche d'adresses"""

    def test_search_address_success(self, test_client, mock_ban_response):
        """Recherche d'adresse avec resultats"""
        with patch('app.main.ban_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_ban_response

            response = test_client.get("/api/address/search", params={"q": "1 rue de la paix paris"})

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "results" in data
            assert len(data["results"]) > 0
            assert data["results"][0]["label"] == "1 Rue de la Paix, 75002 Paris"

    def test_search_address_too_short(self, test_client):
        """Recherche avec query trop courte"""
        response = test_client.get("/api/address/search", params={"q": "ab"})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_search_address_missing_query(self, test_client):
        """Recherche sans parametre q"""
        response = test_client.get("/api/address/search")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_reverse_geocode_success(self, test_client, mock_ban_response):
        """Geocodage inverse avec resultats"""
        with patch('app.main.ban_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_ban_response

            response = test_client.get("/api/address/reverse", params={"lon": 2.3488, "lat": 48.8534})

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "result" in data

    def test_reverse_geocode_invalid_coordinates(self, test_client):
        """Geocodage inverse avec coordonnees invalides"""
        response = test_client.get("/api/address/reverse", params={"lon": 200, "lat": 48.8534})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestCadastreEndpoints:
    """Tests pour les endpoints cadastre"""

    def test_get_parcelles_success(self, test_client, mock_cadastre_response):
        """Recuperation des parcelles avec succes"""
        with patch('app.main.cadastre_client.get', new_callable=AsyncMock) as mock_get, \
             patch('app.main.cache_get', new_callable=AsyncMock) as mock_cache_get, \
             patch('app.main.cache_set', new_callable=AsyncMock) as mock_cache_set:
            mock_get.return_value = mock_cadastre_response
            mock_cache_get.return_value = None
            mock_cache_set.return_value = True

            response = test_client.get("/api/cadastre/parcelles", params={"code_insee": "75102"})

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["type"] == "FeatureCollection"
            assert "features" in data

    def test_get_parcelles_invalid_insee(self, test_client):
        """Recuperation avec code INSEE invalide"""
        response = test_client.get("/api/cadastre/parcelles", params={"code_insee": "123"})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_parcelles_with_section_filter(self, test_client, mock_cadastre_response):
        """Filtrage par section cadastrale"""
        with patch('app.main.cadastre_client.get', new_callable=AsyncMock) as mock_get, \
             patch('app.main.cache_get', new_callable=AsyncMock) as mock_cache_get, \
             patch('app.main.cache_set', new_callable=AsyncMock) as mock_cache_set:
            mock_get.return_value = mock_cadastre_response
            mock_cache_get.return_value = None
            mock_cache_set.return_value = True

            response = test_client.get(
                "/api/cadastre/parcelles",
                params={"code_insee": "75102", "section": "AB"}
            )

            assert response.status_code == status.HTTP_200_OK

    def test_get_parcelle_detail_success(self, test_client, mock_cadastre_response):
        """Details d'une parcelle specifique"""
        with patch('app.main.cadastre_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_cadastre_response

            response = test_client.get("/api/cadastre/parcelle/75102000AB0001")

            assert response.status_code == status.HTTP_200_OK

    def test_get_parcelle_detail_not_found(self, test_client, mock_cadastre_response):
        """Parcelle non trouvee"""
        with patch('app.main.cadastre_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {"features": []}

            response = test_client.get("/api/cadastre/parcelle/75102000XX9999")

            assert response.status_code == status.HTTP_404_NOT_FOUND


class TestDVFEndpoints:
    """Tests pour les endpoints DVF"""

    def test_get_dvf_by_insee(self, test_client, mock_dvf_response):
        """Transactions DVF par code INSEE"""
        with patch('app.main.dvf_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_dvf_response

            response = test_client.get("/api/dvf/transactions", params={"code_insee": "75102"})

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["type"] == "FeatureCollection"
            assert "features" in data
            assert "count" in data

    def test_get_dvf_by_coordinates(self, test_client, mock_dvf_response):
        """Transactions DVF par coordonnees"""
        with patch('app.main.dvf_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_dvf_response

            response = test_client.get(
                "/api/dvf/transactions",
                params={"lon": 2.3488, "lat": 48.8534, "rayon": 500}
            )

            assert response.status_code == status.HTTP_200_OK

    def test_get_dvf_missing_params(self, test_client):
        """DVF sans parametres requis"""
        response = test_client.get("/api/dvf/transactions")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_get_dvf_statistiques(self, test_client, mock_dvf_response):
        """Statistiques DVF"""
        with patch('app.main.dvf_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_dvf_response

            response = test_client.get(
                "/api/dvf/statistiques",
                params={"code_insee": "75102"}
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "nb_transactions" in data
            assert "statistiques" in data


class TestGeoEndpoints:
    """Tests pour les endpoints Geo"""

    def test_search_communes(self, test_client, mock_geo_communes_response):
        """Recherche de communes"""
        with patch('app.main.geo_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_geo_communes_response

            response = test_client.get("/api/geo/communes", params={"nom": "Paris"})

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "communes" in data

    def test_get_commune_by_insee(self, test_client):
        """Details d'une commune"""
        with patch('app.main.geo_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {"nom": "Paris", "code": "75056"}

            response = test_client.get("/api/geo/commune/75056")

            assert response.status_code == status.HTTP_200_OK

    def test_get_departements(self, test_client):
        """Liste des departements"""
        with patch('app.main.geo_client.get', new_callable=AsyncMock) as mock_get, \
             patch('app.main.cache_get', new_callable=AsyncMock) as mock_cache_get, \
             patch('app.main.cache_set', new_callable=AsyncMock) as mock_cache_set:
            mock_get.return_value = [{"code": "75", "nom": "Paris"}]
            mock_cache_get.return_value = None
            mock_cache_set.return_value = True

            response = test_client.get("/api/geo/departements")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "departements" in data


class TestRisquesEndpoints:
    """Tests pour les endpoints risques"""

    def test_get_risques_commune(self, test_client, mock_georisques_response):
        """Risques d'une commune"""
        with patch('app.main.georisques_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_georisques_response

            response = test_client.get("/api/risques/commune/75102")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "risques" in data
            assert "count" in data

    def test_get_risques_parcelle(self, test_client, mock_georisques_response):
        """Risques pour une localisation"""
        with patch('app.main.georisques_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_georisques_response

            response = test_client.get(
                "/api/risques/parcelle",
                params={"lon": 2.3488, "lat": 48.8534}
            )

            assert response.status_code == status.HTTP_200_OK

    def test_get_risques_inondation(self, test_client):
        """Zones inondables"""
        with patch('app.main.georisques_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {"data": []}

            response = test_client.get(
                "/api/risques/inondation",
                params={"lon": 2.3488, "lat": 48.8534}
            )

            assert response.status_code == status.HTTP_200_OK


class TestUrbanismeEndpoints:
    """Tests pour les endpoints urbanisme"""

    def test_get_zonage_plu(self, test_client, mock_gpu_response):
        """Zonage PLU"""
        with patch('app.main.gpu_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_gpu_response

            response = test_client.get(
                "/api/urbanisme/zonage",
                params={"lon": 2.3488, "lat": 48.8534}
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "zonages" in data

    def test_get_prescriptions_plu(self, test_client):
        """Prescriptions PLU"""
        with patch('app.main.gpu_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {"features": []}

            response = test_client.get(
                "/api/urbanisme/prescriptions",
                params={"lon": 2.3488, "lat": 48.8534}
            )

            assert response.status_code == status.HTTP_200_OK


class TestExportEndpoints:
    """Tests pour les endpoints d'export"""

    def test_export_dvf_csv(self, test_client, mock_dvf_response):
        """Export DVF en CSV"""
        with patch('app.main.dvf_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_dvf_response

            response = test_client.get(
                "/api/export/dvf/csv",
                params={"code_insee": "75102"}
            )

            assert response.status_code == status.HTTP_200_OK
            assert "text/csv" in response.headers.get("content-type", "")
            assert "attachment" in response.headers.get("content-disposition", "")

    def test_export_dvf_geojson(self, test_client, mock_dvf_response):
        """Export DVF en GeoJSON"""
        with patch('app.main.dvf_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_dvf_response

            response = test_client.get(
                "/api/export/dvf/geojson",
                params={"code_insee": "75102"}
            )

            assert response.status_code == status.HTTP_200_OK
            assert "geo+json" in response.headers.get("content-type", "")

    def test_export_parcelles_geojson(self, test_client, mock_cadastre_response):
        """Export parcelles en GeoJSON"""
        with patch('app.main.cadastre_client.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_cadastre_response

            response = test_client.get(
                "/api/export/parcelles/geojson",
                params={"code_insee": "75102"}
            )

            assert response.status_code == status.HTTP_200_OK


class TestInputValidation:
    """Tests pour la validation des entrees"""

    def test_insee_code_validation(self, test_client):
        """Validation du code INSEE"""
        # Code trop court
        response = test_client.get("/api/cadastre/parcelles", params={"code_insee": "123"})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Code trop long
        response = test_client.get("/api/cadastre/parcelles", params={"code_insee": "123456"})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_coordinates_validation(self, test_client):
        """Validation des coordonnees"""
        # Longitude hors limites
        response = test_client.get("/api/address/reverse", params={"lon": 200, "lat": 48})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Latitude hors limites
        response = test_client.get("/api/address/reverse", params={"lon": 2, "lat": 100})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_query_length_validation(self, test_client):
        """Validation de la longueur des requetes"""
        # Query trop courte
        response = test_client.get("/api/address/search", params={"q": "ab"})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
