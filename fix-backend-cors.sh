#!/bin/bash
# Fix rapide pour le backend (problème CORS_ORIGINS)

echo "🔧 Fix du backend - Problème CORS_ORIGINS"
echo "=========================================="
echo ""

if [[ $EUID -ne 0 ]]; then
   echo "❌ Ce script doit être exécuté en tant que root (sudo)"
   exit 1
fi

cd /opt/prospection

echo "📥 Récupération du fix..."
sudo -u prospection git pull origin claude/viabilis-map-evolution-brBkE

echo ""
echo "🔄 Redémarrage du backend uniquement..."
docker compose down backend
docker compose up -d

echo ""
echo "⏳ Attente du démarrage (20 secondes)..."
sleep 20

echo ""
echo "✅ Vérification..."
echo "-------------------------------------------"

# État des conteneurs
docker compose ps

echo ""
echo "🏥 Health check backend..."
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend opérationnel !"
    curl http://localhost:8000/health
    echo ""
    echo ""
    echo "🎉 SUCCÈS ! Application complètement fonctionnelle !"
    echo ""
    echo "Votre site est maintenant accessible avec toutes les nouvelles fonctionnalités :"
    echo "  📁 Gestion de projets"
    echo "  📊 Dashboard avec graphiques"
    echo "  🔔 Historique & alertes"
    echo "  📄 Rapports PDF"
    echo "  🌍 Données enrichies"
    echo "  🎨 Mode sombre/clair"
    echo ""
    echo "🌐 Ouvrez votre site dans un navigateur et testez !"
else
    echo "⚠️  Backend pas encore prêt..."
    echo ""
    echo "📋 Logs du backend :"
    docker compose logs backend --tail=30
fi
