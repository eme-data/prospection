"""
Routes API pour l'analyse de devis par IA
Priorité : Claude (Anthropic) → Ollama (local, optionnel)
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List
import os
import base64
import tempfile
import json
import asyncio
from app.auth import get_current_active_user
from app.models.user import User
from app.models.settings import SystemSettings
from app.database import get_db
from sqlalchemy.orm import Session
import anthropic

router = APIRouter(prefix="/commerce/analyse-devis", tags=["commerce"])


def _get_api_key(db: Session, db_key: str, env_key: str) -> str | None:
    setting = db.query(SystemSettings).filter_by(key=db_key).first()
    if setting and setting.value:
        return setting.value
    return os.environ.get(env_key)


PROMPT_ANALYSE = """Tu es un expert en analyse de devis de CONSTRUCTION (BTP). Analyse et compare ces {n} devis joints.

Extrais TOUTES les informations disponibles dans chaque document. Si une information est absente du document, utilise null.

Fournis une analyse COMPLÈTE au format JSON suivant EXACTEMENT:

{{
  "resume_executif": "Résumé global de la comparaison des devis en 3-4 phrases",
  "devis": [
    {{
      "id": 1,
      "nom_fournisseur": "Raison sociale complète de l'entreprise",
      "siret": "Numéro SIRET (14 chiffres) si présent, sinon null",
      "adresse": "Adresse complète de l'entreprise si présente",
      "telephone": "Numéro de téléphone si présent",
      "email": "Email si présent",
      "assurance_decennale": {{
        "assureur": "Nom de la compagnie d'assurance si présent, sinon null",
        "numero_police": "Numéro de police si présent, sinon null",
        "validite": "Période de validité ou année si présente, sinon null"
      }},
      "prix_total_ht": "Montant HT en € (ex: 12 500,00 €)",
      "prix_total_ttc": "Montant TTC en € (ex: 15 000,00 €)",
      "tva": "Taux de TVA applicable (ex: 10%, 20%)",
      "delais_execution": "Délai d'exécution des travaux",
      "conditions_paiement": "Conditions de paiement (acompte, échéances) si mentionnées",
      "validite_offre": "Durée de validité du devis si mentionnée",
      "postes_travaux": [
        {{
          "numero": "Numéro du poste ou lot si présent",
          "corps_etat": "Corps d'état (ex: Maçonnerie, Électricité, Plomberie)",
          "description": "Description détaillée de la prestation",
          "unite": "Unité de mesure (m², ml, u, h, forfait…)",
          "quantite": "Quantité (valeur numérique)",
          "prix_unitaire_ht": "Prix unitaire HT en € si disponible",
          "prix_total_ht": "Prix total HT du poste en €"
        }}
      ]
    }}
  ],
  "comparaison": {{
    "moins_disant": "ID du devis avec le prix le plus bas",
    "mieux_disant": "ID du devis avec le meilleur rapport qualité/prix global",
    "ecart_prix": "Écart en € et % entre le moins cher et le plus cher",
    "alertes_conformite": [
      "Alerte si SIRET manquant",
      "Alerte si assurance décennale absente ou non mentionnée",
      "Autres anomalies légales ou contractuelles"
    ],
    "points_attention_communs": ["Points à négocier ou vérifier communs aux devis"],
    "tableau_comparatif": [
      {{
        "poste": "Corps d'état ou catégorie",
        "devis_1": "Prix devis 1 ou null",
        "devis_2": "Prix devis 2 ou null"
      }}
    ]
  }},
  "recommandation": {{
    "devis_recommande": "ID du devis recommandé",
    "score_qualite": {{
      "devis_1": "Note /10 avec commentaire",
      "devis_2": "Note /10 avec commentaire"
    }},
    "justification": "Justification détaillée de la recommandation (prix, délai, conformité, postes manquants)"
  }}
}}

RÈGLES ABSOLUES pour le JSON :
- Commence DIRECTEMENT par {{ sans aucun texte avant
- Termine DIRECTEMENT par }} sans aucun texte après
- Utilise UNIQUEMENT des guillemets doubles " (jamais de guillemets simples)
- Échappe les guillemets dans les valeurs texte : \"
- Pas de virgule après le dernier élément d'un tableau ou objet
- Pas de commentaires dans le JSON
- null pour toute valeur absente du document
"""


def _parse_json_response(text: str) -> dict:
    # Nettoyer les balises markdown
    text = text.replace('```json', '').replace('```', '').strip()
    if text.startswith('json'):
        text = text[4:].strip()

    # Tentative 1 : JSON standard
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Tentative 2 : json-repair (guillemets manquants, virgules en trop, JSON tronqué…)
    try:
        from json_repair import repair_json
        repaired = repair_json(text, return_objects=True)
        if isinstance(repaired, dict) and repaired:
            print(f"DEBUG: JSON repaired by json-repair (original length={len(text)})")
            return repaired
    except Exception:
        pass

    # Tentative 3 : extraire le premier objet JSON complet par accolades
    try:
        start = text.index('{')
        depth = 0
        for i, ch in enumerate(text[start:], start):
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return json.loads(text[start:i + 1])
    except Exception:
        pass

    raise ValueError(f"Impossible de parser la réponse JSON (longueur={len(text)})")


@router.post("/")
async def analyze_quotes(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Analyse 1 à N devis (PDF/Images) avec Claude Sonnet.
    Fallback Ollama local si Claude n'est pas disponible.
    """
    if len(files) < 1:
        raise HTTPException(status_code=400, detail="Au moins un fichier est requis.")
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 fichiers autorisés.")

    prompt = PROMPT_ANALYSE.format(n=len(files))

    temp_files = []
    file_infos = []  # (temp_path, ext, mime_type, original_filename)

    try:
        for file in files:
            ext = os.path.splitext(file.filename)[1].lower()
            fd, temp_path = tempfile.mkstemp(suffix=ext)
            content = await file.read()
            with os.fdopen(fd, 'wb') as f:
                f.write(content)

            mime_type = file.content_type or "application/octet-stream"
            if mime_type == "application/octet-stream":
                if ext == ".pdf":
                    mime_type = "application/pdf"
                elif ext in [".jpg", ".jpeg"]:
                    mime_type = "image/jpeg"
                elif ext == ".png":
                    mime_type = "image/png"

            temp_files.append(temp_path)
            file_infos.append((temp_path, ext, mime_type, file.filename))

        provider_errors = []

        # ── 1. Claude (Anthropic) ─────────────────────────────────────────────
        anthropic_key = _get_api_key(db, "anthropic_api_key", "ANTHROPIC_API_KEY")
        if anthropic_key:
            try:
                print("DEBUG: Attempting analysis with Claude Sonnet...")
                content_parts = []

                for temp_path, ext, mime_type, filename in file_infos:
                    with open(temp_path, "rb") as f:
                        file_data = base64.standard_b64encode(f.read()).decode("utf-8")

                    if ext == ".pdf":
                        content_parts.append({
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": file_data,
                            },
                        })
                    elif mime_type.startswith("image/"):
                        content_parts.append({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": mime_type,
                                "data": file_data,
                            },
                        })

                content_parts.append({"type": "text", "text": prompt})

                claude_client = anthropic.Anthropic(api_key=anthropic_key)
                message = await asyncio.to_thread(
                    claude_client.messages.create,
                    model="claude-sonnet-4-6",
                    max_tokens=8192,
                    messages=[{"role": "user", "content": content_parts}],
                )
                analysis_data = _parse_json_response(message.content[0].text)
                return {
                    "success": True,
                    "analysis": analysis_data,
                    "files_analyzed": [f.filename for f in files],
                    "model_used": "Claude Sonnet (Anthropic)",
                }

            except Exception as e:
                err_msg = f"Claude: {type(e).__name__}: {e}"
                print(f"DEBUG: {err_msg}")
                provider_errors.append(err_msg)
        else:
            provider_errors.append("Claude: clé API ANTHROPIC_API_KEY non configurée")

        # ── 2. Ollama (local) — fallback optionnel ────────────────────────────
        try:
            print("DEBUG: Attempting analysis with local Ollama (llama3.2)...")
            import httpx

            ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434")
            if not ollama_url.startswith("http"):
                ollama_url = f"http://{ollama_url}"

            text_prompt = prompt + "\nNote: Analyse les données issues des fichiers transmis."

            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{ollama_url}/api/generate",
                    json={
                        "model": "llama3.2:3b",
                        "prompt": text_prompt,
                        "stream": False,
                        "format": "json",
                    },
                )
                resp.raise_for_status()
                result = resp.json()
                analysis_data = json.loads(result.get("response", "{}"))
                return {
                    "success": True,
                    "analysis": analysis_data,
                    "files_analyzed": [f.filename for f in files],
                    "model_used": "Ollama (Local llama3.2)",
                }

        except Exception as ollama_err:
            provider_errors.append(f"Ollama: {type(ollama_err).__name__}: {ollama_err}")
            print(f"DEBUG: Ollama fallback failed: {ollama_err}")

        # Aucun provider n'a réussi
        errors_detail = " | ".join(provider_errors)
        raise HTTPException(
            status_code=500,
            detail=f"Analyse impossible. Détail : {errors_detail}",
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Global error during analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        for temp_path in temp_files:
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except Exception:
                pass
