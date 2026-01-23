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

# Vérifier s'il y a des changements
if [[ "$CURRENT_COMMIT" == "$NEW_COMMIT" ]] && [[ "$FORCE_REBUILD" == false ]]; then
    log_warn "Aucun changement détecté. Utilisez --force pour reconstruire quand même."
    echo ""
    echo "Version actuelle: $(sudo -u "$APP_USER" git describe --tags 2>/dev/null || echo $NEW_COMMIT)"
    exit 0
fi

#===============================================================================
# DÉTECTION DES CHANGEMENTS
#===============================================================================
log_info "Analyse des changements..."

CHANGED_FILES=$(git diff --name-only "$CURRENT_COMMIT" "$NEW_COMMIT" || echo "")

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
log_info "Reconstruction des images Docker..."

BUILD_FLAGS=""
if [[ "$FORCE_REBUILD" == true ]]; then
    BUILD_FLAGS="--no-cache"
    log_info "Mode force: reconstruction complète sans cache"
fi

if [[ "$NO_DOWNTIME" == true ]]; then
    log_info "Mode zero-downtime activé"

    # Construire les nouvelles images
    sudo -u "$APP_USER" docker compose build $BUILD_FLAGS

    # Mettre à jour un par un
    if [[ "$BACKEND_CHANGED" == true ]] || [[ "$CONFIG_CHANGED" == true ]]; then
        log_info "Mise à jour du backend..."
        sudo -u "$APP_USER" docker compose up -d --no-deps backend
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
        sudo -u "$APP_USER" docker compose up -d --no-deps frontend
        sleep 3
    fi
else
    # Mise à jour standard avec arrêt
    log_info "Arrêt de l'application..."
    systemctl stop prospection

    # Construire
    if [[ "$BACKEND_CHANGED" == true ]] || [[ "$FORCE_REBUILD" == true ]] || [[ "$CONFIG_CHANGED" == true ]]; then
        sudo -u "$APP_USER" docker compose build $BUILD_FLAGS backend
    fi

    if [[ "$FRONTEND_CHANGED" == true ]] || [[ "$FORCE_REBUILD" == true ]] || [[ "$CONFIG_CHANGED" == true ]]; then
        sudo -u "$APP_USER" docker compose build $BUILD_FLAGS frontend
    fi

    # Redémarrer
    log_info "Redémarrage de l'application..."
    systemctl start prospection
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

# Health check
if curl -sf http://localhost/health > /dev/null 2>&1; then
    log_success "✓ Health check OK"
else
    log_warn "Health check échoué - vérifiez les logs"
    docker compose logs --tail=50
fi

# État des conteneurs
RUNNING_CONTAINERS=$(docker compose ps --services --filter "status=running" | wc -l)
TOTAL_CONTAINERS=$(docker compose ps --services | wc -l)

if [[ "$RUNNING_CONTAINERS" -eq "$TOTAL_CONTAINERS" ]]; then
    log_success "✓ Tous les conteneurs sont démarrés ($RUNNING_CONTAINERS/$TOTAL_CONTAINERS)"
else
    log_warn "Certains conteneurs ne sont pas démarrés ($RUNNING_CONTAINERS/$TOTAL_CONTAINERS)"
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
COMMITS_COUNT=$(git rev-list --count "$CURRENT_COMMIT..$NEW_COMMIT" 2>/dev/null || echo "0")
if [[ "$COMMITS_COUNT" -gt 0 ]]; then
    echo "Changements déployés ($COMMITS_COUNT commits):"
    git log --oneline "$CURRENT_COMMIT..$NEW_COMMIT" | head -10
    echo ""
fi

echo "Commandes utiles:"
echo "  docker compose logs -f              # Voir les logs"
echo "  docker compose ps                   # État des conteneurs"
echo "  curl http://localhost/health        # Health check"
echo "  sudo ./update.sh --rollback         # Rollback si problème"
echo ""
echo "=============================================="
