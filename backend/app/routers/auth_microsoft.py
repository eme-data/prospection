from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import timedelta
from jose import jwt, JWTError
import httpx

from app.database import get_db
from app.config import settings
from app.auth import create_access_token, get_user_by_email
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

class MicrosoftToken(BaseModel):
    access_token: str


@router.post("/microsoft")
async def login_with_microsoft(token_data: MicrosoftToken, db: Session = Depends(get_db)):
    if not settings.msal_client_id or not settings.msal_tenant_id:
        raise HTTPException(status_code=501, detail="L'authentification Microsoft n'est pas configurée.")

    try:
        # L'idToken a déjà été validé par la librairie MSAL côté frontend.
        # On le décode pour extraire les informations de l'utilisateur.
        payload = jwt.decode(
            token_data.access_token,
            key="",
            options={"verify_signature": False, "verify_aud": False, "verify_exp": True}
        )

        email = payload.get("preferred_username") or payload.get("email") or payload.get("upn")
        if not email:
            raise HTTPException(status_code=400, detail="L'email n'a pas pu être extrait du profil Microsoft.")

        name = payload.get("name") or email.split("@")[0]

        # Vérifier si l'utilisateur existe dans la DB
        user = get_user_by_email(db, email)
        
        # S'il n'existe pas, auto-provisionning
        if not user:
            # Vérifier si c'est le premier utilisateur (devient admin)
            is_first_user = db.query(User).count() == 0
            
            user = User(
                email=email, 
                hashed_password="SSO_MICROSOFT_NO_LOCAL_PASSWORD",
                full_name=name,
                role="admin" if is_first_user else "user",
                module_faisabilite=True,
                module_commerce=False,
                module_sav=False,
                module_conges=False,
                module_communication=False,
                solde_conges=25.0
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # Générer notre propre JWT local
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token, 
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "modules": {
                    "faisabilite": user.module_faisabilite,
                    "commerce": user.module_commerce,
                    "sav": user.module_sav,
                    "conges": user.module_conges,
                    "communication": user.module_communication
                },
                "manager_id": str(user.manager_id) if user.manager_id else None,
                "solde_conges": user.solde_conges
            }
        }
        
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token invalide: {str(e)}")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur d'authentification Microsoft: {str(e)}")
