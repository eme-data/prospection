#!/bin/bash
# Script de diagnostic backend - À exécuter sur le serveur

echo "=== DIAGNOSTIC BACKEND PROSPECTION ==="
echo ""

echo "📋 1. Status du service"
echo "---"
sudo systemctl status prospection.service --no-pager -n 5
echo ""

echo "📜 2. Derniers logs systemd (50 lignes)"
echo "---"
sudo journalctl -xeu prospection.service --no-pager -n 50
echo ""

echo "🐳 3. Status des containers Docker"
echo "---"
sudo docker ps -a | grep prospection
echo ""

echo "📊 4. Logs du container backend (50 lignes)"
echo "---"
sudo docker logs prospection-backend-1 --tail 50
echo ""

echo "🔍 5. Vérifier si le module economic_layers existe"
echo "---"
ls -la /opt/prospection/backend/app/economic_layers.py
echo ""

echo "✅ 6. Test d'import Python dans le container"
echo "---"
sudo docker exec prospection-backend-1 python3 -c "from app.economic_layers import router; print('✅ Import OK')" 2>&1 || echo "❌ Import FAILED"
echo ""

echo "=== FIN DIAGNOSTIC ==="
