#!/bin/bash
#===============================================================================
# Script d'Installation de Production - Prospection Foncière
# Usage: sudo ./install-prod.sh
#===============================================================================

set -euo pipefail

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Variables
INSTALL_DIR="/opt/prospection"
APP_USER="prospection"
DOMAIN_APP="prospection.mdoservices.fr"
DOMAIN_WEBUI="brain.mdoservices.fr"
EMAIL="mathieu@mdoservices.fr"

#===============================================================================
# VÉRIFICATION INITIALE
#===============================================================================
if [[ $EUID -ne 0 ]]; then
    log_error "Ce script doit être exécuté en tant que root (sudo ./install-prod.sh)"
fi

log_info "Début de l'installation de production..."

#===============================================================================
# DÉPENDANCES SYSTÈME
#===============================================================================
log_info "Installation des dépendances logicielles..."
apt-get update
apt-get install -y git curl docker.io docker-compose-v2 certbot python3-certbot-nginx

# Configuration Docker
systemctl enable --now docker
log_success "Docker et Certbot installés et activés"

#===============================================================================
# UTILISATEUR ET RÉPERTOIRE
#===============================================================================
log_info "Configuration de l'utilisateur système..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$APP_USER"
    usermod -aG docker "$APP_USER"
    log_success "Utilisateur $APP_USER créé"
fi

mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/ssl"
mkdir -p "$INSTALL_DIR/data"
chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"
log_success "Répertoires configurés"

#===============================================================================
# CONFIGURATION SSL
#===============================================================================
log_info "Configuration SSL via Certbot..."

# On demande confirmation des domaines
read -p "Domaine principal ($DOMAIN_APP) ? " input_domain
DOMAIN_APP=${input_domain:-$DOMAIN_APP}

read -p "Domaine Secondary Brain ($DOMAIN_WEBUI) ? " input_webui
DOMAIN_WEBUI=${input_webui:-$DOMAIN_WEBUI}

read -p "Email pour Certbot ($EMAIL) ? " input_email
EMAIL=${input_email:-$EMAIL}

log_info "Obtention du certificat pour $DOMAIN_APP et $DOMAIN_WEBUI..."
certbot certonly --standalone \
    -d "$DOMAIN_APP" \
    -d "$DOMAIN_WEBUI" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive || log_warn "Certbot a échoué. Vérifiez que les ports 80/443 sont libres et que le DNS pointe sur cette IP."

# Lien symbolique ou copie pour Nginx
cp "/etc/letsencrypt/live/$DOMAIN_APP/fullchain.pem" "$INSTALL_DIR/ssl/fullchain.pem" 2>/dev/null || log_warn "Échec copie fullchain"
cp "/etc/letsencrypt/live/$DOMAIN_APP/privkey.pem" "$INSTALL_DIR/ssl/privkey.pem" 2>/dev/null || log_warn "Échec copie privkey"
chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR/ssl"

#===============================================================================
# CONFIGURATION SERVICE SYSTEMD
#===============================================================================
log_info "Configuration du service Systemd..."
cat > /etc/systemd/system/prospection.service << EOF
[Unit]
Description=Prospection Fonciere Application
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d --build
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
ExecReload=/usr/bin/docker compose -f docker-compose.prod.yml restart
TimeoutStartSec=600

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable prospection.service
log_success "Service systemd configuré"

#===============================================================================
# PREMIER DÉMARRAGE
#===============================================================================
log_info "Premier déploiement via update.sh..."
chmod +x "$INSTALL_DIR/update.sh"
cd "$INSTALL_DIR"
./update.sh --force

log_success "Installation de production terminée avec succès !"
echo "--------------------------------------------------------"
echo "Applications accessibles sur :"
echo "- Portail : https://$DOMAIN_APP"
echo "- Brain :   https://$DOMAIN_WEBUI"
echo "--------------------------------------------------------"
