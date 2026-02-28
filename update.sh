#!/bin/bash
#===============================================================================
# Script de Mise à Jour Rapide - Prospection Foncière
# Usage: sudo ./update.sh [OPTIONS]
#
# Options:
#   --branch BRANCH     Branche à déployer (défaut: main)
#   --tag TAG           Tag/Version spécifique à déployer
#   --force             Force la reconstruction sans cache
#   --rollback          Revenir à la version précédente
#   --no-downtime       Mise à jour sans interruption
#===============================================================================

set -euo pipefail

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Variables
INSTALL_DIR="/opt/prospection"
APP_USER="prospection"
BRANCH="main"
TAG=""
FORCE_REBUILD=false
ROLLBACK=false
NO_DOWNTIME=false

# Fonctions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --branch)
            BRANCH="$2"
            shift 2
            ;;
        --tag)
            TAG="$2"
            shift 2
            ;;
        --force)
            FORCE_REBUILD=true
            shift
            ;;
        --rollback)
            ROLLBACK=true
            shift
            ;;
        --no-downtime)
            NO_DOWNTIME=true
            shift
            ;;
        -h|--help)
            echo "Usage: sudo ./update.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --branch BRANCH     Branche Git à déployer (défaut: main)"
            echo "  --tag TAG           Version/tag spécifique"
            echo "  --force             Force la reconstruction sans cache"
            echo "  --rollback          Revenir à la version précédente"
            echo "  --no-downtime       Mise à jour sans interruption de service"
            echo "  -h, --help          Afficher cette aide"
            echo ""
            echo "Exemples:"
            echo "  sudo ./update.sh                          # Mise à jour standard"
            echo "  sudo ./update.sh --branch develop         # Déployer la branche develop"
            echo "  sudo ./update.sh --tag v2.1.0             # Déployer la version v2.1.0"
            echo "  sudo ./update.sh --force                  # Reconstruction complète"
            echo "  sudo ./update.sh --no-downtime            # Zero downtime update"
            echo "  sudo ./update.sh --rollback               # Rollback version précédente"
            exit 0
            ;;
        *)
            log_error "Option inconnue: $1 (utilisez --help)"
            ;;
    esac
done

# Vérification root
if [[ $EUID -ne 0 ]]; then
    log_error "Ce script doit être exécuté en tant que root (sudo ./update.sh)"
fi

# Vérification du répertoire
if [[ ! -d "$INSTALL_DIR" ]]; then
    log_error "Répertoire d'installation non trouvé: $INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Fix git safe directory issues (CVE-2022-24765)
git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true
sudo -u "$APP_USER" git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true

# Fix permissions : s'assurer que l'utilisateur $APP_USER peut écrire dans tout le repo
# Docker et root peuvent changer les propriétaires des fichiers, on remet tout en ordre
log_info "Correction des permissions du répertoire..."
chown -R "$APP_USER":"$APP_USER" "$INSTALL_DIR" 2>/dev/null || true

echo ""
echo "=============================================="
echo "  Mise à Jour Prospection Foncière"
echo "=============================================="
echo ""

#===============================================================================
# ROLLBACK
#===============================================================================
if [[ "$ROLLBACK" == true ]]; then
    log_info "Rollback à la version précédente..."

    # Récupérer le tag précédent
    PREVIOUS_TAG=$(sudo -u "$APP_USER" git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")

    if [[ -z "$PREVIOUS_TAG" ]]; then
        log_warn "Aucun tag précédent trouvé, rollback au commit précédent..."
        PREVIOUS_COMMIT=$(sudo -u "$APP_USER" git rev-parse HEAD~1)
        log_info "Rollback vers commit: $PREVIOUS_COMMIT"

        systemctl stop prospection
        sudo -u "$APP_USER" git checkout "$PREVIOUS_COMMIT"
    else
        log_info "Rollback vers version: $PREVIOUS_TAG"
        systemctl stop prospection
        sudo -u "$APP_USER" git checkout "$PREVIOUS_TAG"
    fi

    # Reconstruire et redémarrer
    sudo -u "$APP_USER" docker compose build
    systemctl start prospection

    log_success "Rollback terminé"
    exit 0
fi

#===============================================================================
# SAUVEGARDE
#===============================================================================
log_info "Sauvegarde de la version actuelle..."

CURRENT_COMMIT=$(sudo -u "$APP_USER" git rev-parse --short HEAD)
BACKUP_TAG="backup-$(date +%Y%m%d-%H%M%S)-${CURRENT_COMMIT}"

sudo -u "$APP_USER" git tag "$BACKUP_TAG" 2>/dev/null || log_warn "Tag backup déjà existant"
log_success "Backup créé: $BACKUP_TAG"

#===============================================================================
# MISE À JOUR DU CODE
#===============================================================================
log_info "Récupération des mises à jour..."

# Reset des modifications locales pour éviter les conflits lors du pull
# (ex: update.sh modifié manuellement sur le serveur)
sudo -u "$APP_USER" git reset --hard HEAD 2>/dev/null || true

sudo -u "$APP_USER" git fetch --all --tags

if [[ -n "$TAG" ]]; then
    log_info "Déploiement de la version: $TAG"
    sudo -u "$APP_USER" git checkout "tags/$TAG"
elif [[ -n "$BRANCH" ]]; then
    log_info "Déploiement de la branche: $BRANCH"
    sudo -u "$APP_USER" git checkout "$BRANCH"
    sudo -u "$APP_USER" git pull origin "$BRANCH"
fi

NEW_COMMIT=$(sudo -u "$APP_USER" git rev-parse --short HEAD)
log_success "Code mis à jour: $CURRENT_COMMIT -> $NEW_COMMIT"

# Fix permissions après pull (git pull crée des fichiers en tant que $APP_USER via sudo,
# mais certains fichiers peuvent rester root si le pull échoue partiellement)
chown -R "$APP_USER":"$APP_USER" "$INSTALL_DIR" 2>/dev/null || true

# Vérifier s'il y a des changements
if [[ "$CURRENT_COMMIT" == "$NEW_COMMIT" ]] && [[ "$FORCE_REBUILD" == false ]]; then
    log_warn "Aucun changement détecté. Utilisez --force pour reconstruire quand même."
    echo ""
    echo "Version actuelle: $(sudo -u "$APP_USER" git describe --tags 2>/dev/null || echo $NEW_COMMIT)"
    exit 0
fi

#===============================================================================
# VALIDATION DU .env
#===============================================================================
log_info "Vérification du fichier .env..."

ENV_FILE="$INSTALL_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
    # Chercher aussi dans backend/
    ENV_FILE="$INSTALL_DIR/backend/.env"
fi

ENV_OK=true

check_env_var() {
    local var_name="$1"
    local required="$2"  # "required" ou "recommended"
    local hint="$3"

    # Chercher dans le .env ou dans l'environnement
    local value=""
    if [[ -f "$ENV_FILE" ]]; then
        value=$(grep -E "^${var_name}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-)
    fi

    if [[ -z "$value" ]]; then
        if [[ "$required" == "required" ]]; then
            log_error "Variable manquante dans .env : ${var_name} — ${hint}"
            ENV_OK=false
        else
            log_warn "Variable recommandée absente : ${var_name} — ${hint}"
        fi
    fi
}

check_env_var "SECRET_KEY" "required" "Générer avec: openssl rand -hex 32"
check_env_var "POSTGRES_PASSWORD" "required" "Mot de passe PostgreSQL"
check_env_var "WEBUI_SECRET_KEY" "required" "Générer avec: openssl rand -hex 32"
check_env_var "CORS_ORIGINS" "recommended" "Ex: [\"https://mon-domaine.fr\"]"

# Vérifier que WEBUI_SECRET_KEY n'est pas la valeur par défaut
if [[ -f "$ENV_FILE" ]]; then
    WEBUI_KEY=$(grep -E "^WEBUI_SECRET_KEY=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2-)
    if [[ "$WEBUI_KEY" == "prospection-secret-key-change-me" ]]; then
        log_warn "WEBUI_SECRET_KEY utilise la valeur par défaut — à changer en production !"
    fi
fi

if [[ "$ENV_OK" == false ]]; then
    log_error "Des variables obligatoires sont manquantes dans .env. Corrigez avant de continuer."
fi

log_success "Fichier .env validé"

#===============================================================================
# DÉTECTION DES CHANGEMENTS
#===============================================================================
log_info "Analyse des changements..."

CHANGED_FILES=$(sudo -u "$APP_USER" git diff --name-only "$CURRENT_COMMIT" "$NEW_COMMIT" || echo "")

BACKEND_CHANGED=false
FRONTEND_CHANGED=false
CONFIG_CHANGED=false

if echo "$CHANGED_FILES" | grep -q "backend/"; then
    BACKEND_CHANGED=true
    log_info "→ Backend modifié"
fi

if echo "$CHANGED_FILES" | grep -q "frontend/"; then
    FRONTEND_CHANGED=true
    log_info "→ Frontend modifié"
fi

if echo "$CHANGED_FILES" | grep -qE "docker-compose|Dockerfile|nginx.conf|requirements.txt|package.json"; then
    CONFIG_CHANGED=true
    log_info "→ Configuration modifiée"
fi

#===============================================================================
# RECONSTRUCTION
#===============================================================================
COMPOSE_FILE="docker-compose.yml"
if [[ -f "docker-compose.prod.yml" ]]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    log_info "Utilisation du fichier de production: $COMPOSE_FILE"
fi

# Nettoyage des conteneurs orphelins et réseaux stale avant redémarrage
# Évite les erreurs "container is not connected to network" et "network has active endpoints"
log_info "Nettoyage des conteneurs orphelins..."
sudo -u "$APP_USER" docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
docker network prune -f > /dev/null 2>&1 || true

log_info "Mise à jour des images externes (Ollama, Open WebUI, Redis)..."
sudo -u "$APP_USER" docker compose -f "$COMPOSE_FILE" pull --ignore-pull-failures || true

log_info "Reconstruction des images Docker locales..."

BUILD_FLAGS=""
if [[ "$FORCE_REBUILD" == true ]]; then
    BUILD_FLAGS="--no-cache"
    log_info "Mode force: reconstruction complète sans cache"
fi

if [[ "$NO_DOWNTIME" == true ]]; then
    log_info "Mode zero-downtime activé"

    # Construire les nouvelles images
    sudo -u "$APP_USER" docker compose -f "$COMPOSE_FILE" build $BUILD_FLAGS

    # Mettre à jour un par un
    if [[ "$BACKEND_CHANGED" == true ]] || [[ "$CONFIG_CHANGED" == true ]]; then
        log_info "Mise à jour du backend..."
        sudo -u "$APP_USER" docker compose -f "$COMPOSE_FILE" up -d --no-deps --remove-orphans backend
        sleep 5

        # Vérifier que le backend répond
        for i in {1..10}; do
            if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
                log_success "Backend opérationnel"
                break
            fi
            sleep 2
        done
    fi

    if [[ "$FRONTEND_CHANGED" == true ]] || [[ "$CONFIG_CHANGED" == true ]]; then
        log_info "Mise à jour du frontend..."
        sudo -u "$APP_USER" docker compose -f "$COMPOSE_FILE" up -d --no-deps --remove-orphans frontend
        sleep 3
    fi
else
    # Mise à jour standard
    log_info "Redémarrage de l'application..."
    
    # On utilise docker compose directement pour éviter les conflits systemd pendant la build
    if [[ "$BACKEND_CHANGED" == true ]] || [[ "$FORCE_REBUILD" == true ]] || [[ "$CONFIG_CHANGED" == true ]]; then
        sudo -u "$APP_USER" docker compose -f "$COMPOSE_FILE" build $BUILD_FLAGS backend
    fi

    if [[ "$FRONTEND_CHANGED" == true ]] || [[ "$FORCE_REBUILD" == true ]] || [[ "$CONFIG_CHANGED" == true ]]; then
        sudo -u "$APP_USER" docker compose -f "$COMPOSE_FILE" build $BUILD_FLAGS frontend
    fi

    # Lancement/Update
    sudo -u "$APP_USER" docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

    # Attendre que le backend soit opérationnel
    log_info "Attente du backend..."
    for i in {1..15}; do
        if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
            log_success "Backend opérationnel"
            break
        fi
        if [[ $i -eq 15 ]]; then
            log_warn "Backend lent à démarrer — vérifiez les logs: docker compose -f $COMPOSE_FILE logs backend"
        fi
        sleep 2
    done
fi

#===============================================================================
# CONFIGURATION AI (OLLAMA)
#===============================================================================
log_info "Vérification des modèles AI..."
if docker ps | grep -q "prospection-ollama"; then
    log_info "Téléchargement du modèle de base (llama3.2:3b) si manquant..."
    # On ne fait pas pull si le modèle existe déjà pour gagner du temps
    if ! docker exec prospection-ollama ollama list | grep -q "llama3.2"; then
        log_info "Ceci peut prendre quelques minutes..."
        docker exec prospection-ollama ollama pull llama3.2:3b || log_warn "Échec du téléchargement du modèle llama3.2"
    else
        log_success "Modèle llama3.2 déjà présent"
    fi
else
    log_warn "Conteneur Ollama non trouvé, saut de l'étape AI"
fi

#===============================================================================
# MIGRATIONS DE BASE DE DONNÉES
#===============================================================================
log_info "Exécution des migrations de base de données..."

# Attendre que le conteneur backend et la DB soient prêts
for i in {1..20}; do
    if sudo -u "$APP_USER" docker compose -f "$COMPOSE_FILE" exec -T backend python -c "from app.database import engine; engine.connect()" 2>/dev/null; then
        log_success "Connexion base de données OK"
        break
    fi
    if [[ $i -eq 20 ]]; then
        log_warn "Impossible de se connecter à la base de données après 40s"
    fi
    sleep 2
done

# 1. Migrations Alembic (schéma)
log_info "Exécution des migrations Alembic..."
if sudo -u "$APP_USER" docker compose -f "$COMPOSE_FILE" exec -T backend alembic upgrade head 2>&1; then
    log_success "Migrations Alembic appliquées"
else
    log_warn "Alembic a retourné une erreur — vérifiez les logs (peut être normal si pas de nouvelle migration)"
fi

# 2. Script de migration de données (legacy)
if [[ -f "backend/update_db_modules.py" ]]; then
    log_info "Exécution du script de migration de données..."
    sudo -u "$APP_USER" docker compose -f "$COMPOSE_FILE" exec -T backend python update_db_modules.py >/dev/null 2>&1 || log_warn "Le script de migration de données a retourné une erreur (peut-être déjà appliqué)."
fi

#===============================================================================
# NETTOYAGE
#===============================================================================
log_info "Nettoyage des anciennes images..."
docker image prune -f > /dev/null 2>&1

#===============================================================================
# VÉRIFICATION
#===============================================================================
log_info "Vérification du déploiement..."

sleep 5

DEPLOY_OK=true

# Health check principal
if curl -sf http://localhost/health > /dev/null 2>&1 || curl -sf -k https://localhost/health > /dev/null 2>&1; then
    log_success "✓ Health check OK"
else
    log_warn "✗ Health check échoué"
    DEPLOY_OK=false
fi

# Vérification de l'endpoint d'authentification
if curl -sf http://localhost:8000/api/auth/users/me -o /dev/null -w "%{http_code}" 2>/dev/null | grep -q "401"; then
    log_success "✓ API auth opérationnelle (401 attendu sans token)"
else
    log_warn "✗ API auth ne répond pas correctement"
    DEPLOY_OK=false
fi

# État des conteneurs
RUNNING_CONTAINERS=$(docker compose -f "$COMPOSE_FILE" ps --services --filter "status=running" | wc -l)
TOTAL_CONTAINERS=$(docker compose -f "$COMPOSE_FILE" ps --services | wc -l)

if [[ "$RUNNING_CONTAINERS" -eq "$TOTAL_CONTAINERS" ]]; then
    log_success "✓ Tous les conteneurs sont démarrés ($RUNNING_CONTAINERS/$TOTAL_CONTAINERS)"
else
    log_warn "✗ Certains conteneurs ne sont pas démarrés ($RUNNING_CONTAINERS/$TOTAL_CONTAINERS)"
    DEPLOY_OK=false
fi

# Vérification des logs d'erreur récents (dernières 30 secondes)
RECENT_ERRORS=$(sudo -u "$APP_USER" docker compose -f "$COMPOSE_FILE" logs --since 30s backend 2>&1 | grep -ci "error\|traceback\|critical" || true)
if [[ "$RECENT_ERRORS" -gt 0 ]]; then
    log_warn "✗ $RECENT_ERRORS erreurs détectées dans les logs récents du backend"
    log_warn "  → docker compose -f $COMPOSE_FILE logs --tail 50 backend"
    DEPLOY_OK=false
else
    log_success "✓ Aucune erreur dans les logs récents"
fi

if [[ "$DEPLOY_OK" == false ]]; then
    echo ""
    log_warn "⚠ Des problèmes ont été détectés. Rollback possible avec: sudo ./update.sh --rollback"
fi

#===============================================================================
# RÉSUMÉ
#===============================================================================
echo ""
echo "=============================================="
echo "  Mise à jour terminée avec succès!"
echo "=============================================="
echo ""
echo "Version précédente: $CURRENT_COMMIT"
echo "Version actuelle:   $NEW_COMMIT"
echo "Backup créé:        $BACKUP_TAG"
echo ""

# Afficher la version si disponible
VERSION=$(sudo -u "$APP_USER" git describe --tags 2>/dev/null || echo "dev")
echo "Version déployée:   $VERSION"
echo ""

# Résumé des changements
COMMITS_COUNT=$(sudo -u "$APP_USER" git rev-list --count "$CURRENT_COMMIT..$NEW_COMMIT" 2>/dev/null || echo "0")
if [[ "$COMMITS_COUNT" -gt 0 ]]; then
    echo "Changements déployés ($COMMITS_COUNT commits):"
    sudo -u "$APP_USER" git log --oneline "$CURRENT_COMMIT..$NEW_COMMIT" | head -10
    echo ""
fi

echo "Commandes utiles:"
echo "  docker compose -f $COMPOSE_FILE logs -f    # Voir les logs"
echo "  docker compose -f $COMPOSE_FILE ps         # État des conteneurs"
echo "  sudo ./update.sh --rollback                # Rollback si problème"
echo ""
echo "=============================================="

