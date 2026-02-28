"""
Endpoint de vérification proxy pour l'authentification unifiée Open WebUI.

Nginx utilise auth_request pour valider le JWT (cookie prospection_token)
et injecter les headers X-User-Email / X-User-Name vers Open WebUI.
"""

from fastapi import APIRouter, Request, Response, HTTPException, status, Depends
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.auth import get_user_by_email

router = APIRouter(tags=["secondary-brain"])


@router.get("/api/auth/verify-proxy")
async def verify_proxy(request: Request, db: Session = Depends(get_db)):
    """Valide le JWT depuis le cookie et retourne l'email/nom en headers.

    Utilisé par Nginx auth_request pour le proxy Open WebUI.
    """
    token = request.cookies.get("prospection_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        email: str = payload.get("sub")
        if not email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    user = get_user_by_email(db, email=email)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    response = Response(status_code=200)
    response.headers["X-User-Email"] = user.email
    response.headers["X-User-Name"] = user.full_name or user.email.split("@")[0]
    return response
