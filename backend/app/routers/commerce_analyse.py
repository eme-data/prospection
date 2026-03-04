"""
Routes API pour l'analyse de devis par IA
Priorité : Claude (Anthropic) → Ollama (local, optionnel)
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
import os
import base64
import tempfile
import json
import asyncio
import logging
from app.auth import get_current_active_user
from app.models.user import User

logger = logging.getLogger(__name__)
from app.models.settings import SystemSettings
from app.models.analyse_devis import DevisAnalyse
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

IMPORTANT : Il y a exactement {n} documents/devis distincts. Tu DOIS créer {n} entrées dans le tableau "devis", une par document.
Extrais TOUTES les lignes de chaque devis dans postes_travaux, sans exception.

Fournis l'analyse au format JSON suivant EXACTEMENT :

{{
  "resume_executif": "Résumé de 2-3 phrases comparant les devis",
  "devis": [
    {{
      "id": 1,
      "nom_fournisseur": "Raison sociale",
      "siret": "SIRET ou null",
      "adresse": "Adresse ou null",
      "telephone": "Tel ou null",
      "email": "Email ou null",
      "assurance_decennale": {{
        "assureur": "Nom ou null",
        "numero_police": "N° ou null",
        "validite": "Validité ou null"
      }},
      "prix_total_ht": 123456.78,
      "prix_total_ttc": 148148.14,
      "tva": "20%",
      "delais_execution": "Délai ou null",
      "conditions_paiement": "Conditions ou null",
      "validite_offre": "Validité ou null",
      "postes_travaux": [
        {{
          "numero": "1",
          "corps_etat": "Corps d'état",
          "description": "Description courte",
          "unite": "m²",
          "quantite": 100,
          "prix_unitaire_ht": 45.00,
          "prix_total_ht": 4500.00
        }}
      ]
    }}
  ],
  "comparaison": {{
    "moins_disant": 1,
    "mieux_disant": 1,
    "ecart_prix": "Écart en € et %",
    "alertes_conformite": ["Alerte 1"],
    "points_attention_communs": ["Point 1"]
  }},
  "recommandation": {{
    "devis_recommande": 1,
    "justification": "Justification en 2-3 phrases"
  }},
  "comparaison_postes": [
    {{
      "libelle": "Nom du corps d'état / lot",
      "corps_etat": "Corps d'état",
      "par_devis": [{{"id": 1, "qte": null, "pu": null, "total": 45000.00}}, {{"id": 2, "qte": null, "pu": null, "total": 42000.00}}],
      "best_qte_id": null,
      "best_pu_id": null,
      "target_ht": 42000.00,
      "ecart_qte": null,
      "ecart_pu": null,
      "negocier": true,
      "motif": "Raison courte ou null"
    }}
  ],
  "prix_cible_ht": 250000.00,
  "verification_totaux": [
    {{
      "devis_id": 1,
      "nom_fournisseur": "Raison sociale",
      "total_declare_ht": 260000.00,
      "somme_postes_ht": 259800.00,
      "ecart": 200.00,
      "concordance": true
    }}
  ]
}}

RÈGLES ABSOLUES :
- Commence DIRECTEMENT par {{ — aucun texte avant ni après le JSON
- Guillemets doubles uniquement, pas de commentaires
- null pour toute valeur absente
- TOUS les montants en NOMBRES (pas de chaînes) : 45000.00 et non "45 000,00 €"
- postes_travaux : TOUTES les lignes de chaque devis, sans exception
- comparaison_postes : regrouper par CORPS D'ÉTAT / LOT (un par entrée), PAS ligne par ligne. Le total par_devis = somme HT de ce lot pour ce devis. Trier par total décroissant. negocier=true si écart >5%
- corps_etat : normaliser les noms identiquement entre tous les devis
- verification_totaux : somme de tous les postes_travaux.prix_total_ht vs prix_total_ht déclaré. concordance=true si écart < 1%
- PRIORITÉ : d'abord les {n} devis complets, puis comparaison_postes, puis verification_totaux
"""


PROMPT_NEGOCIATION = """Tu es un expert en NÉGOCIATION de prix pour des marchés de travaux BTP.
On te fournit le résultat structuré d'une analyse comparative de {n} devis de prestataires.
L'utilisateur a sélectionné le prestataire n°{selected_id} ({selected_name}) et souhaite négocier avec lui.

Voici l'analyse comparative complète (JSON) :
{analysis_json}

À partir de ces données, produis une étude de négociation détaillée au format JSON EXACTEMENT comme suit :

{{
  "prestataire_selectionne": {{
    "id": {selected_id},
    "nom": "{selected_name}",
    "prix_total_ht": "Prix HT actuel du prestataire"
  }},
  "synthese_negociation": "Résumé de 3-4 phrases : potentiel de négociation global, montant d'économie visé, posture recommandée",
  "objectif_prix_ht": "Prix HT cible après négociation",
  "economie_potentielle": {{
    "montant": "Montant en € de l'économie visée",
    "pourcentage": "Pourcentage de réduction visé"
  }},
  "points_negociation": [
    {{
      "priorite": 1,
      "poste": "Libellé du poste ou lot",
      "corps_etat": "Corps d'état",
      "prix_actuel": "Prix HT actuel chez ce prestataire",
      "prix_concurrent": "Meilleur prix concurrent",
      "prix_cible": "Prix cible réaliste (compromis crédible)",
      "ecart_euros": "Économie visée en €",
      "ecart_pourcentage": "Réduction demandée en %",
      "argument": "Argument de levier détaillé (prix concurrent, marché, volume…)",
      "concession_possible": "Ce qu'on peut concéder en échange (délai, paiement, volume…)"
    }}
  ],
  "strategie": {{
    "ordre_priorite": "Par quoi commencer et pourquoi",
    "points_fermes": ["Point non négociable 1", "Point 2"],
    "concessions_acceptables": ["Concession possible 1", "Concession possible 2"],
    "arguments_transversaux": ["Argument applicable à tous les postes"],
    "ton_recommande": "Collaboratif / Ferme mais ouvert / etc."
  }},
  "modele_email": "Objet : Négociation devis — [Projet]\\n\\nMadame, Monsieur,\\n\\nSuite à l'étude comparative de plusieurs offres pour [description], nous souhaitons revenir vers vous concernant votre proposition de [prix HT].\\n\\nNotre analyse fait ressortir les points suivants :\\n- [Point 1 avec chiffres]\\n- [Point 2 avec chiffres]\\n\\nNous restons intéressés par votre prestation et souhaitons trouver un terrain d'entente sur les postes identifiés.\\n\\nNous vous proposons un échange à votre convenance.\\n\\nCordialement,\\n[Signature]"
}}

RÈGLES ABSOLUES :
- Commence DIRECTEMENT par {{ sans aucun texte avant
- Termine DIRECTEMENT par }} sans aucun texte après
- Guillemets doubles uniquement, jamais de guillemets simples
- Pas de virgule après le dernier élément d'un tableau ou objet
- Pas de commentaires dans le JSON
- null pour toute valeur absente
- points_negociation : UNIQUEMENT postes où ce prestataire est plus cher qu'un concurrent, triés par impact financier décroissant, max 10 entrées
- prix_cible : RÉALISTE (compromis crédible, pas simplement le prix du concurrent)
- modele_email : texte professionnel BTP, factuel et concis, les \\n sont des retours à la ligne
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
            logger.debug("JSON repaired by json-repair (original length=%d)", len(text))
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
                logger.info("Attempting analysis with Claude Sonnet")
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

                def _stream_analysis():
                    with claude_client.messages.stream(
                        model="claude-sonnet-4-6",
                        max_tokens=32768,
                        messages=[{"role": "user", "content": content_parts}],
                    ) as stream:
                        return stream.get_final_text()

                raw_text = await asyncio.to_thread(_stream_analysis)
                analysis_data = _parse_json_response(raw_text)
                return {
                    "success": True,
                    "analysis": analysis_data,
                    "files_analyzed": [f.filename for f in files],
                    "model_used": "Claude Sonnet (Anthropic)",
                }

            except Exception as e:
                err_msg = f"Claude: {type(e).__name__}: {e}"
                logger.warning(err_msg)
                provider_errors.append(err_msg)
        else:
            provider_errors.append("Claude: clé API ANTHROPIC_API_KEY non configurée")

        # ── 2. Ollama (local) — fallback optionnel ────────────────────────────
        try:
            logger.info("Attempting analysis with local Ollama (llama3.2)")
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
            logger.warning("Ollama fallback failed: %s", ollama_err)

        # Aucun provider n'a réussi
        errors_detail = " | ".join(provider_errors)
        raise HTTPException(
            status_code=500,
            detail=f"Analyse impossible. Détail : {errors_detail}",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Global error during analysis: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        for temp_path in temp_files:
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except Exception:
                pass


# ── Historique des analyses ───────────────────────────────────────────────────

class SaveAnalyseRequest(BaseModel):
    nom_projet: Optional[str] = None
    fichiers_info: list  # [{name, size_bytes}]
    result_json: dict    # Full AnalysisData object


@router.post("/save")
def save_analyse(
    body: SaveAnalyseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Sauvegarde une analyse en base de données."""
    record = DevisAnalyse(
        user_id=current_user.id,
        nom_projet=body.nom_projet or None,
        fichiers_info=json.dumps(body.fichiers_info, ensure_ascii=False),
        result_json=json.dumps(body.result_json, ensure_ascii=False),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"id": record.id, "created_at": record.created_at}


@router.get("/history")
def list_analyses(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Liste les analyses sauvegardées de l'utilisateur (sans le résultat complet)."""
    total = db.query(DevisAnalyse).filter_by(user_id=current_user.id).count()
    records = (
        db.query(DevisAnalyse)
        .filter_by(user_id=current_user.id)
        .order_by(DevisAnalyse.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    items = []
    for r in records:
        try:
            fichiers = json.loads(r.fichiers_info or "[]")
        except (json.JSONDecodeError, TypeError):
            fichiers = []
        try:
            result = json.loads(r.result_json or "{}")
            nb_devis = len(result.get("devis", []))
        except (json.JSONDecodeError, TypeError):
            nb_devis = 0
        items.append({
            "id": r.id,
            "nom_projet": r.nom_projet,
            "created_at": r.created_at,
            "fichiers_info": fichiers,
            "nb_devis": nb_devis,
        })
    return {"items": items, "total": total}


@router.get("/history/{analyse_id}")
def get_analyse(
    analyse_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Récupère une analyse complète par son ID."""
    record = db.query(DevisAnalyse).filter_by(id=analyse_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Analyse introuvable.")
    if record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès interdit.")
    try:
        result = json.loads(record.result_json)
    except (json.JSONDecodeError, TypeError):
        result = {}
    try:
        fichiers = json.loads(record.fichiers_info or "[]")
    except (json.JSONDecodeError, TypeError):
        fichiers = []
    return {
        "id": record.id,
        "nom_projet": record.nom_projet,
        "created_at": record.created_at,
        "fichiers_info": fichiers,
        "result": result,
    }


@router.delete("/history/{analyse_id}")
def delete_analyse(
    analyse_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Supprime une analyse sauvegardée."""
    record = db.query(DevisAnalyse).filter_by(id=analyse_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Analyse introuvable.")
    if record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès interdit.")
    db.delete(record)
    db.commit()
    return {"success": True}


# ── Étude de négociation ─────────────────────────────────────────────────────

class NegociationRequest(BaseModel):
    analysis_data: dict
    selected_devis_id: int | str


@router.post("/negociation")
async def analyze_negociation(
    body: NegociationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Génère une étude de négociation pour un prestataire sélectionné.
    Utilise les données structurées de l'analyse comparative (pas de re-upload PDF).
    """
    analysis = body.analysis_data
    devis_list = analysis.get("devis", [])

    selected = None
    for d in devis_list:
        if str(d.get("id")) == str(body.selected_devis_id):
            selected = d
            break

    if not selected:
        raise HTTPException(status_code=400, detail="Devis sélectionné introuvable dans les données d'analyse.")

    if len(devis_list) < 2:
        raise HTTPException(status_code=400, detail="Au moins 2 devis sont nécessaires pour une étude de négociation.")

    selected_name = selected.get("nom_fournisseur", "Inconnu")

    prompt = PROMPT_NEGOCIATION.format(
        n=len(devis_list),
        selected_id=body.selected_devis_id,
        selected_name=selected_name,
        analysis_json=json.dumps(analysis, ensure_ascii=False),
    )

    anthropic_key = _get_api_key(db, "anthropic_api_key", "ANTHROPIC_API_KEY")
    if not anthropic_key:
        raise HTTPException(status_code=500, detail="Clé API Anthropic non configurée.")

    try:
        claude_client = anthropic.Anthropic(api_key=anthropic_key)

        def _stream_negociation():
            with claude_client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=8192,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                return stream.get_final_text()

        raw_text = await asyncio.to_thread(_stream_negociation)
        negociation_data = _parse_json_response(raw_text)
        return {
            "success": True,
            "negociation": negociation_data,
            "model_used": "Claude Sonnet (Anthropic)",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Negotiation analysis error: %s", e)
        raise HTTPException(status_code=500, detail=f"Erreur analyse négociation : {e}")
