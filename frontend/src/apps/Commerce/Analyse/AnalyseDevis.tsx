import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, FileSearch, Upload, X, Clock, CheckCircle2 } from 'lucide-react';
import { analyzeQuotes } from '../../../api/commerce';

// ── Étapes de progression ────────────────────────────────────────────────────

const STAGES = [
    { label: "Envoi des fichiers vers le serveur", minPct: 0,  maxPct: 10 },
    { label: "Lecture et extraction du contenu",   minPct: 10, maxPct: 30 },
    { label: "Analyse comparative par IA (Claude)",minPct: 30, maxPct: 85 },
    { label: "Structuration des résultats",        minPct: 85, maxPct: 95 },
];

function getCurrentStage(pct: number) {
    for (let i = STAGES.length - 1; i >= 0; i--) {
        if (pct >= STAGES[i].minPct) return STAGES[i];
    }
    return STAGES[0];
}

/** Estimation en secondes selon la taille et le nombre de fichiers */
function estimateDuration(files: File[]): number {
    const totalMB = files.reduce((s, f) => s + f.size / 1024 / 1024, 0);
    return Math.round(20 + files.length * 15 + totalMB * 25);
}

function formatSeconds(s: number): string {
    if (s <= 0) return '0s';
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, '0')}s`;
}

// ── Composant barre de progression ──────────────────────────────────────────

interface ProgressPanelProps {
    progress: number;       // 0-100
    elapsed: number;        // secondes écoulées
    estimated: number;      // secondes estimées au total
}

const ProgressPanel: React.FC<ProgressPanelProps> = ({ progress, elapsed, estimated }) => {
    const stage = getCurrentStage(progress);
    const remaining = Math.max(0, estimated - elapsed);
    const isDone = progress >= 100;

    return (
        <div className="mt-6 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    {isDone
                        ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                        : <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                    }
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {isDone ? "Analyse terminée !" : stage.label}
                    </span>
                </div>
                <span className="text-lg font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                    {Math.round(progress)}%
                </span>
            </div>

            {/* Barre de progression */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden mb-4">
                <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                        width: `${progress}%`,
                        background: isDone
                            ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                            : 'linear-gradient(90deg, #f97316, #ea580c)',
                    }}
                />
            </div>

            {/* Jalons */}
            <div className="flex justify-between mb-5">
                {STAGES.map((s, i) => {
                    const reached = progress >= s.minPct;
                    return (
                        <div key={i} className="flex flex-col items-center gap-1" style={{ width: '22%' }}>
                            <div className={`w-2.5 h-2.5 rounded-full border-2 transition-colors ${
                                reached
                                    ? 'bg-orange-500 border-orange-500'
                                    : 'bg-gray-300 dark:bg-gray-600 border-gray-300 dark:border-gray-600'
                            }`} />
                            <span className={`text-[10px] text-center leading-tight ${
                                reached ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-gray-400'
                            }`}>
                                {s.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Temps */}
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>Écoulé : <strong className="text-gray-700 dark:text-gray-300 tabular-nums">{formatSeconds(elapsed)}</strong></span>
                </div>
                {!isDone && (
                    <div className="flex items-center gap-1.5">
                        <span>Restant estimé : <strong className="text-gray-700 dark:text-gray-300 tabular-nums">~{formatSeconds(remaining)}</strong></span>
                    </div>
                )}
                <div className="flex items-center gap-1.5">
                    <span>Durée estimée totale : <strong className="text-gray-700 dark:text-gray-300 tabular-nums">~{formatSeconds(estimated)}</strong></span>
                </div>
            </div>
        </div>
    );
};

// ── Composant principal ──────────────────────────────────────────────────────

export const AnalyseDevis: React.FC = () => {
    const [fileSlots, setFileSlots] = useState<(File | null)[]>([null, null, null]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Progression
    const [progress, setProgress] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const [estimated, setEstimated] = useState(60);

    const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentProgressRef = useRef(0);

    const clearTimers = () => {
        if (progressRef.current) clearInterval(progressRef.current);
        if (elapsedRef.current) clearInterval(elapsedRef.current);
    };

    const startProgress = (files: File[]) => {
        const totalEstimated = estimateDuration(files);
        setEstimated(totalEstimated);
        setProgress(0);
        setElapsed(0);
        currentProgressRef.current = 0;

        // Compteur de temps écoulé (toutes les secondes)
        elapsedRef.current = setInterval(() => {
            setElapsed(prev => prev + 1);
        }, 1000);

        // Avancement de la barre (toutes les 300ms)
        // Remplit 85% sur la durée estimée, puis ralentit fortement
        const tickMs = 300;
        const ticksToReach85 = (totalEstimated * 1000) / tickMs;
        const stepTo85 = 85 / ticksToReach85;

        progressRef.current = setInterval(() => {
            setProgress(prev => {
                const current = currentProgressRef.current;
                let next: number;
                if (current < 85) {
                    next = Math.min(current + stepTo85, 85);
                } else {
                    // Avancement très lent au-delà de 85% (en attente de la réponse)
                    next = Math.min(current + 0.03, 95);
                }
                currentProgressRef.current = next;
                return next;
            });
        }, tickMs);
    };

    const finishProgress = () => {
        clearTimers();
        setProgress(100);
        currentProgressRef.current = 100;
    };

    useEffect(() => () => clearTimers(), []);

    const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = [...fileSlots];
            newFiles[index] = e.target.files[0];
            setFileSlots(newFiles);
        }
    };

    const removeFile = (index: number) => {
        const newFiles = [...fileSlots];
        newFiles[index] = null;
        setFileSlots(newFiles);
    };

    const handleAnalyze = async () => {
        const validFiles = fileSlots.filter(f => f !== null) as File[];
        if (validFiles.length === 0) {
            setError("Veuillez sélectionner au moins un devis.");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);
        startProgress(validFiles);

        try {
            const data = await analyzeQuotes(validFiles);
            finishProgress();
            // Délai court pour que l'utilisateur voie les 100%
            setTimeout(() => setResult(data.analysis), 600);
        } catch (err: any) {
            clearTimers();
            setError(err.message || 'Erreur inconnue.');
        } finally {
            setLoading(false);
        }
    };

    const hasFiles = fileSlots.some(f => f !== null);

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                    <FileSearch className="w-8 h-8 text-orange-500" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analyse des Devis Prestataires</h2>
                </div>

                <p className="text-gray-600 dark:text-gray-400 mb-8">
                    Déposez vos devis (PDF, images) dans les emplacements ci-dessous pour les analyser et les comparer automatiquement via l'IA.
                </p>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {fileSlots.map((file, index) => (
                        <div key={index} className="relative h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center transition hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            {file ? (
                                <div className="w-full h-full p-4 flex flex-col items-center justify-center relative">
                                    <button
                                        onClick={() => removeFile(index)}
                                        className="absolute top-2 right-2 p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-colors"
                                        title="Retirer ce devis"
                                    >
                                        <X size={16} />
                                    </button>
                                    <div className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 font-semibold px-3 py-1 rounded text-sm mb-3">
                                        Devis {index + 1}
                                    </div>
                                    <div className="text-center w-full px-2">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={file.name}>
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full h-full p-4 flex flex-col items-center justify-center text-center">
                                    <Upload className="h-8 w-8 text-gray-400 mb-3" />
                                    <div className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 font-medium px-3 py-1 rounded text-xs mb-3">
                                        Devis {index + 1}
                                    </div>
                                    <label className="cursor-pointer text-sm font-medium text-orange-600 hover:text-orange-500 focus:outline-none">
                                        <span>Sélectionner le fichier</span>
                                        <input
                                            type="file"
                                            className="sr-only"
                                            onChange={(e) => handleFileChange(index, e)}
                                            accept=".pdf,image/*"
                                        />
                                    </label>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Barre de progression (visible pendant et juste après l'analyse) */}
                {(loading || progress > 0) && (
                    <ProgressPanel
                        progress={progress}
                        elapsed={elapsed}
                        estimated={estimated}
                    />
                )}

                {hasFiles && (
                    <div className="mt-8 flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={handleAnalyze}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Analyse IA en cours...</>
                            ) : (
                                <><FileSearch className="w-5 h-5" /> Lancer l'analyse comparative</>
                            )}
                        </button>
                    </div>
                )}

                {result && (
                    <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Résultat de l'analyse</h3>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 font-mono text-sm overflow-x-auto text-gray-800 dark:text-gray-300">
                            <pre>{JSON.stringify(result, null, 2)}</pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
