import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
from app.models.settings import SystemSettings
import logging

logger = logging.getLogger(__name__)

def get_smtp_config(db: Session):
    """Récupère la configuration SMTP dynamique en BD"""
    host = db.query(SystemSettings).filter_by(key="smtp_host").first()
    port = db.query(SystemSettings).filter_by(key="smtp_port").first()
    user = db.query(SystemSettings).filter_by(key="smtp_user").first()
    password = db.query(SystemSettings).filter_by(key="smtp_password").first()
    
    if not host or not port or not user or not password:
        return None
        
    return {
        "host": host.value,
        "port": int(port.value),
        "user": user.value,
        "password": password.value
    }

def send_email(db: Session, to_email: str, subject: str, html_body: str):
    """Envoie un email via la configuration SMTP de la BD"""
    config = get_smtp_config(db)
    if not config:
        logger.warning(f"Configuration SMTP non définie, email ignoré pour {to_email}")
        return False
        
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = config["user"]
        msg["To"] = to_email
        
        # Encodage HTML
        part = MIMEText(html_body, "html")
        msg.attach(part)
        
        # Connexion TLS
        logger.info(f"Connexion SMTP à {config['host']}:{config['port']}")
        server = smtplib.SMTP(config["host"], config["port"])
        server.starttls()
        server.login(config["user"], config["password"])
        
        server.send_message(msg)
        server.quit()
        logger.info(f"Email envoyé avec succès à {to_email}")
        return True
    except Exception as e:
        logger.error(f"Erreur d'envoi email à {to_email}: {str(e)}")
        return False
