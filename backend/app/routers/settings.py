from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict
from app.database import get_db
from app.models.user import User
from app.models.settings import SystemSettings
from app.auth import get_current_active_user

router = APIRouter(prefix="/settings", tags=["settings"])

class SmtpConfig(BaseModel):
    host: str
    port: int
    user: str
    password: str

@router.get("/smtp")
async def get_smtp_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """(Admin) Récupère la configuration SMTP actuelle"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Réservé aux administrateurs")
        
    host = db.query(SystemSettings).filter_by(key="smtp_host").first()
    port = db.query(SystemSettings).filter_by(key="smtp_port").first()
    user = db.query(SystemSettings).filter_by(key="smtp_user").first()
    password = db.query(SystemSettings).filter_by(key="smtp_password").first()
    
    return {
        "host": host.value if host else "",
        "port": int(port.value) if port else 587,
        "user": user.value if user else "",
        "password": password.value if password else ""
    }

@router.put("/smtp")
async def update_smtp_settings(
    config: SmtpConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """(Admin) Met à jour la configuration SMTP globale"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Réservé aux administrateurs")
        
    def _upsert(key: str, value: str):
        setting = db.query(SystemSettings).filter_by(key=key).first()
        if setting:
            setting.value = value
        else:
            db.add(SystemSettings(key=key, value=value))
            
    _upsert("smtp_host", config.host)
    _upsert("smtp_port", str(config.port))
    _upsert("smtp_user", config.user)
    _upsert("smtp_password", config.password)
    
    db.commit()
    return {"message": "Configuration SMTP mise à jour avec succès"}

class ApiKeysConfig(BaseModel):
    gemini_api_key: str
    groq_api_key: str

@router.get("/apikeys")
async def get_apikeys_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """(Admin) Récupère la configuration des clés API"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Réservé aux administrateurs")
        
    gemini = db.query(SystemSettings).filter_by(key="gemini_api_key").first()
    groq = db.query(SystemSettings).filter_by(key="groq_api_key").first()
    import os
    
    return {
        "gemini_api_key": gemini.value if gemini else os.getenv("GEMINI_API_KEY", ""),
        "groq_api_key": groq.value if groq else os.getenv("GROQ_API_KEY", "")
    }

@router.put("/apikeys")
async def update_apikeys_settings(
    config: ApiKeysConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """(Admin) Met à jour la configuration des clés API"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Réservé aux administrateurs")
        
    def _upsert(key: str, value: str):
        setting = db.query(SystemSettings).filter_by(key=key).first()
        if setting:
            setting.value = value
        else:
            db.add(SystemSettings(key=key, value=value))
            
    # Ne met a jour que si la valeur n'est pas "********"
    if config.gemini_api_key and config.gemini_api_key != "********":
        _upsert("gemini_api_key", config.gemini_api_key)
    if config.groq_api_key and config.groq_api_key != "********":
        _upsert("groq_api_key", config.groq_api_key)
    
    db.commit()
    return {"message": "Configuration des clés API mise à jour avec succès"}

