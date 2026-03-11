import React, { useState, useEffect, useCallback } from 'react';
import {
    Archive, Play, RefreshCw, Loader2, CheckCircle2, AlertCircle,
    FolderOpen, FileText, HardDrive, Search, Trash2,
    Filter, ChevronDown, ChevronUp, Info,
    Settings, Save, Plug, Eye, EyeOff,
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
    status: 'running' | 'completed' | 'failed';
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
    total_size_bytes: number;
    migrated_size_bytes: number;
    started_at: string | null;
    completed_at: string | null;
    errors: string[];
}

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

export const ArchivageSharepoint: React.FC = () => {
    // Config
    const [inactivityDays, setInactivityDays] = useState(730);
    const [deleteAfterMigration, setDeleteAfterMigration] = useState(false);

    // Sites SharePoint
    const [sites, setSites] = useState<SharePointSite[]>([]);
    const [loadingSites, setLoadingSites] = useState(false);

    // Scan — restaurer les résultats précédents depuis sessionStorage
    const [scanResult, setScanResult] = useState<ScanResult | null>(() => {
        try {
            const saved = sessionStorage.getItem(SCAN_RESULT_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });
    const [scanning, setScanning] = useState(false);
    const [scanJob, setScanJob] = useState<ScanJob | null>(null);

    // Migration
    const [currentJob, setCurrentJob] = useState<MigrationJob | null>(null);
    const [migrating, setMigrating] = useState(false);

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

    // ── Persister les résultats du scan dans sessionStorage ───────────────────
    useEffect(() => {
        if (scanResult) {
            try {
                sessionStorage.setItem(SCAN_RESULT_KEY, JSON.stringify(scanResult));
            } catch { /* quota exceeded — ignore */ }
        } else {
            sessionStorage.removeItem(SCAN_RESULT_KEY);
        }
    }, [scanResult]);

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
                    setScanJob(data);
                    setScanning(true);
                } else if (data.status === 'completed') {
                    setScanResult({
                        total_files: data.eligible_files,
                        total_size_bytes: data.eligible_size_bytes,
                        files: (data.files ?? []).map((f: any) => ({ ...f, selected: true })),
                    });
                    localStorage.removeItem(SCAN_ID_KEY);
                } else {
                    localStorage.removeItem(SCAN_ID_KEY);
                }
            } catch {
                localStorage.removeItem(SCAN_ID_KEY);
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

    // ── Polling du scan en cours ──────────────────────────────────────────────
    useEffect(() => {
        if (!scanJob || scanJob.status !== 'running') return;
        const interval = setInterval(async () => {
            try {
                const data = await fetchJSON<ScanJob>(`/api/tooling/archivage-sharepoint/scan-jobs/${scanJob.id}`, { silent: true });
                setScanJob(data);
                if (data.status === 'completed') {
                    setScanResult({
                        total_files: data.eligible_files,
                        total_size_bytes: data.eligible_size_bytes,
                        files: (data.files ?? []).map((f: any) => ({ ...f, selected: true })),
                    });
                    setScanning(false);
                    localStorage.removeItem(SCAN_ID_KEY);
                    clearInterval(interval);
                } else if (data.status === 'failed') {
                    setError(data.error ?? 'Le scan a échoué');
                    setScanning(false);
                    localStorage.removeItem(SCAN_ID_KEY);
                    clearInterval(interval);
                }
            } catch {
                // silently ignore polling errors
            }
        }, 1500);
        return () => clearInterval(interval);
    }, [scanJob?.id, scanJob?.status]);

    // ── Lancer la migration ──────────────────────────────────────────────────
    const handleMigrate = async () => {
        if (!scanResult) return;
        const selectedFiles = scanResult.files.filter(f => f.selected);
        if (selectedFiles.length === 0) {
            setError('Aucun fichier sélectionné pour la migration.');
            return;
        }
        setMigrating(true);
        setError(null);
        try {
            const data = await fetchJSON<{ job: MigrationJob }>('/api/tooling/archivage-sharepoint/migrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_ids: selectedFiles.map(f => f.id), delete_after_migration: deleteAfterMigration }),
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
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Archivage SharePoint → S3</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Identifie et migre les fichiers non accédés/modifiés depuis plus de {inactivityDays} jours vers le stockage S3.
                        </p>
                    </div>
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

                {/* Paramètres */}
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
                        <button
                            onClick={handleScan}
                            disabled={scanning || sites.filter(s => s.selected).length === 0}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-600 text-white font-medium text-sm hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            {scanning ? 'Scan en cours...' : 'Scanner les fichiers éligibles'}
                        </button>

                        {/* Barre de progression du scan */}
                        {scanJob && scanJob.status === 'running' && (
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
                                </div>

                                {/* Barre animée */}
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3 overflow-hidden">
                                    <div className="h-full bg-cyan-500 rounded-full animate-pulse" style={{ width: '100%', opacity: 0.7 }} />
                                </div>

                                {/* Compteurs en temps réel */}
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
                    </div>
                </div>

                {/* Résultats du scan */}
                {scanResult && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <FileText className="w-4 h-4 text-cyan-500" /> Fichiers éligibles à l'archivage
                            </h3>
                            <button
                                onClick={() => setExpandedFiles(v => !v)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                {expandedFiles ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
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
                                    <button onClick={() => toggleAllFiles(true)} className="text-xs text-cyan-600 hover:underline">Tout sélectionner</button>
                                    <button onClick={() => toggleAllFiles(false)} className="text-xs text-gray-500 hover:underline">Tout désélectionner</button>
                                </div>

                                {/* Table fichiers */}
                                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="sticky top-0">
                                            <tr className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                <th className="px-3 py-2 w-8"></th>
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
                {currentJob && (
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

                        {/* Barre de progression */}
                        {(currentJob.status === 'running' || currentJob.status === 'completed') && (
                            <div className="mb-4">
                                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                                    <span>{currentJob.migrated_files} / {currentJob.total_files} fichiers</span>
                                    <span>{formatBytes(currentJob.migrated_size_bytes)} / {formatBytes(currentJob.total_size_bytes)}</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            currentJob.status === 'completed' ? 'bg-green-500' : 'bg-cyan-500'
                                        }`}
                                        style={{ width: `${currentJob.total_files > 0 ? (currentJob.migrated_files / currentJob.total_files) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Stats finales */}
                        {currentJob.status === 'completed' && (
                            <div className="grid grid-cols-3 gap-3 text-center">
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

            </div>
        </main>
    );
};
