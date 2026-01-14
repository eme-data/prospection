"""
Configuration du logging structure
Utilise structlog pour des logs JSON en production
"""

import logging
import sys
from typing import Optional

import structlog
from structlog.typing import Processor

from app.config import settings


def setup_logging() -> None:
    """Configure le logging pour l'application"""

    # Niveau de log
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)

    # Processors communs
    shared_processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if settings.log_format == "json":
        # Format JSON pour la production
        processors: list[Processor] = shared_processors + [
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ]
    else:
        # Format console pour le developpement
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(colors=True),
        ]

    # Configuration structlog
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Configuration logging standard (pour les bibliotheques tierces)
    logging.basicConfig(
        format="%(message)s",
        level=log_level,
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    # Reduction du bruit des bibliotheques
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: Optional[str] = None) -> structlog.BoundLogger:
    """Retourne un logger configure"""
    return structlog.get_logger(name)
