"""
Routes API pour l'analyse de devis par IA (Gemini 1.5 Flash)
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List
import os
import tempfile
import json
import asyncio
from app.auth import get_current_active_user
from app.models.user import User
from app.models.settings import SystemSettings
from app.database import get_db
from sqlalchemy.orm import Session
import google.generativeai as genai

router = APIRouter(prefix="/commerce/analyse-devis", tags=["commerce"])

def get_gemini_api_key(db: Session):
    setting = db.query(SystemSettings).filter_by(key="gemini_api_key").first()
    if setting and setting.value:
        return setting.value
    # Fallback to environment variable
    return os.environ.get("GEMINI_API_KEY")

@router.post("/")
async def analyze_quotes(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Analyse 1 à N devis (PDF/Images) avec Gemini 1.5 Flash utilisant la File API.
    """
    if len(files) < 1:
        raise HTTPException(status_code=400, detail="Au moins un fichier est requis.")
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 fichiers autorisés.")
        
    api_key = get_gemini_api_key(db)
    if not api_key:
        raise HTTPException(status_code=500, detail="Clé API Gemini non configurée dans l'administration.")
        
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('models/gemini-1.5-flash')
    
    uploaded_gemini_files = []
    temp_files = []
    
    try:
        # Save uploaded files to temp directory and upload to Gemini
        for file in files:
            # Create a temporary file with the original extension
            ext = os.path.splitext(file.filename)[1]
            fd, temp_path = tempfile.mkstemp(suffix=ext)
            
            with os.fdopen(fd, 'wb') as f:
                content = await file.read()
                f.write(content)
            
            temp_files.append(temp_path)
            
            # Upload to Gemini File API
            # determine mime type
            mime_type = file.content_type
            if not mime_type or mime_type == "application/octet-stream":
                if ext.lower() == ".pdf":
                    mime_type = "application/pdf"
                elif ext.lower() in [".jpg", ".jpeg"]:
                    mime_type = "image/jpeg"
                elif ext.lower() == ".png":
                    mime_type = "image/png"
                    
            gemini_file = genai.upload_file(path=temp_path, mime_type=mime_type, display_name=file.filename)
            uploaded_gemini_files.append(gemini_file)
            
        # Create prompt content list
        prompt_parts = []
        
        prompt = f"""Tu es un expert en analyse de devis de CONSTRUCTION (BTP). Analyse et compare ces {len(files)} devis joints.

Fournis une analyse COMPLÈTE au format JSON suivant EXACTEMENT:

{{
  "resume_executif": "Résumé global de la comparaison des devis",
  "devis": [
    {{
      "id": 1,
      "nom_fournisseur": "Nom de l'entreprise",
      "siret": "SIRET si mentionné",
      "prix_total_ht": "Montant HT en €",
      "prix_total_ttc": "Montant TTC en €",
      "tva": "Taux de TVA",
      "delais_execution": "Délais",
      "postes_travaux": [
        {{
          "corps_etat": "Type de corps d'état",
          "description": "Description",
          "quantite": "Quantité",
          "prix_total": "Prix en €"
        }}
      ]
    }}
  ],
  "comparaison": {{
    "meilleur_rapport_qualite_prix": "ID du devis",
    "alertes_conformite": ["Alerte 1"],
    "points_attention_communs": ["Point 1"]
  }},
  "recommandation": {{
    "devis_recommande": "ID du devis recommandé",
    "justification": "Justification d'expert"
  }}
}}

Fournis UNIQUEMENT le JSON, sans bloquages markdown ```json.
"""
        prompt_parts.append(prompt)
        prompt_parts.extend(uploaded_gemini_files)
        
        # Try different model names as fallbacks with full resource names
        # Most reliable models first
        models_to_try = [
            'models/gemini-1.5-flash', 
            'models/gemini-1.5-flash-latest',
            'models/gemini-1.5-flash-8b',
            'models/gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-2.0-flash'
        ]
        last_error = None
        
        for model_name in models_to_try:
            try:
                print(f"DEBUG: Attempting analysis with model: {model_name}")
                model = genai.GenerativeModel(model_name)
                
                # Call Gemini
                response = await asyncio.to_thread(model.generate_content, prompt_parts)
                text = response.text
                
                if not text:
                    raise ValueError("Empty response from Gemini")
                    
                # If we reach here, it worked!
                # Parse output - handle multiple common markdown formats
                text = text.replace('```json', '').replace('```', '').strip()
                if text.startswith('json'):
                    text = text[4:].strip()
                    
                analysis_data = json.loads(text)
                
                print(f"SUCCESS: Analysis completed with model {model_name}")
                return {
                    "success": True,
                    "analysis": analysis_data,
                    "files_analyzed": [f.filename for f in files],
                    "model_used": model_name
                }
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                print(f"DEBUG: Error with model {model_name}: {e}")
                
                # Only fallback if the model itself is not found or not supported
                # If it's a quota (429) or auth (403) error, stop and report it
                if "not found" in err_str or "not supported" in err_str or "unsupported model" in err_str or "404" in err_str:
                    continue
                else:
                    break
                
        # If all models failed or we hit a non-retryable error
        error_msg = f"Erreur Analyse Gemini : {last_error}"
        if "429" in str(last_error):
            error_msg = "Quota API dépassé (429). Veuillez patienter une minute ou vérifier votre plan sur Google AI Studio."
            
        print(f"ERROR: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)
        
    except Exception as e:
        print(f"Global error during Gemini Analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Clean up temporary files
        for temp_path in temp_files:
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except Exception:
                pass
                
        # Clean up Gemini Files in background
        for gemini_file in uploaded_gemini_files:
            try:
                genai.delete_file(gemini_file.name)
            except Exception:
                pass
