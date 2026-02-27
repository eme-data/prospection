#!/bin/bash
# Entrypoint backend — applique les migrations Alembic puis démarre Gunicorn

set -e

echo "[entrypoint] Attente de la base de données..."
# Attend que la DB soit prête (max 30s)
MAX_RETRIES=30
RETRY=0
until python -c "
from app.database import engine
from sqlalchemy import text
try:
    with engine.connect() as c:
        c.execute(text('SELECT 1'))
    print('DB OK')
    exit(0)
except Exception as e:
    print(f'DB not ready: {e}')
    exit(1)
" 2>/dev/null; do
    RETRY=$((RETRY+1))
    if [ $RETRY -ge $MAX_RETRIES ]; then
        echo "[entrypoint] Timeout: DB inaccessible après ${MAX_RETRIES}s"
        exit 1
    fi
    echo "[entrypoint] DB pas encore prête (${RETRY}/${MAX_RETRIES})..."
    sleep 1
done

echo "[entrypoint] Application des migrations Alembic..."
alembic upgrade head
echo "[entrypoint] Migrations OK"

echo "[entrypoint] Démarrage de Gunicorn..."
exec gunicorn app.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers 4 \
    --bind 0.0.0.0:8000 \
    --timeout 300 \
    --keep-alive 5 \
    --access-logfile - \
    --error-logfile - \
    --capture-output
