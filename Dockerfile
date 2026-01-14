# Dockerfile multi-stage pour Prospection Fonciere
# Build: docker build -t prospection-fonciere .
# Run: docker run -p 8000:8000 -p 5173:5173 prospection-fonciere

# ============== Stage 1: Build Frontend ==============
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copie des fichiers de dependances
COPY frontend/package*.json ./

# Installation des dependances
RUN npm ci

# Copie du code source
COPY frontend/ ./

# Build de production
RUN npm run build

# ============== Stage 2: Runtime ==============
FROM python:3.11-slim

WORKDIR /app

# Installation des dependances systeme
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copie des fichiers backend
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/

# Copie du build frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Installation de Node.js pour le serveur de preview (optionnel)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copie du package.json pour le serveur preview
COPY frontend/package*.json ./frontend/

# Script de demarrage
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Ports exposes
EXPOSE 8000 5173

# Variables d'environnement
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
