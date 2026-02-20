from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.database import get_db
from app.config import settings
from app.auth import create_access_token, get_password_hash, get_user_by_email, get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "user"
    module_faisabilite: bool = True
    module_crm: bool = False
    module_travaux: bool = False
    module_sav: bool = False
    module_conges: bool = False
    module_communication: bool = False
    manager_id: Optional[str] = None
    solde_conges: float = 25.0

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    module_faisabilite: Optional[bool] = None
    module_crm: Optional[bool] = None
    module_travaux: Optional[bool] = None
    module_sav: Optional[bool] = None
    module_conges: Optional[bool] = None
    module_communication: Optional[bool] = None
    manager_id: Optional[str] = None
    solde_conges: Optional[float] = None

def authenticate_user_db(db: Session, email: str, password: str):
    from app.auth import get_user_by_email, verify_password
    user = get_user_by_email(db, email)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

@router.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user_db(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "modules": {
                "faisabilite": user.module_faisabilite,
                "crm": user.module_crm,
                "travaux": user.module_travaux,
                "sav": user.module_sav,
                "conges": user.module_conges,
                "communication": user.module_communication
            },
            "manager_id": user.manager_id,
            "solde_conges": user.solde_conges
        }
    }

@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    # Simple check if any user exists so the first user created is an admin automatically without needing login
    # In production, this route should be protected except for the first hit
    is_first_user = db.query(User).count() == 0
    
    db_user = get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà enregistré")
    
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email, 
        hashed_password=hashed_password,
        full_name=user.full_name,
        role="admin" if is_first_user else user.role,
        module_faisabilite=user.module_faisabilite,
        module_crm=user.module_crm,
        module_travaux=user.module_travaux,
        module_sav=user.module_sav,
        module_conges=user.module_conges,
        module_communication=user.module_communication,
        manager_id=user.manager_id,
        solde_conges=user.solde_conges
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {
        "id": db_user.id,
        "email": db_user.email,
        "full_name": db_user.full_name,
        "role": db_user.role,
        "modules": {
            "faisabilite": db_user.module_faisabilite,
            "crm": db_user.module_crm,
            "travaux": db_user.module_travaux,
            "sav": db_user.module_sav,
            "conges": db_user.module_conges,
            "communication": db_user.module_communication
        },
        "manager_id": db_user.manager_id,
        "solde_conges": db_user.solde_conges
    }

@router.get("/users/me")
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "modules": {
            "faisabilite": current_user.module_faisabilite,
            "crm": current_user.module_crm,
            "travaux": current_user.module_travaux,
            "sav": current_user.module_sav,
            "conges": current_user.module_conges,
            "communication": current_user.module_communication
        },
        "manager_id": current_user.manager_id,
        "solde_conges": current_user.solde_conges
    }

@router.get("/users")
async def get_all_users(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé. Réservé aux administrateurs.")
    
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
            "modules": {
                "faisabilite": u.module_faisabilite,
                "crm": u.module_crm,
                "travaux": u.module_travaux,
                "sav": u.module_sav,
                "conges": u.module_conges
            },
            "manager_id": u.manager_id,
            "solde_conges": u.solde_conges
        } for u in users
    ]

@router.put("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé.")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        
    update_data = payload.dict(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = get_password_hash(update_data["password"])
        del update_data["password"]
    elif "password" in update_data:
        del update_data["password"]
        
    for key, value in update_data.items():
        setattr(user, key, value)
        
    db.commit()
    db.refresh(user)
    return {"message": "Utilisateur mis à jour avec succès"}

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé.")
        
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte.")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        
    db.delete(user)
    db.commit()
    return {"message": "Utilisateur supprimé"}
