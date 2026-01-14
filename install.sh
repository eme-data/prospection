#!/bin/bash
#
# Script d'installation automatique - Prospection Fonciere
# Compatible: Ubuntu/Debian, Fedora/RHEL, Arch Linux
#

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Repertoire du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          PROSPECTION FONCIERE - Installation                 ║"
echo "║          Application de prospection fonciere                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Fonction pour afficher les messages
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERREUR]${NC} $1"
}

# Detection du gestionnaire de paquets
detect_package_manager() {
    if command -v apt-get &> /dev/null; then
        PKG_MANAGER="apt"
        PKG_INSTALL="sudo apt-get install -y"
        PKG_UPDATE="sudo apt-get update"
    elif command -v dnf &> /dev/null; then
        PKG_MANAGER="dnf"
        PKG_INSTALL="sudo dnf install -y"
        PKG_UPDATE="sudo dnf check-update || true"
    elif command -v yum &> /dev/null; then
        PKG_MANAGER="yum"
        PKG_INSTALL="sudo yum install -y"
        PKG_UPDATE="sudo yum check-update || true"
    elif command -v pacman &> /dev/null; then
        PKG_MANAGER="pacman"
        PKG_INSTALL="sudo pacman -S --noconfirm"
        PKG_UPDATE="sudo pacman -Sy"
    else
        log_error "Gestionnaire de paquets non supporte"
        exit 1
    fi
    log_info "Gestionnaire de paquets detecte: $PKG_MANAGER"
}

# Verification de Python
check_python() {
    log_info "Verification de Python..."

    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
        PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
        PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)

        if [ "$PYTHON_MAJOR" -ge 3 ] && [ "$PYTHON_MINOR" -ge 10 ]; then
            log_success "Python $PYTHON_VERSION installe"
            return 0
        else
            log_warning "Python $PYTHON_VERSION trouve, version 3.10+ requise"
        fi
    fi

    return 1
}

# Installation de Python
install_python() {
    log_info "Installation de Python 3..."

    case $PKG_MANAGER in
        apt)
            $PKG_UPDATE
            $PKG_INSTALL python3 python3-pip python3-venv
            ;;
        dnf|yum)
            $PKG_INSTALL python3 python3-pip python3-virtualenv
            ;;
        pacman)
            $PKG_INSTALL python python-pip python-virtualenv
            ;;
    esac

    log_success "Python installe"
}

# Verification de Node.js
check_nodejs() {
    log_info "Verification de Node.js..."

    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | sed 's/v//')
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)

        if [ "$NODE_MAJOR" -ge 18 ]; then
            log_success "Node.js $NODE_VERSION installe"
            return 0
        else
            log_warning "Node.js $NODE_VERSION trouve, version 18+ requise"
        fi
    fi

    return 1
}

# Installation de Node.js
install_nodejs() {
    log_info "Installation de Node.js 20 LTS..."

    case $PKG_MANAGER in
        apt)
            # Installation via NodeSource
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            $PKG_INSTALL nodejs
            ;;
        dnf|yum)
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            $PKG_INSTALL nodejs
            ;;
        pacman)
            $PKG_INSTALL nodejs npm
            ;;
    esac

    log_success "Node.js installe"
}

# Installation du backend
install_backend() {
    log_info "Installation du backend Python..."

    cd "$SCRIPT_DIR/backend"

    # Creation de l'environnement virtuel
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        log_success "Environnement virtuel cree"
    fi

    # Activation et installation des dependances
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate

    log_success "Backend installe"
}

# Installation du frontend
install_frontend() {
    log_info "Installation du frontend React..."

    cd "$SCRIPT_DIR/frontend"

    # Installation des dependances npm
    npm install

    log_success "Frontend installe"
}

# Creation des scripts de lancement
create_launch_scripts() {
    log_info "Creation des scripts de lancement..."

    # Script de lancement du backend
    cat > "$SCRIPT_DIR/start-backend.sh" << 'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
echo "Demarrage du backend sur http://localhost:8000"
echo "Documentation API: http://localhost:8000/docs"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
EOF
    chmod +x "$SCRIPT_DIR/start-backend.sh"

    # Script de lancement du frontend
    cat > "$SCRIPT_DIR/start-frontend.sh" << 'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/frontend"
echo "Demarrage du frontend sur http://localhost:5173"
npm run dev
EOF
    chmod +x "$SCRIPT_DIR/start-frontend.sh"

    # Script de lancement complet
    cat > "$SCRIPT_DIR/start.sh" << 'EOF'
#!/bin/bash
#
# Lance l'application complete (backend + frontend)
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          PROSPECTION FONCIERE - Demarrage                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Fonction de nettoyage
cleanup() {
    echo ""
    echo "Arret de l'application..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Demarrage du backend en arriere-plan
echo "[1/2] Demarrage du backend..."
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
sleep 2

# Verification que le backend a demarre
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "Erreur: Le backend n'a pas demarre"
    exit 1
fi
echo "Backend demarre (PID: $BACKEND_PID)"

# Demarrage du frontend
echo "[2/2] Demarrage du frontend..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
sleep 3

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Application demarree avec succes!                           ║"
echo "║                                                              ║"
echo "║  Frontend:  http://localhost:5173                            ║"
echo "║  Backend:   http://localhost:8000                            ║"
echo "║  API Docs:  http://localhost:8000/docs                       ║"
echo "║                                                              ║"
echo "║  Appuyez sur Ctrl+C pour arreter                             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Attente
wait
EOF
    chmod +x "$SCRIPT_DIR/start.sh"

    log_success "Scripts de lancement crees"
}

# Creation du fichier .env exemple
create_env_file() {
    if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
        cat > "$SCRIPT_DIR/backend/.env" << 'EOF'
# Configuration de l'API Prospection Fonciere
# Copiez ce fichier en .env et modifiez les valeurs si necessaire

# Port du serveur (defaut: 8000)
PORT=8000

# Mode debug (defaut: true en developpement)
DEBUG=true

# URL du frontend pour CORS
FRONTEND_URL=http://localhost:5173
EOF
        log_success "Fichier .env cree"
    fi
}

# Fonction principale
main() {
    detect_package_manager

    echo ""
    log_info "Verification des prerequis..."
    echo ""

    # Verification/Installation Python
    if ! check_python; then
        read -p "Installer Python 3? (o/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Oo]$ ]]; then
            install_python
        else
            log_error "Python 3.10+ est requis"
            exit 1
        fi
    fi

    # Verification/Installation Node.js
    if ! check_nodejs; then
        read -p "Installer Node.js 20? (o/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Oo]$ ]]; then
            install_nodejs
        else
            log_error "Node.js 18+ est requis"
            exit 1
        fi
    fi

    echo ""
    log_info "Installation des composants..."
    echo ""

    # Installation backend
    install_backend

    # Installation frontend
    install_frontend

    # Creation des scripts
    create_launch_scripts
    create_env_file

    echo ""
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║          Installation terminee avec succes!                  ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "Pour demarrer l'application:"
    echo ""
    echo "  Option 1 - Lancement complet:"
    echo "    ./start.sh"
    echo ""
    echo "  Option 2 - Lancement separe (2 terminaux):"
    echo "    Terminal 1: ./start-backend.sh"
    echo "    Terminal 2: ./start-frontend.sh"
    echo ""
    echo "L'application sera accessible sur: http://localhost:5173"
    echo "Documentation API: http://localhost:8000/docs"
    echo ""

    # Proposition de lancer l'application
    read -p "Lancer l'application maintenant? (o/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Oo]$ ]]; then
        exec "$SCRIPT_DIR/start.sh"
    fi
}

# Execution
main "$@"
