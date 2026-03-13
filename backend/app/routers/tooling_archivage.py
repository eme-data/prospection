"""
Routes API pour l'archivage SharePoint → S3
Scan des fichiers non accédés/modifiés depuis N jours,
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

# ── Stockage des jobs via Redis (partagé entre workers Gunicorn) ──────────────
import json as _json

def _get_redis():
    """Retourne le client Redis, None si indisponible."""
    from app.cache import get_redis_client
    return get_redis_client()

_SCAN_PREFIX = "archivage:scan:"
_MIGRATION_PREFIX = "archivage:migration:"
_JOB_TTL = 86400  # 24h

def _save_job(prefix: str, job_id: str, job: dict):
    r = _get_redis()
    if r:
        r.setex(f"{prefix}{job_id}", _JOB_TTL, _json.dumps(job, default=str))

def _load_job(prefix: str, job_id: str) -> dict | None:
    r = _get_redis()
    if r:
        data = r.get(f"{prefix}{job_id}")
        if data:
            return _json.loads(data)
    return None


# ── Schémas ──────────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    site_ids: List[str]
    inactivity_days: int = 730


class DuplicateScanRequest(BaseModel):
    site_ids: List[str]


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
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Lance un scan en arrière-plan des fichiers SharePoint éligibles."""
    if not current_user.module_tooling:
        raise HTTPException(status_code=403, detail="Module Tooling désactivé.")

    try:
        token = _get_graph_token(db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'authentification SharePoint : {e}")

    scan_id = str(uuid.uuid4())
    scan_job = {
        "id": scan_id,
        "status": "running",
        "folders_explored": 0,
        "files_analyzed": 0,
        "eligible_files": 0,
        "eligible_size_bytes": 0,
        "current_folder": "",
        "files": [],
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "error": None,
    }
    _save_job(_SCAN_PREFIX, scan_id, scan_job)

    background_tasks.add_task(
        _run_scan,
        scan_id=scan_id,
        site_ids=body.site_ids,
        inactivity_days=body.inactivity_days,
        graph_token=token,
    )

    return {"scan_id": scan_id, "status": "running"}


@router.get("/scan-jobs/{scan_id}")
async def get_scan_status(
    scan_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Retourne le statut d'un scan en cours."""
    job = _load_job(_SCAN_PREFIX, scan_id)
    if not job:
        raise HTTPException(status_code=404, detail="Scan introuvable.")
    return job


@router.post("/scan-jobs/{scan_id}/cancel")
async def cancel_scan(
    scan_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Arrête un scan en cours. Les fichiers déjà trouvés restent disponibles."""
    job = _load_job(_SCAN_PREFIX, scan_id)
    if not job:
        raise HTTPException(status_code=404, detail="Scan introuvable.")
    if job["status"] != "running":
        raise HTTPException(status_code=400, detail="Le scan n'est pas en cours.")
    # Utiliser une clé Redis dédiée pour le signal d'annulation
    r = _get_redis()
    if r:
        r.setex(f"{_SCAN_PREFIX}{scan_id}:cancel", 3600, "1")
    return {"success": True, "message": "Arrêt demandé"}


def _is_scan_cancelled(scan_id: str) -> bool:
    """Vérifie si l'annulation a été demandée via Redis."""
    r = _get_redis()
    if r:
        return r.get(f"{_SCAN_PREFIX}{scan_id}:cancel") is not None
    return False


# ── Scan doublons ────────────────────────────────────────────────────────────

_DUPLICATES_PREFIX = "archivage:duplicates:"


@router.post("/scan-duplicates")
async def scan_duplicates(
    body: DuplicateScanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Lance un scan de doublons en arrière-plan sur les sites SharePoint sélectionnés."""
    if not current_user.module_tooling:
        raise HTTPException(status_code=403, detail="Module Tooling désactivé.")

    try:
        token = _get_graph_token(db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'authentification SharePoint : {e}")

    scan_id = str(uuid.uuid4())
    scan_job = {
        "id": scan_id,
        "status": "running",
        "folders_explored": 0,
        "files_analyzed": 0,
        "duplicate_groups": 0,
        "duplicate_files": 0,
        "duplicate_size_bytes": 0,
        "current_folder": "",
        "groups": [],  # List of duplicate groups
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "error": None,
    }
    _save_job(_DUPLICATES_PREFIX, scan_id, scan_job)

    background_tasks.add_task(
        _run_duplicate_scan,
        scan_id=scan_id,
        site_ids=body.site_ids,
        graph_token=token,
    )

    return {"scan_id": scan_id}


@router.get("/duplicate-jobs/{scan_id}")
async def get_duplicate_scan_status(
    scan_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Retourne le statut d'un scan de doublons."""
    job = _load_job(_DUPLICATES_PREFIX, scan_id)
    if not job:
        raise HTTPException(status_code=404, detail="Scan introuvable.")
    return job


@router.post("/duplicate-jobs/{scan_id}/cancel")
async def cancel_duplicate_scan(
    scan_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Arrête un scan de doublons en cours."""
    job = _load_job(_DUPLICATES_PREFIX, scan_id)
    if not job:
        raise HTTPException(status_code=404, detail="Scan introuvable.")
    if job["status"] != "running":
        raise HTTPException(status_code=400, detail="Le scan n'est pas en cours.")
    r = _get_redis()
    if r:
        r.setex(f"{_DUPLICATES_PREFIX}{scan_id}:cancel", 3600, "1")
    return {"success": True, "message": "Arrêt demandé"}


def _is_dup_scan_cancelled(scan_id: str) -> bool:
    r = _get_redis()
    if r:
        return r.get(f"{_DUPLICATES_PREFIX}{scan_id}:cancel") is not None
    return False


def _run_duplicate_scan(
    scan_id: str,
    site_ids: List[str],
    graph_token: str,
):
    """Scanne tous les fichiers SharePoint et identifie les doublons par signature de contenu (hash)."""
    import httpx
    from collections import defaultdict

    job = _load_job(_DUPLICATES_PREFIX, scan_id) or {}
    headers = {"Authorization": f"Bearer {graph_token}"}
    # Dictionnaire : clé = hash de contenu → liste de fichiers
    file_index: dict[str, list] = defaultdict(list)
    save_counter = [0]

    def _persist():
        _save_job(_DUPLICATES_PREFIX, scan_id, job)

    try:
        with httpx.Client(timeout=60.0) as client:
            for site_id in site_ids:
                try:
                    drives_resp = client.get(
                        f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives",
                        headers=headers,
                    )
                    drives_resp.raise_for_status()
                    drives = drives_resp.json().get("value", [])
                except Exception as e:
                    logger.warning("Duplicates scan: failed to list drives for site %s: %s", site_id, e)
                    continue

                for drive in drives:
                    drive_id = drive["id"]
                    drive_name = drive.get("name", "")
                    urls_to_explore = [
                        (f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root/children", drive_name)
                    ]

                    while urls_to_explore:
                        if _is_dup_scan_cancelled(scan_id):
                            job["status"] = "cancelled"
                            job["completed_at"] = datetime.now(timezone.utc).isoformat()
                            job["current_folder"] = ""
                            # Calculer les groupes avant de quitter
                            _finalize_duplicate_groups(job, file_index)
                            _persist()
                            return

                        explore_url, folder_name = urls_to_explore.pop()
                        job["current_folder"] = folder_name
                        job["folders_explored"] += 1

                        next_url: Optional[str] = explore_url
                        while next_url:
                            try:
                                items_resp = client.get(next_url, headers=headers)
                                items_resp.raise_for_status()
                                items_data = items_resp.json()
                            except Exception as e:
                                logger.warning("Duplicates scan: error listing items: %s", e)
                                break

                            for item in items_data.get("value", []):
                                if "folder" in item:
                                    folder_children_url = (
                                        f"https://graph.microsoft.com/v1.0/drives/{drive_id}"
                                        f"/items/{item['id']}/children"
                                    )
                                    urls_to_explore.append((folder_children_url, item.get("name", "")))
                                    continue

                                if "file" not in item:
                                    continue

                                job["files_analyzed"] += 1
                                file_name = item.get("name", "")
                                file_size = item.get("size", 0)
                                parent_path = item.get("parentReference", {}).get("path", "")
                                clean_path = parent_path.split("root:")[-1].lstrip("/") if "root:" in parent_path else parent_path

                                # Récupérer le hash de contenu (quickXorHash ou sha256Hash)
                                file_hashes = item.get("file", {}).get("hashes", {})
                                content_hash = (
                                    file_hashes.get("quickXorHash")
                                    or file_hashes.get("sha256Hash")
                                    or file_hashes.get("sha1Hash")
                                )
                                if not content_hash:
                                    # Pas de hash disponible — ignorer ce fichier
                                    continue

                                file_entry = {
                                    "id": item["id"],
                                    "name": file_name,
                                    "path": clean_path,
                                    "size_bytes": file_size,
                                    "last_modified": item.get("lastModifiedDateTime", ""),
                                    "site_name": drive_name,
                                    "drive_id": drive_id,
                                    "web_url": item.get("webUrl", ""),
                                    "hash": content_hash,
                                }
                                file_index[content_hash].append(file_entry)

                            next_url = items_data.get("@odata.nextLink")

                        save_counter[0] += 1
                        if save_counter[0] % 5 == 0:
                            # Mettre à jour les compteurs de doublons en temps réel
                            dup_count = sum(1 for v in file_index.values() if len(v) > 1)
                            dup_files = sum(len(v) for v in file_index.values() if len(v) > 1)
                            job["duplicate_groups"] = dup_count
                            job["duplicate_files"] = dup_files
                            _persist()

        job["status"] = "completed"
    except Exception as e:
        logger.error("Duplicate scan job %s failed: %s", scan_id, e)
        job["status"] = "failed"
        job["error"] = str(e)
    finally:
        job["completed_at"] = datetime.now(timezone.utc).isoformat()
        job["current_folder"] = ""
        _finalize_duplicate_groups(job, file_index)
        _persist()


def _finalize_duplicate_groups(job: dict, file_index: dict):
    """Construit la liste des groupes de doublons à partir de l'index par hash."""
    groups = []
    total_dup_size = 0
    for content_hash, files in file_index.items():
        if len(files) > 1:
            # Utiliser le nom du premier fichier comme nom du groupe
            # (les fichiers identiques peuvent avoir des noms différents)
            size = files[0]["size_bytes"]
            # Construire un label : si tous ont le même nom, l'utiliser, sinon lister les noms uniques
            unique_names = list(dict.fromkeys(f["name"] for f in files))
            group_name = unique_names[0] if len(unique_names) == 1 else " / ".join(unique_names[:3])
            if len(unique_names) > 3:
                group_name += f" (+{len(unique_names) - 3})"

            wasted = (len(files) - 1) * size
            total_dup_size += wasted
            groups.append({
                "name": group_name,
                "hash": content_hash,
                "size_bytes": size,
                "count": len(files),
                "wasted_bytes": wasted,
                "files": files,
            })
    # Trier par espace gaspillé décroissant
    groups.sort(key=lambda g: g["wasted_bytes"], reverse=True)
    job["groups"] = groups
    job["duplicate_groups"] = len(groups)
    job["duplicate_files"] = sum(g["count"] for g in groups)
    job["duplicate_size_bytes"] = total_dup_size


# ── Scan archivage ───────────────────────────────────────────────────────────

def _run_scan(
    scan_id: str,
    site_ids: List[str],
    inactivity_days: int,
    graph_token: str,
):
    """Exécute le scan récursif SharePoint (tâche de fond)."""
    import httpx

    job = _load_job(_SCAN_PREFIX, scan_id) or {}
    cutoff = datetime.now(timezone.utc) - timedelta(days=inactivity_days)
    headers = {"Authorization": f"Bearer {graph_token}"}
    # Compteur pour sauvegarder périodiquement dans Redis
    save_counter = [0]

    def _persist():
        """Sauvegarde l'état courant dans Redis."""
        _save_job(_SCAN_PREFIX, scan_id, job)

    try:
        with httpx.Client(timeout=60.0) as client:
            for site_id in site_ids:
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
                    drive_name = drive.get("name", "")
                    urls_to_explore = [
                        (f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root/children", drive_name)
                    ]

                    while urls_to_explore:
                        # Vérifier si l'arrêt a été demandé via Redis
                        if _is_scan_cancelled(scan_id):
                            job["status"] = "cancelled"
                            job["completed_at"] = datetime.now(timezone.utc).isoformat()
                            job["current_folder"] = ""
                            _persist()
                            return

                        explore_url, folder_name = urls_to_explore.pop()
                        job["current_folder"] = folder_name
                        job["folders_explored"] += 1

                        next_url: Optional[str] = explore_url
                        while next_url:
                            try:
                                items_resp = client.get(next_url, headers=headers)
                                items_resp.raise_for_status()
                                items_data = items_resp.json()
                            except Exception as e:
                                logger.warning("Error listing items: %s", e)
                                break

                            for item in items_data.get("value", []):
                                if "folder" in item:
                                    folder_children_url = (
                                        f"https://graph.microsoft.com/v1.0/drives/{drive_id}"
                                        f"/items/{item['id']}/children"
                                    )
                                    urls_to_explore.append((folder_children_url, item.get("name", "")))
                                    continue

                                if "file" not in item:
                                    continue

                                job["files_analyzed"] += 1

                                last_modified = item.get("lastModifiedDateTime", "")
                                fs_info = item.get("fileSystemInfo", {})
                                last_accessed = fs_info.get("lastAccessedDateTime", last_modified)

                                try:
                                    mod_dt = datetime.fromisoformat(last_modified.replace("Z", "+00:00"))
                                    acc_dt = datetime.fromisoformat(last_accessed.replace("Z", "+00:00"))
                                except (ValueError, AttributeError):
                                    continue

                                if mod_dt < cutoff and acc_dt < cutoff:
                                    file_size = item.get("size", 0)
                                    job["files"].append({
                                        "id": item["id"],
                                        "name": item.get("name", ""),
                                        "path": item.get("parentReference", {}).get("path", ""),
                                        "size_bytes": file_size,
                                        "last_accessed": last_accessed,
                                        "last_modified": last_modified,
                                        "site_name": drive_name,
                                        "drive_id": drive_id,
                                        "download_url": item.get("@microsoft.graph.downloadUrl", ""),
                                    })
                                    job["eligible_files"] += 1
                                    job["eligible_size_bytes"] += file_size

                            next_url = items_data.get("@odata.nextLink")

                        # Sauvegarder dans Redis tous les 5 dossiers
                        save_counter[0] += 1
                        if save_counter[0] % 5 == 0:
                            _persist()

        job["status"] = "completed"
    except Exception as e:
        logger.error("Scan job %s failed: %s", scan_id, e)
        job["status"] = "failed"
        job["error"] = str(e)
    finally:
        job["completed_at"] = datetime.now(timezone.utc).isoformat()
        job["current_folder"] = ""
        _persist()


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
    _save_job(_MIGRATION_PREFIX, job_id, job)

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
    job = _load_job(_MIGRATION_PREFIX, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job introuvable.")
    return job


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

    job = _load_job(_MIGRATION_PREFIX, job_id) or {}
    job["status"] = "running"
    job["started_at"] = datetime.now(timezone.utc).isoformat()
    _save_job(_MIGRATION_PREFIX, job_id, job)

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
                _save_job(_MIGRATION_PREFIX, job_id, job)

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
    _save_job(_MIGRATION_PREFIX, job_id, job)

    logger.info(
        "Migration job %s completed: %d/%d migrated, %d failed",
        job_id, job["migrated_files"], job["total_files"], job["failed_files"],
    )
