# 🔧 Fix de l'Erreur Systemd

## 🔍 Diagnostic

L'erreur que vous voyez :
```
open /opt/prospection/docker-compose.prod.ymlfalse: no such file or directory
```

**Cause :** Le fichier de service systemd a une erreur de configuration qui concatène mal les noms de fichiers.

---

## ✅ Solution Rapide (30 secondes)

**Sur votre serveur**, exécutez ces commandes **UNE PAR UNE** :

### Étape 1 : Télécharger le script de correction

```bash
cd /opt/prospection
git pull origin main
```

### Étape 2 : Exécuter le script de correction

```bash
sudo ./fix-systemd.sh
```

✨ **C'est tout !** Le script va :
- Détecter votre configuration (avec ou sans SSL)
- Corriger le fichier systemd
- Redémarrer le service
- Vérifier que tout fonctionne

---

## 🛠️ Solution Manuelle (Si vous préférez)

Si le script ne fonctionne pas, voici la correction manuelle :

### 1. Éditer le fichier de service

```bash
sudo nano /etc/systemd/system/prospection.service
```

### 2. Trouver cette ligne (AVANT) :

```
ExecStart=/usr/bin/docker compose -f docker-compose.prod.ymlfalse up -d --build
```

### 3. Remplacer par (APRÈS) :

**Si vous n'utilisez PAS SSL :**
```
ExecStart=/usr/bin/docker compose -f docker-compose.yml up -d --build
ExecStop=/usr/bin/docker compose -f docker-compose.yml down
ExecReload=/usr/bin/docker compose -f docker-compose.yml restart
```

**Si vous utilisez SSL :**
```
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d --build
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
ExecReload=/usr/bin/docker compose -f docker-compose.prod.yml restart
```

### 4. Sauvegarder et quitter

- Appuyez sur `Ctrl + X`
- Appuyez sur `Y` pour confirmer
- Appuyez sur `Entrée`

### 5. Recharger et redémarrer

```bash
sudo systemctl daemon-reload
sudo systemctl start prospection
sudo systemctl status prospection
```

---

## 🔍 Comment Savoir Si Vous Utilisez SSL ?

```bash
# Vérifier si ces fichiers existent
ls -la /opt/prospection/docker-compose.prod.yml
ls -la /opt/prospection/nginx-ssl.conf
ls -la /opt/prospection/ssl/
```

- **Si les fichiers existent** → Vous utilisez SSL (docker-compose.prod.yml)
- **Si les fichiers n'existent pas** → Vous n'utilisez pas SSL (docker-compose.yml)

---

## ✅ Vérification Après Correction

```bash
# 1. Vérifier le service
sudo systemctl status prospection

# 2. Vérifier les conteneurs
cd /opt/prospection
sudo docker compose ps

# 3. Vérifier l'accès
curl http://localhost/health

# 4. Voir les logs si problème
sudo docker compose logs -f
```

**Résultat attendu :**
```
prospection.service - Prospection Fonciere Application
     Loaded: loaded
     Active: active (running)
```

---

## 🚨 Autres Problèmes Possibles

### Problème : "Cannot connect to Docker daemon"

```bash
# Démarrer Docker
sudo systemctl start docker

# Puis réessayer
sudo systemctl start prospection
```

### Problème : "Permission denied"

```bash
# Corriger les permissions
sudo chown -R prospection:prospection /opt/prospection
sudo usermod -aG docker prospection

# Puis réessayer
sudo systemctl start prospection
```

### Problème : "Port already in use"

```bash
# Voir ce qui utilise le port 80
sudo netstat -tulpn | grep :80

# Arrêter le service conflit (exemple avec nginx)
sudo systemctl stop nginx

# Puis réessayer
sudo systemctl start prospection
```

---

## 📊 Commandes de Diagnostic

Si ça ne fonctionne toujours pas :

```bash
# Logs détaillés du service
sudo journalctl -u prospection -n 50 --no-pager

# Logs des conteneurs
cd /opt/prospection
sudo docker compose logs --tail=100

# État complet
sudo systemctl status prospection --no-pager -l

# Tester manuellement
cd /opt/prospection
sudo docker compose up
# (Ctrl+C pour arrêter)
```

---

## 🎯 Après Correction Réussie

Une fois le service démarré, vous devriez voir :

```bash
$ curl http://localhost/health
{"status":"healthy","version":"2.1.0"}

$ sudo docker compose ps
NAME                      STATUS
prospection-backend       Up 2 minutes
prospection-frontend      Up 2 minutes
prospection-redis         Up 2 minutes
```

**Votre site est maintenant accessible !** 🎉

Accédez à votre site et vous verrez les nouvelles fonctionnalités :
- 📁 Gestion de projets
- 📊 Dashboard avec graphiques
- 🔔 Alertes
- 🌙 Mode sombre/clair
- 📄 Rapports PDF

---

## 📞 Besoin d'Aide ?

Envoyez-moi le résultat de ces commandes :

```bash
cat /etc/systemd/system/prospection.service
ls -la /opt/prospection/*.yml
sudo systemctl status prospection --no-pager
sudo journalctl -u prospection -n 20 --no-pager
```

---

**Résumé en 1 ligne :** Le service systemd a un nom de fichier incorrect, utilisez `sudo ./fix-systemd.sh` pour corriger automatiquement.
