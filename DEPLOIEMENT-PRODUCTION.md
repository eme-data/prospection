# 🚀 Guide de Déploiement en Production

## 📍 Situation Actuelle

Vous êtes actuellement sur une **machine de développement** où :
- Le code source est à jour avec toutes les nouvelles fonctionnalités ✅
- Les commits ont été créés et poussés sur GitHub ✅
- **MAIS** votre site web tourne sur un **serveur distant** qui n'a pas encore ces changements ❌

C'est pourquoi vous ne voyez aucun changement sur votre site.

---

## 🎯 Solution : Déployer sur Votre Serveur

### Prérequis

Vous devez connaître :
- L'adresse IP ou le nom de domaine de votre serveur
- Vos identifiants SSH
- Le chemin d'installation (probablement `/opt/prospection`)

### Méthode 1 : Déploiement Simple (Recommandé)

**Connectez-vous à votre serveur :**

```bash
ssh votre-utilisateur@votre-serveur.com
# ou
ssh votre-utilisateur@123.456.789.012
```

**Puis exécutez ces commandes :**

```bash
# Aller dans le répertoire
cd /opt/prospection

# Option A : Si update.sh existe (nouveau script)
sudo ./update.sh --branch claude/viabilis-map-evolution-brBkE

# Option B : Mise à jour manuelle
sudo systemctl stop prospection
sudo -u prospection git config --global --add safe.directory /opt/prospection
sudo -u prospection git fetch origin
sudo -u prospection git checkout claude/viabilis-map-evolution-brBkE
sudo -u prospection git pull origin claude/viabilis-map-evolution-brBkE
sudo -u prospection docker compose build --no-cache
sudo systemctl start prospection
```

**Vérifier que ça fonctionne :**

```bash
# État des conteneurs
sudo docker compose ps

# Logs en temps réel
sudo docker compose logs -f

# Health check
curl http://localhost/health
```

---

### Méthode 2 : Via Pull Request GitHub (Plus Propre)

**Étape 1 : Créer et merger la PR**

1. Allez sur : https://github.com/eme-data/prospection/pull/new/claude/viabilis-map-evolution-brBkE
2. Créez la Pull Request
3. Vérifiez les changements
4. Mergez dans `main` (ou votre branche principale)

**Étape 2 : Déployer sur le serveur**

```bash
# Sur votre serveur
ssh votre-utilisateur@votre-serveur.com
cd /opt/prospection
sudo ./update.sh
# ou
sudo systemctl stop prospection
sudo -u prospection git pull origin main
sudo -u prospection docker compose build --no-cache
sudo systemctl start prospection
```

---

### Méthode 3 : Si vous n'avez PAS accès SSH

Si votre serveur est géré par un hébergeur ou une plateforme :

1. **Mergez la Pull Request sur GitHub**
2. **Déclenchez un redéploiement** depuis votre plateforme (Netlify, Vercel, DigitalOcean, etc.)
3. La plateforme va automatiquement récupérer le nouveau code

---

## 🔍 Diagnostic : Où est Votre Site ?

### Vérifier l'adresse de votre serveur

Regardez dans votre fichier `deploy.sh` ou `docker-compose.yml` pour trouver :
- L'IP du serveur
- Le nom de domaine
- Les informations de connexion

### Vérifier si Docker tourne localement

```bash
# Sur votre machine actuelle
docker compose ps
```

Si ça affiche des conteneurs, votre site tourne **localement**.
Sinon, il tourne sur un **serveur distant**.

---

## 📦 Contenu du Déploiement

Quand vous déployez, voici ce qui sera mis à jour :

### Backend (Python/FastAPI)
- ✅ Nouveau module `report_generator.py`
- ✅ 3 nouveaux endpoints API :
  - `/api/reports/generate` (PDF)
  - `/api/enrichissement/demographics/{code}`
  - `/api/enrichissement/potential/{code}`
- ✅ Nouvelles dépendances : reportlab, Pillow

### Frontend (React/TypeScript)
- ✅ 7 nouveaux composants :
  - `ProjectsPanel.tsx`
  - `Dashboard.tsx`
  - `HistoryPanel.tsx`
  - `AlertsPanel.tsx`
  - `ReportGenerator.tsx`
  - `ThemeContext.tsx`
- ✅ Nouvelle dépendance : recharts
- ✅ Mode sombre Tailwind activé
- ✅ App.tsx complètement remanié

### Configuration
- ✅ `update.sh` - Script de mise à jour
- ✅ `UPDATES.md` - Documentation
- ✅ `CHANGELOG.md` - Historique

---

## ⚠️ Problèmes Courants

### Erreur : "dubious ownership in repository"

**Solution :**
```bash
sudo git config --global --add safe.directory /opt/prospection
```

### Erreur : "Permission denied"

**Solution :**
```bash
# Vérifier les permissions
ls -la /opt/prospection

# Corriger si nécessaire
sudo chown -R prospection:prospection /opt/prospection
```

### Les conteneurs ne démarrent pas

**Solution :**
```bash
# Voir les logs
sudo docker compose logs

# Reconstruire sans cache
sudo docker compose build --no-cache
sudo docker compose up -d
```

### Le frontend ne se met pas à jour

Le frontend est compilé au build. Il faut **TOUJOURS** reconstruire :
```bash
sudo docker compose build --no-cache frontend
sudo docker compose up -d frontend
```

---

## 🧪 Test Local (Sans Serveur)

Si vous voulez tester localement **avant** de déployer :

```bash
# Dans /home/user/prospection
docker compose build
docker compose up -d

# Accédez à http://localhost
# Les nouvelles fonctionnalités seront visibles
```

**Attention :** Cela nécessite Docker installé localement.

---

## 📊 Vérification Après Déploiement

Une fois déployé, vérifiez que tout fonctionne :

### 1. Backend

```bash
curl http://votre-site.com/health
# Doit retourner : {"status":"ok"}
```

### 2. Frontend

Ouvrez votre site dans un navigateur et vérifiez :
- [ ] Le header affiche les nouvelles icônes
- [ ] L'icône de mode sombre/clair est visible
- [ ] Le bouton "Projets" (dossier) apparaît
- [ ] Le bouton "Dashboard" (graphique) apparaît
- [ ] Le bouton "Historique" (horloge) apparaît
- [ ] Le bouton "Alertes" (cloche) apparaît
- [ ] Le bouton "Rapport PDF" (document) apparaît

### 3. Conteneurs Docker

```bash
sudo docker compose ps
# Les 3 conteneurs doivent être "Up"
```

---

## 🔄 Rollback (En Cas de Problème)

Si quelque chose ne va pas après le déploiement :

```bash
cd /opt/prospection
sudo ./update.sh --rollback
```

Ou manuellement :
```bash
sudo systemctl stop prospection
sudo -u prospection git checkout <commit-precedent>
sudo systemctl start prospection
```

---

## 💡 Résumé Rapide

```bash
# Sur votre serveur de production
ssh user@serveur
cd /opt/prospection
sudo systemctl stop prospection
sudo -u prospection git fetch origin
sudo -u prospection git pull origin claude/viabilis-map-evolution-brBkE
sudo -u prospection docker compose build --no-cache
sudo systemctl start prospection

# Vérifier
curl http://localhost/health
sudo docker compose ps
```

---

## 📞 Besoin d'Aide ?

**Vous ne voyez toujours rien ?**

Fournissez ces informations :
1. Où tourne votre site ? (URL ou IP)
2. Avez-vous accès SSH ?
3. Résultat de `docker compose ps` sur le serveur
4. Résultat de `git log -1` dans /opt/prospection

---

**Version à déployer :** v2.1.0
**Commit :** c536279
**Branche :** claude/viabilis-map-evolution-brBkE
