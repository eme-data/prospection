import aiosmtplib
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

async def send_email(db: Session, to_email: str, subject: str, html_body: str):
    """Envoie un email via la configuration SMTP de la BD (async, non-bloquant)"""
    config = get_smtp_config(db)
    if not config:
        logger.warning("Configuration SMTP non définie, email ignoré pour %s", to_email)
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = config["user"]
        msg["To"] = to_email

        part = MIMEText(html_body, "html")
        msg.attach(part)

        logger.info("Connexion SMTP à %s:%d", config["host"], config["port"])
        await aiosmtplib.send(
            msg,
            hostname=config["host"],
            port=config["port"],
            start_tls=True,
            username=config["user"],
            password=config["password"],
        )
        logger.info("Email envoyé avec succès à %s", to_email)
        return True
    except aiosmtplib.SMTPException as e:
        logger.error("Erreur SMTP pour %s: %s", to_email, e)
        return False
    except Exception as e:
        logger.error("Erreur d'envoi email à %s: %s", to_email, e)
        return False
