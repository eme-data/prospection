#!/bin/bash
#===============================================================================
# Script de deploiement - Prospection Fonciere
# Usage: sudo ./deploy.sh [OPTIONS]
#
# Options:
#   --domain DOMAIN     Nom de domaine (ex: prospection.example.com)
#   --email EMAIL       Email pour Let's Encrypt SSL
#   --with-ssl          Activer HTTPS avec Let's Encrypt
#   --dev               Mode developpement (sans SSL, ports exposes)
#===============================================================================

set -euo pipefail

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables par defaut
DOMAIN=""
EMAIL=""
WITH_SSL=false
DEV_MODE=false
INSTALL_DIR="/opt/prospection"
APP_USER="prospection"

# Fonctions utilitaires
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Parse des arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --email)
            EMAIL="$2"
            shift 2
            ;;
        --with-ssl)
            WITH_SSL=true
            shift
            ;;
        --dev)
            DEV_MODE=true
            shift
            ;;
        -h|--help)
            echo "Usage: sudo ./deploy.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --domain DOMAIN     Nom de domaine (requis pour SSL)"
            echo "  --email EMAIL       Email pour Let's Encrypt"
            echo "  --with-ssl          Activer HTTPS avec Let's Encrypt"
            echo "  --dev               Mode developpement"
            echo "  -h, --help          Afficher cette aide"
            exit 0
            ;;
        *)
            log_error "Option inconnue: $1"
            ;;
    esac
done

# Verification des privileges root
if [[ $EUID -ne 0 ]]; then
    log_error "Ce script doit etre execute en tant que root (sudo ./deploy.sh)"
fi

# Verification SSL
if [[ "$WITH_SSL" == true ]]; then
    if [[ -z "$DOMAIN" ]]; then
        log_error "Le domaine est requis pour SSL (--domain)"
    fi
    if [[ -z "$EMAIL" ]]; then
        log_error "L'email est requis pour Let's Encrypt (--email)"
    fi
fi

echo ""
echo "=============================================="
echo "  Deploiement Prospection Fonciere"
echo "=============================================="
echo ""

#===============================================================================
# 1. Detection du systeme et installation des dependances
#===============================================================================
log_info "Detection du systeme..."

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    log_error "Impossible de detecter le systeme d'exploitation"
fi

log_success "Systeme detecte: $OS $VERSION"

log_info "Installation des dependances systeme..."

case $OS in
    ubuntu|debian)
        apt-get update -qq
        apt-get install -y -qq curl git ca-certificates gnupg lsb-release
        ;;
    centos|rhel|fedora|rocky|almalinux)
        if command -v dnf &> /dev/null; then
            dnf install -y -q curl git ca-certificates
        else
            yum install -y -q curl git ca-certificates
        fi
        ;;
    arch|manjaro)
        pacman -Sy --noconfirm --quiet curl git ca-certificates
        ;;
    *)
        log_warn "Systeme non reconnu, tentative d'installation manuelle..."
        ;;
esac

log_success "Dependances systeme installees"

#===============================================================================
# 2. Installation de Docker
#===============================================================================
log_info "Verification de Docker..."

if ! command -v docker &> /dev/null; then
    log_info "Installation de Docker..."

    case $OS in
        ubuntu|debian)
            # Ajout du repo Docker officiel
            install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            chmod a+r /etc/apt/keyrings/docker.gpg

            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

            apt-get update -qq
            apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        centos|rhel|rocky|almalinux)
            dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo || yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            dnf install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin || yum install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        fedora)
            dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
            dnf install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        arch|manjaro)
            pacman -S --noconfirm docker docker-compose
            ;;
        *)
            log_warn "Installation Docker manuelle requise"
            curl -fsSL https://get.docker.com | sh
            ;;
    esac

    # Demarrage et activation de Docker
    systemctl start docker
    systemctl enable docker

    log_success "Docker installe"
else
    log_success "Docker deja installe: $(docker --version)"
fi

# Verification de docker compose
if ! docker compose version &> /dev/null; then
    if ! command -v docker-compose &> /dev/null; then
        log_info "Installation de Docker Compose..."
        curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
fi

log_success "Docker Compose disponible"

#===============================================================================
# 3. Creation de l'utilisateur applicatif
#===============================================================================
log_info "Configuration de l'utilisateur applicatif..."

if ! id "$APP_USER" &>/dev/null; then
    useradd --system --shell /bin/bash --home-dir "$INSTALL_DIR" --create-home "$APP_USER"
    usermod -aG docker "$APP_USER"
    log_success "Utilisateur '$APP_USER' cree"
else
    log_success "Utilisateur '$APP_USER' existe deja"
fi

#===============================================================================
# 4. Clonage/Mise a jour du code
#===============================================================================
log_info "Installation de l'application dans $INSTALL_DIR..."

if [ -d "$INSTALL_DIR/.git" ]; then
    log_info "Mise a jour du code existant..."
    cd "$INSTALL_DIR"
    # Fix git safe.directory issue
    git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true
    sudo -u "$APP_USER" git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true
    git fetch origin 2>/dev/null || true
    git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || log_warn "Git pull echoue - utilisation du code local"
else
    if [ -d "$INSTALL_DIR" ] && [ "$(ls -A $INSTALL_DIR 2>/dev/null)" ]; then
        log_info "Copie du code source local..."
        # Le code est deja present (copie manuelle)
    else
        log_warn "Repertoire vide. Copiez le code source dans $INSTALL_DIR"
        mkdir -p "$INSTALL_DIR"
    fi
fi

chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"
cd "$INSTALL_DIR"

log_success "Code installe"

#===============================================================================
# 5. Configuration de l'environnement
#===============================================================================
log_info "Configuration de l'environnement..."

# Fichier .env pour le backend
if [ ! -f "$INSTALL_DIR/backend/.env" ]; then
    cat > "$INSTALL_DIR/backend/.env" << EOF
# Configuration Production
ENVIRONMENT=production
DEBUG=false

# CORS - Ajoutez votre domaine
CORS_ORIGINS=http://localhost,http://127.0.0.1${DOMAIN:+,https://$DOMAIN}

# Redis
REDIS_URL=redis://redis:6379/0

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60

# Cache
CACHE_ENABLED=true
CACHE_TTL=300

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json

# API
API_TIMEOUT=30.0
API_MAX_RETRIES=3
EOF
    chown "$APP_USER:$APP_USER" "$INSTALL_DIR/backend/.env"
    log_success "Fichier .env cree"
else
    log_success "Fichier .env existe deja"
fi

#===============================================================================
# 6. Configuration SSL avec Let's Encrypt (optionnel)
#===============================================================================
if [[ "$WITH_SSL" == true ]]; then
    log_info "Configuration SSL avec Let's Encrypt..."

    # Installation de Certbot
    case $OS in
        ubuntu|debian)
            apt-get install -y -qq certbot
            ;;
        centos|rhel|rocky|almalinux|fedora)
            dnf install -y -q certbot || yum install -y -q certbot
            ;;
        arch|manjaro)
            pacman -S --noconfirm certbot
            ;;
    esac

    # Creation du repertoire pour les certificats
    mkdir -p "$INSTALL_DIR/ssl"

    # Arret temporaire des conteneurs si existants
    cd "$INSTALL_DIR"
    docker compose down 2>/dev/null || true

    # Obtention du certificat
    certbot certonly --standalone --non-interactive --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN" \
        --cert-path "$INSTALL_DIR/ssl/cert.pem" \
        --key-path "$INSTALL_DIR/ssl/key.pem" \
        --fullchain-path "$INSTALL_DIR/ssl/fullchain.pem" \
        --chain-path "$INSTALL_DIR/ssl/chain.pem"

    # Copie des certificats
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem "$INSTALL_DIR/ssl/"
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem "$INSTALL_DIR/ssl/"
    chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR/ssl"

    # Configuration nginx avec SSL
    cat > "$INSTALL_DIR/nginx-ssl.conf" << 'NGINXEOF'
# Configuration Nginx avec SSL

limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=static_limit:10m rate=50r/s;

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # SSL Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_stapling on;
    ssl_stapling_verify on;

    root /usr/share/nginx/html;
    index index.html;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/geo+json;

    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /api {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location ~ ^/(health|ready|live|metrics) {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINXEOF

    sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$INSTALL_DIR/nginx-ssl.conf"
    chown "$APP_USER:$APP_USER" "$INSTALL_DIR/nginx-ssl.conf"

    # Mise a jour docker-compose pour SSL
    cat > "$INSTALL_DIR/docker-compose.prod.yml" << 'COMPOSEEOF'
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: prospection-redis
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped
    networks:
      - prospection-internal

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: prospection-backend
    env_file:
      - backend/.env
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    restart: unless-stopped
    networks:
      - prospection-internal
    expose:
      - "8000"

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: prospection-frontend
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - prospection-internal
    volumes:
      - ./nginx-ssl.conf:/etc/nginx/conf.d/default.conf:ro
      - ./ssl:/etc/nginx/ssl:ro

volumes:
  redis_data:

networks:
  prospection-internal:
    name: prospection-network
COMPOSEEOF

    chown "$APP_USER:$APP_USER" "$INSTALL_DIR/docker-compose.prod.yml"

    # Cron pour renouvellement SSL
    cat > /etc/cron.d/prospection-ssl-renew << EOF
0 3 * * * root certbot renew --quiet --post-hook "cp /etc/letsencrypt/live/$DOMAIN/*.pem $INSTALL_DIR/ssl/ && docker restart prospection-frontend"
EOF

    log_success "SSL configure avec Let's Encrypt"
fi

#===============================================================================
# 7. Creation du service systemd
#===============================================================================
log_info "Creation du service systemd..."

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
ExecStart=/usr/bin/docker compose -f ${WITH_SSL:+docker-compose.prod.yml}${WITH_SSL:-docker-compose.yml} up -d --build
ExecStop=/usr/bin/docker compose -f ${WITH_SSL:+docker-compose.prod.yml}${WITH_SSL:-docker-compose.yml} down
ExecReload=/usr/bin/docker compose -f ${WITH_SSL:+docker-compose.prod.yml}${WITH_SSL:-docker-compose.yml} restart
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable prospection.service

log_success "Service systemd cree"

#===============================================================================
# 8. Configuration du firewall
#===============================================================================
log_info "Configuration du firewall..."

if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 22/tcp
    log_success "Firewall UFW configure"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --permanent --add-service=ssh
    firewall-cmd --reload
    log_success "Firewall firewalld configure"
else
    log_warn "Aucun firewall detecte. Configurez manuellement les ports 80, 443"
fi

#===============================================================================
# 9. Demarrage de l'application
#===============================================================================
log_info "Construction et demarrage de l'application..."

cd "$INSTALL_DIR"

if [[ "$WITH_SSL" == true ]]; then
    sudo -u "$APP_USER" docker compose -f docker-compose.prod.yml build
    sudo -u "$APP_USER" docker compose -f docker-compose.prod.yml up -d
else
    sudo -u "$APP_USER" docker compose build
    sudo -u "$APP_USER" docker compose up -d
fi

log_success "Application demarree"

#===============================================================================
# 10. Verification
#===============================================================================
log_info "Verification du deploiement..."

sleep 10

if curl -sf http://localhost/health > /dev/null 2>&1; then
    log_success "Health check OK"
else
    log_warn "Health check echoue - l'application peut encore demarrer..."
fi

#===============================================================================
# Resume
#===============================================================================
echo ""
echo "=============================================="
echo "  Deploiement termine avec succes!"
echo "=============================================="
echo ""
echo "Application installee dans: $INSTALL_DIR"
echo "Utilisateur: $APP_USER"
echo ""

if [[ "$WITH_SSL" == true ]]; then
    echo "URL: https://$DOMAIN"
else
    echo "URL: http://$(hostname -I | awk '{print $1}')"
fi

echo ""
echo "Commandes utiles:"
echo "  systemctl status prospection    # Statut du service"
echo "  systemctl restart prospection   # Redemarrer"
echo "  systemctl stop prospection      # Arreter"
echo "  journalctl -u prospection -f    # Voir les logs"
echo ""
echo "  cd $INSTALL_DIR"
echo "  docker compose logs -f          # Logs des conteneurs"
echo "  docker compose ps               # Etat des conteneurs"
echo ""
echo "=============================================="
