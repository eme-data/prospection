#!/bin/bash
set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          PROSPECTION FONCIERE - Docker                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# Demarrage du backend
echo "Demarrage du backend..."
cd /app/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Attente que le backend soit pret
sleep 3

# Demarrage du serveur frontend (mode preview)
echo "Demarrage du frontend..."
cd /app/frontend
npx serve dist -l 5173 &
FRONTEND_PID=$!

echo ""
echo "Application demarree!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""

# Gestion des signaux
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGTERM SIGINT

# Attente
wait
