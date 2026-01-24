#!/bin/bash
# Script de redéploiement rapide avec le fix react-is

echo "🔧 Redéploiement avec le fix de la dépendance react-is"
echo "======================================================="
echo ""

if [[ $EUID -ne 0 ]]; then
   echo "❌ Ce script doit être exécuté en tant que root (sudo)"
   exit 1
fi

cd /opt/prospection

echo "📥 Récupération du fix..."
sudo -u prospection git pull origin claude/viabilis-map-evolution-brBkE

echo ""
echo "🛑 Arrêt des conteneurs..."
docker compose down

echo ""
echo "🔨 Reconstruction du frontend avec react-is..."
sudo -u prospection docker compose build --no-cache frontend

echo ""
echo "🔨 Reconstruction du backend..."
sudo -u prospection docker compose build --no-cache backend

echo ""
echo "🚀 Démarrage..."
sudo -u prospection docker compose up -d

echo ""
echo "⏳ Attente (30 secondes)..."
sleep 30

echo ""
echo "✅ Vérification..."
echo "------------------------------------------------------"
docker compose ps
echo ""

if curl -sf http://localhost/health > /dev/null 2>&1; then
    echo "✅ Application opérationnelle !"
    curl http://localhost/health
    echo ""
    echo ""
    echo "🎉 SUCCÈS ! Votre site est maintenant à jour avec :"
    echo "   📁 Gestion de projets"
    echo "   📊 Dashboard avec graphiques"
    echo "   🔔 Historique & alertes"
    echo "   📄 Rapports PDF"
    echo "   🎨 Mode sombre/clair"
    echo ""
    echo "Accédez à votre site et testez les nouvelles fonctionnalités !"
else
    echo "⚠️  L'application ne répond pas encore"
    echo "Vérifiez les logs : docker compose logs -f"
fi
