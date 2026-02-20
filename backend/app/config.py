"""
Configuration de l'application
Gestion centralisee des parametres via variables d'environnement
"""

from functools import lru_cache
from typing import List, Optional, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration de l'application"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Application
    app_name: str = "Prospection Fonciere API"
    app_version: str = "2.0.0"
    debug: bool = Field(default=False, description="Mode debug")
    environment: str = Field(default="production", description="Environnement (development, staging, production)")

    # Server
    host: str = Field(default="0.0.0.0", description="Host du serveur")
    port: int = Field(default=8000, description="Port du serveur")
    workers: int = Field(default=4, description="Nombre de workers Gunicorn")

    # CORS
    cors_origins: Union[List[str], str] = Field(
        default=["http://localhost:5173"],
        description="Origines autorisees pour CORS"
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",")]
        return v

    # Security & Auth
    rate_limit_requests: int = Field(default=100, description="Nombre max de requetes")
    rate_limit_window: int = Field(default=60, description="Fenetre en secondes")
    api_key: Optional[str] = Field(default=None, description="Cle API optionnelle")
    
    # Database (Stockée dans /data pour persistance via Docker volume)
    database_url: str = Field(default="sqlite:////data/prospection.db", description="URL de la base de donnees")
    
    # JWT Authentication
    secret_key: str = Field(default="change-ce-secret-immédiatement-en-production", description="Cle secrete JWT")
    access_token_expire_minutes: int = Field(default=1440, description="Expiration du token en minutes (24h)")

    # Redis Cache
    redis_url: Optional[str] = Field(default=None, description="URL Redis pour le cache")
    cache_ttl: int = Field(default=300, description="TTL du cache en secondes")
    cache_enabled: bool = Field(default=True, description="Activer le cache")

    # External APIs
    api_timeout: float = Field(default=30.0, description="Timeout des APIs externes")
    api_max_retries: int = Field(default=3, description="Nombre max de retries")

    # Logging
    log_level: str = Field(default="INFO", description="Niveau de log")
    log_format: str = Field(default="json", description="Format de log (json, console)")
    log_file: Optional[str] = Field(default=None, description="Fichier de log optionnel")

    # URLs des APIs externes
    api_adresse_url: str = "https://api-adresse.data.gouv.fr"
    api_cadastre_url: str = "https://cadastre.data.gouv.fr"
    api_geo_url: str = "https://geo.api.gouv.fr"
    api_dvf_url: str = "https://api.cquest.org/dvf"
    api_georisques_url: str = "https://georisques.gouv.fr/api/v1"
    api_gpu_url: str = "https://apicarto.ign.fr/api/gpu"
    api_ign_wfs_url: str = "https://data.geopf.fr/wfs/ows"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_development(self) -> bool:
        return self.environment == "development"


@lru_cache()
def get_settings() -> Settings:
    """Singleton pour la configuration"""
    return Settings()


# Instance globale
settings = get_settings()
