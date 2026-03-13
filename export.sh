#!/bin/bash
# =============================================================
# Export simplifié — Prospection Foncière
# Crée une archive prête à déployer sur un nouveau serveur
# Inclut les données pour une migration sans perte
# =============================================================
# Usage :
#   bash export.sh                  # Export code + données
#   bash export.sh --no-data        # Export code uniquement
# =============================================================

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
INCLUDE_DATA=true

# Parsing des arguments
for arg in "$@"; do
    case "$arg" in
        --no-data) INCLUDE_DATA=false ;;
    esac
done

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Export Prospection Foncière            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

if [ "$INCLUDE_DATA" = true ]; then
    echo -e "  Mode : ${GREEN}Code + Données (migration complète)${NC}"
else
    echo -e "  Mode : ${YELLOW}Code uniquement (installation neuve)${NC}"
fi
echo ""

# --- Demander le domaine cible ---
read -rp "Domaine cible (ex: app.mondomaine.fr) : " TARGET_DOMAIN
if [ -z "$TARGET_DOMAIN" ]; then
    echo -e "${RED}Erreur : domaine requis.${NC}"
    exit 1
fi

# --- Dossier d'export ---
EXPORT_NAME="prospection-export-${TIMESTAMP}"
EXPORT_DIR="/tmp/${EXPORT_NAME}"
mkdir -p "$EXPORT_DIR"

STEP=1
TOTAL_STEPS=5
[ "$INCLUDE_DATA" = true ] && TOTAL_STEPS=6

echo ""
echo -e "${BLUE}[${STEP}/${TOTAL_STEPS}] Copie des fichiers sources...${NC}"

# Copier backend et frontend (sans fichiers runtime)
rsync -a --exclude='node_modules' --exclude='venv' --exclude='.venv' \
    --exclude='__pycache__' --exclude='*.pyc' --exclude='dist' \
    --exclude='.git' --exclude='data' --exclude='ssl' \
    --exclude='test_venv' --exclude='tmp_*' --exclude='*.db' \
    --exclude='*.sqlite' --exclude='.env' --exclude='.env.local' \
    "$SCRIPT_DIR/" "$EXPORT_DIR/"

echo -e "${GREEN}  ✓ Sources copiées${NC}"

# --- Export des données ---
if [ "$INCLUDE_DATA" = true ]; then
    STEP=$((STEP+1))
    echo -e "${BLUE}[${STEP}/${TOTAL_STEPS}] Export des données...${NC}"

    mkdir -p "$EXPORT_DIR/data-export"

    # 1. Base de données SQLite
    DATA_DIR="${SCRIPT_DIR}/data"
    if [ -d "$DATA_DIR" ]; then
        echo -e "  Copie du dossier data/..."
        cp -r "$DATA_DIR" "$EXPORT_DIR/data-export/data"
        DB_COUNT=$(find "$EXPORT_DIR/data-export/data" -name "*.db" -o -name "*.sqlite" 2>/dev/null | wc -l)
        DB_SIZE=$(du -sh "$EXPORT_DIR/data-export/data" 2>/dev/null | cut -f1)
        echo -e "${GREEN}  ✓ Données applicatives : ${DB_COUNT} base(s) — ${DB_SIZE}${NC}"
    else
        echo -e "${YELLOW}  ⚠ Pas de dossier data/ local trouvé${NC}"
    fi

    # 2. Export depuis le conteneur Docker (si en cours d'exécution)
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "prospection-backend"; then
        echo -e "  Export depuis les conteneurs Docker en cours..."

        # Copier la DB depuis le volume Docker
        docker cp prospection-backend:/data "$EXPORT_DIR/data-export/docker-data" 2>/dev/null && \
            echo -e "${GREEN}  ✓ Données du conteneur backend copiées${NC}" || \
            echo -e "${YELLOW}  ⚠ Impossible de copier depuis le conteneur backend${NC}"

        # Export Redis (dump RDB)
        if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "prospection-redis"; then
            docker exec prospection-redis redis-cli BGSAVE > /dev/null 2>&1
            sleep 2
            docker cp prospection-redis:/data/dump.rdb "$EXPORT_DIR/data-export/redis-dump.rdb" 2>/dev/null && \
                echo -e "${GREEN}  ✓ Dump Redis copié${NC}" || \
                echo -e "${YELLOW}  ⚠ Pas de dump Redis disponible${NC}"
        fi

        # Export .env actuel (avec secrets masqués pour référence)
        if docker exec prospection-backend cat /app/.env > /dev/null 2>&1; then
            docker exec prospection-backend env 2>/dev/null | grep -E "^(MSAL_|ANTHROPIC_|SECRET_|DATABASE_|CORS_|REDIS_)" > "$EXPORT_DIR/data-export/env-reference.txt" 2>/dev/null || true
            echo -e "${GREEN}  ✓ Variables d'environnement de référence exportées${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠ Conteneurs Docker non actifs — export depuis volumes uniquement${NC}"

        # Tenter de copier depuis les volumes Docker directement
        BACKEND_VOL=$(docker volume inspect prospection_data --format '{{.Mountpoint}}' 2>/dev/null || echo "")
        if [ -n "$BACKEND_VOL" ] && [ -d "$BACKEND_VOL" ]; then
            cp -r "$BACKEND_VOL" "$EXPORT_DIR/data-export/docker-data" 2>/dev/null && \
                echo -e "${GREEN}  ✓ Volume data copié${NC}" || true
        fi
    fi

    # Copier le .env actuel du backend (si existant localement)
    if [ -f "$SCRIPT_DIR/backend/.env" ]; then
        cp "$SCRIPT_DIR/backend/.env" "$EXPORT_DIR/data-export/original.env"
        echo -e "${GREEN}  ✓ .env original sauvegardé${NC}"
    fi

    DATA_TOTAL_SIZE=$(du -sh "$EXPORT_DIR/data-export" 2>/dev/null | cut -f1)
    echo -e "${GREEN}  ✓ Export données terminé — ${DATA_TOTAL_SIZE} total${NC}"
fi

STEP=$((STEP+1))
echo -e "${BLUE}[${STEP}/${TOTAL_STEPS}] Adaptation des configs nginx au domaine ${TARGET_DOMAIN}...${NC}"

# Adapter nginx.conf
sed -i "s/prospection\.mdoservices\.fr/${TARGET_DOMAIN}/g" "$EXPORT_DIR/nginx.conf"
echo -e "${GREEN}  ✓ nginx.conf adapté${NC}"

# Adapter nginx-ssl.conf
sed -i "s/prospection\.mdoservices\.fr/${TARGET_DOMAIN}/g" "$EXPORT_DIR/nginx-ssl.conf"
sed -i "s/brain\.mdoservices\.fr/brain.${TARGET_DOMAIN%%.*}.${TARGET_DOMAIN#*.}/g" "$EXPORT_DIR/nginx-ssl.conf" 2>/dev/null || true
echo -e "${GREEN}  ✓ nginx-ssl.conf adapté${NC}"

STEP=$((STEP+1))
echo -e "${BLUE}[${STEP}/${TOTAL_STEPS}] Génération du fichier .env...${NC}"

# Générer une SECRET_KEY aléatoire
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | head -c 64)

# Si on a un .env original, reprendre les clés existantes
ORIG_MSAL_CLIENT_ID=""
ORIG_MSAL_TENANT_ID=""
ORIG_ANTHROPIC_KEY=""
ORIG_SECRET_KEY="$SECRET_KEY"
if [ "$INCLUDE_DATA" = true ] && [ -f "$EXPORT_DIR/data-export/original.env" ]; then
    echo -e "  Reprise des secrets depuis le .env original..."
    ORIG_MSAL_CLIENT_ID=$(grep "^MSAL_CLIENT_ID=" "$EXPORT_DIR/data-export/original.env" 2>/dev/null | cut -d= -f2- || echo "")
    ORIG_MSAL_TENANT_ID=$(grep "^MSAL_TENANT_ID=" "$EXPORT_DIR/data-export/original.env" 2>/dev/null | cut -d= -f2- || echo "")
    ORIG_ANTHROPIC_KEY=$(grep "^ANTHROPIC_API_KEY=" "$EXPORT_DIR/data-export/original.env" 2>/dev/null | cut -d= -f2- || echo "")
    ORIG_SK=$(grep "^SECRET_KEY=" "$EXPORT_DIR/data-export/original.env" 2>/dev/null | cut -d= -f2- || echo "")
    # IMPORTANT : garder la même SECRET_KEY pour que les JWT existants restent valides
    [ -n "$ORIG_SK" ] && ORIG_SECRET_KEY="$ORIG_SK"
fi

cat > "$EXPORT_DIR/backend/.env" <<ENVEOF
# ============================================================
# Configuration Prospection — ${TARGET_DOMAIN}
# Généré le $(date '+%Y-%m-%d %H:%M:%S')
# ============================================================

# ---- Application ----
ENVIRONMENT=production
DEBUG=false
APP_VERSION=2.0.0

# ---- Serveur ----
HOST=0.0.0.0
PORT=8000
WORKERS=4

# ---- CORS ----
CORS_ORIGINS=https://${TARGET_DOMAIN},https://www.${TARGET_DOMAIN}

# ---- Sécurité JWT ----
# IMPORTANT : si vous migrez avec données, cette clé doit rester identique
# pour que les sessions utilisateur restent valides
SECRET_KEY=${ORIG_SECRET_KEY}
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# ---- Base de données ----
DATABASE_URL=sqlite:////data/prospection.db

# ---- Microsoft Azure AD (optionnel) ----
MSAL_CLIENT_ID=${ORIG_MSAL_CLIENT_ID}
MSAL_TENANT_ID=${ORIG_MSAL_TENANT_ID}

# ---- Open WebUI ----
WEBUI_SECRET_KEY=$(head -c 32 /dev/urandom | xxd -p | head -c 32 2>/dev/null || echo "changeme-$(date +%s)")

# ---- Anthropic Claude (optionnel) ----
ANTHROPIC_API_KEY=${ORIG_ANTHROPIC_KEY}

# ---- Redis ----
REDIS_URL=redis://redis:6379/0
CACHE_TTL=300
CACHE_ENABLED=true

# ---- Logging ----
LOG_LEVEL=INFO
LOG_FORMAT=json
ENVEOF

echo -e "${GREEN}  ✓ .env généré (secrets repris de l'original)${NC}"

STEP=$((STEP+1))
echo -e "${BLUE}[${STEP}/${TOTAL_STEPS}] Génération du script d'installation...${NC}"

cat > "$EXPORT_DIR/install-server.sh" <<'INSTALLEOF'
#!/bin/bash
# =============================================================
# Installation Prospection Foncière sur serveur
# Gère l'installation neuve ET la migration avec données
# Prérequis : Docker + Docker Compose
# =============================================================

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Installation Prospection Foncière           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

HAS_DATA=false
[ -d "data-export" ] && HAS_DATA=true

if [ "$HAS_DATA" = true ]; then
    echo -e "  Mode : ${GREEN}Migration avec données${NC}"
else
    echo -e "  Mode : ${YELLOW}Installation neuve${NC}"
fi
echo ""

# --- Vérifier Docker ---
if ! command -v docker &> /dev/null; then
    echo -e "${BLUE}Installation de Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
    sudo systemctl enable docker && sudo systemctl start docker
    echo -e "${GREEN}Docker installé.${NC}"
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}Docker Compose v2 requis.${NC}"
    echo "  https://docs.docker.com/compose/install/"
    exit 1
fi

# Extraire le domaine depuis nginx.conf
DOMAIN=$(grep -m1 'server_name' nginx.conf | awk '{print $2}' | tr -d ';')
echo -e "Domaine : ${GREEN}${DOMAIN}${NC}"
echo ""

# --- [1] Configuration ---
echo -e "${BLUE}[1/6] Vérification de la configuration...${NC}"
if [ ! -f backend/.env ]; then
    echo -e "${RED}Fichier backend/.env manquant !${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ backend/.env présent${NC}"

# --- [2] Dossiers ---
echo -e "${BLUE}[2/6] Création des dossiers...${NC}"
mkdir -p data ssl
echo -e "${GREEN}  ✓ Dossiers data/ et ssl/ créés${NC}"

# --- [3] Restauration des données ---
if [ "$HAS_DATA" = true ]; then
    echo -e "${BLUE}[3/6] Restauration des données...${NC}"

    # Priorité : docker-data (depuis conteneur) > data (dossier local)
    if [ -d "data-export/docker-data" ]; then
        echo -e "  Restauration depuis l'export Docker..."
        cp -r data-export/docker-data/* data/ 2>/dev/null || \
        cp -r data-export/docker-data/. data/ 2>/dev/null || true
        DATA_SIZE=$(du -sh data/ 2>/dev/null | cut -f1)
        echo -e "${GREEN}  ✓ Données Docker restaurées (${DATA_SIZE})${NC}"
    elif [ -d "data-export/data" ]; then
        echo -e "  Restauration depuis le dossier local..."
        cp -r data-export/data/* data/ 2>/dev/null || \
        cp -r data-export/data/. data/ 2>/dev/null || true
        DATA_SIZE=$(du -sh data/ 2>/dev/null | cut -f1)
        echo -e "${GREEN}  ✓ Données locales restaurées (${DATA_SIZE})${NC}"
    fi

    # Vérifier la DB
    DB_FILES=$(find data/ -name "*.db" -o -name "*.sqlite" 2>/dev/null | head -5)
    if [ -n "$DB_FILES" ]; then
        echo -e "${GREEN}  ✓ Base(s) de données trouvée(s) :${NC}"
        for db in $DB_FILES; do
            DB_SIZE=$(du -sh "$db" | cut -f1)
            echo -e "    - $db (${DB_SIZE})"
        done
    else
        echo -e "${YELLOW}  ⚠ Aucune base de données trouvée dans les données exportées${NC}"
    fi

    # Redis dump
    if [ -f "data-export/redis-dump.rdb" ]; then
        echo -e "  Le dump Redis sera restauré après le démarrage des services."
    fi
else
    echo -e "${BLUE}[3/6] Installation neuve — pas de données à restaurer${NC}"
fi

# --- [4] SSL ---
echo -e "${BLUE}[4/6] Configuration SSL...${NC}"

if [ -f ssl/fullchain.pem ] && [ -s ssl/fullchain.pem ]; then
    echo -e "${GREEN}  ✓ Certificats SSL déjà présents${NC}"
else
    echo ""
    echo "  Options SSL :"
    echo "    1) Let's Encrypt (le domaine doit pointer vers ce serveur)"
    echo "    2) Certificat auto-signé (tests)"
    echo "    3) HTTP uniquement"
    echo ""
    read -rp "  Choix [1/2/3] : " SSL_CHOICE

    case "$SSL_CHOICE" in
        1)
            if ! command -v certbot &> /dev/null; then
                apt-get update && apt-get install -y certbot 2>/dev/null || \
                snap install --classic certbot 2>/dev/null
            fi
            read -rp "  Email Let's Encrypt : " LE_EMAIL
            certbot certonly --standalone -d "$DOMAIN" --email "$LE_EMAIL" --agree-tos --non-interactive
            cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ssl/fullchain.pem
            cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" ssl/privkey.pem
            echo -e "${GREEN}  ✓ Certificat Let's Encrypt obtenu${NC}"

            # Renouvellement automatique
            (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ${SCRIPT_DIR}/ssl/fullchain.pem && cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem ${SCRIPT_DIR}/ssl/privkey.pem && docker compose -f ${SCRIPT_DIR}/docker-compose.prod.yml restart frontend") | crontab -
            echo -e "${GREEN}  ✓ Renouvellement auto configuré${NC}"
            ;;
        2)
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout ssl/privkey.pem -out ssl/fullchain.pem \
                -subj "/CN=${DOMAIN}" 2>/dev/null
            echo -e "${GREEN}  ✓ Certificat auto-signé (365j)${NC}"
            ;;
        3)
            cp nginx.conf nginx-ssl.conf
            mkdir -p ssl
            touch ssl/fullchain.pem ssl/privkey.pem
            echo -e "${YELLOW}  ⚠ HTTP uniquement${NC}"
            ;;
    esac
fi

# --- [5] Build & Start ---
echo ""
echo -e "${BLUE}[5/6] Build des images Docker...${NC}"
docker compose -f docker-compose.prod.yml build
echo -e "${GREEN}  ✓ Images construites${NC}"

echo ""
echo -e "${BLUE}[6/6] Démarrage des services...${NC}"
docker compose -f docker-compose.prod.yml up -d
echo -e "${GREEN}  ✓ Services démarrés${NC}"

# --- Restaurer Redis si dump disponible ---
if [ "$HAS_DATA" = true ] && [ -f "data-export/redis-dump.rdb" ]; then
    echo ""
    echo -e "${BLUE}Restauration du cache Redis...${NC}"
    sleep 3
    docker cp data-export/redis-dump.rdb prospection-redis:/data/dump.rdb 2>/dev/null && \
    docker restart prospection-redis 2>/dev/null && \
    echo -e "${GREEN}  ✓ Cache Redis restauré${NC}" || \
    echo -e "${YELLOW}  ⚠ Restauration Redis échouée (non bloquant)${NC}"
fi

# --- Attente backend ---
echo ""
echo -e "${BLUE}Attente du backend...${NC}"
MAX_WAIT=60
WAITED=0
until curl -sf http://localhost:8000/health > /dev/null 2>&1; do
    WAITED=$((WAITED+2))
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo -e "${YELLOW}  ⚠ Timeout. Vérifiez : docker compose -f docker-compose.prod.yml logs backend${NC}"
        break
    fi
    sleep 2
done
[ $WAITED -lt $MAX_WAIT ] && echo -e "${GREEN}  ✓ Backend opérationnel${NC}"

# --- Compte admin (seulement si install neuve) ---
if [ "$HAS_DATA" = false ]; then
    echo ""
    echo -e "${BLUE}Création du compte administrateur...${NC}"
    read -rp "  Email admin : " ADMIN_EMAIL
    read -rsp "  Mot de passe : " ADMIN_PASS
    echo ""
    docker compose -f docker-compose.prod.yml exec backend python create_admin.py "$ADMIN_EMAIL" "$ADMIN_PASS" 2>/dev/null || \
        echo -e "${YELLOW}  ⚠ Création admin échouée. Vérifiez manuellement.${NC}"
else
    echo ""
    echo -e "${GREEN}  ✓ Comptes utilisateur existants restaurés avec la base de données${NC}"
fi

# --- Résumé ---
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
if [ "$HAS_DATA" = true ]; then
echo -e "${GREEN}║  Migration terminée !                        ║${NC}"
else
echo -e "${GREEN}║  Installation terminée !                     ║${NC}"
fi
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Application : ${BLUE}https://${DOMAIN}${NC}"
echo ""
if [ "$HAS_DATA" = true ]; then
echo -e "  ${GREEN}✓ Base de données restaurée${NC}"
echo -e "  ${GREEN}✓ Comptes utilisateur conservés${NC}"
echo -e "  ${GREEN}✓ Secrets JWT conservés (sessions valides)${NC}"
echo ""
fi
echo -e "  Commandes utiles :"
echo -e "    ${YELLOW}docker compose -f docker-compose.prod.yml logs -f${NC}        # Logs"
echo -e "    ${YELLOW}docker compose -f docker-compose.prod.yml restart${NC}        # Redémarrer"
echo -e "    ${YELLOW}docker compose -f docker-compose.prod.yml down${NC}           # Arrêter"
echo ""

# Nettoyage optionnel du dossier d'export
if [ "$HAS_DATA" = true ]; then
    echo -e "${YELLOW}  Le dossier data-export/ peut être supprimé après vérification :${NC}"
    echo -e "    rm -rf data-export/"
fi
echo ""
INSTALLEOF

chmod +x "$EXPORT_DIR/install-server.sh"
echo -e "${GREEN}  ✓ install-server.sh généré${NC}"

STEP=$((STEP+1))
echo -e "${BLUE}[${STEP}/${TOTAL_STEPS}] Création de l'archive...${NC}"

ARCHIVE_PATH="${SCRIPT_DIR}/${EXPORT_NAME}.tar.gz"
cd /tmp
tar czf "$ARCHIVE_PATH" "$EXPORT_NAME"
rm -rf "$EXPORT_DIR"

ARCHIVE_SIZE=$(du -sh "$ARCHIVE_PATH" | cut -f1)

echo -e "${GREEN}  ✓ Archive créée${NC}"
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Export terminé !                            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Archive  : ${BLUE}${ARCHIVE_PATH}${NC}"
echo -e "  Taille   : ${ARCHIVE_SIZE}"
echo -e "  Domaine  : ${TARGET_DOMAIN}"
if [ "$INCLUDE_DATA" = true ]; then
echo -e "  Données  : ${GREEN}incluses${NC}"
fi
echo ""
echo -e "  ${YELLOW}Déploiement sur le nouveau serveur :${NC}"
echo ""
echo -e "    1. Copier l'archive :"
echo -e "       ${BLUE}scp ${ARCHIVE_PATH} user@serveur:~/${NC}"
echo ""
echo -e "    2. Extraire :"
echo -e "       ${BLUE}tar xzf ${EXPORT_NAME}.tar.gz${NC}"
echo -e "       ${BLUE}cd ${EXPORT_NAME}${NC}"
echo ""
echo -e "    3. Vérifier/éditer la config :"
echo -e "       ${BLUE}nano backend/.env${NC}"
echo ""
echo -e "    4. Lancer l'installation :"
echo -e "       ${BLUE}sudo bash install-server.sh${NC}"
echo ""
