# Guide de Gestion des Mises à Jour

Ce document explique comment gérer les mises à jour de l'application Prospection Foncière.

## 🔄 Système de Mises à Jour Actuel

L'application utilise **Docker** avec **systemd** pour la gestion du cycle de vie. Voici comment fonctionnent les updates :

### Architecture de Déploiement

```
/opt/prospection/          # Répertoire d'installation
├── docker-compose.yml     # Configuration Docker standard
├── docker-compose.prod.yml # Configuration Docker avec SSL
├── backend/
│   ├── .env              # Variables d'environnement
│   └── requirements.txt  # Dépendances Python
├── frontend/
│   └── package.json      # Dépendances Node.js
└── deploy.sh             # Script de déploiement automatique
```

### Service systemd

```bash
# Commandes principales
systemctl status prospection    # Voir l'état
systemctl restart prospection   # Redémarrer
systemctl stop prospection      # Arrêter
systemctl start prospection     # Démarrer
```

---

## 📦 Méthodes de Mise à Jour

### Méthode 1 : Mise à jour Automatique (Recommandée)

**Pour une mise à jour complète du code depuis Git :**

```bash
cd /opt/prospection

# Arrêter l'application
sudo systemctl stop prospection

# Mettre à jour le code
sudo -u prospection git fetch origin
sudo -u prospection git pull origin main  # ou le nom de votre branche

# Reconstruire et redémarrer
sudo systemctl start prospection

# Vérifier les logs
sudo journalctl -u prospection -f
```

Le script `deploy.sh` gère automatiquement :
- La mise à jour du code Git
- La reconstruction des images Docker
- Le redémarrage des services
- Les migrations de dépendances

### Méthode 2 : Mise à jour Manuelle avec Docker Compose

**Si vous avez modifié des fichiers localement :**

```bash
cd /opt/prospection

# Arrêter les conteneurs
sudo docker compose down

# Reconstruire les images (force la reconstruction)
sudo docker compose build --no-cache

# Redémarrer
sudo docker compose up -d

# Vérifier
sudo docker compose ps
sudo docker compose logs -f
```

### Méthode 3 : Mise à jour Rolling (Zero Downtime)

**Pour une mise à jour sans interruption de service :**

```bash
cd /opt/prospection

# Construire les nouvelles images
sudo docker compose build

# Recréer les conteneurs un par un
sudo docker compose up -d --no-deps --build backend
sleep 10  # Attendre que le backend démarre
sudo docker compose up -d --no-deps --build frontend
```

---

## 🔧 Mises à Jour par Composant

### Backend (FastAPI/Python)

**Mise à jour des dépendances Python :**

```bash
cd /opt/prospection/backend

# Modifier requirements.txt si nécessaire
sudo nano requirements.txt

# Reconstruire le conteneur backend
cd /opt/prospection
sudo docker compose build backend
sudo docker compose up -d backend
```

**Mise à jour du code backend uniquement :**

```bash
# Après modification du code
sudo docker compose restart backend
sudo docker compose logs -f backend
```

### Frontend (React/Vite)

**Mise à jour des dépendances npm :**

```bash
cd /opt/prospection/frontend

# Modifier package.json si nécessaire
sudo nano package.json

# Reconstruire le conteneur frontend
cd /opt/prospection
sudo docker compose build frontend --no-cache
sudo docker compose up -d frontend
```

**Note :** Le frontend est compilé pendant le build Docker, donc toute modification nécessite une reconstruction complète.

### Base de données Redis

**Mise à jour de Redis :**

```bash
cd /opt/prospection

# Modifier la version dans docker-compose.yml
# Exemple : redis:7-alpine -> redis:7.2-alpine

sudo docker compose pull redis
sudo docker compose up -d redis
```

**Attention :** Redis stocke le cache. Une mise à jour vide le cache mais n'affecte pas les données persistantes.

---

## 🚀 Workflow de Mise à Jour Recommandé

### 1. **Développement Local**

```bash
# Sur votre machine de développement
git checkout -b feature/ma-nouvelle-fonctionnalite

# Développez et testez
npm run dev  # Frontend
uvicorn app.main:app --reload  # Backend

# Commitez vos changements
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push origin feature/ma-nouvelle-fonctionnalite
```

### 2. **Validation et Fusion**

```bash
# Créez une Pull Request sur GitHub
# Après review et validation, mergez dans main

git checkout main
git pull origin main
```

### 3. **Déploiement en Production**

```bash
# Sur le serveur de production
cd /opt/prospection
sudo systemctl stop prospection

# Sauvegarder la version actuelle (optionnel)
sudo -u prospection git tag -a v$(date +%Y%m%d-%H%M) -m "Backup avant update"

# Mettre à jour
sudo -u prospection git pull origin main

# Redémarrer
sudo systemctl start prospection

# Vérifier
curl http://localhost/health
sudo docker compose logs -f
```

---

## 🔐 Gestion des Versions

### Stratégie de Versioning (Recommandée)

**Utilisez Semantic Versioning (SemVer) :**

```
v2.1.0
  │ │ └── Patch (corrections de bugs)
  │ └──── Minor (nouvelles fonctionnalités rétrocompatibles)
  └────── Major (changements incompatibles)
```

**Créer une version :**

```bash
# Tagger une version stable
git tag -a v2.1.0 -m "Release v2.1.0 - Dashboard amélioré + Rapports PDF"
git push origin v2.1.0

# Sur le serveur
sudo -u prospection git fetch --tags
sudo -u prospection git checkout v2.1.0
sudo systemctl restart prospection
```

### Rollback (Retour en Arrière)

**En cas de problème après une mise à jour :**

```bash
cd /opt/prospection

# Voir les versions disponibles
git tag -l

# Revenir à la version précédente
sudo systemctl stop prospection
sudo -u prospection git checkout v2.0.0
sudo systemctl start prospection

# Ou revenir au commit précédent
sudo -u prospection git log --oneline -10
sudo -u prospection git checkout <commit-hash>
sudo systemctl restart prospection
```

---

## 📊 Monitoring des Mises à Jour

### Vérifier l'état après mise à jour

```bash
# Santé de l'application
curl http://localhost/health

# État des conteneurs
sudo docker compose ps

# Logs en temps réel
sudo docker compose logs -f

# Logs du backend uniquement
sudo docker compose logs -f backend

# Logs système
sudo journalctl -u prospection -n 100
```

### Vérifier les versions déployées

```bash
# Version Git
cd /opt/prospection
git log -1 --oneline

# Version des conteneurs
sudo docker compose images

# Version Python (backend)
sudo docker compose exec backend python --version

# Versions des packages npm (frontend)
# Consultez package.json
```

---

## 🔄 Automatisation des Mises à Jour

### Option 1 : Cron Job pour Mises à Jour Automatiques

**⚠️ Non recommandé pour la production sans tests**

```bash
# Créer un script de mise à jour
sudo nano /opt/prospection/auto-update.sh
```

```bash
#!/bin/bash
cd /opt/prospection
git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ $LOCAL != $REMOTE ]; then
    echo "Mise à jour disponible, déploiement..."
    systemctl stop prospection
    git pull origin main
    systemctl start prospection
    echo "Mise à jour terminée le $(date)" >> /var/log/prospection-updates.log
fi
```

```bash
# Rendre exécutable
sudo chmod +x /opt/prospection/auto-update.sh

# Ajouter au cron (toutes les nuits à 3h)
sudo crontab -e
# Ajouter : 0 3 * * * /opt/prospection/auto-update.sh
```

### Option 2 : GitHub Actions + Webhook

**Pour déclencher un déploiement depuis GitHub :**

1. Installez un webhook listener sur le serveur
2. Configurez GitHub Actions pour appeler le webhook après un push sur main
3. Le serveur reçoit la notification et lance la mise à jour

### Option 3 : Watchtower (Docker Auto-Update)

**Pour mettre à jour automatiquement les images Docker :**

```yaml
# Ajouter dans docker-compose.yml
services:
  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 86400  # Vérifier toutes les 24h
```

---

## 🛡️ Bonnes Pratiques

### ✅ À Faire

1. **Toujours tester en local avant de déployer**
2. **Créer un tag Git pour chaque version stable**
3. **Sauvegarder les données Redis si nécessaire** (`docker compose exec redis redis-cli BGSAVE`)
4. **Vérifier les logs après chaque mise à jour**
5. **Documenter les changements dans CHANGELOG.md**
6. **Avoir un plan de rollback**

### ❌ À Éviter

1. **Ne jamais éditer directement dans /opt/prospection sans commit**
2. **Ne pas mettre à jour sans tester les dépendances**
3. **Ne pas oublier de reconstruire les images Docker**
4. **Ne pas déployer pendant les heures de forte affluence**
5. **Ne pas ignorer les avertissements de sécurité**

---

## 🔍 Troubleshooting

### Problème : Le frontend ne se met pas à jour

```bash
# Le frontend est compilé en build time
# Il faut TOUJOURS reconstruire avec --no-cache
sudo docker compose build --no-cache frontend
sudo docker compose up -d frontend
```

### Problème : Dépendances Python manquantes

```bash
# Vérifier requirements.txt
cat backend/requirements.txt

# Reconstruire sans cache
sudo docker compose build --no-cache backend
sudo docker compose up -d backend
```

### Problème : Port déjà utilisé

```bash
# Vérifier les ports
sudo netstat -tulpn | grep ':80\|:443\|:8000'

# Arrêter les anciens conteneurs
sudo docker compose down
sudo docker ps -a
sudo docker rm -f $(sudo docker ps -aq)  # Supprimer tous les conteneurs arrêtés
```

### Problème : Espace disque insuffisant

```bash
# Nettoyer les images inutilisées
sudo docker system prune -a

# Nettoyer les volumes
sudo docker volume prune
```

---

## 📝 Checklist de Mise à Jour

```
□ Tester la mise à jour en local
□ Lire le CHANGELOG.md pour les breaking changes
□ Sauvegarder la base de données si nécessaire
□ Créer un tag Git de la version actuelle (backup)
□ Arrêter le service : systemctl stop prospection
□ Mettre à jour le code : git pull
□ Reconstruire les images : docker compose build
□ Démarrer le service : systemctl start prospection
□ Vérifier les logs : docker compose logs -f
□ Tester l'application : curl /health
□ Documenter la mise à jour
```

---

## 🆕 Nouvelle Mise à Jour Disponible !

**Votre version actuelle :** `v2.1.0` (avec Dashboard + Rapports PDF)

**Commit :** `5cc7872`

**Pour mettre à jour vers cette version :**

```bash
cd /opt/prospection
sudo systemctl stop prospection
sudo -u prospection git pull origin claude/viabilis-map-evolution-brBkE
sudo systemctl start prospection
```

---

## 📞 Support

En cas de problème lors d'une mise à jour :

1. Consultez les logs : `journalctl -u prospection -n 100`
2. Vérifiez l'état : `docker compose ps`
3. Rollback si nécessaire : `git checkout <version-precedente>`
4. Contactez l'équipe de développement

---

**Dernière mise à jour de ce document :** $(date +%Y-%m-%d)
