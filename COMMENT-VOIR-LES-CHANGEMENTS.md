# 🎯 Comment Voir les Nouvelles Fonctionnalités

## 📌 Situation Actuelle

**Les changements sont dans Git ✅ mais PAS ENCORE visibles sur votre site ❌**

Pourquoi ? Parce que :
1. Vous êtes sur une machine de développement (`/home/user/prospection`)
2. Votre site tourne probablement ailleurs (serveur distant ou pas encore déployé)
3. Le script `update.sh` est conçu pour un serveur de production dans `/opt/prospection`

---

## 🚀 3 Options pour Voir les Changements

### Option 1 : Test Local avec Docker (RAPIDE - 5 min)

**Si Docker est installé :**

```bash
cd /home/user/prospection

# Lancer l'application localement
docker compose build
docker compose up -d

# Ouvrir dans votre navigateur
http://localhost
```

✅ **Avantages :**
- Vous voyez immédiatement les changements
- Pas besoin de serveur distant
- Parfait pour tester avant production

❌ **Inconvénients :**
- Nécessite Docker installé
- Accessible uniquement en local

---

### Option 2 : Déployer sur Votre Serveur de Production

**Si vous avez un serveur distant où tourne actuellement votre site :**

```bash
# 1. Connectez-vous à votre serveur
ssh votre-utilisateur@votre-serveur.com

# 2. Allez dans le répertoire de l'application
cd /opt/prospection  # ou le chemin où est installée votre app

# 3. Téléchargez les nouveaux fichiers (update.sh, UPDATES.md, etc.)
sudo -u prospection git fetch origin
sudo -u prospection git pull origin claude/viabilis-map-evolution-brBkE

# 4. Mettez à jour
sudo systemctl stop prospection
sudo -u prospection docker compose build --no-cache
sudo systemctl start prospection

# 5. Vérifiez
curl http://localhost/health
sudo docker compose ps
```

✅ **Avantages :**
- Déploiement en production
- Accessible publiquement

❌ **Inconvénients :**
- Nécessite accès SSH au serveur
- Temps de déploiement plus long

---

### Option 3 : Installation Fresh sur un Nouveau Serveur

**Si vous voulez installer sur un nouveau serveur :**

```bash
# Sur le serveur
cd /opt
git clone https://github.com/eme-data/prospection.git
cd prospection
git checkout claude/viabilis-map-evolution-brBkE

# Installation
sudo ./deploy.sh

# Ou avec SSL
sudo ./deploy.sh --domain votre-domaine.com --email votre@email.com --with-ssl
```

---

## 🔍 Comment Savoir Où Tourne Votre Site ?

### Vérification 1 : Avez-vous Docker localement ?

```bash
docker --version
docker compose ps
```

- **Si Docker est installé** → Utilisez Option 1
- **Si Docker n'est pas trouvé** → Utilisez Option 2 ou 3

### Vérification 2 : Avez-vous un serveur distant ?

Vérifiez vos notes/documentation pour :
- Une adresse IP (ex: 123.456.789.012)
- Un nom de domaine (ex: prospection.example.com)
- Des identifiants SSH

- **Si OUI** → Utilisez Option 2
- **Si NON** → Utilisez Option 1 ou 3

---

## ✅ Liste de Vérification des Nouvelles Fonctionnalités

Une fois déployé, vous devriez voir :

### Dans le Header (en haut)

```
[Logo] Prospection Foncière [Barre de recherche] [📁][📊][🕐][🔔] | [🔍][⚠️][📄][💾][⭐] | [🌙]
```

- 📁 **Projets** (nouveau)
- 📊 **Dashboard** (nouveau)
- 🕐 **Historique** (nouveau)
- 🔔 **Alertes** (nouveau)
- 📄 **Rapport PDF** (nouveau)
- 🌙 **Mode sombre/clair** (nouveau)

### Fonctionnalités Testables

1. **Projets**
   - Cliquer sur 📁
   - Créer un nouveau projet
   - Voir la liste des projets

2. **Dashboard**
   - Chercher une adresse
   - Cliquer sur 📊
   - Voir les graphiques

3. **Mode Sombre**
   - Cliquer sur 🌙
   - L'interface devient sombre

4. **Rapports PDF**
   - Chercher une commune
   - Cliquer sur 📄
   - Générer un rapport PDF

---

## 🆘 Vous Ne Voyez Toujours Rien ?

### Problème : "Le header n'a pas changé"

**Solutions :**

1. **Vider le cache du navigateur**
   - Chrome : Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)
   - Firefox : Ctrl+F5
   - Ou ouvrir en navigation privée

2. **Vérifier que les conteneurs ont bien redémarré**
   ```bash
   docker compose ps
   # frontend doit être "Up"
   ```

3. **Reconstruire le frontend SANS cache**
   ```bash
   docker compose build --no-cache frontend
   docker compose up -d frontend
   ```

### Problème : "Le site ne charge pas du tout"

```bash
# Vérifier les logs
docker compose logs -f

# Redémarrer tout
docker compose down
docker compose up -d
```

### Problème : "Erreur 502 Bad Gateway"

```bash
# Le backend n'est pas démarré
docker compose restart backend
docker compose logs -f backend
```

---

## 📦 Fichiers Importants à Transférer

Si vous déployez manuellement, assurez-vous d'avoir ces nouveaux fichiers :

**Backend :**
- `backend/app/report_generator.py` (nouveau)
- `backend/app/main.py` (modifié)
- `backend/requirements.txt` (modifié)

**Frontend :**
- `frontend/src/components/ProjectsPanel.tsx` (nouveau)
- `frontend/src/components/Dashboard.tsx` (nouveau)
- `frontend/src/components/HistoryPanel.tsx` (nouveau)
- `frontend/src/components/AlertsPanel.tsx` (nouveau)
- `frontend/src/components/ReportGenerator.tsx` (nouveau)
- `frontend/src/contexts/ThemeContext.tsx` (nouveau)
- `frontend/src/App.tsx` (modifié)
- `frontend/src/main.tsx` (modifié)
- `frontend/tailwind.config.js` (modifié)
- `frontend/package.json` (modifié)

**Scripts :**
- `update.sh` (nouveau)
- `UPDATES.md` (nouveau)
- `CHANGELOG.md` (nouveau)

---

## 🎓 Comprendre le Problème

```
┌─────────────────────────────────────┐
│   Machine Actuelle (Dev)            │
│   /home/user/prospection            │
│                                     │
│   ✅ Code à jour (v2.1.0)           │
│   ✅ Commits créés                  │
│   ✅ Push sur GitHub                │
│                                     │
│   ❌ Mais Docker pas lancé          │
│   ❌ Donc pas de site visible       │
└─────────────────────────────────────┘
            ⬇️ (git pull)
┌─────────────────────────────────────┐
│   Serveur de Production             │
│   /opt/prospection                  │
│                                     │
│   ❓ Code ancien (v2.0.0)           │
│   ❓ A besoin de git pull           │
│   ❓ A besoin de docker rebuild     │
│                                     │
│   ✅ Docker tourne                  │
│   ✅ Site accessible                │
└─────────────────────────────────────┘
```

**Solution :** Faire un `git pull` + `docker compose build` sur le serveur !

---

## 📞 Commande de Diagnostic

Exécutez ceci et envoyez-moi le résultat :

```bash
echo "=== Environnement actuel ==="
pwd
echo ""
echo "=== Docker disponible ? ==="
docker --version 2>&1 || echo "Docker non installé"
echo ""
echo "=== Conteneurs en cours ==="
docker compose ps 2>&1 || echo "Aucun conteneur"
echo ""
echo "=== Version Git actuelle ==="
git log -1 --oneline
echo ""
echo "=== Fichiers récents ==="
ls -lt | head -10
```

Cela m'aidera à comprendre votre configuration exacte.

---

**Version à déployer :** v2.1.0
**Commit :** c536279
**Branche :** claude/viabilis-map-evolution-brBkE

**Résumé en 1 ligne :** Le code est prêt mais doit être déployé avec `docker compose build` sur le serveur où tourne votre site.
