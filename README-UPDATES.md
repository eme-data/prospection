# Guide Rapide de Mise à Jour

## 🚀 Mise à jour en 30 secondes

```bash
cd /opt/prospection
sudo ./update.sh
```

C'est tout ! Le script s'occupe de tout.

---

## 📋 Scénarios Courants

### 1. Mise à jour standard (après un `git push`)

```bash
sudo ./update.sh
```

Le script va :
- ✓ Créer une sauvegarde automatique
- ✓ Récupérer le nouveau code
- ✓ Reconstruire uniquement ce qui a changé
- ✓ Redémarrer l'application
- ✓ Vérifier que tout fonctionne

### 2. Déployer une version spécifique

```bash
sudo ./update.sh --tag v2.1.0
```

### 3. Mise à jour SANS interruption de service

```bash
sudo ./update.sh --no-downtime
```

⚡ Les conteneurs sont mis à jour un par un, l'application reste accessible.

### 4. Forcer une reconstruction complète

```bash
sudo ./update.sh --force
```

🔨 Utile si quelque chose ne marche pas après une mise à jour.

### 5. Retour en arrière (Rollback)

```bash
sudo ./update.sh --rollback
```

🔙 Revient à la version précédente automatiquement.

---

## 🔍 Vérifier l'État

```bash
# Voir la version actuelle
cd /opt/prospection
git describe --tags

# Voir les logs
sudo docker compose logs -f

# État des conteneurs
sudo docker compose ps

# Health check
curl http://localhost/health
```

---

## 📚 Documentation Complète

- **[UPDATES.md](./UPDATES.md)** - Guide détaillé (méthodes, troubleshooting)
- **[CHANGELOG.md](./CHANGELOG.md)** - Historique des versions
- **[update.sh](./update.sh)** - Script de mise à jour automatique

---

## 🛡️ Sécurité

Le script crée **automatiquement une sauvegarde** avant chaque mise à jour :

```bash
# Les backups sont des tags Git
git tag -l | grep backup

# Exemple de rollback manuel vers un backup
git checkout backup-20260123-143022-5cc7872
sudo systemctl restart prospection
```

---

## ⚙️ Configuration Avancée

### Déploiement Automatique (CI/CD)

**Option 1 : Cron Job (toutes les nuits)**

```bash
sudo crontab -e

# Ajouter cette ligne pour MAJ à 3h du matin
0 3 * * * cd /opt/prospection && ./update.sh >> /var/log/prospection-updates.log 2>&1
```

**Option 2 : Webhook GitHub**

Déclenchement automatique après un `git push` sur GitHub.

Voir [UPDATES.md](./UPDATES.md) section "Automatisation" pour plus de détails.

---

## 🚨 En Cas de Problème

```bash
# 1. Voir les logs
sudo docker compose logs -f backend
sudo docker compose logs -f frontend

# 2. Redémarrer
sudo systemctl restart prospection

# 3. Rollback
sudo ./update.sh --rollback

# 4. Reconstruction forcée
sudo ./update.sh --force
```

---

## 📊 Workflow Recommandé

### Développement → Production

```mermaid
graph LR
    A[Dev Local] -->|git push| B[GitHub]
    B -->|Pull Request| C[Review]
    C -->|Merge| D[main/master]
    D -->|update.sh| E[Production]
```

**Étapes :**

1. **Développement local**
   ```bash
   git checkout -b feature/ma-fonctionnalite
   # Développer et tester
   git push origin feature/ma-fonctionnalite
   ```

2. **Pull Request sur GitHub**
   - Review du code
   - Tests automatiques (si configurés)
   - Merge dans `main`

3. **Déploiement en production**
   ```bash
   ssh votre-serveur
   cd /opt/prospection
   sudo ./update.sh
   ```

---

## 🎯 Bonnes Pratiques

### ✅ À FAIRE

- Tester en local avant de déployer
- Vérifier les logs après mise à jour
- Déployer pendant les heures creuses
- Lire le CHANGELOG.md avant de mettre à jour

### ❌ À ÉVITER

- Ne jamais éditer directement dans /opt/prospection
- Ne pas sauter de versions majeures
- Ne pas ignorer les erreurs dans les logs

---

## 💡 Astuces

### Voir les changements avant de déployer

```bash
cd /opt/prospection
git fetch origin
git log --oneline HEAD..origin/main
```

### Comparer deux versions

```bash
git diff v2.0.0 v2.1.0
```

### Nettoyer l'espace disque

```bash
sudo docker system prune -a
```

---

## 📞 Support

**Problème lors d'une mise à jour ?**

1. Consultez [UPDATES.md](./UPDATES.md) section "Troubleshooting"
2. Vérifiez les logs : `docker compose logs -f`
3. Faites un rollback si nécessaire : `sudo ./update.sh --rollback`
4. Contactez l'équipe de développement

---

**Version actuelle :** v2.1.0
**Dernière mise à jour :** 2026-01-23
