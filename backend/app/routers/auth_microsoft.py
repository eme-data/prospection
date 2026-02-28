from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import timedelta
import httpx
import logging

from app.database import get_db
from app.config import settings
from app.auth import create_access_token, get_user_by_email
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


class MicrosoftToken(BaseModel):
    access_token: str


@router.post("/microsoft")
async def login_with_microsoft(token_data: MicrosoftToken, db: Session = Depends(get_db)):
    if not settings.msal_client_id or not settings.msal_tenant_id:
        raise HTTPException(status_code=501, detail="L'authentification Microsoft n'est pas configurée.")

    try:
        # Valider le token en appelant Microsoft Graph API
        # C'est la méthode recommandée : le token est vérifié par Microsoft lui-même
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {token_data.access_token}"},
            )

        if response.status_code != 200:
            logger.warning("Microsoft Graph rejected token: %s", response.status_code)
            raise HTTPException(status_code=401, detail="Token Microsoft invalide ou expiré.")

        profile = response.json()
        email = (
            profile.get("mail")
            or profile.get("userPrincipalName")
        )
        if not email:
            raise HTTPException(status_code=400, detail="L'email n'a pas pu être extrait du profil Microsoft.")

        name = profile.get("displayName") or email.split("@")[0]

        # Vérifier si l'utilisateur existe dans la DB
        user = get_user_by_email(db, email)

        # S'il n'existe pas, auto-provisionning
        if not user:
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

    except httpx.HTTPError as e:
        logger.error("Microsoft Graph API unreachable: %s", e)
        raise HTTPException(status_code=502, detail="Impossible de contacter Microsoft pour valider le token.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Microsoft auth error: %s", e)
        raise HTTPException(status_code=500, detail="Erreur d'authentification Microsoft.")
