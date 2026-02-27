"""
Configuration Alembic — charge la DATABASE_URL depuis les settings
et importe tous les modèles SQLAlchemy pour les migrations auto-générées.
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Ajoute le dossier backend au path pour que les imports app.* fonctionnent
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.config import settings
from app.database import Base  # noqa: E402

# Import explicite de tous les modèles pour que Base.metadata les inclue
from app.models import user           # noqa: F401
from app.models import communication  # noqa: F401
from app.models import commerce       # noqa: F401
from app.models import conges         # noqa: F401
from app.models import settings as app_settings_model  # noqa: F401
from app.models import analyse_devis  # noqa: F401
from app.models import logo           # noqa: F401
from app.models import faisabilite    # noqa: F401

# Config Alembic (depuis alembic.ini)
config = context.config

# Surcharge l'URL avec celle des settings (env var > alembic.ini)
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Mode offline — génère le SQL sans connexion réelle."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Mode online — connexion réelle et migration."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
