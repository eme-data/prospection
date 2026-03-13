import React, { useState, useEffect, useCallback } from 'react';
import {
    Archive, Play, RefreshCw, Loader2, CheckCircle2, AlertCircle,
    FolderOpen, FileText, HardDrive, Search, Trash2, Square,
    Filter, ChevronDown, ChevronUp, Info,
    Settings, Save, Plug, Eye, EyeOff, Copy,
} from 'lucide-react';
import { fetchJSON } from '../../../api';

// ── Types ────────────────────────────────────────────────────────────────────

interface SharePointSite {
    id: string;
    name: string;
    url: string;
    selected: boolean;
}

interface ArchivableFile {
    id: string;
    drive_id: string;
    name: string;
    path: string;
    size_bytes: number;
    last_accessed: string;
    last_modified: string;
    site_name: string;
    selected: boolean;
}

interface ScanResult {
    total_files: number;
    total_size_bytes: number;
    files: ArchivableFile[];
}

interface ScanJob {
    id: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    folders_explored: number;
    files_analyzed: number;
    eligible_files: number;
    eligible_size_bytes: number;
    current_folder: string;
    files: ArchivableFile[];
    started_at: string | null;
    completed_at: string | null;
    error: string | null;
}

interface MigrationJob {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    total_files: number;
    migrated_files: number;
    failed_files: number;
    deleted_files: number;
    total_size_bytes: number;
    migrated_size_bytes: number;
    current_file: string;
    delete_after: boolean;
    started_at: string | null;
    completed_at: string | null;
    errors: string[];
}

interface DuplicateFile {
    id: string;
    name: string;
    path: string;
    size_bytes: number;
    last_modified: string;
    site_name: string;
    drive_id: string;
    web_url: string;
    hash: string;
}

interface DuplicateGroup {
    name: string;
    hash: string;
    size_bytes: number;
    count: number;
    wasted_bytes: number;
    files: DuplicateFile[];
}

interface DuplicateScanJob {
    id: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    folders_explored: number;
    files_analyzed: number;
    duplicate_groups: number;
    duplicate_files: number;
    duplicate_size_bytes: number;
    current_folder: string;
    groups: DuplicateGroup[];
    started_at: string | null;
    completed_at: string | null;
    error: string | null;
}

type ScanMode = 'archivage' | 'doublons';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 o';
    const k = 1024;
    const sizes = ['o', 'Ko', 'Mo', 'Go', 'To'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
}

function daysSince(iso: string): number {
    return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

// ── Composant principal ──────────────────────────────────────────────────────

const SCAN_ID_KEY = 'archivage_scan_id';
const SCAN_RESULT_KEY = 'archivage_scan_result';
const DUP_SCAN_ID_KEY = 'archivage_dup_scan_id';
const DUP_RESULT_KEY = 'archivage_dup_result';

export const ArchivageSharepoint: React.FC = () => {
    // Mode
    const [scanMode, setScanMode] = useState<ScanMode>('archivage');

    // Config
    const [inactivityDays, setInactivityDays] = useState(730);
    const [deleteAfterMigration, setDeleteAfterMigration] = useState(false);

    // Sites SharePoint
    const [sites, setSites] = useState<SharePointSite[]>([]);
    const [loadingSites, setLoadingSites] = useState(false);

    // Scan — restaurer les résultats précédents depuis localStorage
    const [scanResult, setScanResult] = useState<ScanResult | null>(() => {
        try {
            const saved = localStorage.getItem(SCAN_RESULT_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });
    const [scanning, setScanning] = useState(false);
    const [scanJob, setScanJob] = useState<ScanJob | null>(null);

    // Migration
    const [currentJob, setCurrentJob] = useState<MigrationJob | null>(null);
    const [migrating, setMigrating] = useState(false);

    // Doublons
    const [dupResult, setDupResult] = useState<DuplicateGroup[] | null>(() => {
        try {
            const saved = localStorage.getItem(DUP_RESULT_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });
    const [dupScanning, setDupScanning] = useState(false);
    const [dupScanJob, setDupScanJob] = useState<DuplicateScanJob | null>(null);
    const [dupSearchFilter, setDupSearchFilter] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Config
    const [showConfig, setShowConfig] = useState(false);
    const [config, setConfig] = useState<Record<string, string>>({});
    const [savingConfig, setSavingConfig] = useState(false);
    const [configSaved, setConfigSaved] = useState(false);
    const [testingS3, setTestingS3] = useState(false);
    const [testingSharepoint, setTestingSharepoint] = useState(false);
    const [testResult, setTestResult] = useState<{ type: string; success: boolean; message: string } | null>(null);
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

    // UI
    const [expandedFiles, setExpandedFiles] = useState(true);
    const [searchFilter, setSearchFilter] = useState('');
    const [error, setError] = useState<string | null>(null);

    // ── Persister les résultats du scan dans localStorage ───────────────────
    useEffect(() => {
        if (scanResult) {
            try {
                localStorage.setItem(SCAN_RESULT_KEY, JSON.stringify(scanResult));
            } catch { /* quota exceeded — ignore */ }
        } else {
            localStorage.removeItem(SCAN_RESULT_KEY);
        }
    }, [scanResult]);

    // ── Persister les résultats doublons dans localStorage ──────────────────
    useEffect(() => {
        if (dupResult) {
            try {
                localStorage.setItem(DUP_RESULT_KEY, JSON.stringify(dupResult));
            } catch { /* quota exceeded */ }
        } else {
            localStorage.removeItem(DUP_RESULT_KEY);
        }
    }, [dupResult]);

    // ── Charger la config ────────────────────────────────────────────────────
    const loadConfig = useCallback(async () => {
        try {
            const data = await fetchJSON<Record<string, string>>('/api/tooling/archivage-sharepoint/config');
            setConfig(data);
        } catch { /* config pas encore renseignée */ }
    }, []);

    useEffect(() => { loadConfig(); }, [loadConfig]);

    // ── Reprendre un scan en cours si on revient sur la page ──────────────────
    useEffect(() => {
        const savedScanId = localStorage.getItem(SCAN_ID_KEY);
        if (!savedScanId) return;
        // Vérifier si le scan existe encore côté backend
        (async () => {
            try {
                const data = await fetchJSON<ScanJob>(`/api/tooling/archivage-sharepoint/scan-jobs/${savedScanId}`, { silent: true });
                if (data.status === 'running') {
                    // Scan toujours en cours → reprendre le polling
                    setScanJob(data);
                    setScanning(true);
                } else if (data.status === 'completed' || data.status === 'cancelled') {
                    // Scan terminé/arrêté côté backend → charger les résultats
                    setScanResult({
                        total_files: data.eligible_files,
                        total_size_bytes: data.eligible_size_bytes,
                        files: (data.files ?? []).map((f: any) => ({ ...f, selected: true })),
                    });
                }
                // On ne supprime PAS le scan_id — il sera écrasé au prochain scan
            } catch {
                // Backend ne connaît plus ce scan (redémarrage) — on garde le cache localStorage
                // Les résultats ont déjà été restaurés via l'initialisation du useState
            }
        })();
    }, []);

    // ── Reprendre un scan doublons en cours ────────────────────────────────
    useEffect(() => {
        const savedDupId = localStorage.getItem(DUP_SCAN_ID_KEY);
        if (!savedDupId) return;
        (async () => {
            try {
                const data = await fetchJSON<DuplicateScanJob>(`/api/tooling/archivage-sharepoint/duplicate-jobs/${savedDupId}`, { silent: true });
                if (data.status === 'running') {
                    setDupScanJob(data);
                    setDupScanning(true);
                    setScanMode('doublons');
                } else if (data.status === 'completed' || data.status === 'cancelled') {
                    setDupResult(data.groups ?? []);
                    setScanMode('doublons');
                }
            } catch {
                // Backend ne connaît plus ce scan — garder le cache localStorage
            }
        })();
    }, []);

    const handleSaveConfig = async () => {
        setSavingConfig(true);
        setError(null);
        try {
            await fetchJSON('/api/tooling/archivage-sharepoint/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            setConfigSaved(true);
            setTimeout(() => setConfigSaved(false), 3000);
            loadConfig();
        } catch (e: any) {
            setError(e.message ?? 'Erreur lors de la sauvegarde de la configuration');
        } finally {
            setSavingConfig(false);
        }
    };

    const handleTestS3 = async () => {
        setTestingS3(true);
        setTestResult(null);
        try {
            const data = await fetchJSON<{ success: boolean; message: string }>('/api/tooling/archivage-sharepoint/test-s3', { method: 'POST' });
            setTestResult({ type: 's3', ...data });
        } catch (e: any) {
            setTestResult({ type: 's3', success: false, message: e.message ?? 'Erreur' });
        } finally {
            setTestingS3(false);
        }
    };

    const handleTestSharepoint = async () => {
        setTestingSharepoint(true);
        setTestResult(null);
        try {
            const data = await fetchJSON<{ success: boolean; message: string }>('/api/tooling/archivage-sharepoint/test-sharepoint', { method: 'POST' });
            setTestResult({ type: 'sharepoint', ...data });
        } catch (e: any) {
            setTestResult({ type: 'sharepoint', success: false, message: e.message ?? 'Erreur' });
        } finally {
            setTestingSharepoint(false);
        }
    };

    const updateConfig = (key: string, value: string) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        setConfigSaved(false);
    };

    // ── Charger les sites SharePoint ─────────────────────────────────────────
    const loadSites = useCallback(async () => {
        setLoadingSites(true);
        setError(null);
        try {
            const data = await fetchJSON<{ sites: any[] }>('/api/tooling/archivage-sharepoint/sites');
            setSites((data.sites ?? []).map((s: any) => ({ ...s, selected: true })));
        } catch (e: any) {
            setError(e.message ?? 'Erreur lors du chargement des sites SharePoint');
        } finally {
            setLoadingSites(false);
        }
    }, []);

    useEffect(() => { loadSites(); }, [loadSites]);

    // ── Scanner les fichiers éligibles ───────────────────────────────────────
    const handleScan = async () => {
        const selectedSiteIds = sites.filter(s => s.selected).map(s => s.id);
        if (selectedSiteIds.length === 0) {
            setError('Sélectionnez au moins un site SharePoint.');
            return;
        }
        setScanning(true);
        setError(null);
        setScanResult(null);
        setScanJob(null);
        try {
            const data = await fetchJSON<{ scan_id: string }>('/api/tooling/archivage-sharepoint/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ site_ids: selectedSiteIds, inactivity_days: inactivityDays }),
            });
            localStorage.setItem(SCAN_ID_KEY, data.scan_id);
            setScanJob({
                id: data.scan_id,
                status: 'running',
                folders_explored: 0,
                files_analyzed: 0,
                eligible_files: 0,
                eligible_size_bytes: 0,
                current_folder: '',
                files: [],
                started_at: new Date().toISOString(),
                completed_at: null,
                error: null,
            });
        } catch (e: any) {
            setError(e.message ?? 'Erreur lors du scan');
            setScanning(false);
        }
    };

    // ── Arrêter le scan ─────────────────────────────────────────────────────
    const handleCancelScan = async () => {
        if (!scanJob) return;
        try {
            await fetchJSON(`/api/tooling/archivage-sharepoint/scan-jobs/${scanJob.id}/cancel`, { method: 'POST' });
        } catch {
            // ignore — le polling détectera l'arrêt
        }
    };

    // ── Polling du scan en cours ──────────────────────────────────────────────
    useEffect(() => {
        if (!scanJob || scanJob.status !== 'running') return;
        const interval = setInterval(async () => {
            try {
                const data = await fetchJSON<ScanJob>(`/api/tooling/archivage-sharepoint/scan-jobs/${scanJob.id}`, { silent: true });
                setScanJob(data);
                if (data.status === 'completed' || data.status === 'cancelled') {
                    setScanResult({
                        total_files: data.eligible_files,
                        total_size_bytes: data.eligible_size_bytes,
                        files: (data.files ?? []).map((f: any) => ({ ...f, selected: true })),
                    });
                    setScanning(false);
                    clearInterval(interval);
                } else if (data.status === 'failed') {
                    setError(data.error ?? 'Le scan a échoué');
                    setScanning(false);
                    clearInterval(interval);
                }
            } catch {
                // silently ignore polling errors
            }
        }, 1500);
        return () => clearInterval(interval);
    }, [scanJob?.id, scanJob?.status]);

    // ── Scanner les doublons ─────────────────────────────────────────────────
    const handleDuplicateScan = async () => {
        const selectedSiteIds = sites.filter(s => s.selected).map(s => s.id);
        if (selectedSiteIds.length === 0) {
            setError('Sélectionnez au moins un site SharePoint.');
            return;
        }
        setDupScanning(true);
        setError(null);
        setDupResult(null);
        setDupScanJob(null);
        try {
            const data = await fetchJSON<{ scan_id: string }>('/api/tooling/archivage-sharepoint/scan-duplicates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ site_ids: selectedSiteIds }),
            });
            localStorage.setItem(DUP_SCAN_ID_KEY, data.scan_id);
            setDupScanJob({
                id: data.scan_id,
                status: 'running',
                folders_explored: 0,
                files_analyzed: 0,
                duplicate_groups: 0,
                duplicate_files: 0,
                duplicate_size_bytes: 0,
                current_folder: '',
                groups: [],
                started_at: new Date().toISOString(),
                completed_at: null,
                error: null,
            });
        } catch (e: any) {
            setError(e.message ?? 'Erreur lors du scan des doublons');
            setDupScanning(false);
        }
    };

    const handleCancelDupScan = async () => {
        if (!dupScanJob) return;
        try {
            await fetchJSON(`/api/tooling/archivage-sharepoint/duplicate-jobs/${dupScanJob.id}/cancel`, { method: 'POST' });
        } catch { /* ignore */ }
    };

    // ── Polling du scan doublons ──────────────────────────────────────────────
    useEffect(() => {
        if (!dupScanJob || dupScanJob.status !== 'running') return;
        const interval = setInterval(async () => {
            try {
                const data = await fetchJSON<DuplicateScanJob>(`/api/tooling/archivage-sharepoint/duplicate-jobs/${dupScanJob.id}`, { silent: true });
                setDupScanJob(data);
                if (data.status === 'completed' || data.status === 'cancelled') {
                    setDupResult(data.groups ?? []);
                    setDupScanning(false);
                    clearInterval(interval);
                } else if (data.status === 'failed') {
                    setError(data.error ?? 'Le scan des doublons a échoué');
                    setDupScanning(false);
                    clearInterval(interval);
                }
            } catch { /* ignore */ }
        }, 1500);
        return () => clearInterval(interval);
    }, [dupScanJob?.id, dupScanJob?.status]);

    // ── Filtrage doublons ──────────────────────────────────────────────────────
    const filteredDupGroups = dupResult?.filter(g =>
        g.name.toLowerCase().includes(dupSearchFilter.toLowerCase()) ||
        g.files.some(f => f.path.toLowerCase().includes(dupSearchFilter.toLowerCase()) || f.site_name.toLowerCase().includes(dupSearchFilter.toLowerCase()))
    ) ?? [];

    const totalWasted = dupResult?.reduce((s, g) => s + g.wasted_bytes, 0) ?? 0;

    const toggleGroup = (name: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    };

    // ── Supprimer un fichier doublon ──────────────────────────────────────────
    const handleDeleteDuplicate = async (file: DuplicateFile) => {
        setDeletingFileId(file.id);
        setError(null);
        try {
            await fetchJSON('/api/tooling/archivage-sharepoint/delete-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ drive_id: file.drive_id, file_id: file.id }),
            });
            // Retirer le fichier des résultats
            if (dupResult) {
                const updated = dupResult
                    .map(g => ({
                        ...g,
                        files: g.files.filter(f => f.id !== file.id),
                        count: g.files.filter(f => f.id !== file.id).length,
                        wasted_bytes: Math.max(0, (g.files.filter(f => f.id !== file.id).length - 1) * g.size_bytes),
                    }))
                    .filter(g => g.files.length > 1); // Retirer les groupes qui n'ont plus de doublons
                setDupResult(updated);
            }
        } catch (e: any) {
            setError(e.message ?? 'Erreur lors de la suppression');
        } finally {
            setDeletingFileId(null);
            setConfirmDeleteId(null);
        }
    };

    // ── Lancer la migration ──────────────────────────────────────────────────
    const handleMigrate = async () => {
        if (!scanResult) return;
        const selectedFiles = scanResult.files.filter(f => f.selected);
        if (selectedFiles.length === 0) {
            setError('Aucun fichier sélectionné pour la migration.');
            return;
        }
        // Vérifier que tous les fichiers ont un drive_id (ancien scan sans drive_id)
        const missingDriveId = selectedFiles.some(f => !f.drive_id);
        if (missingDriveId) {
            setError('Les données du scan sont obsolètes (drive_id manquant). Veuillez relancer un scan.');
            return;
        }
        setMigrating(true);
        setError(null);
        try {
            const data = await fetchJSON<{ job: MigrationJob }>('/api/tooling/archivage-sharepoint/migrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: selectedFiles.map(f => ({ id: f.id, drive_id: f.drive_id })), delete_after_migration: deleteAfterMigration }),
            });
            setCurrentJob(data.job);
        } catch (e: any) {
            setError(e.message ?? 'Erreur lors du lancement de la migration');
        } finally {
            setMigrating(false);
        }
    };

    // ── Polling du job en cours ──────────────────────────────────────────────
    useEffect(() => {
        if (!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed') return;
        const interval = setInterval(async () => {
            try {
                const data = await fetchJSON<MigrationJob>(`/api/tooling/archivage-sharepoint/jobs/${currentJob.id}`, { silent: true });
                setCurrentJob(data);
                if (data.status === 'completed' || data.status === 'failed') {
                    clearInterval(interval);
                }
            } catch {
                // silently ignore polling errors
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [currentJob]);

    // ── Filtrage fichiers ────────────────────────────────────────────────────
    const filteredFiles = scanResult?.files.filter(f =>
        f.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        f.path.toLowerCase().includes(searchFilter.toLowerCase()) ||
        f.site_name.toLowerCase().includes(searchFilter.toLowerCase())
    ) ?? [];

    const selectedCount = scanResult?.files.filter(f => f.selected).length ?? 0;
    const selectedSize = scanResult?.files.filter(f => f.selected).reduce((s, f) => s + f.size_bytes, 0) ?? 0;

    const toggleAllFiles = (val: boolean) => {
        if (!scanResult) return;
        setScanResult({
            ...scanResult,
            files: scanResult.files.map(f => ({ ...f, selected: val })),
        });
    };

    const toggleFile = (id: string) => {
        if (!scanResult) return;
        setScanResult({
            ...scanResult,
            files: scanResult.files.map(f => f.id === id ? { ...f, selected: !f.selected } : f),
        });
    };

    return (
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* En-tête */}
                <div className="flex items-center gap-3">
                    <Archive className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">SharePoint — Outils</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Archivage des fichiers inactifs et détection des doublons.
                        </p>
                    </div>
                </div>

                {/* Onglets mode */}
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    <button
                        onClick={() => setScanMode('archivage')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                            scanMode === 'archivage'
                                ? 'bg-white dark:bg-gray-700 text-cyan-700 dark:text-cyan-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <Archive className="w-4 h-4" /> Archivage S3
                    </button>
                    <button
                        onClick={() => setScanMode('doublons')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                            scanMode === 'doublons'
                                ? 'bg-white dark:bg-gray-700 text-orange-700 dark:text-orange-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <Copy className="w-4 h-4" /> Détection des doublons
                    </button>
                </div>

                {/* Configuration SharePoint + S3 */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => setShowConfig(v => !v)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left"
                    >
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Settings className="w-4 h-4 text-cyan-500" /> Configuration des connexions
                        </h3>
                        <div className="flex items-center gap-2">
                            {configSaved && <span className="text-xs text-green-500 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Sauvegardé</span>}
                            {showConfig ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                    </button>

                    {showConfig && (
                        <div className="px-5 pb-5 space-y-5 border-t border-gray-100 dark:border-gray-700 pt-4">
                            {/* SharePoint */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                    <FolderOpen className="w-4 h-4 text-blue-500" /> SharePoint (Microsoft Graph)
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {[
                                        { key: 'sharepoint_tenant_id', label: 'Tenant ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
                                        { key: 'sharepoint_client_id', label: 'Client ID (App Registration)', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
                                        { key: 'sharepoint_client_secret', label: 'Client Secret', placeholder: '••••••••', secret: true },
                                    ].map(field => (
                                        <div key={field.key}>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{field.label}</label>
                                            <div className="relative">
                                                <input
                                                    type={field.secret && !showSecrets[field.key] ? 'password' : 'text'}
                                                    value={config[field.key] ?? ''}
                                                    onChange={e => updateConfig(field.key, e.target.value)}
                                                    placeholder={field.placeholder}
                                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent pr-9"
                                                />
                                                {field.secret && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowSecrets(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                    >
                                                        {showSecrets[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2">
                                    <button
                                        onClick={handleTestSharepoint}
                                        disabled={testingSharepoint}
                                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
                                    >
                                        {testingSharepoint ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
                                        Tester la connexion SharePoint
                                    </button>
                                    {testResult?.type === 'sharepoint' && (
                                        <span className={`ml-3 text-xs font-medium ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
                                            {testResult.success ? '✓' : '✗'} {testResult.message}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* S3 */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                    <HardDrive className="w-4 h-4 text-green-500" /> Stockage S3
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {[
                                        { key: 's3_endpoint_url', label: 'Endpoint URL (optionnel, pour S3 compatible)', placeholder: 'https://s3.eu-west-3.amazonaws.com' },
                                        { key: 's3_access_key_id', label: 'Access Key ID', placeholder: 'AKIAIOSFODNN7EXAMPLE' },
                                        { key: 's3_secret_access_key', label: 'Secret Access Key', placeholder: '••••••••', secret: true },
                                        { key: 's3_region', label: 'Région', placeholder: 'eu-west-3' },
                                        { key: 's3_archive_bucket', label: 'Nom du bucket', placeholder: 'sharepoint-archive' },
                                    ].map(field => (
                                        <div key={field.key}>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{field.label}</label>
                                            <div className="relative">
                                                <input
                                                    type={field.secret && !showSecrets[field.key] ? 'password' : 'text'}
                                                    value={config[field.key] ?? ''}
                                                    onChange={e => updateConfig(field.key, e.target.value)}
                                                    placeholder={field.placeholder}
                                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent pr-9"
                                                />
                                                {field.secret && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowSecrets(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                    >
                                                        {showSecrets[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2">
                                    <button
                                        onClick={handleTestS3}
                                        disabled={testingS3}
                                        className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 hover:text-green-700 font-medium"
                                    >
                                        {testingS3 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
                                        Tester la connexion S3
                                    </button>
                                    {testResult?.type === 's3' && (
                                        <span className={`ml-3 text-xs font-medium ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
                                            {testResult.success ? '✓' : '✗'} {testResult.message}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Bouton sauvegarder */}
                            <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
                                <button
                                    onClick={handleSaveConfig}
                                    disabled={savingConfig}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-600 text-white font-medium text-sm hover:bg-cyan-700 disabled:opacity-50 transition-colors"
                                >
                                    {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Sauvegarder la configuration
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Erreur */}
                {error && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
                        <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {/* Paramètres — archivage seulement */}
                {scanMode === 'archivage' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Filter className="w-4 h-4 text-cyan-500" /> Paramètres de scan
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Inactivité minimale (jours)
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={3650}
                                value={inactivityDays}
                                onChange={e => setInactivityDays(Number(e.target.value))}
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-400 mt-1">Fichiers non accédés ni modifiés depuis ce nombre de jours.</p>
                        </div>
                        <div className="flex items-center gap-3 self-center">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={deleteAfterMigration}
                                    onChange={e => setDeleteAfterMigration(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-gray-500 peer-checked:bg-red-500" />
                            </label>
                            <div>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" /> Supprimer après migration
                                </p>
                                <p className="text-xs text-gray-400">Supprime les fichiers de SharePoint après copie sur S3.</p>
                            </div>
                        </div>
                    </div>
                </div>
                )}

                {/* Sites SharePoint */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-cyan-500" /> Sites SharePoint
                        </h3>
                        <button
                            onClick={loadSites}
                            disabled={loadingSites}
                            className="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 flex items-center gap-1"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loadingSites ? 'animate-spin' : ''}`} /> Rafraîchir
                        </button>
                    </div>

                    {loadingSites ? (
                        <div className="flex items-center justify-center py-8 text-gray-400">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement des sites...
                        </div>
                    ) : sites.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <Info className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-sm">Aucun site SharePoint trouvé. Vérifiez la configuration.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/30 cursor-pointer border border-gray-200 dark:border-gray-600">
                                <input
                                    type="checkbox"
                                    checked={sites.length > 0 && sites.every(s => s.selected)}
                                    ref={el => { if (el) el.indeterminate = sites.some(s => s.selected) && !sites.every(s => s.selected); }}
                                    onChange={e => setSites(prev => prev.map(s => ({ ...s, selected: e.target.checked })))}
                                    className="w-4 h-4 text-cyan-500 rounded border-gray-300 focus:ring-cyan-500"
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Tout sélectionner ({sites.filter(s => s.selected).length} / {sites.length})
                                </span>
                            </label>
                            {sites.map(site => (
                                <label key={site.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={site.selected}
                                        onChange={() => setSites(prev => prev.map(s => s.id === site.id ? { ...s, selected: !s.selected } : s))}
                                        className="w-4 h-4 text-cyan-500 rounded border-gray-300 focus:ring-cyan-500"
                                    />
                                    <FolderOpen className="w-4 h-4 text-cyan-500" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{site.name}</p>
                                        <p className="text-xs text-gray-400 truncate">{site.url}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        {scanMode === 'archivage' ? (
                            <button
                                onClick={handleScan}
                                disabled={scanning || sites.filter(s => s.selected).length === 0}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-600 text-white font-medium text-sm hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                {scanning ? 'Scan en cours...' : 'Scanner les fichiers éligibles'}
                            </button>
                        ) : (
                            <button
                                onClick={handleDuplicateScan}
                                disabled={dupScanning || sites.filter(s => s.selected).length === 0}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 text-white font-medium text-sm hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {dupScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                                {dupScanning ? 'Analyse en cours...' : 'Analyser les doublons'}
                            </button>
                        )}

                        {/* Barre de progression du scan archivage */}
                        {scanMode === 'archivage' && scanJob && scanJob.status === 'running' && (
                            <div className="mt-4 p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
                                <div className="flex items-center gap-3 mb-3">
                                    <Loader2 className="w-5 h-5 text-cyan-500 animate-spin flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            Scan en cours...
                                        </p>
                                        {scanJob.current_folder && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                Dossier : {scanJob.current_folder}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleCancelScan}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                        title="Arrêter le scan (les fichiers déjà trouvés sont conservés)"
                                    >
                                        <Square className="w-3.5 h-3.5" /> Arrêter
                                    </button>
                                </div>

                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3 overflow-hidden">
                                    <div className="h-full bg-cyan-500 rounded-full animate-pulse" style={{ width: '100%', opacity: 0.7 }} />
                                </div>

                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                                        <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{scanJob.folders_explored}</p>
                                        <p className="text-[10px] text-gray-500">dossiers explorés</p>
                                    </div>
                                    <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                                        <p className="text-lg font-bold text-gray-700 dark:text-gray-300">{scanJob.files_analyzed}</p>
                                        <p className="text-[10px] text-gray-500">fichiers analysés</p>
                                    </div>
                                    <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                                        <p className="text-lg font-bold text-green-600 dark:text-green-400">{scanJob.eligible_files}</p>
                                        <p className="text-[10px] text-gray-500">éligibles ({formatBytes(scanJob.eligible_size_bytes)})</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Barre de progression du scan doublons */}
                        {scanMode === 'doublons' && dupScanJob && dupScanJob.status === 'running' && (
                            <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                                <div className="flex items-center gap-3 mb-3">
                                    <Loader2 className="w-5 h-5 text-orange-500 animate-spin flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            Analyse des doublons en cours...
                                        </p>
                                        {dupScanJob.current_folder && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                Dossier : {dupScanJob.current_folder}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleCancelDupScan}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                    >
                                        <Square className="w-3.5 h-3.5" /> Arrêter
                                    </button>
                                </div>

                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3 overflow-hidden">
                                    <div className="h-full bg-orange-500 rounded-full animate-pulse" style={{ width: '100%', opacity: 0.7 }} />
                                </div>

                                <div className="grid grid-cols-4 gap-3 text-center">
                                    <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                                        <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{dupScanJob.folders_explored}</p>
                                        <p className="text-[10px] text-gray-500">dossiers explorés</p>
                                    </div>
                                    <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                                        <p className="text-lg font-bold text-gray-700 dark:text-gray-300">{dupScanJob.files_analyzed}</p>
                                        <p className="text-[10px] text-gray-500">fichiers analysés</p>
                                    </div>
                                    <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                                        <p className="text-lg font-bold text-red-600 dark:text-red-400">{dupScanJob.duplicate_groups}</p>
                                        <p className="text-[10px] text-gray-500">groupes de doublons</p>
                                    </div>
                                    <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                                        <p className="text-lg font-bold text-red-600 dark:text-red-400">{dupScanJob.duplicate_files}</p>
                                        <p className="text-[10px] text-gray-500">fichiers en double</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Résultats du scan archivage */}
                {scanMode === 'archivage' && scanResult && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <FileText className="w-4 h-4 text-cyan-500" /> Fichiers éligibles à l'archivage
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setScanResult(null);
                                        setScanJob(null);
                                        localStorage.removeItem(SCAN_ID_KEY);
                                        localStorage.removeItem(SCAN_RESULT_KEY);
                                    }}
                                    className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Effacer
                                </button>
                                <button
                                    onClick={() => setExpandedFiles(v => !v)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    {expandedFiles ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Stats résumé */}
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3 text-center">
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{scanResult.total_files}</p>
                                <p className="text-xs text-gray-500">fichiers trouvés</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3 text-center">
                                <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{selectedCount}</p>
                                <p className="text-xs text-gray-500">sélectionnés</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3 text-center">
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatBytes(selectedSize)}</p>
                                <p className="text-xs text-gray-500">volume à migrer</p>
                            </div>
                        </div>

                        {expandedFiles && (
                            <>
                                {/* Barre recherche + tout sélectionner */}
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={searchFilter}
                                            onChange={e => setSearchFilter(e.target.value)}
                                            placeholder="Filtrer par nom, chemin ou site..."
                                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>
                                    <span className="text-xs text-gray-500">{selectedCount} / {scanResult?.files.length ?? 0} sélectionnés</span>
                                </div>

                                {/* Table fichiers */}
                                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="sticky top-0">
                                            <tr className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                <th className="px-3 py-2 w-8">
                                                    <input
                                                        type="checkbox"
                                                        checked={filteredFiles.length > 0 && filteredFiles.every(f => f.selected)}
                                                        ref={el => { if (el) el.indeterminate = filteredFiles.some(f => f.selected) && !filteredFiles.every(f => f.selected); }}
                                                        onChange={e => toggleAllFiles(e.target.checked)}
                                                        className="w-3.5 h-3.5 text-cyan-500 rounded border-gray-300"
                                                    />
                                                </th>
                                                <th className="px-3 py-2 text-left font-semibold">Fichier</th>
                                                <th className="px-3 py-2 text-left font-semibold">Site</th>
                                                <th className="px-3 py-2 text-right font-semibold">Taille</th>
                                                <th className="px-3 py-2 text-right font-semibold">Dernier accès</th>
                                                <th className="px-3 py-2 text-right font-semibold">Dernière modif.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {filteredFiles.map(f => (
                                                <tr key={f.id} className="hover:bg-cyan-50/50 dark:hover:bg-cyan-900/10">
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={f.selected}
                                                            onChange={() => toggleFile(f.id)}
                                                            className="w-3.5 h-3.5 text-cyan-500 rounded border-gray-300"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <p className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-xs" title={f.name}>{f.name}</p>
                                                        <p className="text-[10px] text-gray-400 truncate max-w-xs" title={f.path}>{f.path}</p>
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">{f.site_name}</td>
                                                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatBytes(f.size_bytes)}</td>
                                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                                        <span className="text-gray-500">{formatDate(f.last_accessed)}</span>
                                                        <span className="ml-1 text-[10px] text-red-400">({daysSince(f.last_accessed)}j)</span>
                                                    </td>
                                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                                        <span className="text-gray-500">{formatDate(f.last_modified)}</span>
                                                        <span className="ml-1 text-[10px] text-red-400">({daysSince(f.last_modified)}j)</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {filteredFiles.length === 0 && (
                                        <div className="py-8 text-center text-gray-400 text-sm">Aucun fichier ne correspond au filtre.</div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Bouton migration */}
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {selectedCount} fichier{selectedCount > 1 ? 's' : ''} ({formatBytes(selectedSize)}) prêt{selectedCount > 1 ? 's' : ''} à migrer
                                {deleteAfterMigration && <span className="ml-2 text-red-500 font-medium">(suppression SharePoint activée)</span>}
                            </p>
                            <button
                                onClick={handleMigrate}
                                disabled={migrating || selectedCount === 0}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white font-medium text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                {migrating ? 'Lancement...' : 'Lancer la migration vers S3'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Job en cours / terminé */}
                {scanMode === 'archivage' && currentJob && (
                    <div className={`rounded-xl border-2 p-5 ${
                        currentJob.status === 'completed' ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' :
                        currentJob.status === 'failed' ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' :
                        'border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-900/20'
                    }`}>
                        <div className="flex items-center gap-3 mb-4">
                            {currentJob.status === 'completed' ? (
                                <CheckCircle2 className="w-6 h-6 text-green-500" />
                            ) : currentJob.status === 'failed' ? (
                                <AlertCircle className="w-6 h-6 text-red-500" />
                            ) : (
                                <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
                            )}
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                    {currentJob.status === 'completed' ? 'Migration terminée' :
                                     currentJob.status === 'failed' ? 'Migration échouée' :
                                     'Migration en cours...'}
                                </h3>
                                <p className="text-xs text-gray-500">
                                    Job {currentJob.id}
                                    {currentJob.started_at && ` — démarré le ${formatDate(currentJob.started_at)}`}
                                </p>
                            </div>
                        </div>

                        {/* Fichier en cours */}
                        {currentJob.status === 'running' && currentJob.current_file && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">
                                <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
                                {currentJob.current_file}
                            </p>
                        )}

                        {/* Barre de progression */}
                        {(currentJob.status === 'running' || currentJob.status === 'completed') && (
                            <div className="mb-4">
                                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                                    <span>{currentJob.migrated_files} / {currentJob.total_files} fichiers migrés</span>
                                    {currentJob.delete_after && (
                                        <span className="text-orange-500">{currentJob.deleted_files} supprimé{currentJob.deleted_files > 1 ? 's' : ''}</span>
                                    )}
                                    <span>{formatBytes(currentJob.migrated_size_bytes)}</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            currentJob.status === 'completed' ? 'bg-green-500' : 'bg-cyan-500'
                                        }`}
                                        style={{ width: `${currentJob.total_files > 0 ? ((currentJob.migrated_files + currentJob.failed_files) / currentJob.total_files) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Stats finales */}
                        {currentJob.status === 'completed' && (
                            <div className={`grid ${currentJob.delete_after ? 'grid-cols-4' : 'grid-cols-3'} gap-3 text-center`}>
                                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
                                    <p className="text-xl font-bold text-green-600">{currentJob.migrated_files}</p>
                                    <p className="text-xs text-gray-500">migrés</p>
                                </div>
                                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
                                    <p className="text-xl font-bold text-red-500">{currentJob.failed_files}</p>
                                    <p className="text-xs text-gray-500">échoués</p>
                                </div>
                                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">{formatBytes(currentJob.migrated_size_bytes)}</p>
                                    <p className="text-xs text-gray-500">archivés</p>
                                </div>
                                {currentJob.delete_after && (
                                    <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
                                        <p className="text-xl font-bold text-orange-500">{currentJob.deleted_files}</p>
                                        <p className="text-xs text-gray-500">supprimés</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Erreurs */}
                        {currentJob.errors.length > 0 && (
                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                <p className="text-xs font-semibold text-red-600 mb-1">Erreurs ({currentJob.errors.length})</p>
                                <ul className="space-y-1 max-h-32 overflow-y-auto">
                                    {currentJob.errors.map((err, i) => (
                                        <li key={i} className="text-xs text-red-500">{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Résultats doublons */}
                {scanMode === 'doublons' && dupResult && dupResult.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Copy className="w-4 h-4 text-orange-500" /> Doublons détectés
                            </h3>
                            <button
                                onClick={() => {
                                    setDupResult(null);
                                    setDupScanJob(null);
                                    localStorage.removeItem(DUP_SCAN_ID_KEY);
                                    localStorage.removeItem(DUP_RESULT_KEY);
                                }}
                                className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Effacer
                            </button>
                        </div>

                        {/* Stats résumé */}
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg px-4 py-3 text-center">
                                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{dupResult.length}</p>
                                <p className="text-xs text-gray-500">groupes de doublons</p>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3 text-center">
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                                    {dupResult.reduce((s, g) => s + g.count, 0)}
                                </p>
                                <p className="text-xs text-gray-500">fichiers en double</p>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3 text-center">
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatBytes(totalWasted)}</p>
                                <p className="text-xs text-gray-500">espace gaspillé</p>
                            </div>
                        </div>

                        {/* Barre de recherche */}
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={dupSearchFilter}
                                onChange={e => setDupSearchFilter(e.target.value)}
                                placeholder="Filtrer par nom de fichier, chemin ou site..."
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                            />
                        </div>

                        {/* Liste des groupes de doublons */}
                        <div className="space-y-2 max-h-[600px] overflow-y-auto">
                            {filteredDupGroups.map((group, gi) => (
                                <div key={`${group.name}-${group.size_bytes}-${gi}`} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                    {/* En-tête du groupe */}
                                    <button
                                        onClick={() => toggleGroup(`${group.name}-${gi}`)}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                    >
                                        {expandedGroups.has(`${group.name}-${gi}`) ? (
                                            <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                        )}
                                        <Copy className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{group.name}</p>
                                            <p className="text-xs text-gray-400">
                                                {formatBytes(group.size_bytes)} par fichier — <span className="font-mono">{group.hash?.slice(0, 12)}...</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-medium">
                                                {group.count} copies
                                            </span>
                                            <span className="text-xs text-red-500 font-medium">
                                                -{formatBytes(group.wasted_bytes)} gaspillés
                                            </span>
                                        </div>
                                    </button>

                                    {/* Détails des fichiers du groupe */}
                                    {expandedGroups.has(`${group.name}-${gi}`) && (
                                        <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 overflow-x-auto">
                                            <table className="w-full text-xs table-fixed">
                                                <thead>
                                                    <tr className="text-gray-500 dark:text-gray-400">
                                                        <th className="px-3 py-2 text-left font-medium w-[22%]">Fichier</th>
                                                        <th className="px-3 py-2 text-left font-medium w-[32%]">Emplacement</th>
                                                        <th className="px-3 py-2 text-left font-medium w-[18%]">Site</th>
                                                        <th className="px-3 py-2 text-right font-medium w-[13%]">Dernière modif.</th>
                                                        <th className="px-3 py-2 text-center font-medium w-[15%]">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                    {group.files.map((f) => (
                                                        <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                            <td className="px-3 py-2">
                                                                <p className="text-gray-700 dark:text-gray-300 font-medium truncate" title={f.name}>
                                                                    {f.name}
                                                                </p>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <p className="text-gray-500 dark:text-gray-400 truncate" title={f.path}>
                                                                    {f.path || '/'}
                                                                </p>
                                                            </td>
                                                            <td className="px-3 py-2 text-gray-500 truncate">{f.site_name}</td>
                                                            <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">{formatDate(f.last_modified)}</td>
                                                            <td className="px-3 py-2 text-center">
                                                                {confirmDeleteId === f.id ? (
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <button
                                                                            onClick={() => handleDeleteDuplicate(f)}
                                                                            disabled={deletingFileId === f.id}
                                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-600 text-white text-[10px] font-medium hover:bg-red-700 disabled:opacity-50"
                                                                        >
                                                                            {deletingFileId === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                                                            Oui
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setConfirmDeleteId(null)}
                                                                            className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-[10px] font-medium hover:bg-gray-300 dark:hover:bg-gray-500"
                                                                        >
                                                                            Non
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => setConfirmDeleteId(f.id)}
                                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-[10px] font-medium transition-colors"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" /> Supprimer
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {filteredDupGroups.length === 0 && (
                            <div className="py-8 text-center text-gray-400 text-sm">Aucun doublon ne correspond au filtre.</div>
                        )}
                    </div>
                )}

                {scanMode === 'doublons' && dupResult && dupResult.length === 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Aucun doublon détecté</h3>
                        <p className="text-sm text-gray-500">Votre espace SharePoint ne contient pas de fichiers en double.</p>
                    </div>
                )}

            </div>
        </main>
    );
};
