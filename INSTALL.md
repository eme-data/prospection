# Guide d'Installation - Prospection Fonciere

## Prerequis

- Serveur Linux (Ubuntu 20.04+, Debian 11+, CentOS 8+, ou equivalent)
- 2 Go de RAM minimum (4 Go recommandes)
- 10 Go d'espace disque
- Acces root ou sudo
- Ports 80 et 443 ouverts

## Installation Automatique (Recommandee)

### 1. Transferer le code sur le serveur

```bash
# Option A: Avec git
git clone <URL_DU_REPO> /tmp/prospection
sudo mv /tmp/prospection /opt/

# Option B: Avec scp (depuis votre machine locale)
scp -r ./prospection user@serveur:/tmp/
ssh user@serveur "sudo mv /tmp/prospection /opt/"
```

### 2. Executer le script de deploiement

```bash
cd /opt/prospection
sudo chmod +x deploy.sh

# Installation basique (HTTP uniquement)
sudo ./deploy.sh

# Installation avec SSL (HTTPS)
sudo ./deploy.sh --domain prospection.example.com --email admin@example.com --with-ssl
```

### 3. Verifier l'installation

```bash
# Statut des conteneurs
docker compose ps

# Health check
curl http://localhost/health

# Logs
docker compose logs -f
```

---

## Installation Manuelle

### Etape 1: Installer Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable docker
sudo systemctl start docker

# Ajouter votre utilisateur au groupe docker
sudo usermod -aG docker $USER
```

### Etape 2: Installer le code

```bash
# Creer le repertoire
sudo mkdir -p /opt/prospection
sudo chown $USER:$USER /opt/prospection

# Copier ou cloner le code
cd /opt/prospection
# git clone ... ou copie manuelle
```

### Etape 3: Configurer l'environnement

```bash
cd /opt/prospection

# Copier le fichier d'exemple
cp backend/.env.example backend/.env

# Editer selon vos besoins
nano backend/.env
```

Configuration minimale pour production:

```ini
ENVIRONMENT=production
DEBUG=false
CORS_ORIGINS=https://votre-domaine.com
REDIS_URL=redis://redis:6379/0
RATE_LIMIT_REQUESTS=100
CACHE_ENABLED=true
LOG_LEVEL=INFO
LOG_FORMAT=json
```

### Etape 4: Construire et demarrer

```bash
cd /opt/prospection

# Construire les images
docker compose build

# Demarrer en arriere-plan
docker compose up -d

# Verifier
docker compose ps
docker compose logs -f
```

### Etape 5: Configurer le demarrage automatique

Creer `/etc/systemd/system/prospection.service`:

```ini
[Unit]
Description=Prospection Fonciere
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/prospection
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
```

Activer le service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable prospection
sudo systemctl start prospection
```

---

## Configuration SSL avec Nginx (Reverse Proxy)

Si vous avez deja un serveur Nginx sur votre machine:

### 1. Obtenir un certificat SSL

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d prospection.example.com
```

### 2. Configuration Nginx

Creer `/etc/nginx/sites-available/prospection`:

```nginx
server {
    listen 80;
    server_name prospection.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name prospection.example.com;

    ssl_certificate /etc/letsencrypt/live/prospection.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/prospection.example.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=31536000" always;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Modifier docker-compose pour exposer sur localhost

Dans `docker-compose.yml`, changer:

```yaml
frontend:
  ports:
    - "127.0.0.1:8080:80"
```

### 4. Activer la configuration

```bash
sudo ln -s /etc/nginx/sites-available/prospection /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Commandes Utiles

### Gestion du service

```bash
# Statut
sudo systemctl status prospection

# Demarrer/Arreter/Redemarrer
sudo systemctl start prospection
sudo systemctl stop prospection
sudo systemctl restart prospection

# Logs systemd
journalctl -u prospection -f
```

### Gestion Docker

```bash
cd /opt/prospection

# Voir les conteneurs
docker compose ps

# Logs temps reel
docker compose logs -f
docker compose logs -f backend    # Backend seulement

# Redemarrer un service
docker compose restart backend

# Reconstruire apres modification
docker compose build --no-cache
docker compose up -d
```

### Mise a jour de l'application

```bash
cd /opt/prospection

# Arreter
docker compose down

# Mettre a jour le code
git pull origin main

# Reconstruire et redemarrer
docker compose build
docker compose up -d
```

### Sauvegarde

```bash
# Sauvegarder les donnees Redis
docker compose exec redis redis-cli BGSAVE
docker cp prospection-redis:/data/dump.rdb ./backup/

# Sauvegarder la configuration
cp backend/.env ./backup/
```

---

## Depannage

### L'application ne demarre pas

```bash
# Verifier les logs
docker compose logs

# Verifier l'espace disque
df -h

# Verifier la memoire
free -h

# Reconstruire completement
docker compose down
docker system prune -f
docker compose build --no-cache
docker compose up -d
```

### Erreur de connexion Redis

```bash
# Verifier que Redis fonctionne
docker compose exec redis redis-cli ping

# Redemarrer Redis
docker compose restart redis
```

### Problemes de performance

```bash
# Augmenter les workers dans Dockerfile.backend
# Modifier la ligne: "--workers", "4"
# Ajuster selon: 2 * CPU cores + 1

# Augmenter la memoire Redis dans docker-compose.yml
# Modifier: --maxmemory 512mb
```

### Verifier les health checks

```bash
curl http://localhost/health
curl http://localhost/ready
curl http://localhost/metrics
```

---

## Support

Pour signaler un probleme ou demander de l'aide:
- Verifier les logs: `docker compose logs`
- Verifier le statut: `curl http://localhost/health`
- Consulter ce guide
