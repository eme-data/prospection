from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import datetime

from app.database import get_db
from app.models.user import User
from app.models.conges import Conge
from app.auth import get_current_active_user
from app.email_service import send_email

router = APIRouter(prefix="/conges", tags=["conges"])

class CongeCreate(BaseModel):
    date_debut: datetime.date
    date_fin: datetime.date
    type_conge: str
    commentaire: Optional[str] = None

class CongeUpdateStatut(BaseModel):
    statut: str # approuve ou refuse

@router.post("/")
async def create_conge(
    conge_data: CongeCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not current_user.module_conges:
        raise HTTPException(status_code=403, detail="Module Congés désactivé pour ce compte")
        
    jours_demandes = (conge_data.date_fin - conge_data.date_debut).days + 1
    if jours_demandes <= 0:
        raise HTTPException(status_code=400, detail="Dates invalides")
        
    if current_user.solde_conges < jours_demandes and conge_data.type_conge != "Sans Solde":
        raise HTTPException(status_code=400, detail="Solde insuffisant")
        
    nouvel_conge = Conge(
        user_id=current_user.id,
        date_debut=conge_data.date_debut,
        date_fin=conge_data.date_fin,
        type_conge=conge_data.type_conge,
        commentaire=conge_data.commentaire,
        statut="en_attente"
    )
    db.add(nouvel_conge)
    db.commit()
    db.refresh(nouvel_conge)
    
    # Trouver le manager a notifier (Manager ou Admin par défaut)
    manager = None
    if current_user.manager_id:
        manager = db.query(User).filter_by(id=current_user.manager_id).first()
    
    if not manager:
        manager = db.query(User).filter_by(role="admin").first()
        
    if manager:
        sujet = f"Nouvelle demande de congé de {current_user.full_name or current_user.email}"
        html = f"""
        <h3>Demande de congé</h3>
        <p><strong>De :</strong> {current_user.full_name or current_user.email}</p>
        <p><strong>Du :</strong> {conge_data.date_debut} <strong>Au :</strong> {conge_data.date_fin}</p>
        <p><strong>Type :</strong> {conge_data.type_conge}</p>
        <p><strong>Commentaire :</strong> {conge_data.commentaire or 'Aucun'}</p>
        <br/>
        <p>Veuillez vous connecter à la plateforme pour valider ou refuser cette demande.</p>
        """
        background_tasks.add_task(send_email, db, manager.email, sujet, html)
        
    return {"message": "Demande envoyée", "conge": nouvel_conge}

@router.get("/me")
async def get_my_conges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    conges = db.query(Conge).filter_by(user_id=current_user.id).all()
    return {"solde": current_user.solde_conges, "historique": conges}

@router.get("/team")
async def get_team_conges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role == "admin":
        return db.query(Conge).all()
        
    users_under_manager = db.query(User).filter_by(manager_id=current_user.id).all()
    user_ids = [u.id for u in users_under_manager]
    
    if not user_ids:
        return []
        
    return db.query(Conge).filter(Conge.user_id.in_(user_ids)).all()

@router.put("/{conge_id}/statut")
async def update_conge_statut(
    conge_id: str,
    payload: CongeUpdateStatut,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    conge = db.query(Conge).filter_by(id=conge_id).first()
    if not conge:
        raise HTTPException(status_code=404, detail="Congé introuvable")
        
    if conge.statut != "en_attente":
        raise HTTPException(status_code=400, detail="Ce congé a déjà été traité")
        
    # Security: current_user must either be an admin or the manager of the requester
    demandeur = db.query(User).filter_by(id=conge.user_id).first()
    
    is_authorized = False
    if current_user.role == "admin":
        is_authorized = True
    elif demandeur and demandeur.manager_id == current_user.id:
        is_authorized = True
        
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Non autorisé à valider ce congé")
        
    if payload.statut not in ["approuve", "refuse"]:
        raise HTTPException(status_code=400, detail="Statut invalide")
        
    conge.statut = payload.statut
    
    # Débiter le solde si approuvé
    if payload.statut == "approuve":
        jours = (conge.date_fin - conge.date_debut).days + 1
        if demandeur.solde_conges >= jours:
            demandeur.solde_conges -= jours
            
    db.commit()
    
    sujet = f"Votre demande de congé a été {payload.statut}"
    html = f"""
    <h3>Information de la Direction</h3>
    <p>Bonjour {demandeur.full_name or demandeur.email},</p>
    <p>Votre demande de congé (du {conge.date_debut} au {conge.date_fin}) a été <strong>{payload.statut.upper()}</strong>.</p>
    <p>Nouveau solde : {demandeur.solde_conges} jours.</p>
    """
    background_tasks.add_task(send_email, db, demandeur.email, sujet, html)
    
    return {"message": "Statut mis à jour"}
