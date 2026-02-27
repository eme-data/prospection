# Prospection Foncière

Application web multi-modules pour la prospection foncière, l'analyse immobilière et la gestion d'équipe, basée sur les données opendata françaises.

## Fonctionnalités

### Module Faisabilité (Prospection foncière)
- **Cartographie interactive** : MapLibre GL avec couches cadastrales, DVF, INSEE, risques
- **Recherche d'adresse** : Autocomplétion via la Base Adresse Nationale (BAN)
- **Transactions DVF** : Visualisation et filtrage des ventes immobilières
- **Score d'opportunité (0–100)** : Calcul automatique basé sur prix, surface, localisation, marché, PLU
- **Workflow de prospection** : Suivi du statut par parcelle (à prospecter → acquis)
- **Fiches terrain** : Documentation enrichie avec photos, documents, notes
- **Isochrones** : Accessibilité temporelle par transport
- **Couches INSEE** : Données démographiques et économiques
- **Risques naturels/technologiques** : Géorisques, zones inondables
- **Zonage PLU** : Zones urbaines, agricoles, naturelles
- **Génération de rapports PDF**
- **Export CSV / GeoJSON**

### Module Commerce / CRM
- Gestion clients (prospects, clients, partenaires)
- Catalogue : matériaux, services, articles composés
- Calcul automatique des prix avec marges et coefficients
- Devis et compositions

### Module Congés
- Gestion des demandes de congés
- Suivi des soldes et validation manager

### Module Communication
- Publication sur réseaux sociaux
- Intégration IA (Groq, Google Generative AI)
- Gestion des comptes sociaux

## Architecture

```
prospection/
├── backend/                    # API FastAPI (Python 3.11)
│   ├── app/
│   │   ├── main.py             # Point d'entrée (middlewares + routers)
│   │   ├── config.py           # Configuration centralisée (.env)
│   │   ├── auth.py             # JWT + bcrypt
│   │   ├── database.py         # SQLAlchemy + SQLite
│   │   ├── security.py         # Rate limiting, headers sécurité
│   │   ├── cache.py            # Redis cache
│   │   ├── models/             # Modèles ORM (User, Commerce, Congés…)
│   │   ├── routers/            # 23 routers spécialisés
│   │   ├── scoring.py          # Algorithme de score parcellaire
│   │   ├── report_generator.py # Génération PDF (ReportLab)
│   │   └── …
│   ├── requirements.txt
│   └── tests/
│
├── frontend/                   # Application React 18 + TypeScript
│   └── src/
│       ├── components/         # 30+ composants
│       ├── auth/               # Composants d'authentification
│       ├── apps/               # Vues par module
│       ├── contexts/           # AuthContext, ThemeContext
│       ├── hooks/              # Hooks personnalisés
│       ├── api/                # Client API avec auth
│       └── types/              # Types TypeScript
│
├── docker-compose.yml          # Stack complète (Redis + Backend + Frontend)
├── Dockerfile.backend          # Build multi-stage Python
├── Dockerfile.frontend         # Build multi-stage React + Nginx
├── nginx.conf                  # Reverse proxy
└── Makefile                    # Commandes de développement
```

## Sources de données

| Source | Description | API |
|--------|-------------|-----|
| Base Adresse Nationale | Géocodage et recherche | api-adresse.data.gouv.fr |
| Cadastre Étalab | Parcelles cadastrales | cadastre.data.gouv.fr |
| DVF | Transactions immobilières | api.cquest.org/dvf |
| API Géo | Communes et territoires | geo.api.gouv.fr |
| Géorisques | Risques naturels et technologiques | georisques.gouv.fr |
| GPU/IGN | Zonages PLU/PLUi | apicarto.ign.fr |
| INSEE | Données démographiques | (via enrichissement) |

## Technologies

### Backend
| Composant | Technologie |
|-----------|-------------|
| Framework | FastAPI 0.109 |
| Serveur | Uvicorn + Gunicorn |
| Base de données | SQLite via SQLAlchemy 2.0 |
| Authentification | JWT (python-jose) + bcrypt |
| Cache | Redis 7 |
| PDF | ReportLab |
| IA | Groq, Google Generative AI |
| Tests | pytest + pytest-asyncio |

### Frontend
| Composant | Technologie |
|-----------|-------------|
| Framework | React 18 + TypeScript 5.3 |
| Build | Vite 5 |
| Cartographie | MapLibre GL 4 + react-map-gl |
| UI | Tailwind CSS 3 |
| Requêtes | TanStack Query 5 |
| Graphiques | Recharts |
| Icônes | Lucide React |

## Installation

### Prérequis
- Python 3.11+
- Node.js 20+
- Redis (optionnel, le cache est désactivable)
- Docker + Docker Compose (recommandé pour la production)

### Développement local

**1. Backend**
```bash
cd prospection/backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

pip install -r requirements.txt

# Copier et configurer l'environnement
cp .env.example .env
# Éditer .env avec vos valeurs (SECRET_KEY, etc.)

uvicorn app.main:app --reload --port 8000
```

**2. Frontend**
```bash
cd prospection/frontend
npm install
npm run dev
```

L'application est accessible sur http://localhost:5173
L'API est accessible sur http://localhost:8000
La documentation API (mode debug) : http://localhost:8000/docs

**3. Créer le premier compte administrateur**
```bash
cd prospection/backend
python create_admin.py
```

### Production avec Docker

```bash
cd prospection

# Copier et configurer l'environnement
cp backend/.env.example backend/.env
# Éditer backend/.env

# Lancer la stack complète
docker-compose up -d

# Vérifier les logs
docker-compose logs -f
```

La stack expose :
- Port **80** : Application web (HTTP)
- Port **443** : Application web (HTTPS, avec nginx-ssl.conf)

### Commandes Makefile

```bash
make install         # Installation complète
make backend-dev     # Backend en mode développement (hot-reload)
make frontend-dev    # Frontend Vite dev server
make build           # Build de production
make docker-build    # Build des images Docker
make docker-run      # Lancer avec Docker
make test-api        # Tester les endpoints API
make lint            # Vérification du code
make clean           # Nettoyer les fichiers temporaires
```

## Configuration

Copiez `backend/.env.example` en `backend/.env` et renseignez les variables :

| Variable | Description | Défaut |
|----------|-------------|--------|
| `SECRET_KEY` | Clé secrète JWT **(obligatoire en production)** | — |
| `ENVIRONMENT` | `development` / `production` | `production` |
| `DEBUG` | Activer la doc API (`/docs`) | `false` |
| `DATABASE_URL` | URL SQLite | `sqlite:////data/prospection.db` |
| `REDIS_URL` | URL Redis (optionnel) | `None` |
| `CORS_ORIGINS` | Origines CORS autorisées | `http://localhost:5173` |
| `MSAL_CLIENT_ID` | Azure AD Client ID (auth Microsoft) | — |
| `MSAL_TENANT_ID` | Azure AD Tenant ID (auth Microsoft) | — |
| `WORKERS` | Nombre de workers Gunicorn | `4` |
| `CACHE_TTL` | TTL du cache Redis (secondes) | `300` |

## API — Endpoints principaux

### Authentification
| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/token` | Connexion (email + mot de passe) |
| `POST /api/auth/users` | Créer un utilisateur |
| `GET /api/auth/users/me` | Profil utilisateur connecté |

### Faisabilité / Prospection
| Endpoint | Description |
|----------|-------------|
| `GET /api/address/search?q=` | Recherche d'adresse |
| `GET /api/cadastre/parcelles?code_insee=` | Parcelles cadastrales |
| `GET /api/dvf/transactions?code_insee=` | Transactions DVF |
| `GET /api/dvf/statistiques?code_insee=` | Statistiques marché |
| `GET /api/scoring/parcelle/{id}` | Score d'une parcelle |
| `GET /api/scoring/commune/{code_insee}` | Top parcelles scorées |
| `GET /api/risques/commune/{code}` | Risques naturels/technologiques |
| `GET /api/urbanisme/zonage?lon=&lat=` | Zonage PLU |
| `GET /api/enrichissement/demographics/{code_insee}` | Données démographiques |
| `GET /api/prospection` | Liste des prospections |
| `POST /api/reports/generate` | Générer un rapport PDF |
| `GET /api/export/dvf/csv?code_insee=` | Export CSV |

### Santé
| Endpoint | Description |
|----------|-------------|
| `GET /health` | Vérification de santé (Docker) |

## Sécurité

- **Authentification JWT** : Token Bearer sur toutes les routes métier
- **Rate limiting** : 100 req/minute par défaut (configurable)
- **Headers sécurité** : CSP, X-Frame-Options, HSTS
- **Validation des entrées** : Sanitisation et validation Pydantic
- **Utilisateur non-root** en Docker
- **CORS** configurable par environnement
- **Secrets en variables d'environnement** (jamais en dur dans le code)

## Licence

MIT
