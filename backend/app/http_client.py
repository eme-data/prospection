"""
Client HTTP robuste avec retry et circuit breaker
"""

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
from typing import Any, Dict, Optional

from app.config import settings
from app.logging_config import get_logger

logger = get_logger(__name__)


class APIError(Exception):
    """Erreur lors d'un appel API"""

    def __init__(self, message: str, status_code: int = 500, api_name: str = "unknown"):
        self.message = message
        self.status_code = status_code
        self.api_name = api_name
        super().__init__(self.message)


class RobustHTTPClient:
    """Client HTTP avec retry automatique et gestion des erreurs"""

    def __init__(self, base_url: str, api_name: str = "API"):
        self.base_url = base_url.rstrip("/")
        self.api_name = api_name
        self.timeout = httpx.Timeout(settings.api_timeout)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
        reraise=True,
    )
    async def _request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> httpx.Response:
        """Execute une requete HTTP avec retry"""
        url = f"{self.base_url}{path}"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.request(method, url, params=params, **kwargs)

                # Log de la requete
                logger.debug(
                    "api_request",
                    api=self.api_name,
                    method=method,
                    path=path,
                    status_code=response.status_code,
                )

                return response

            except httpx.TimeoutException as e:
                logger.warning(
                    "api_timeout",
                    api=self.api_name,
                    path=path,
                    timeout=settings.api_timeout,
                )
                raise

            except httpx.NetworkError as e:
                logger.warning(
                    "api_network_error",
                    api=self.api_name,
                    path=path,
                    error=str(e),
                )
                raise

    async def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        raise_for_status: bool = True,
    ) -> Dict[str, Any]:
        """Execute une requete GET"""
        try:
            response = await self._request("GET", path, params=params)

            if raise_for_status and response.status_code >= 400:
                logger.error(
                    "api_error",
                    api=self.api_name,
                    path=path,
                    status_code=response.status_code,
                    response=response.text[:500],
                )
                raise APIError(
                    f"Erreur API {self.api_name}: {response.status_code}",
                    status_code=response.status_code,
                    api_name=self.api_name,
                )

            return response.json()

        except httpx.TimeoutException:
            raise APIError(
                f"Timeout lors de l'appel a {self.api_name}",
                status_code=504,
                api_name=self.api_name,
            )
        except httpx.NetworkError as e:
            raise APIError(
                f"Erreur reseau pour {self.api_name}: {str(e)}",
                status_code=502,
                api_name=self.api_name,
            )
        except Exception as e:
            if isinstance(e, APIError):
                raise
            logger.exception("api_unexpected_error", api=self.api_name, path=path)
            raise APIError(
                f"Erreur inattendue pour {self.api_name}",
                status_code=500,
                api_name=self.api_name,
            )


# Clients pre-configures pour chaque API
ban_client = RobustHTTPClient(settings.api_adresse_url, "BAN")
cadastre_client = RobustHTTPClient(settings.api_cadastre_url, "Cadastre")
geo_client = RobustHTTPClient(settings.api_geo_url, "Geo API")
dvf_client = RobustHTTPClient(settings.api_dvf_url, "DVF")
georisques_client = RobustHTTPClient(settings.api_georisques_url, "Georisques")
gpu_client = RobustHTTPClient(settings.api_gpu_url, "GPU")
