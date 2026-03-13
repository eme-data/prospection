# Guide d'export et migration — Prospection Foncière

## Vue d'ensemble

Le script `export.sh` permet de créer une archive complète de l'application, prête à être déployée sur un nouveau serveur. Il gère deux modes :

- **Migration complète** (par défaut) : code + base de données + cache Redis + secrets → aucune perte de données
- **Installation neuve** (`--no-data`) : code uniquement, pour un déploiement vierge

---

## Prérequis

### Sur le serveur source (export)
- Bash
- `rsync`
- Python 3 ou `openssl` (pour la génération de clés)
- Docker (si vous souhaitez exporter les données depuis les conteneurs en cours)

### Sur le serveur cible (import)
- Un serveur Linux (Ubuntu/Debian recommandé)
- Accès root ou sudo
- Le domaine doit pointer vers l'IP du serveur (pour Let's Encrypt)
- Docker et Docker Compose v2 seront installés automatiquement si absents

---

## Étape 1 — Export depuis le serveur actuel

### Migration avec données (recommandé)

```bash
cd /chemin/vers/prospection
bash export.sh
```

Le script va vous demander :
1. **Domaine cible** — le nom de domaine du nouveau serveur (ex: `app.nouveaudomaine.fr`)

Il effectue ensuite automatiquement :
- Copie du code source (backend, frontend, Dockerfiles, configs nginx)
- Export de la base de données SQLite (depuis `data/` et/ou depuis le conteneur Docker)
- Export du dump Redis (cache)
- Sauvegarde du `.env` actuel et reprise des secrets (SECRET_KEY, MSAL, Anthropic)
- Adaptation des fichiers nginx.conf au nouveau domaine
- Génération du `.env` pour le nouveau serveur
- Création de l'archive `.tar.gz`

### Installation neuve (sans données)

```bash
bash export.sh --no-data
```

Même processus, mais sans export de la base de données, du cache Redis, ni des secrets existants. Un nouveau `SECRET_KEY` est généré.

### Résultat

L'export produit un fichier :
```
prospection-export-20260313_143022.tar.gz
```

---

## Étape 2 — Transfert vers le nouveau serveur

```bash
scp prospection-export-20260313_143022.tar.gz user@nouveau-serveur:~/
```

---

## Étape 3 — Installation sur le nouveau serveur

```bash
# Connexion au serveur
ssh user@nouveau-serveur

# Extraction
tar xzf prospection-export-*.tar.gz
cd prospection-export-*

# Vérification/édition de la configuration (optionnel)
nano backend/.env

# Lancement de l'installation
sudo bash install-server.sh
```

### Déroulement de l'installation

Le script `install-server.sh` effectue les opérations suivantes :

| Étape | Description |
|-------|-------------|
| 1/6 | Vérifie que Docker et Docker Compose sont installés (installe Docker si absent) |
| 2/6 | Crée les dossiers `data/` et `ssl/` |
| 3/6 | Restaure les données (base SQLite, fichiers applicatifs) si mode migration |
| 4/6 | Configure SSL avec 3 options au choix |
| 5/6 | Build les images Docker (backend, frontend, Redis, Ollama, Open WebUI) |
| 6/6 | Démarre tous les services et attend que le backend soit opérationnel |

### Options SSL

Lors de l'installation, vous pouvez choisir :

1. **Let's Encrypt** (recommandé en production)
   - Génère un certificat gratuit et reconnu
   - Le domaine doit déjà pointer vers le serveur
   - Configure le renouvellement automatique via cron
2. **Certificat auto-signé**
   - Pour les tests ou les environnements internes
   - Valide 365 jours
   - Le navigateur affichera un avertissement
3. **HTTP uniquement**
   - Sans chiffrement
   - Déconseillé en production

---

## Ce qui est migré

### Mode migration complète (par défaut)

| Élément | Détail |
|---------|--------|
| Code source | Backend (FastAPI) + Frontend (React) |
| Base de données | SQLite avec tous les utilisateurs, données métier, paramètres |
| Comptes utilisateur | Tous les comptes et mots de passe sont conservés |
| Sessions | La SECRET_KEY est reprise → les JWT existants restent valides |
| Cache Redis | Dump RDB restauré (scans en cours, cache API) |
| Secrets | MSAL_CLIENT_ID, MSAL_TENANT_ID, ANTHROPIC_API_KEY repris du .env original |
| Configuration nginx | Adaptée automatiquement au nouveau domaine |

### Mode installation neuve (`--no-data`)

| Élément | Détail |
|---------|--------|
| Code source | Backend + Frontend |
| Base de données | Vide, créée au premier démarrage |
| Compte admin | Créé interactivement lors de l'installation |
| Secrets | Nouveaux secrets générés aléatoirement |
| Configuration nginx | Adaptée au nouveau domaine |

---

## Contenu de l'archive

```
prospection-export-YYYYMMDD_HHMMSS/
├── backend/                    # Code source backend FastAPI
│   ├── app/                    # Application Python
│   ├── alembic/                # Migrations de base de données
│   ├── .env                    # Configuration générée pour le nouveau serveur
│   ├── requirements.txt
│   └── entrypoint.sh
├── frontend/                   # Code source frontend React
│   ├── src/
│   ├── package.json
│   └── ...
├── data-export/                # (migration uniquement)
│   ├── docker-data/            # Données depuis le conteneur Docker
│   ├── data/                   # Données depuis le dossier local
│   ├── redis-dump.rdb          # Dump du cache Redis
│   ├── original.env            # .env du serveur source (référence)
│   └── env-reference.txt       # Variables d'env du conteneur
├── docker-compose.prod.yml     # Orchestration Docker
├── Dockerfile.backend
├── Dockerfile.frontend
├── nginx.conf                  # Config nginx (domaine adapté)
├── nginx-ssl.conf              # Config nginx SSL (domaine adapté)
└── install-server.sh           # Script d'installation automatique
```

---

## Vérification post-migration

Après l'installation, vérifiez que tout fonctionne :

```bash
# Vérifier que tous les conteneurs tournent
docker compose -f docker-compose.prod.yml ps

# Vérifier les logs du backend
docker compose -f docker-compose.prod.yml logs backend --tail 50

# Tester le endpoint de santé
curl -s https://votre-domaine.fr/health

# Vérifier la connexion
# → Ouvrir https://votre-domaine.fr dans un navigateur
# → Se connecter avec un compte existant
```

---

## Commandes utiles post-installation

```bash
# Voir les logs en temps réel
docker compose -f docker-compose.prod.yml logs -f

# Redémarrer tous les services
docker compose -f docker-compose.prod.yml restart

# Redémarrer un service spécifique
docker compose -f docker-compose.prod.yml restart backend

# Arrêter tous les services
docker compose -f docker-compose.prod.yml down

# Mettre à jour (après un git pull ou nouveau code)
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Voir l'état de la base de données
docker compose -f docker-compose.prod.yml exec backend python -c "
from app.database import engine
from sqlalchemy import inspect, text
tables = inspect(engine).get_table_names()
print(f'Tables: {len(tables)}')
for t in tables:
    with engine.connect() as c:
        count = c.execute(text(f'SELECT COUNT(*) FROM {t}')).scalar()
        print(f'  {t}: {count} lignes')
"
```

---

## Nettoyage post-migration

Une fois la migration vérifiée et fonctionnelle :

```bash
# Sur le nouveau serveur, supprimer les fichiers d'export
rm -rf data-export/

# Sur la machine locale, supprimer l'archive
rm prospection-export-*.tar.gz
```

---

## Dépannage

### Le backend ne démarre pas
```bash
docker compose -f docker-compose.prod.yml logs backend
```
Causes fréquentes :
- `SECRET_KEY` vide → vérifier `backend/.env`
- Base de données corrompue → vérifier `data/prospection.db`

### Erreur SSL / certificat
```bash
# Regénérer un certificat Let's Encrypt
certbot certonly --standalone -d votre-domaine.fr
cp /etc/letsencrypt/live/votre-domaine.fr/fullchain.pem ssl/
cp /etc/letsencrypt/live/votre-domaine.fr/privkey.pem ssl/
docker compose -f docker-compose.prod.yml restart frontend
```

### Les utilisateurs ne peuvent pas se connecter
Si vous avez changé la `SECRET_KEY` entre les deux serveurs, les anciens JWT sont invalidés. Les utilisateurs doivent se reconnecter. En mode migration, la SECRET_KEY est reprise automatiquement pour éviter ce problème.

### L'authentification Microsoft ne fonctionne pas
Vérifiez que `MSAL_CLIENT_ID` et `MSAL_TENANT_ID` sont présents dans `backend/.env`, et que l'URL de redirection dans Azure AD inclut le nouveau domaine :
- `https://nouveau-domaine.fr`
- `https://nouveau-domaine.fr/auth/callback`

### Redis ne contient pas de données
Le cache Redis est non critique — il se reconstruit automatiquement. Les scans SharePoint en cours devront être relancés.
