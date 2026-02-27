import React, { useState, useEffect, useRef } from 'react';
import {
    Loader2, AlertCircle, FileSearch, Upload, X, Clock,
    CheckCircle2, Award, AlertTriangle, ChevronDown, ChevronUp,
    Building2, Hash, Euro, Timer, Star
} from 'lucide-react';
import { analyzeQuotes } from '../../../api/commerce';

// ── Estimation & progression ─────────────────────────────────────────────────

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

function estimateDuration(files: File[]): number {
    const totalMB = files.reduce((s, f) => s + f.size / 1024 / 1024, 0);
    return Math.round(20 + files.length * 15 + totalMB * 25);
}

function formatSeconds(s: number): string {
    if (s <= 0) return '0s';
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, '0')}s`;
}

// ── Composant barre de progression ───────────────────────────────────────────

const ProgressPanel: React.FC<{ progress: number; elapsed: number; estimated: number }> = ({
    progress, elapsed, estimated
}) => {
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

            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>Écoulé : <strong className="text-gray-700 dark:text-gray-300 tabular-nums">{formatSeconds(elapsed)}</strong></span>
                </div>
                {!isDone && (
                    <span>Restant : <strong className="text-gray-700 dark:text-gray-300 tabular-nums">~{formatSeconds(remaining)}</strong></span>
                )}
                <span>Estimation totale : <strong className="text-gray-700 dark:text-gray-300 tabular-nums">~{formatSeconds(estimated)}</strong></span>
            </div>
        </div>
    );
};

// ── Composant résultats ───────────────────────────────────────────────────────

interface PosteTravaux {
    corps_etat: string;
    description: string;
    quantite: string;
    prix_total: string;
}

interface Devis {
    id: number | string;
    nom_fournisseur: string;
    siret?: string;
    prix_total_ht: string;
    prix_total_ttc: string;
    tva: string;
    delais_execution: string;
    postes_travaux: PosteTravaux[];
}

interface AnalysisData {
    resume_executif: string;
    devis: Devis[];
    comparaison: {
        meilleur_rapport_qualite_prix: string;
        alertes_conformite: string[];
        points_attention_communs: string[];
    };
    recommandation: {
        devis_recommande: string;
        justification: string;
    };
}

const DevisCard: React.FC<{ devis: Devis; isRecommended: boolean; isBestValue: boolean }> = ({
    devis, isRecommended, isBestValue
}) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={`rounded-xl border-2 overflow-hidden transition-all ${
            isRecommended
                ? 'border-green-400 dark:border-green-600 shadow-lg shadow-green-100 dark:shadow-green-900/30'
                : 'border-gray-200 dark:border-gray-700'
        }`}>
            {/* En-tête de la carte */}
            <div className={`px-5 py-4 flex items-start justify-between gap-2 ${
                isRecommended
                    ? 'bg-green-50 dark:bg-green-900/30'
                    : 'bg-gray-50 dark:bg-gray-700/40'
            }`}>
                <div className="flex items-center gap-2 min-w-0">
                    <Building2 className={`w-5 h-5 flex-shrink-0 ${isRecommended ? 'text-green-600' : 'text-gray-500'}`} />
                    <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white truncate">{devis.nom_fournisseur}</p>
                        {devis.siret && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <Hash className="w-3 h-3" /> {devis.siret}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                    {isRecommended && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                            <CheckCircle2 className="w-3 h-3" /> Recommandé
                        </span>
                    )}
                    {isBestValue && !isRecommended && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                            <Star className="w-3 h-3" /> Meilleur prix
                        </span>
                    )}
                </div>
            </div>

            {/* Infos principales */}
            <div className="px-5 py-4 bg-white dark:bg-gray-800">
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1">
                            <Euro className="w-3 h-3" /> Total HT
                        </p>
                        <p className="text-base font-bold text-gray-900 dark:text-white">{devis.prix_total_ht}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1">
                            <Euro className="w-3 h-3" /> Total TTC
                        </p>
                        <p className="text-base font-bold text-gray-900 dark:text-white">{devis.prix_total_ttc}</p>
                    </div>
                </div>

                <div className="flex gap-3 text-sm mb-4">
                    <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        <span className="font-medium">TVA :</span> {devis.tva}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        <Timer className="w-3.5 h-3.5" />
                        <span className="font-medium">Délai :</span> {devis.delais_execution}
                    </span>
                </div>

                {/* Postes de travaux */}
                {devis.postes_travaux?.length > 0 && (
                    <div>
                        <button
                            onClick={() => setExpanded(v => !v)}
                            className="w-full flex items-center justify-between text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 py-1"
                        >
                            <span>{devis.postes_travaux.length} poste{devis.postes_travaux.length > 1 ? 's' : ''} de travaux</span>
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {expanded && (
                            <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-left">
                                            <th className="px-3 py-2 font-semibold">Corps d'état</th>
                                            <th className="px-3 py-2 font-semibold">Description</th>
                                            <th className="px-3 py-2 font-semibold text-right">Qté</th>
                                            <th className="px-3 py-2 font-semibold text-right">Prix</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {devis.postes_travaux.map((p, i) => (
                                            <tr key={i} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{p.corps_etat}</td>
                                                <td className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-xs">{p.description}</td>
                                                <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.quantite}</td>
                                                <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">{p.prix_total}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const AnalysisResults: React.FC<{ data: AnalysisData }> = ({ data }) => {
    const recommendedId = String(data.recommandation?.devis_recommande);
    const bestValueId   = String(data.comparaison?.meilleur_rapport_qualite_prix);

    return (
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 space-y-8">

            {/* Résumé exécutif */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
                <h3 className="text-base font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2 mb-2">
                    <FileSearch className="w-5 h-5" /> Résumé exécutif
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">{data.resume_executif}</p>
            </div>

            {/* Cartes des devis */}
            <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Devis analysés</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {data.devis?.map(devis => (
                        <DevisCard
                            key={devis.id}
                            devis={devis}
                            isRecommended={String(devis.id) === recommendedId}
                            isBestValue={String(devis.id) === bestValueId}
                        />
                    ))}
                </div>
            </div>

            {/* Comparaison */}
            {data.comparaison && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {data.comparaison.alertes_conformite?.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
                            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-3">
                                <AlertTriangle className="w-4 h-4" /> Alertes de conformité
                            </h4>
                            <ul className="space-y-1.5">
                                {data.comparaison.alertes_conformite.map((a, i) => (
                                    <li key={i} className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                                        <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        {a}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {data.comparaison.points_attention_communs?.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
                                <AlertCircle className="w-4 h-4" /> Points d'attention communs
                            </h4>
                            <ul className="space-y-1.5">
                                {data.comparaison.points_attention_communs.map((p, i) => (
                                    <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                                        <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400" />
                                        {p}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Recommandation */}
            {data.recommandation && (
                <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-xl p-6">
                    <h3 className="text-base font-bold text-green-900 dark:text-green-200 flex items-center gap-2 mb-1">
                        <Award className="w-5 h-5 text-green-600" /> Recommandation de l'IA
                    </h3>
                    <p className="text-xs text-green-700 dark:text-green-400 mb-3">
                        Devis recommandé : <strong>Devis n°{data.recommandation.devis_recommande}</strong>
                    </p>
                    <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed">{data.recommandation.justification}</p>
                </div>
            )}
        </div>
    );
};

// ── Composant principal ───────────────────────────────────────────────────────

export const AnalyseDevis: React.FC = () => {
    const [fileSlots, setFileSlots] = useState<(File | null)[]>([null, null, null]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AnalysisData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [progress, setProgress] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const [estimated, setEstimated] = useState(60);

    const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const elapsedRef  = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentProgressRef = useRef(0);

    const clearTimers = () => {
        if (progressRef.current) clearInterval(progressRef.current);
        if (elapsedRef.current)  clearInterval(elapsedRef.current);
    };

    const startProgress = (files: File[]) => {
        const totalEstimated = estimateDuration(files);
        setEstimated(totalEstimated);
        setProgress(0);
        setElapsed(0);
        currentProgressRef.current = 0;

        elapsedRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);

        const tickMs = 300;
        const ticksToReach85 = (totalEstimated * 1000) / tickMs;
        const stepTo85 = 85 / ticksToReach85;

        progressRef.current = setInterval(() => {
            setProgress(prev => {
                const current = currentProgressRef.current;
                const next = current < 85
                    ? Math.min(current + stepTo85, 85)
                    : Math.min(current + 0.03, 95);
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

                {(loading || progress > 0) && (
                    <ProgressPanel progress={progress} elapsed={elapsed} estimated={estimated} />
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

                {result && <AnalysisResults data={result} />}
            </div>
        </div>
    );
};
