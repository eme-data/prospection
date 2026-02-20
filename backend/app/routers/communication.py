from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import os
import logging
import google.generativeai as genai
from groq import Groq
from typing import Optional
from app.routers.auth import get_current_active_user, User
import re

router = APIRouter()
logger = logging.getLogger(__name__)

class LogoRequest(BaseModel):
    prompt: str
    provider: str = "auto"

class LogoResponse(BaseModel):
    content: list[dict]
    model: str
    provider: str
    fallbackUsed: Optional[bool] = False

# Function to clean SVG
def clean_svg_code(code: str) -> str:
    # Remove markdown code blocks if present
    code = re.sub(r'```(?:svg|xml)?\n?', '', code)
    code = re.sub(r'```\n?', '', code)

    # Extract SVG if there's text before/after
    svg_match = re.search(r'<svg[\s\S]*<\/svg>', code, re.IGNORECASE)
    if svg_match:
        code = svg_match.group(0)

    # Trim whitespace
    code = code.strip()

    # Validate it starts with <svg
    if not code.lower().startswith('<svg'):
        raise Exception("Le code généré n'est pas un SVG valide")

    return code

@router.post("/logo", response_model=LogoResponse)
async def generate_logo(request: LogoRequest, current_user: User = Depends(get_current_active_user)):
    """
    Génère un logo au format SVG en utilisant Gemini ou Groq.
    Protégé par authentification et par la permission module_communication.
    """
    # Vérification des droits
    if not current_user.module_communication:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les utilisateurs avec la permission Module Communication peuvent accéder à ce service."
        )

    prompt = request.prompt
    provider = request.provider

    if not prompt or len(prompt) > 5000:
        raise HTTPException(status_code=400, detail="Le prompt est requis et doit faire moins de 5000 caractères")

    gemini_key = os.getenv("GEMINI_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")

    async def call_gemini() -> LogoResponse:
        if not gemini_key or gemini_key == 'votre-cle-gemini-ici':
            raise Exception("Clé API Gemini non configurée dans le .env")
        
        logger.info("Calling Gemini API...")
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        text = response.text
        
        valid_svg = clean_svg_code(text)
        logger.info("Logo generated with Gemini")
        
        return LogoResponse(
            content=[{"type": "text", "text": valid_svg}],
            model="gemini-1.5-flash",
            provider="gemini"
        )
        
    async def call_groq() -> LogoResponse:
        if not groq_key or groq_key == 'your-groq-api-key-here':
            raise Exception("Clé API Groq non configurée dans le .env")
            
        logger.info("Calling Groq API...")
        client = Groq(api_key=groq_key)
        completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=8000
        )
        
        text = completion.choices[0].message.content
        if not text:
            raise Exception("Réponse vide de Groq")
            
        valid_svg = clean_svg_code(text)
        logger.info("Logo generated with Groq")
        
        return LogoResponse(
            content=[{"type": "text", "text": valid_svg}],
            model="llama-3.3-70b-versatile",
            provider="groq"
        )

    try:
        if provider == "gemini":
            return await call_gemini()
        elif provider == "groq":
            return await call_groq()
        else:
            # Auto fallback mode
            try:
                return await call_gemini()
            except Exception as e:
                logger.warning(f"Gemini failed: {str(e)}. Falling back to Groq.")
                try:
                    result = await call_groq()
                    result.fallbackUsed = True
                    return result
                except Exception as e2:
                    logger.error(f"Groq fallback also failed: {str(e2)}")
                    raise Exception("Les deux IA ont échoué à générer le logo. Réessayez.")
                    
    except Exception as e:
        logger.error(f"Error generating logo: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
