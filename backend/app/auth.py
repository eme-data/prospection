import time as _time
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm="HS256")
    return encoded_jwt

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Pouvez-vous valider vos informations d'identification ?",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Utilisateur inactif")
    return current_user


# Throttle in-memory : {user_id: last_db_write_epoch}
# Borné à 500 entrées pour éviter les fuites mémoire sur les serveurs long-running
_activity_last_write: OrderedDict[str, float] = OrderedDict()
_ACTIVITY_THROTTLE_SECONDS = 60
_ACTIVITY_MAX_ENTRIES = 500


async def get_current_active_user_with_activity(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> User:
    """Comme get_current_active_user, mais met à jour last_activity_at (throttlé à 1/min)."""
    now_epoch = _time.time()
    last_write = _activity_last_write.get(current_user.id, 0)

    if now_epoch - last_write > _ACTIVITY_THROTTLE_SECONDS:
        current_user.last_activity_at = datetime.now(timezone.utc)
        db.commit()
        _activity_last_write[current_user.id] = now_epoch
        # Élaguer les entrées les plus anciennes si le dict dépasse la limite
        while len(_activity_last_write) > _ACTIVITY_MAX_ENTRIES:
            _activity_last_write.popitem(last=False)

    return current_user
