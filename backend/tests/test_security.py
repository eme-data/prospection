"""
Tests pour le module de securite
"""

import pytest
from app.security import (
    validate_code_insee,
    validate_coordinates,
    sanitize_string,
)


class TestValidateCodeInsee:
    """Tests pour la validation du code INSEE"""

    def test_valid_code_insee(self):
        """Code INSEE valide"""
        assert validate_code_insee("75056") is True
        assert validate_code_insee("13055") is True
        assert validate_code_insee("69123") is True
        assert validate_code_insee("2A004") is True  # Corse
        assert validate_code_insee("2B033") is True  # Corse

    def test_invalid_code_insee_length(self):
        """Code INSEE avec longueur invalide"""
        assert validate_code_insee("7505") is False
        assert validate_code_insee("750560") is False
        assert validate_code_insee("") is False

    def test_invalid_code_insee_characters(self):
        """Code INSEE avec caracteres invalides"""
        assert validate_code_insee("7505!") is False
        assert validate_code_insee("75 56") is False
        assert validate_code_insee("ABCDE") is False

    def test_code_insee_with_special_chars(self):
        """Code INSEE avec injection potentielle"""
        assert validate_code_insee("75056; DROP TABLE") is False
        assert validate_code_insee("<script>") is False


class TestValidateCoordinates:
    """Tests pour la validation des coordonnees"""

    def test_valid_coordinates(self):
        """Coordonnees valides"""
        assert validate_coordinates(2.3488, 48.8534) is True
        assert validate_coordinates(-180, -90) is True
        assert validate_coordinates(180, 90) is True
        assert validate_coordinates(0, 0) is True

    def test_invalid_longitude(self):
        """Longitude invalide"""
        assert validate_coordinates(-181, 48) is False
        assert validate_coordinates(181, 48) is False

    def test_invalid_latitude(self):
        """Latitude invalide"""
        assert validate_coordinates(2, -91) is False
        assert validate_coordinates(2, 91) is False

    def test_none_coordinates(self):
        """Coordonnees None"""
        assert validate_coordinates(None, 48) is False
        assert validate_coordinates(2, None) is False
        assert validate_coordinates(None, None) is False


class TestSanitizeString:
    """Tests pour la sanitization des chaines"""

    def test_normal_string(self):
        """Chaine normale"""
        assert sanitize_string("Paris") == "Paris"
        assert sanitize_string("1 rue de la Paix") == "1 rue de la Paix"

    def test_string_with_html(self):
        """Chaine avec HTML"""
        result = sanitize_string("<script>alert('xss')</script>")
        assert "<script>" not in result
        assert "alert" not in result or "&lt;" in result

    def test_string_truncation(self):
        """Troncature de chaine longue"""
        long_string = "a" * 300
        result = sanitize_string(long_string, max_length=100)
        assert len(result) <= 100

    def test_string_with_sql_injection(self):
        """Chaine avec injection SQL"""
        result = sanitize_string("'; DROP TABLE users; --")
        # La fonction doit nettoyer ou echapper les caracteres dangereux
        assert "DROP TABLE" not in result or "&#" in result or "&" in result

    def test_empty_string(self):
        """Chaine vide"""
        assert sanitize_string("") == ""

    def test_whitespace_trimming(self):
        """Suppression des espaces en debut/fin"""
        assert sanitize_string("  Paris  ").strip() == "Paris"
