# Makefile - Prospection Fonciere
# Commandes utilitaires pour le developpement

.PHONY: help install start stop backend frontend clean test lint build

# Couleurs
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m

help: ## Affiche cette aide
	@echo ""
	@echo "$(BLUE)Prospection Fonciere - Commandes disponibles$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

install: ## Installation complete (backend + frontend)
	@echo "$(BLUE)Installation du projet...$(NC)"
	@./install.sh

start: ## Demarre l'application complete
	@./start.sh

backend: ## Demarre uniquement le backend
	@./start-backend.sh

frontend: ## Demarre uniquement le frontend
	@./start-frontend.sh

stop: ## Arrete tous les processus
	@echo "$(YELLOW)Arret des processus...$(NC)"
	@pkill -f "uvicorn app.main:app" 2>/dev/null || true
	@pkill -f "vite" 2>/dev/null || true
	@echo "$(GREEN)Processus arretes$(NC)"

clean: ## Nettoie les fichiers temporaires
	@echo "$(YELLOW)Nettoyage...$(NC)"
	@rm -rf backend/venv
	@rm -rf backend/__pycache__
	@rm -rf backend/app/__pycache__
	@rm -rf frontend/node_modules
	@rm -rf frontend/dist
	@echo "$(GREEN)Nettoyage termine$(NC)"

reinstall: clean install ## Reinstallation complete

backend-dev: ## Backend en mode developpement avec rechargement
	@cd backend && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend-dev: ## Frontend en mode developpement
	@cd frontend && npm run dev

build: ## Build de production du frontend
	@echo "$(BLUE)Build de production...$(NC)"
	@cd frontend && npm run build
	@echo "$(GREEN)Build termine dans frontend/dist$(NC)"

lint: ## Verification du code
	@echo "$(BLUE)Verification du code...$(NC)"
	@cd frontend && npm run lint || true
	@echo "$(GREEN)Verification terminee$(NC)"

test-api: ## Test des endpoints API
	@echo "$(BLUE)Test des endpoints API...$(NC)"
	@echo "GET /"
	@curl -s http://localhost:8000/ | head -c 200
	@echo ""
	@echo ""
	@echo "GET /api/address/search?q=Paris"
	@curl -s "http://localhost:8000/api/address/search?q=Paris" | head -c 300
	@echo ""
	@echo ""
	@echo "$(GREEN)Tests termines$(NC)"

logs-backend: ## Affiche les logs du backend
	@tail -f backend/logs/*.log 2>/dev/null || echo "Pas de fichier de log"

update-deps: ## Met a jour les dependances
	@echo "$(BLUE)Mise a jour des dependances...$(NC)"
	@cd backend && source venv/bin/activate && pip install --upgrade -r requirements.txt
	@cd frontend && npm update
	@echo "$(GREEN)Mise a jour terminee$(NC)"

docker-build: ## Build l'image Docker (si Dockerfile present)
	@docker build -t prospection-fonciere .

docker-run: ## Lance le conteneur Docker
	@docker run -p 8000:8000 -p 5173:5173 prospection-fonciere
