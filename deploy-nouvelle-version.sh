#!/bin/bash
# Script de déploiement de la version v2.1.0

echo "🚀 Déploiement de la version v2.1.0 avec toutes les nouvelles fonctionnalités"
echo "========================================================================"
echo ""

# Vérification root
if [[ $EUID -ne 0 ]]; then
   echo "❌ Ce script doit être exécuté en tant que root (sudo)"
   exit 1
fi

cd /opt/prospection

echo "📦 Étape 1 : Arrêt des conteneurs actuels"
systemctl stop prospection || true
docker compose down || true

echo ""
echo "📥 Étape 2 : Récupération du code complet de la branche de développement"
sudo -u prospection git fetch origin
sudo -u prospection git checkout claude/viabilis-map-evolution-brBkE
sudo -u prospection git pull origin claude/viabilis-map-evolution-brBkE

echo ""
echo "📝 Version à déployer :"
git log -1 --oneline

echo ""
echo "🔨 Étape 3 : Reconstruction des images Docker (cela peut prendre 2-3 minutes)"
echo "Construction du backend..."
sudo -u prospection docker compose build --no-cache backend

echo ""
echo "Construction du frontend..."
sudo -u prospection docker compose build --no-cache frontend

echo ""
echo "🚀 Étape 4 : Démarrage de l'application"
sudo -u prospection docker compose up -d

echo ""
echo "⏳ Attente du démarrage des services (30 secondes)..."
sleep 30

echo ""
echo "✅ Étape 5 : Vérification"
echo "----------------------------------------------------------------------"

# Vérifier les conteneurs
echo "📊 État des conteneurs :"
docker compose ps

echo ""
echo "🏥 Health check :"
if curl -sf http://localhost/health > /dev/null 2>&1; then
    echo "✅ Backend opérationnel"
    curl http://localhost/health
else
    echo "⚠️  Backend pas encore prêt, vérifiez les logs"
fi

echo ""
echo "📋 Logs récents du backend :"
docker compose logs --tail=20 backend

echo ""
echo "📋 Logs récents du frontend :"
docker compose logs --tail=10 frontend

echo ""
echo "======================================================================"
echo "🎉 Déploiement terminé !"
echo "======================================================================"
echo ""
echo "Version déployée : v2.1.0"
echo "Branche : claude/viabilis-map-evolution-brBkE"
echo ""
echo "Nouvelles fonctionnalités disponibles :"
echo "  📁 Gestion de projets de prospection"
echo "  📊 Tableau de bord avec graphiques interactifs"
echo "  🔔 Historique des recherches et alertes"
echo "  📄 Génération de rapports PDF professionnels"
echo "  🌍 Données enrichies (démographie, potentiel)"
echo "  🎨 Mode sombre/clair"
echo ""
echo "Commandes utiles :"
echo "  docker compose logs -f          # Voir les logs en direct"
echo "  docker compose ps               # État des conteneurs"
echo "  docker compose restart          # Redémarrer"
echo "  systemctl start prospection     # Utiliser le service systemd"
echo ""
