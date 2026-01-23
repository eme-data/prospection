#!/bin/bash
# Script de correction du service systemd

echo "🔧 Correction du service prospection.service"
echo ""

# Vérifier si nous sommes root
if [[ $EUID -ne 0 ]]; then
   echo "❌ Ce script doit être exécuté en tant que root (sudo)"
   exit 1
fi

# Sauvegarder l'ancien service
if [ -f /etc/systemd/system/prospection.service ]; then
    cp /etc/systemd/system/prospection.service /etc/systemd/system/prospection.service.backup
    echo "✅ Backup créé: /etc/systemd/system/prospection.service.backup"
fi

# Détecter si SSL est configuré
WITH_SSL=false
if [ -f /opt/prospection/nginx-ssl.conf ] || [ -f /opt/prospection/docker-compose.prod.yml ]; then
    WITH_SSL=true
    echo "🔐 Configuration SSL détectée"
    COMPOSE_FILE="docker-compose.prod.yml"
else
    echo "📄 Configuration standard détectée"
    COMPOSE_FILE="docker-compose.yml"
fi

# Créer le nouveau fichier de service corrigé
cat > /etc/systemd/system/prospection.service << EOF
[Unit]
Description=Prospection Fonciere Application
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=prospection
Group=prospection
WorkingDirectory=/opt/prospection
ExecStart=/usr/bin/docker compose -f $COMPOSE_FILE up -d --build
ExecStop=/usr/bin/docker compose -f $COMPOSE_FILE down
ExecReload=/usr/bin/docker compose -f $COMPOSE_FILE restart
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Service systemd corrigé (utilise $COMPOSE_FILE)"

# Recharger systemd
systemctl daemon-reload
echo "✅ systemd rechargé"

# Démarrer le service
echo ""
echo "🚀 Démarrage du service..."
systemctl start prospection

# Vérifier le statut
sleep 5
if systemctl is-active --quiet prospection; then
    echo "✅ Service démarré avec succès !"
    echo ""
    systemctl status prospection --no-pager
else
    echo "❌ Échec du démarrage. Logs :"
    journalctl -u prospection -n 20 --no-pager
fi

echo ""
echo "📊 État des conteneurs Docker :"
cd /opt/prospection
docker compose ps
