import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import getattr, get_db
from app.auth import get_current_active_user
from app.models.user import User
from app.models.communication import Post, SocialAccount
from pydantic import BaseModel
from datetime import datetime
import os
import google.generativeai as genai
from groq import Groq

# Initialize router
router = APIRouter(prefix="/communication", tags=["Communication"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------
class GenerateRequest(BaseModel):
    topic: str
    platform: str
    ai_model: str
    tone: str = "professional"
    length: str = "medium"
    include_hashtags: bool = True
    include_emojis: bool = False

class PostResponse(BaseModel):
    id: int
    platform: str
    ai_model: str
    topic: str
    content: str
    tone: str
    length: str
    include_hashtags: bool
    include_emojis: bool
    published_to_linkedin: bool
    published_to_facebook: bool
    published_to_instagram: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class HistoryResponse(BaseModel):
    success: bool
    posts: List[PostResponse]
    pagination: Dict[str, Any]


# ---------------------------------------------------------
# AI Generation Setup (Gemini & Groq)
# ---------------------------------------------------------

def build_prompt(params: GenerateRequest) -> str:
    length_guide = {
        "short": "100-150 mots",
        "medium": "150-250 mots",
        "long": "250-400 mots"
    }

    tone_guide = {
        "professional": "un ton professionnel et formel",
        "casual": "un ton décontracté et amical",
        "enthusiastic": "un ton enthousiaste et énergique",
        "informative": "un ton informatif et éducatif"
    }

    platform_guide = {
        "linkedin": "LinkedIn (réseau professionnel)",
        "facebook": "Facebook (réseau social grand public)",
        "instagram": "Instagram (réseau visuel et lifestyle)"
    }

    prompt = f"Génère un post engageant pour {platform_guide.get(params.platform, 'réseaux sociaux')} sur le sujet suivant : \"{params.topic}\".\n\n"
    prompt += f"Instructions :\n"
    prompt += f"- Utilise {tone_guide.get(params.tone, 'un ton neutre')}\n"
    prompt += f"- Longueur cible : {length_guide.get(params.length, '150 mots')}\n"
    has_hashtags = "Inclus des hashtags pertinents à la fin" if params.include_hashtags else "N'inclus pas de hashtags"
    has_emojis = "Utilise quelques emojis" if params.include_emojis else "N'utilise pas d'emojis"
    prompt += f"- {has_hashtags}\n"
    prompt += f"- {has_emojis}\n"

    if params.platform == 'linkedin':
        prompt += f"- Adopte un style adapté au monde professionnel\n"
        prompt += f"- Mets en avant la valeur ajoutée et les insights\n"
    elif params.platform == 'instagram':
        prompt += f"- Adopte un style visuel et accrocheur\n"
        prompt += f"- Utilise des sauts de ligne pour aérer le texte\n"
        prompt += f"- Invite à l'interaction (Call to Action)\n"
        prompt += f"- Le texte doit accompagner une image (référence l'image implicitement si besoin)\n"
    else:
        prompt += f"- Adopte un style convivial et accessible\n"
        prompt += f"- Favorise l'engagement et les interactions\n"

    prompt += f"\nGénère uniquement le contenu du post, sans introduction ni métadonnées ni balises markdown superflues."
    return prompt


# ---------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------

@router.post("/generate")
async def generate_post(
    request: GenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        if request.platform not in ["linkedin", "facebook", "instagram"]:
            raise HTTPException(status_code=400, detail="Plateforme invalide")
        if request.ai_model not in ["gemini", "groq"]:
            raise HTTPException(status_code=400, detail="Modèle IA invalide")

        prompt = build_prompt(request)
        content = ""

        if request.ai_model == "gemini":
            from app.models.settings import SystemSettings
            gemini_setting = db.query(SystemSettings).filter_by(key="gemini_api_key").first()
            api_key = gemini_setting.value if gemini_setting and gemini_setting.value else os.getenv("GEMINI_API_KEY")
            
            if not api_key:
                raise HTTPException(status_code=500, detail="Clé API Gemini non configurée")
            
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-2.5-flash')
            response = model.generate_content(prompt)
            content = response.text

        elif request.ai_model == "groq":
            from app.models.settings import SystemSettings
            groq_setting = db.query(SystemSettings).filter_by(key="groq_api_key").first()
            api_key = groq_setting.value if groq_setting and groq_setting.value else os.getenv("GROQ_API_KEY")

            if not api_key:
                raise HTTPException(status_code=500, detail="Clé API Groq non configurée")
                
            groq_client = Groq(api_key=api_key)
            chat_completion = groq_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
                temperature=0.7,
                max_tokens=1024,
            )
            content = chat_completion.choices[0].message.content

        # Save to database
        db_post = Post(
            user_id=current_user.id,
            platform=request.platform,
            ai_model=request.ai_model,
            topic=request.topic,
            content=content,
            tone=request.tone,
            length=request.length,
            include_hashtags=request.include_hashtags,
            include_emojis=request.include_emojis
        )
        db.add(db_post)
        db.commit()
        db.refresh(db_post)

        return {
            "success": True,
            "post": {
                "id": db_post.id,
                "content": db_post.content,
                "platform": db_post.platform,
                "aiModel": db_post.ai_model,
                "topic": db_post.topic
            }
        }

    except Exception as e:
        logger.error(f"Erreur lors de la génération: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la génération: {str(e)}")


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        posts = db.query(Post).filter(Post.user_id == current_user.id).order_by(Post.created_at.desc()).offset(offset).limit(limit).all()
        total = db.query(Post).filter(Post.user_id == current_user.id).count()

        return {
            "success": True,
            "posts": posts,
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset
            }
        }
    except Exception as e:
        logger.error(f"Erreur récupération historique: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération de l'historique")


@router.delete("/history/{post_id}")
async def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        post = db.query(Post).filter(Post.id == post_id, Post.user_id == current_user.id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post non trouvé")

        db.delete(post)
        db.commit()
        return {"success": True, "message": "Post supprimé avec succès"}
    except Exception as e:
        db.rollback()
        logger.error(f"Erreur suppression: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur serveur")


@router.get("/accounts")
async def get_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        accounts = db.query(SocialAccount).filter(SocialAccount.user_id == current_user.id).all()
        # Ensure we don't leak access tokens to the frontend
        safe_accounts = [
            {
                "id": acc.id,
                "platform": acc.platform,
                "expiresAt": acc.expires_at.isoformat() if acc.expires_at else None,
                "isValid": acc.expires_at > datetime.now() if acc.expires_at else True
            }
            for acc in accounts
        ]
        return {
            "success": True,
            "accounts": safe_accounts
        }
    except Exception as e:
        logger.error(f"Erreur récupération comptes sociaux: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération des comptes")


@router.post("/publish/{platform}")
async def publish_post(
    platform: str,
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        post = db.query(Post).filter(Post.id == post_id, Post.user_id == current_user.id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post non trouvé")

        account = db.query(SocialAccount).filter(
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == platform
        ).first()

        if not account:
            raise HTTPException(status_code=400, detail=f"Compte {platform} non connecté")

        if account.expires_at and account.expires_at <= datetime.now():
            raise HTTPException(status_code=400, detail=f"Token {platform} expiré. Veuillez vous reconnecter.")

        # ==========================================
        # TODO: Implement actual API calls to social platforms here
        # (LinkedIn UGC Posts API, Facebook Graph API, Instagram Graph API)
        # using the account.access_token and post.content
        # ==========================================
        
        # Simulated success for now since OAuth integration isn't fully set up yet
        url = f"https://www.{platform}.com/post/simulated-{post.id}"

        if platform == "linkedin":
            post.published_to_linkedin = True
            post.linkedin_post_url = url
        elif platform == "facebook":
            post.published_to_facebook = True
            post.facebook_post_url = url
        elif platform == "instagram":
            post.published_to_instagram = True
            post.instagram_post_url = url

        db.commit()

        return {
            "success": True,
            "message": f"Post publié sur {platform} avec succès",
            "url": url
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la publication sur {platform}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la publication: {str(e)}")
