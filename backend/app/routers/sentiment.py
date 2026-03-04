import logging
import os
import json
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.auth import get_current_active_user
from app.models.user import User
from app.models.sentiment import SentimentAnalysis, SentimentItem

router = APIRouter(prefix="/sentiment", tags=["Sentiment Analysis"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------

class AnalyzeRequest(BaseModel):
    query: str
    sources: List[str] = ["news"]  # news, twitter, manual

class ManualAnalyzeRequest(BaseModel):
    texts: List[str]
    query: str = "Analyse manuelle"

class SentimentItemResponse(BaseModel):
    id: int
    source: str
    title: Optional[str]
    content: str
    url: Optional[str]
    author: Optional[str]
    published_at: Optional[datetime]
    sentiment_score: float
    sentiment_label: str

    class Config:
        from_attributes = True

class SentimentAnalysisResponse(BaseModel):
    id: int
    query: str
    sources: str
    sentiment_score: float
    sentiment_label: str
    total_items: int
    positive_count: int
    negative_count: int
    neutral_count: int
    summary: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class SentimentAnalysisDetailResponse(SentimentAnalysisResponse):
    items: List[SentimentItemResponse]


# ---------------------------------------------------------
# Helpers — Data Collection
# ---------------------------------------------------------

async def collect_news(query: str, api_key: str) -> list[dict]:
    """Collect articles from NewsAPI."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": query,
                    "language": "fr",
                    "sortBy": "relevancy",
                    "pageSize": 20,
                    "apiKey": api_key,
                },
            )
        if response.status_code != 200:
            logger.warning("NewsAPI error: %s", response.text)
            return []

        data = response.json()
        articles = data.get("articles", [])
        return [
            {
                "source": "news",
                "title": a.get("title", ""),
                "content": (a.get("description") or a.get("content") or "")[:500],
                "url": a.get("url"),
                "author": a.get("author"),
                "published_at": a.get("publishedAt"),
            }
            for a in articles
            if a.get("title") and a.get("title") != "[Removed]"
        ]
    except Exception as e:
        logger.error("NewsAPI collection failed: %s", e)
        return []


SOCIAL_SITE_MAP = {
    "linkedin": "site:linkedin.com",
    "instagram": "site:instagram.com",
    "facebook": "site:facebook.com",
}


async def collect_social(query: str, platform: str, api_key: str, cx: str) -> list[dict]:
    """Collect content from a social platform via Google Custom Search API."""
    import httpx

    site_filter = SOCIAL_SITE_MAP.get(platform, "")
    search_query = f"{site_filter} {query}" if site_filter else query

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "https://www.googleapis.com/customsearch/v1",
                params={
                    "key": api_key,
                    "cx": cx,
                    "q": search_query,
                    "num": 10,
                    "lr": "lang_fr",
                },
            )
        if response.status_code != 200:
            logger.warning("Google CSE error for %s: %s", platform, response.text)
            return []

        data = response.json()
        items = data.get("items", [])
        return [
            {
                "source": platform,
                "title": item.get("title", ""),
                "content": (item.get("snippet") or "")[:500],
                "url": item.get("link"),
                "author": None,
                "published_at": None,
            }
            for item in items
            if item.get("snippet")
        ]
    except Exception as e:
        logger.error("Google CSE collection failed for %s: %s", platform, e)
        return []


async def collect_twitter(query: str, bearer_token: str) -> list[dict]:
    """Collect tweets via Twitter API v2 recent search."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "https://api.twitter.com/2/tweets/search/recent",
                params={
                    "query": f"{query} lang:fr -is:retweet",
                    "max_results": 20,
                    "tweet.fields": "created_at,author_id,text",
                },
                headers={"Authorization": f"Bearer {bearer_token}"},
            )
        if response.status_code != 200:
            logger.warning("Twitter API error: %s %s", response.status_code, response.text)
            return []

        data = response.json()
        tweets = data.get("data", [])
        return [
            {
                "source": "twitter",
                "title": None,
                "content": t.get("text", "")[:500],
                "url": f"https://twitter.com/i/web/status/{t['id']}",
                "author": t.get("author_id"),
                "published_at": t.get("created_at"),
            }
            for t in tweets
        ]
    except Exception as e:
        logger.error("Twitter collection failed: %s", e)
        return []


# ---------------------------------------------------------
# Helper — Claude Sentiment Analysis
# ---------------------------------------------------------

def analyze_with_claude(items: list[dict], query: str, api_key: str) -> dict:
    """Send items to Claude for sentiment analysis. Returns scores + summary."""
    import anthropic

    texts_block = ""
    for i, item in enumerate(items[:30]):  # limit to 30 items
        title = item.get("title") or ""
        content = item.get("content") or ""
        texts_block += f"\n--- Item {i+1} (source: {item['source']}) ---\nTitre: {title}\nContenu: {content}\n"

    prompt = f"""Tu es un analyste de sentiment professionnel. Analyse les textes suivants liés à la recherche "{query}".

Pour chaque item, attribue :
- un score de sentiment entre -1.0 (très négatif) et 1.0 (très positif), 0.0 étant neutre
- un label : "positif", "négatif" ou "neutre"

Puis fournis un résumé global de l'analyse de sentiment.

{texts_block}

Réponds UNIQUEMENT en JSON valide avec cette structure exacte :
{{
  "items": [
    {{"index": 0, "score": 0.5, "label": "positif"}},
    ...
  ],
  "global_score": 0.3,
  "global_label": "positif",
  "summary": "Résumé en 2-3 phrases de l'analyse globale."
}}"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text

        # Extract JSON from potential markdown wrapper
        if "```" in raw:
            import re
            match = re.search(r"```(?:json)?\s*\n?([\s\S]*?)```", raw)
            if match:
                raw = match.group(1).strip()

        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            from json_repair import repair_json
            return json.loads(repair_json(raw))

    except Exception as e:
        logger.error("Claude sentiment analysis failed: %s", e)
        return {
            "items": [{"index": i, "score": 0.0, "label": "neutre"} for i in range(len(items))],
            "global_score": 0.0,
            "global_label": "neutre",
            "summary": f"Analyse automatique non disponible : {str(e)}",
        }


# ---------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------

@router.post("/analyze", response_model=SentimentAnalysisDetailResponse)
async def analyze_sentiment(
    request: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Launch a sentiment analysis: collect data from sources, analyze with Claude."""
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Le terme de recherche est requis.")

    valid_sources = {"news", "twitter", "linkedin", "instagram", "facebook"}
    sources = [s for s in request.sources if s in valid_sources]
    if not sources:
        raise HTTPException(status_code=400, detail="Au moins une source valide est requise.")

    # Get API keys
    from app.models.settings import SystemSettings
    claude_setting = db.query(SystemSettings).filter_by(key="anthropic_api_key").first()
    claude_key = claude_setting.value if claude_setting and claude_setting.value else os.getenv("ANTHROPIC_API_KEY")
    if not claude_key:
        raise HTTPException(status_code=500, detail="Clé API Anthropic non configurée.")

    newsapi_key = os.getenv("NEWSAPI_KEY", "")
    twitter_token = os.getenv("TWITTER_BEARER_TOKEN", "")
    google_cse_key = os.getenv("GOOGLE_CSE_API_KEY", "")
    google_cse_cx = os.getenv("GOOGLE_CSE_CX", "")

    # Collect data
    all_items: list[dict] = []
    skipped_sources: list[str] = []

    if "news" in sources:
        if not newsapi_key:
            logger.warning("NEWSAPI_KEY not configured, skipping news source")
            skipped_sources.append("news (NEWSAPI_KEY manquante)")
        else:
            news_items = await collect_news(request.query, newsapi_key)
            all_items.extend(news_items)

    if "twitter" in sources:
        if not twitter_token:
            logger.warning("TWITTER_BEARER_TOKEN not configured, skipping twitter source")
            skipped_sources.append("twitter (TWITTER_BEARER_TOKEN manquante)")
        else:
            twitter_items = await collect_twitter(request.query, twitter_token)
            all_items.extend(twitter_items)

    # Social platforms via Google Custom Search
    social_sources = [s for s in sources if s in ("linkedin", "instagram", "facebook")]
    if social_sources:
        if not google_cse_key or not google_cse_cx:
            for s in social_sources:
                logger.warning("GOOGLE_CSE_API_KEY/CX not configured, skipping %s", s)
                skipped_sources.append(f"{s} (GOOGLE_CSE_API_KEY/CX manquante)")
        else:
            for platform in social_sources:
                social_items = await collect_social(request.query, platform, google_cse_key, google_cse_cx)
                all_items.extend(social_items)

    if not all_items:
        detail = "Aucun résultat trouvé."
        if skipped_sources:
            detail += f" Sources ignorées (clés API manquantes) : {', '.join(skipped_sources)}."
        detail += " Vérifiez vos clés API ou essayez un autre terme."
        raise HTTPException(status_code=404, detail=detail)

    # Analyze with Claude
    analysis_result = analyze_with_claude(all_items, request.query, claude_key)

    # Create DB records
    global_score = analysis_result.get("global_score", 0.0)
    global_label = analysis_result.get("global_label", "neutre")
    summary = analysis_result.get("summary", "")

    item_results = analysis_result.get("items", [])
    positive = sum(1 for r in item_results if r.get("label") == "positif")
    negative = sum(1 for r in item_results if r.get("label") == "négatif")
    neutral = len(item_results) - positive - negative

    db_analysis = SentimentAnalysis(
        user_id=current_user.id,
        query=request.query,
        sources=",".join(sources),
        sentiment_score=global_score,
        sentiment_label=global_label,
        total_items=len(all_items),
        positive_count=positive,
        negative_count=negative,
        neutral_count=neutral,
        summary=summary,
    )
    db.add(db_analysis)
    db.flush()

    db_items = []
    for i, raw_item in enumerate(all_items):
        result = item_results[i] if i < len(item_results) else {"score": 0.0, "label": "neutre"}
        pub_at = None
        if raw_item.get("published_at"):
            try:
                pub_at = datetime.fromisoformat(raw_item["published_at"].replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pass

        db_item = SentimentItem(
            analysis_id=db_analysis.id,
            source=raw_item["source"],
            title=raw_item.get("title"),
            content=raw_item["content"],
            url=raw_item.get("url"),
            author=raw_item.get("author"),
            published_at=pub_at,
            sentiment_score=result.get("score", 0.0),
            sentiment_label=result.get("label", "neutre"),
        )
        db.add(db_item)
        db_items.append(db_item)

    db.commit()
    db.refresh(db_analysis)

    return db_analysis


@router.post("/analyze/manual", response_model=SentimentAnalysisDetailResponse)
async def analyze_manual(
    request: ManualAnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Analyze manually pasted texts."""
    if not request.texts:
        raise HTTPException(status_code=400, detail="Au moins un texte est requis.")

    from app.models.settings import SystemSettings
    claude_setting = db.query(SystemSettings).filter_by(key="anthropic_api_key").first()
    claude_key = claude_setting.value if claude_setting and claude_setting.value else os.getenv("ANTHROPIC_API_KEY")
    if not claude_key:
        raise HTTPException(status_code=500, detail="Clé API Anthropic non configurée.")

    all_items = [
        {"source": "manual", "title": None, "content": text[:500], "url": None, "author": None, "published_at": None}
        for text in request.texts
        if text.strip()
    ]

    if not all_items:
        raise HTTPException(status_code=400, detail="Aucun texte valide fourni.")

    analysis_result = analyze_with_claude(all_items, request.query, claude_key)

    global_score = analysis_result.get("global_score", 0.0)
    global_label = analysis_result.get("global_label", "neutre")
    summary = analysis_result.get("summary", "")
    item_results = analysis_result.get("items", [])
    positive = sum(1 for r in item_results if r.get("label") == "positif")
    negative = sum(1 for r in item_results if r.get("label") == "négatif")
    neutral = len(item_results) - positive - negative

    db_analysis = SentimentAnalysis(
        user_id=current_user.id,
        query=request.query,
        sources="manual",
        sentiment_score=global_score,
        sentiment_label=global_label,
        total_items=len(all_items),
        positive_count=positive,
        negative_count=negative,
        neutral_count=neutral,
        summary=summary,
    )
    db.add(db_analysis)
    db.flush()

    for i, raw_item in enumerate(all_items):
        result = item_results[i] if i < len(item_results) else {"score": 0.0, "label": "neutre"}
        db.add(SentimentItem(
            analysis_id=db_analysis.id,
            source="manual",
            title=None,
            content=raw_item["content"],
            url=None,
            author=None,
            published_at=None,
            sentiment_score=result.get("score", 0.0),
            sentiment_label=result.get("label", "neutre"),
        ))

    db.commit()
    db.refresh(db_analysis)

    return db_analysis


@router.get("/analyses", response_model=List[SentimentAnalysisResponse])
async def list_analyses(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List user's sentiment analyses (paginated)."""
    analyses = (
        db.query(SentimentAnalysis)
        .filter(SentimentAnalysis.user_id == current_user.id)
        .order_by(SentimentAnalysis.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return analyses


@router.get("/analyses/{analysis_id}", response_model=SentimentAnalysisDetailResponse)
async def get_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get detailed analysis with all items."""
    analysis = (
        db.query(SentimentAnalysis)
        .filter(SentimentAnalysis.id == analysis_id, SentimentAnalysis.user_id == current_user.id)
        .first()
    )
    if not analysis:
        raise HTTPException(status_code=404, detail="Analyse non trouvée.")
    return analysis


@router.delete("/analyses/{analysis_id}")
async def delete_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete an analysis and its items."""
    analysis = (
        db.query(SentimentAnalysis)
        .filter(SentimentAnalysis.id == analysis_id, SentimentAnalysis.user_id == current_user.id)
        .first()
    )
    if not analysis:
        raise HTTPException(status_code=404, detail="Analyse non trouvée.")

    db.delete(analysis)
    db.commit()
    return {"success": True, "message": "Analyse supprimée avec succès."}
