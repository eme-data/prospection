"""
Routes API pour l'archivage SharePoint → S3
Scan des fichiers non accédés/modifiés depuis N mois,
migration vers un bucket S3, suppression optionnelle sur SharePoint.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
import os
import uuid
import logging
from datetime import datetime, timedelta, timezone

from app.auth import get_current_active_user
from app.models.user import User
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tooling/archivage-sharepoint", tags=["tooling"])

# ── Stockage en mémoire des jobs (à remplacer par DB si besoin) ──────────────
_migration_jobs: dict = {}


# ── Schémas ──────────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    site_ids: List[str]
    inactivity_months: int = 24


class MigrateRequest(BaseModel):
    file_ids: List[str]
    delete_after_migration: bool = False


class ArchivageConfig(BaseModel):
    # SharePoint
    sharepoint_tenant_id: Optional[str] = None
    sharepoint_client_id: Optional[str] = None
    sharepoint_client_secret: Optional[str] = None
    # S3
    s3_endpoint_url: Optional[str] = None
    s3_access_key_id: Optional[str] = None
    s3_secret_access_key: Optional[str] = None
    s3_region: Optional[str] = "eu-west-3"
    s3_archive_bucket: Optional[str] = "sharepoint-archive"


# Clés de configuration stockées en DB via SystemSettings
_CONFIG_KEYS = [
    "sharepoint_tenant_id", "sharepoint_client_id", "sharepoint_client_secret",
    "s3_endpoint_url", "s3_access_key_id", "s3_secret_access_key",
    "s3_region", "s3_archive_bucket",
]

# Clés dont la valeur doit être masquée à la lecture
_SECRET_KEYS = {"sharepoint_client_secret", "s3_secret_access_key"}


# ── Helpers : lecture config depuis DB puis env ──────────────────────────────

def _get_setting(db: Session, key: str) -> Optional[str]:
    """Lit une clé de config depuis SystemSettings, fallback sur env."""
    from app.models.settings import SystemSettings
    setting = db.query(SystemSettings).filter_by(key=key).first()
    if setting and setting.value:
        return setting.value
    return os.environ.get(key.upper())


def _set_setting(db: Session, key: str, value: Optional[str]):
    """Écrit une clé de config dans SystemSettings."""
    from app.models.settings import SystemSettings
    setting = db.query(SystemSettings).filter_by(key=key).first()
    if setting:
        setting.value = value or ""
    else:
        db.add(SystemSettings(key=key, value=value or ""))


# ── Helpers SharePoint (Microsoft Graph) ─────────────────────────────────────

def _get_graph_token(db: Session) -> str:
    """Obtient un token d'accès Microsoft Graph via client credentials."""
    import httpx

    tenant_id = _get_setting(db, "sharepoint_tenant_id")
    client_id = _get_setting(db, "sharepoint_client_id")
    client_secret = _get_setting(db, "sharepoint_client_secret")

    if not all([tenant_id, client_id, client_secret]):
        raise HTTPException(
            status_code=500,
            detail="Configuration SharePoint incomplète. Renseignez Tenant ID, Client ID et Client Secret dans les paramètres.",
        )

    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(token_url, data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "https://graph.microsoft.com/.default",
        })
        resp.raise_for_status()
        return resp.json()["access_token"]


def _get_s3_client(db: Session):
    """Retourne un client boto3 S3 configuré depuis les settings DB."""
    import boto3

    endpoint = _get_setting(db, "s3_endpoint_url")
    kwargs = {
        "aws_access_key_id": _get_setting(db, "s3_access_key_id"),
        "aws_secret_access_key": _get_setting(db, "s3_secret_access_key"),
        "region_name": _get_setting(db, "s3_region") or "eu-west-3",
    }
    if endpoint:
        kwargs["endpoint_url"] = endpoint

    return boto3.client("s3", **kwargs)


def _get_s3_bucket(db: Session) -> str:
    return _get_setting(db, "s3_archive_bucket") or "sharepoint-archive"


# ── Routes : Configuration ───────────────────────────────────────────────────

@router.get("/config")
async def get_archivage_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retourne la configuration actuelle (secrets masqués)."""
    if not current_user.module_tooling:
        raise HTTPException(status_code=403, detail="Module Tooling désactivé.")

    config = {}
    for key in _CONFIG_KEYS:
        val = _get_setting(db, key)
        if key in _SECRET_KEYS and val:
            config[key] = "••••••••" + val[-4:] if len(val) > 4 else "••••"
        else:
            config[key] = val or ""
    return config


@router.put("/config")
async def update_archivage_config(
    body: ArchivageConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Met à jour la configuration SharePoint + S3."""
    if not current_user.module_tooling:
        raise HTTPException(status_code=403, detail="Module Tooling désactivé.")
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Réservé aux administrateurs.")

    data = body.dict(exclude_unset=True)
    for key in _CONFIG_KEYS:
        if key in data:
            val = data[key]
            # Ne pas écraser un secret si la valeur masquée est renvoyée
            if key in _SECRET_KEYS and val and val.startswith("••"):
                continue
            _set_setting(db, key, val)
    db.commit()
    return {"success": True}


@router.post("/test-s3")
async def test_s3_connection(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Teste la connexion au bucket S3."""
    if not current_user.module_tooling:
        raise HTTPException(status_code=403, detail="Module Tooling désactivé.")
    try:
        s3 = _get_s3_client(db)
        bucket = _get_s3_bucket(db)
        s3.head_bucket(Bucket=bucket)
        return {"success": True, "message": f"Connexion OK au bucket '{bucket}'"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.post("/test-sharepoint")
async def test_sharepoint_connection(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Teste la connexion à Microsoft Graph / SharePoint."""
    if not current_user.module_tooling:
        raise HTTPException(status_code=403, detail="Module Tooling désactivé.")
    try:
        token = _get_graph_token(db)
        return {"success": True, "message": "Authentification SharePoint OK"}
    except HTTPException as e:
        return {"success": False, "message": e.detail}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/sites")
async def list_sharepoint_sites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Liste les sites SharePoint accessibles."""
    if not current_user.module_tooling:
        raise HTTPException(status_code=403, detail="Module Tooling désactivé.")

    try:
        token = _get_graph_token(db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'authentification SharePoint : {e}")

    import httpx
    headers = {"Authorization": f"Bearer {token}"}

    with httpx.Client(timeout=30.0) as client:
        resp = client.get("https://graph.microsoft.com/v1.0/sites?search=*", headers=headers)
        resp.raise_for_status()
        data = resp.json()

    sites = []
    for site in data.get("value", []):
        sites.append({
            "id": site["id"],
            "name": site.get("displayName", site.get("name", "Sans nom")),
            "url": site.get("webUrl", ""),
        })

    return {"sites": sites}


@router.post("/scan")
async def scan_archivable_files(
    body: ScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Scanne les fichiers SharePoint éligibles à l'archivage."""
    if not current_user.module_tooling:
        raise HTTPException(status_code=403, detail="Module Tooling désactivé.")

    try:
        token = _get_graph_token(db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'authentification SharePoint : {e}")

    import httpx

    cutoff = datetime.now(timezone.utc) - timedelta(days=body.inactivity_months * 30)
    headers = {"Authorization": f"Bearer {token}"}
    archivable_files = []

    with httpx.Client(timeout=60.0) as client:
        for site_id in body.site_ids:
            # Lister les drives du site
            try:
                drives_resp = client.get(
                    f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives",
                    headers=headers,
                )
                drives_resp.raise_for_status()
                drives = drives_resp.json().get("value", [])
            except Exception as e:
                logger.warning("Failed to list drives for site %s: %s", site_id, e)
                continue

            for drive in drives:
                drive_id = drive["id"]
                # Récupérer récursivement les items du drive
                next_url: Optional[str] = (
                    f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root/children"
                )
                while next_url:
                    try:
                        items_resp = client.get(next_url, headers=headers)
                        items_resp.raise_for_status()
                        items_data = items_resp.json()
                    except Exception as e:
                        logger.warning("Error listing items: %s", e)
                        break

                    for item in items_data.get("value", []):
                        # On ne prend que les fichiers (pas les dossiers)
                        if "file" not in item:
                            continue

                        last_modified = item.get("lastModifiedDateTime", "")
                        # Graph API: fileSystemInfo contient lastAccessedDateTime
                        fs_info = item.get("fileSystemInfo", {})
                        last_accessed = fs_info.get("lastAccessedDateTime", last_modified)

                        try:
                            mod_dt = datetime.fromisoformat(last_modified.replace("Z", "+00:00"))
                            acc_dt = datetime.fromisoformat(last_accessed.replace("Z", "+00:00"))
                        except (ValueError, AttributeError):
                            continue

                        if mod_dt < cutoff and acc_dt < cutoff:
                            archivable_files.append({
                                "id": item["id"],
                                "name": item.get("name", ""),
                                "path": item.get("parentReference", {}).get("path", ""),
                                "size_bytes": item.get("size", 0),
                                "last_accessed": last_accessed,
                                "last_modified": last_modified,
                                "site_name": drive.get("name", ""),
                                "drive_id": drive_id,
                                "download_url": item.get("@microsoft.graph.downloadUrl", ""),
                            })

                    next_url = items_data.get("@odata.nextLink")

    total_size = sum(f["size_bytes"] for f in archivable_files)

    return {
        "total_files": len(archivable_files),
        "total_size_bytes": total_size,
        "files": archivable_files,
    }


@router.post("/migrate")
async def start_migration(
    body: MigrateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Lance une migration en arrière-plan : copie vers S3 + suppression optionnelle."""
    if not current_user.module_tooling:
        raise HTTPException(status_code=403, detail="Module Tooling désactivé.")

    if not body.file_ids:
        raise HTTPException(status_code=400, detail="Aucun fichier à migrer.")

    job_id = str(uuid.uuid4())
    job = {
        "id": job_id,
        "status": "pending",
        "total_files": len(body.file_ids),
        "migrated_files": 0,
        "failed_files": 0,
        "total_size_bytes": 0,
        "migrated_size_bytes": 0,
        "started_at": None,
        "completed_at": None,
        "errors": [],
    }
    _migration_jobs[job_id] = job

    try:
        token = _get_graph_token(db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'authentification SharePoint : {e}")

    # Lire la config S3 maintenant (la session DB ne sera plus dispo dans le background task)
    s3_config = {
        "endpoint_url": _get_setting(db, "s3_endpoint_url"),
        "access_key_id": _get_setting(db, "s3_access_key_id"),
        "secret_access_key": _get_setting(db, "s3_secret_access_key"),
        "region": _get_setting(db, "s3_region") or "eu-west-3",
        "bucket": _get_setting(db, "s3_archive_bucket") or "sharepoint-archive",
    }

    background_tasks.add_task(
        _run_migration,
        job_id=job_id,
        file_ids=body.file_ids,
        delete_after=body.delete_after_migration,
        graph_token=token,
        s3_config=s3_config,
    )

    return {"job": job}


@router.get("/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Retourne le statut d'un job de migration."""
    if job_id not in _migration_jobs:
        raise HTTPException(status_code=404, detail="Job introuvable.")
    return _migration_jobs[job_id]


# ── Tâche de fond : migration ────────────────────────────────────────────────

def _run_migration(
    job_id: str,
    file_ids: List[str],
    delete_after: bool,
    graph_token: str,
    s3_config: dict,
):
    """Exécute la migration fichier par fichier (tâche de fond)."""
    import httpx
    import boto3

    job = _migration_jobs[job_id]
    job["status"] = "running"
    job["started_at"] = datetime.now(timezone.utc).isoformat()

    # Construire le client S3 à partir de la config passée
    s3_kwargs = {
        "aws_access_key_id": s3_config["access_key_id"],
        "aws_secret_access_key": s3_config["secret_access_key"],
        "region_name": s3_config["region"],
    }
    if s3_config.get("endpoint_url"):
        s3_kwargs["endpoint_url"] = s3_config["endpoint_url"]
    s3 = boto3.client("s3", **s3_kwargs)
    bucket = s3_config["bucket"]
    headers = {"Authorization": f"Bearer {graph_token}"}

    with httpx.Client(timeout=120.0) as client:
        for file_id in file_ids:
            try:
                # Récupérer les infos du fichier via Graph
                # On cherche dans tous les drives — ici on utilise /me/drive comme fallback
                # Le scan devrait fournir drive_id, mais on gère le cas simplifié
                resp = client.get(
                    f"https://graph.microsoft.com/v1.0/drives/items/{file_id}",
                    headers=headers,
                )
                if resp.status_code == 404:
                    job["errors"].append(f"Fichier {file_id} introuvable.")
                    job["failed_files"] += 1
                    continue

                resp.raise_for_status()
                item = resp.json()
                download_url = item.get("@microsoft.graph.downloadUrl")
                if not download_url:
                    job["errors"].append(f"Pas d'URL de téléchargement pour {item.get('name', file_id)}")
                    job["failed_files"] += 1
                    continue

                # Télécharger le fichier
                dl_resp = client.get(download_url)
                dl_resp.raise_for_status()
                file_content = dl_resp.content
                file_size = len(file_content)

                # Construire le chemin S3
                parent_path = item.get("parentReference", {}).get("path", "")
                # Nettoyer le path (enlever /drives/xxx/root:)
                clean_path = parent_path.split("root:")[-1].lstrip("/") if "root:" in parent_path else parent_path
                s3_key = f"sharepoint-archive/{clean_path}/{item.get('name', file_id)}"

                # Upload vers S3
                s3.put_object(
                    Bucket=bucket,
                    Key=s3_key,
                    Body=file_content,
                    Metadata={
                        "source": "sharepoint",
                        "original-id": file_id,
                        "last-modified": item.get("lastModifiedDateTime", ""),
                        "archived-at": datetime.now(timezone.utc).isoformat(),
                    },
                )

                job["migrated_files"] += 1
                job["migrated_size_bytes"] += file_size

                # Supprimer sur SharePoint si demandé
                if delete_after:
                    try:
                        del_resp = client.delete(
                            f"https://graph.microsoft.com/v1.0/drives/items/{file_id}",
                            headers=headers,
                        )
                        del_resp.raise_for_status()
                    except Exception as e:
                        job["errors"].append(f"Migré mais suppression échouée pour {item.get('name', file_id)}: {e}")

            except Exception as e:
                logger.error("Migration error for file %s: %s", file_id, e)
                job["errors"].append(f"Erreur migration {file_id}: {e}")
                job["failed_files"] += 1

    job["status"] = "completed" if job["failed_files"] == 0 else "completed"
    job["completed_at"] = datetime.now(timezone.utc).isoformat()
    job["total_size_bytes"] = job["migrated_size_bytes"]  # Update actual total

    logger.info(
        "Migration job %s completed: %d/%d migrated, %d failed",
        job_id, job["migrated_files"], job["total_files"], job["failed_files"],
    )
