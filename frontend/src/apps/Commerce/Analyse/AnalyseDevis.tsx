import React, { useState, useEffect, useRef } from 'react';
import {
    Loader2, AlertCircle, FileSearch, Upload, X, Clock,
    CheckCircle2, Award, AlertTriangle, ChevronDown, ChevronUp,
    Building2, Hash, Euro, Timer, Star, Phone, Mail, MapPin,
    Shield, ShieldCheck, ShieldAlert, CreditCard, Calendar, Info,
    FileDown, History, Save, Trash2, FolderOpen, RotateCcw
} from 'lucide-react';
import {
    analyzeQuotes,
    saveAnalysis,
    getAnalyses,
    getAnalysis,
    deleteAnalysis,
    type SavedAnalysisSummary,
    type FichierInfo,
} from '../../../api/commerce';

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

// ── Barre de progression ──────────────────────────────────────────────────────

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
                            }`}>{s.label}</span>
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
                <span>Estimation : <strong className="text-gray-700 dark:text-gray-300 tabular-nums">~{formatSeconds(estimated)}</strong></span>
            </div>
        </div>
    );
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssuranceDecennale {
    assureur: string | null;
    numero_police: string | null;
    validite: string | null;
}

interface PosteTravaux {
    numero?: string;
    corps_etat: string;
    description: string;
    unite?: string;
    quantite: string;
    prix_unitaire_ht?: string;
    prix_total_ht?: string;
    // legacy
    prix_total?: string;
}

interface Devis {
    id: number | string;
    nom_fournisseur: string;
    siret?: string | null;
    adresse?: string | null;
    telephone?: string | null;
    email?: string | null;
    assurance_decennale?: AssuranceDecennale | null;
    prix_total_ht: string;
    prix_total_ttc: string;
    tva: string;
    delais_execution: string;
    conditions_paiement?: string | null;
    validite_offre?: string | null;
    postes_travaux: PosteTravaux[];
}

interface PosteComparaison {
    libelle: string;
    corps_etat: string;
    par_devis: Array<{ id: number | string; qte: string; pu: string; total: string }>;
    best_qte_id: number | string;
    best_pu_id: number | string;
    target_ht: string;
    ecart_qte: string;
    ecart_pu: string;
    negocier: boolean;
    motif?: string;
}

interface AnalysisData {
    resume_executif: string;
    devis: Devis[];
    comparaison: {
        moins_disant?: string;
        mieux_disant?: string;
        meilleur_rapport_qualite_prix?: string;
        ecart_prix?: string;
        alertes_conformite: string[];
        points_attention_communs: string[];
    };
    recommandation: {
        devis_recommande: string;
        justification: string;
    };
    comparaison_postes?: PosteComparaison[];
    prix_cible_ht?: string;
}

// ── Carte devis ───────────────────────────────────────────────────────────────

const BadgeDecennale: React.FC<{ data?: AssuranceDecennale | null }> = ({ data }) => {
    const hasDecennale = data && (data.assureur || data.numero_police);
    if (hasDecennale) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                <ShieldCheck className="w-3 h-3" /> Décennale OK
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
            <ShieldAlert className="w-3 h-3" /> Décennale absente
        </span>
    );
};

const DevisCard: React.FC<{ devis: Devis; isRecommended: boolean; isBestValue: boolean; index: number }> = ({
    devis, isRecommended, isBestValue, index
}) => {
    const [expanded, setExpanded] = useState(false);
    const postes = devis.postes_travaux ?? [];
    const hasSiret = devis.siret && devis.siret !== 'null';
    const hasDecennale = devis.assurance_decennale && (
        devis.assurance_decennale.assureur || devis.assurance_decennale.numero_police
    );

    return (
        <div className={`rounded-xl border-2 overflow-hidden ${
            isRecommended
                ? 'border-green-400 dark:border-green-600 shadow-lg shadow-green-100 dark:shadow-green-900/30'
                : 'border-gray-200 dark:border-gray-700'
        }`}>

            {/* En-tête couleur */}
            <div className={`px-5 py-4 ${isRecommended ? 'bg-green-50 dark:bg-green-900/30' : 'bg-gray-50 dark:bg-gray-700/40'}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2 min-w-0">
                        <Building2 className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isRecommended ? 'text-green-600' : 'text-orange-500'}`} />
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Devis {index + 1}</p>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                                {devis.nom_fournisseur || 'Fournisseur inconnu'}
                            </h3>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {isRecommended && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                                <CheckCircle2 className="w-3 h-3" /> Recommandé
                            </span>
                        )}
                        {isBestValue && !isRecommended && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                                <Star className="w-3 h-3" /> Moins-disant
                            </span>
                        )}
                        <BadgeDecennale data={devis.assurance_decennale} />
                    </div>
                </div>

                {/* Infos contact/légales */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {hasSiret ? (
                        <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                            <Hash className="w-3 h-3 text-gray-400" />
                            <span className="font-medium">SIRET :</span> {devis.siret}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3 h-3" /> SIRET non renseigné
                        </span>
                    )}
                    {devis.adresse && (
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            <MapPin className="w-3 h-3 flex-shrink-0" /> {devis.adresse}
                        </span>
                    )}
                    {devis.telephone && (
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Phone className="w-3 h-3" /> {devis.telephone}
                        </span>
                    )}
                    {devis.email && (
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Mail className="w-3 h-3" /> {devis.email}
                        </span>
                    )}
                </div>
            </div>

            <div className="px-5 py-4 bg-white dark:bg-gray-800 space-y-4">

                {/* Assurance décennale détaillée */}
                {hasDecennale && (
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mb-1">
                            <Shield className="w-3.5 h-3.5" /> Assurance Décennale
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-emerald-800 dark:text-emerald-300">
                            {devis.assurance_decennale!.assureur && (
                                <span><strong>Assureur :</strong> {devis.assurance_decennale!.assureur}</span>
                            )}
                            {devis.assurance_decennale!.numero_police && (
                                <span><strong>Police :</strong> {devis.assurance_decennale!.numero_police}</span>
                            )}
                            {devis.assurance_decennale!.validite && (
                                <span><strong>Validité :</strong> {devis.assurance_decennale!.validite}</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Prix */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1">
                            <Euro className="w-3 h-3" /> Total HT
                        </p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{devis.prix_total_ht}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1">
                            <Euro className="w-3 h-3" /> Total TTC
                        </p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{devis.prix_total_ttc}</p>
                    </div>
                </div>

                {/* Méta */}
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                        <span className="font-medium">TVA :</span> {devis.tva}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Timer className="w-3.5 h-3.5" />
                        <span className="font-medium">Délai :</span> {devis.delais_execution}
                    </span>
                    {devis.conditions_paiement && (
                        <span className="flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5" />
                            {devis.conditions_paiement}
                        </span>
                    )}
                    {devis.validite_offre && (
                        <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            Validité : {devis.validite_offre}
                        </span>
                    )}
                </div>

                {/* Tableau des postes */}
                {postes.length > 0 && (
                    <div>
                        <button
                            onClick={() => setExpanded(v => !v)}
                            className="w-full flex items-center justify-between text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 py-1 border-t border-gray-100 dark:border-gray-700 pt-3"
                        >
                            <span>{postes.length} poste{postes.length > 1 ? 's' : ''} de travaux</span>
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {expanded && (
                            <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-left">
                                            <th className="px-3 py-2 font-semibold w-6">#</th>
                                            <th className="px-3 py-2 font-semibold">Corps d'état</th>
                                            <th className="px-3 py-2 font-semibold">Description</th>
                                            <th className="px-3 py-2 font-semibold text-right">Qté</th>
                                            <th className="px-3 py-2 font-semibold text-right">Unité</th>
                                            <th className="px-3 py-2 font-semibold text-right">P.U. HT</th>
                                            <th className="px-3 py-2 font-semibold text-right">Total HT</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {postes.map((p, i) => (
                                            <tr key={i} className={`bg-white dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-orange-900/10 ${
                                                i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/50'
                                            }`}>
                                                <td className="px-3 py-2 text-gray-400">{p.numero ?? i + 1}</td>
                                                <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{p.corps_etat}</td>
                                                <td className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-[220px]">
                                                    <span title={p.description} className="line-clamp-2">{p.description}</span>
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">{p.quantite}</td>
                                                <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">{p.unite ?? '—'}</td>
                                                <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.prix_unitaire_ht ?? '—'}</td>
                                                <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                                                    {p.prix_total_ht ?? p.prix_total ?? '—'}
                                                </td>
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

// ── Comparaison poste par poste ───────────────────────────────────────────────

const ComparaisonPostes: React.FC<{ data: AnalysisData }> = ({ data }) => {
    const postes = data.comparaison_postes ?? [];
    const devis = data.devis ?? [];

    if (postes.length === 0 || devis.length < 2) return null;

    const postesANegocier = postes.filter(p => p.negocier);

    // Couleurs par devis (max 4)
    const devisTheme = [
        { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-100', border: 'border-orange-300 dark:border-orange-700' },
        { bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-700 dark:text-blue-300',   badge: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100',   border: 'border-blue-300 dark:border-blue-700'   },
        { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', badge: 'bg-purple-100 text-purple-800', border: 'border-purple-300' },
        { bg: 'bg-teal-50 dark:bg-teal-900/20',   text: 'text-teal-700 dark:text-teal-300',   badge: 'bg-teal-100 text-teal-800',   border: 'border-teal-300'   },
    ];

    const getDevisName = (id: number | string) => {
        const d = devis.find(d => String(d.id) === String(id));
        return d ? (d.nom_fournisseur || `Devis ${id}`) : `Devis ${id}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Euro className="w-5 h-5 text-orange-500" />
                    Analyse comparative poste par poste
                </h3>
                {data.prix_cible_ht && (
                    <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Prix cible (best qté × best PU)</p>
                        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{data.prix_cible_ht}</p>
                    </div>
                )}
            </div>

            {/* Légende devis */}
            <div className="flex flex-wrap gap-3">
                {devis.map((d, i) => (
                    <span key={d.id} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${devisTheme[i % 4].badge}`}>
                        <Building2 className="w-3 h-3" />
                        Devis {i + 1} — {d.nom_fournisseur || 'Inconnu'}
                    </span>
                ))}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100">
                    <Star className="w-3 h-3" /> Prix cible = meilleur de chaque
                </span>
            </div>

            {/* Tableau */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            <th className="px-3 py-2.5 text-left font-semibold sticky left-0 bg-gray-100 dark:bg-gray-700 min-w-[160px]">Poste</th>
                            <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Corps d'état</th>
                            {devis.map((d, i) => (
                                <React.Fragment key={d.id}>
                                    <th className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap ${devisTheme[i % 4].text}`}>
                                        Qté D{i + 1}
                                    </th>
                                    <th className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap ${devisTheme[i % 4].text}`}>
                                        PU HT D{i + 1}
                                    </th>
                                </React.Fragment>
                            ))}
                            <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap text-amber-600 dark:text-amber-400">Écart Qté</th>
                            <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap text-amber-600 dark:text-amber-400">Écart PU</th>
                            <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap text-emerald-600 dark:text-emerald-400">Prix cible</th>
                            <th className="px-3 py-2.5 text-center font-semibold">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {postes.map((poste, idx) => (
                            <tr key={idx} className={`${poste.negocier ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'bg-white dark:bg-gray-800'} hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}>
                                {/* Libellé */}
                                <td className={`px-3 py-2 font-medium text-gray-800 dark:text-gray-200 sticky left-0 ${poste.negocier ? 'bg-amber-50/80 dark:bg-amber-900/20' : 'bg-white dark:bg-gray-800'}`}>
                                    <span title={poste.libelle} className="line-clamp-2">{poste.libelle}</span>
                                </td>
                                {/* Corps d'état */}
                                <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">{poste.corps_etat}</td>
                                {/* Colonnes par devis */}
                                {devis.map((d) => {
                                    const entry = poste.par_devis.find(e => String(e.id) === String(d.id));
                                    const isBestQte = String(poste.best_qte_id) === String(d.id);
                                    const isBestPu  = String(poste.best_pu_id) === String(d.id);
                                    return (
                                        <React.Fragment key={d.id}>
                                            <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${isBestQte ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {isBestQte && <span className="mr-1 text-emerald-500">✓</span>}
                                                {entry?.qte ?? '—'}
                                            </td>
                                            <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${isBestPu ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {isBestPu && <span className="mr-1 text-emerald-500">✓</span>}
                                                {entry?.pu ?? '—'}
                                            </td>
                                        </React.Fragment>
                                    );
                                })}
                                {/* Écart Qté */}
                                <td className="px-3 py-2 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded font-semibold ${
                                        poste.ecart_qte?.startsWith('+')
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    }`}>
                                        {poste.ecart_qte}
                                    </span>
                                </td>
                                {/* Écart PU */}
                                <td className="px-3 py-2 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded font-semibold ${
                                        poste.ecart_pu?.startsWith('+')
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    }`}>
                                        {poste.ecart_pu}
                                    </span>
                                </td>
                                {/* Prix cible */}
                                <td className="px-3 py-2 text-right font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                                    {poste.target_ht}
                                </td>
                                {/* Action */}
                                <td className="px-3 py-2 text-center">
                                    {poste.negocier && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 whitespace-nowrap">
                                            <AlertTriangle className="w-2.5 h-2.5" /> Négocier
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    {/* Ligne récap prix cible */}
                    {data.prix_cible_ht && (
                        <tfoot>
                            <tr className="bg-emerald-50 dark:bg-emerald-900/20 border-t-2 border-emerald-300 dark:border-emerald-700">
                                <td colSpan={2 + devis.length * 2 + 2} className="px-3 py-2.5 text-sm font-bold text-emerald-800 dark:text-emerald-200">
                                    Prix cible total (meilleure qté × meilleur PU sur chaque poste)
                                </td>
                                <td className="px-3 py-2.5 text-right text-lg font-extrabold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                                    {data.prix_cible_ht}
                                </td>
                                <td />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Postes à négocier */}
            {postesANegocier.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4" /> {postesANegocier.length} poste{postesANegocier.length > 1 ? 's' : ''} à négocier en priorité
                    </h4>
                    <div className="space-y-2">
                        {postesANegocier.map((p, i) => (
                            <div key={i} className="flex items-start gap-3 text-sm">
                                <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center justify-center">
                                    {i + 1}
                                </span>
                                <div>
                                    <span className="font-semibold text-amber-900 dark:text-amber-200">{p.libelle}</span>
                                    {p.corps_etat && <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">({p.corps_etat})</span>}
                                    {p.motif && <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{p.motif}</p>}
                                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                                        Meilleure qté : <strong>{getDevisName(p.best_qte_id)}</strong> · Meilleur PU : <strong>{getDevisName(p.best_pu_id)}</strong>
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                    {data.prix_cible_ht && (() => {
                        const recommId = String(data.recommandation?.devis_recommande ?? '');
                        const recommDevis = data.devis?.find(d => String(d.id) === recommId);
                        return recommDevis ? (
                            <div className="mt-4 pt-3 border-t border-amber-200 dark:border-amber-700 flex items-center justify-between text-sm">
                                <span className="text-amber-700 dark:text-amber-400">
                                    Devis recommandé actuel ({recommDevis.nom_fournisseur}) : <strong>{recommDevis.prix_total_ht}</strong>
                                </span>
                                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                    → Prix cible : {data.prix_cible_ht}
                                </span>
                            </div>
                        ) : null;
                    })()}
                </div>
            )}
        </div>
    );
};

// ── Export PDF ────────────────────────────────────────────────────────────────

function exportToPDF(data: AnalysisData) {
    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const recommendedId = String(data.recommandation?.devis_recommande ?? '');

    const devisHtml = (data.devis ?? []).map((devis, i) => {
        const hasSiret = devis.siret && devis.siret !== 'null';
        const hasDecennale = devis.assurance_decennale &&
            (devis.assurance_decennale.assureur || devis.assurance_decennale.numero_police);
        const isRecommended = String(devis.id) === recommendedId;
        const postes = devis.postes_travaux ?? [];

        const postesRows = postes.map((p, pi) => `
            <tr style="background:${pi % 2 === 0 ? '#fff' : '#f9fafb'}">
                <td style="padding:4px 8px;color:#9ca3af;border-bottom:1px solid #f3f4f6">${p.numero ?? pi + 1}</td>
                <td style="padding:4px 8px;font-weight:500;border-bottom:1px solid #f3f4f6">${p.corps_etat}</td>
                <td style="padding:4px 8px;color:#4b5563;border-bottom:1px solid #f3f4f6">${p.description}</td>
                <td style="padding:4px 8px;text-align:right;border-bottom:1px solid #f3f4f6">${p.quantite}</td>
                <td style="padding:4px 8px;text-align:right;color:#6b7280;border-bottom:1px solid #f3f4f6">${p.unite ?? '—'}</td>
                <td style="padding:4px 8px;text-align:right;color:#6b7280;border-bottom:1px solid #f3f4f6">${p.prix_unitaire_ht ?? '—'}</td>
                <td style="padding:4px 8px;text-align:right;font-weight:600;border-bottom:1px solid #f3f4f6">${p.prix_total_ht ?? p.prix_total ?? '—'}</td>
            </tr>`).join('');

        return `
        <div style="border:2px solid ${isRecommended ? '#4ade80' : '#e5e7eb'};border-radius:12px;overflow:hidden;margin-bottom:20px;page-break-inside:avoid">
            <div style="background:${isRecommended ? '#f0fdf4' : '#f9fafb'};padding:16px 20px">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                    <div>
                        <p style="font-size:11px;color:#6b7280;margin:0 0 2px">Devis ${i + 1}</p>
                        <h3 style="font-size:16px;font-weight:700;color:#111827;margin:0">${devis.nom_fournisseur || 'Fournisseur inconnu'}</h3>
                    </div>
                    <div style="text-align:right">
                        ${isRecommended ? '<span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600">✓ Recommandé</span>' : ''}
                        <div style="margin-top:4px;font-size:11px;font-weight:600;color:${hasDecennale ? '#166534' : '#dc2626'}">
                            ${hasDecennale ? '✓ Décennale OK' : '✗ Décennale absente'}
                        </div>
                    </div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:11px;color:#6b7280">
                    ${hasSiret ? `<span><strong>SIRET :</strong> ${devis.siret}</span>` : '<span style="color:#d97706">⚠ SIRET non renseigné</span>'}
                    ${devis.adresse ? `<span>📍 ${devis.adresse}</span>` : ''}
                    ${devis.telephone ? `<span>📞 ${devis.telephone}</span>` : ''}
                    ${devis.email ? `<span>✉ ${devis.email}</span>` : ''}
                </div>
            </div>
            <div style="padding:16px 20px;background:#fff">
                ${hasDecennale ? `
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:11px">
                    <strong style="color:#166534">Assurance Décennale</strong><br/>
                    ${devis.assurance_decennale!.assureur ? `Assureur : ${devis.assurance_decennale!.assureur}` : ''}
                    ${devis.assurance_decennale!.numero_police ? ` | Police : ${devis.assurance_decennale!.numero_police}` : ''}
                    ${devis.assurance_decennale!.validite ? ` | Validité : ${devis.assurance_decennale!.validite}` : ''}
                </div>` : ''}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
                    <div style="background:#f9fafb;border-radius:8px;padding:10px 14px">
                        <p style="font-size:11px;color:#6b7280;margin:0 0 2px">Total HT</p>
                        <p style="font-size:18px;font-weight:700;color:#111827;margin:0">${devis.prix_total_ht}</p>
                    </div>
                    <div style="background:#f9fafb;border-radius:8px;padding:10px 14px">
                        <p style="font-size:11px;color:#6b7280;margin:0 0 2px">Total TTC</p>
                        <p style="font-size:18px;font-weight:700;color:#111827;margin:0">${devis.prix_total_ttc}</p>
                    </div>
                </div>
                <div style="font-size:12px;color:#4b5563;margin-bottom:12px">
                    TVA : ${devis.tva} &nbsp;|&nbsp; Délai : ${devis.delais_execution}
                    ${devis.conditions_paiement ? ` &nbsp;|&nbsp; ${devis.conditions_paiement}` : ''}
                    ${devis.validite_offre ? ` &nbsp;|&nbsp; Validité offre : ${devis.validite_offre}` : ''}
                </div>
                ${postes.length > 0 ? `
                <table style="width:100%;border-collapse:collapse;font-size:11px">
                    <thead>
                        <tr style="background:#f3f4f6;color:#374151">
                            <th style="padding:6px 8px;text-align:left;font-weight:600">#</th>
                            <th style="padding:6px 8px;text-align:left;font-weight:600">Corps d'état</th>
                            <th style="padding:6px 8px;text-align:left;font-weight:600">Description</th>
                            <th style="padding:6px 8px;text-align:right;font-weight:600">Qté</th>
                            <th style="padding:6px 8px;text-align:right;font-weight:600">Unité</th>
                            <th style="padding:6px 8px;text-align:right;font-weight:600">P.U. HT</th>
                            <th style="padding:6px 8px;text-align:right;font-weight:600">Total HT</th>
                        </tr>
                    </thead>
                    <tbody>${postesRows}</tbody>
                </table>` : ''}
            </div>
        </div>`;
    }).join('');

    // ── Tableau comparaison postes ───────────────────────────────────────────
    const comparaisonPostes = data.comparaison_postes ?? [];
    const comparaisonTableHtml = comparaisonPostes.length > 0 && data.devis?.length >= 2 ? (() => {
        const devisArr = data.devis ?? [];
        const devisHeaders = devisArr.map((_d, i) =>
            `<th style="padding:5px 8px;text-align:right;font-weight:600;color:#ea580c">Qté D${i+1}</th>
             <th style="padding:5px 8px;text-align:right;font-weight:600;color:#ea580c">PU D${i+1}</th>`
        ).join('');

        const rows = comparaisonPostes.map(poste => {
            const cellsDevis = devisArr.map(d => {
                const entry = poste.par_devis?.find((e: any) => String(e.id) === String(d.id));
                const isBestQte = String(poste.best_qte_id) === String(d.id);
                const isBestPu  = String(poste.best_pu_id)  === String(d.id);
                return `
                    <td style="padding:4px 8px;text-align:right;font-weight:${isBestQte?'700':'400'};color:${isBestQte?'#166534':'#374151'}">${isBestQte?'✓ ':''}${entry?.qte??'—'}</td>
                    <td style="padding:4px 8px;text-align:right;font-weight:${isBestPu?'700':'400'};color:${isBestPu?'#166534':'#374151'}">${isBestPu?'✓ ':''}${entry?.pu??'—'}</td>`;
            }).join('');

            const ecartQteColor = poste.ecart_qte?.startsWith('+') ? '#dc2626' : '#166534';
            const ecartPuColor  = poste.ecart_pu?.startsWith('+')  ? '#dc2626' : '#166534';
            return `<tr style="background:${poste.negocier?'#fffbeb':'#fff'};border-bottom:1px solid #f3f4f6">
                <td style="padding:4px 8px;font-weight:500">${poste.libelle}</td>
                <td style="padding:4px 8px;color:#6b7280">${poste.corps_etat}</td>
                ${cellsDevis}
                <td style="padding:4px 8px;text-align:center;font-weight:600;color:${ecartQteColor}">${poste.ecart_qte}</td>
                <td style="padding:4px 8px;text-align:center;font-weight:600;color:${ecartPuColor}">${poste.ecart_pu}</td>
                <td style="padding:4px 8px;text-align:right;font-weight:700;color:#166534">${poste.target_ht}</td>
                <td style="padding:4px 8px;text-align:center">${poste.negocier?'<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:600">À négocier</span>':''}</td>
            </tr>`;
        }).join('');

        const postesNeg = comparaisonPostes.filter((p: any) => p.negocier);
        const negList = postesNeg.map((p: any) =>
            `<li style="margin-bottom:6px"><strong>${p.libelle}</strong>${p.motif ? ` — ${p.motif}` : ''}<br/>
             <span style="font-size:11px;color:#92400e">Meilleure qté : D${p.best_qte_id} · Meilleur PU : D${p.best_pu_id}</span></li>`
        ).join('');

        return `
        <h2 style="font-size:16px;font-weight:700;color:#111827;margin:24px 0 12px">Analyse comparative poste par poste</h2>
        <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead><tr style="background:#f3f4f6;color:#374151">
                <th style="padding:5px 8px;text-align:left;font-weight:600">Poste</th>
                <th style="padding:5px 8px;text-align:left;font-weight:600">Corps d'état</th>
                ${devisHeaders}
                <th style="padding:5px 8px;text-align:center;font-weight:600;color:#d97706">Écart Qté</th>
                <th style="padding:5px 8px;text-align:center;font-weight:600;color:#d97706">Écart PU</th>
                <th style="padding:5px 8px;text-align:right;font-weight:600;color:#166534">Prix cible</th>
                <th style="padding:5px 8px;text-align:center;font-weight:600">Action</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            ${data.prix_cible_ht ? `<tfoot><tr style="background:#f0fdf4;border-top:2px solid #86efac">
                <td colspan="${2 + devisArr.length * 2 + 2}" style="padding:6px 8px;font-weight:700;color:#166534">Prix cible total (meilleure qté × meilleur PU par poste)</td>
                <td style="padding:6px 8px;text-align:right;font-size:14px;font-weight:800;color:#166534">${data.prix_cible_ht}</td>
                <td></td>
            </tr></tfoot>` : ''}
        </table></div>
        ${postesNeg.length > 0 ? `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-top:16px">
            <h4 style="font-size:13px;font-weight:700;color:#92400e;margin:0 0 8px">⚠ ${postesNeg.length} poste${postesNeg.length>1?'s':''} à négocier en priorité</h4>
            <ul style="margin:0;padding-left:16px;font-size:12px">${negList}</ul>
        </div>` : ''}`;
    })() : '';

    const alertesHtml = (data.comparaison?.alertes_conformite ?? []).map(a =>
        `<li style="margin-bottom:4px;color:#92400e">⚠ ${a}</li>`
    ).join('');

    const pointsHtml = (data.comparaison?.points_attention_communs ?? []).map(p =>
        `<li style="margin-bottom:4px;color:#4b5563">• ${p}</li>`
    ).join('');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Analyse des Devis — ${today}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; margin: 0; padding: 32px; background: #fff; }
  @media print {
    body { padding: 16px; }
    @page { margin: 1.5cm; size: A4; }
  }
</style>
</head>
<body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #e5e7eb">
        <div>
            <h1 style="font-size:22px;font-weight:800;color:#ea580c;margin:0 0 4px">Analyse des Devis Prestataires</h1>
            <p style="font-size:13px;color:#6b7280;margin:0">Généré le ${today} · Analysé par Claude IA</p>
        </div>
        <div style="text-align:right;font-size:12px;color:#9ca3af">
            ${data.devis?.length ?? 0} devis comparé${(data.devis?.length ?? 0) > 1 ? 's' : ''}
        </div>
    </div>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin-bottom:24px">
        <h2 style="font-size:14px;font-weight:700;color:#1e40af;margin:0 0 8px">📋 Résumé exécutif</h2>
        <p style="font-size:13px;color:#1e3a8a;margin:0 0 6px;line-height:1.6">${data.resume_executif}</p>
        ${data.comparaison?.ecart_prix ? `<p style="font-size:12px;font-weight:600;color:#1d4ed8;margin:0">Écart de prix : ${data.comparaison.ecart_prix}</p>` : ''}
    </div>

    <h2 style="font-size:16px;font-weight:700;color:#111827;margin:0 0 16px">Devis analysés</h2>
    ${devisHtml}

    ${comparaisonTableHtml}

    ${(alertesHtml || pointsHtml) ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
        ${alertesHtml ? `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px">
            <h4 style="font-size:13px;font-weight:700;color:#92400e;margin:0 0 8px">⚠ Alertes de conformité</h4>
            <ul style="margin:0;padding-left:0;list-style:none;font-size:12px">${alertesHtml}</ul>
        </div>` : ''}
        ${pointsHtml ? `
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px">
            <h4 style="font-size:13px;font-weight:700;color:#374151;margin:0 0 8px">Points d'attention communs</h4>
            <ul style="margin:0;padding-left:0;list-style:none;font-size:12px">${pointsHtml}</ul>
        </div>` : ''}
    </div>` : ''}

    ${data.recommandation ? `
    <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:10px;padding:16px 20px;page-break-inside:avoid">
        <h3 style="font-size:14px;font-weight:700;color:#166534;margin:0 0 6px">🏆 Recommandation de l'IA</h3>
        <p style="font-size:12px;color:#15803d;margin:0 0 8px">
            Devis recommandé : <strong>n°${data.recommandation.devis_recommande}</strong>
            ${data.devis?.find(d => String(d.id) === String(data.recommandation.devis_recommande))
                ? ` — ${data.devis.find(d => String(d.id) === String(data.recommandation.devis_recommande))!.nom_fournisseur}`
                : ''}
        </p>
        <p style="font-size:13px;color:#166534;margin:0;line-height:1.6">${data.recommandation.justification}</p>
    </div>` : ''}
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 400);
    }
}

// ── Résultats complets ────────────────────────────────────────────────────────

const AnalysisResults: React.FC<{ data: AnalysisData }> = ({ data }) => {
    const recommendedId = String(data.recommandation?.devis_recommande ?? '');
    const bestValueId   = String(
        data.comparaison?.moins_disant ??
        data.comparaison?.meilleur_rapport_qualite_prix ?? ''
    );

    return (
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 space-y-8">

            {/* Bouton export PDF */}
            <div className="flex justify-end">
                <button
                    onClick={() => exportToPDF(data)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-sm font-medium transition-colors"
                    title="Exporter l'analyse en PDF"
                >
                    <FileDown className="w-4 h-4" />
                    Exporter en PDF
                </button>
            </div>

            {/* Résumé exécutif */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
                <h3 className="text-base font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2 mb-2">
                    <Info className="w-5 h-5" /> Résumé exécutif
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">{data.resume_executif}</p>
                {data.comparaison?.ecart_prix && (
                    <p className="mt-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                        Écart de prix : {data.comparaison.ecart_prix}
                    </p>
                )}
            </div>

            {/* Cartes devis */}
            <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Devis analysés</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {data.devis?.map((devis, i) => (
                        <DevisCard
                            key={devis.id}
                            devis={devis}
                            index={i}
                            isRecommended={String(devis.id) === recommendedId}
                            isBestValue={String(devis.id) === bestValueId}
                        />
                    ))}
                </div>
            </div>

            {/* Comparaison poste par poste */}
            {data.comparaison_postes && data.comparaison_postes.length > 0 && (
                <ComparaisonPostes data={data} />
            )}

            {/* Alertes & attention */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {data.comparaison?.alertes_conformite?.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
                        <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-4 h-4" /> Alertes de conformité
                        </h4>
                        <ul className="space-y-1.5">
                            {data.comparaison.alertes_conformite.map((a, i) => (
                                <li key={i} className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                                    <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    {a}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {data.comparaison?.points_attention_communs?.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
                            <AlertCircle className="w-4 h-4" /> Points d'attention communs
                        </h4>
                        <ul className="space-y-1.5">
                            {data.comparaison.points_attention_communs.map((p, i) => (
                                <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                                    <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400" />
                                    {p}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Recommandation */}
            {data.recommandation && (
                <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-xl p-6">
                    <h3 className="text-base font-bold text-green-900 dark:text-green-200 flex items-center gap-2 mb-1">
                        <Award className="w-5 h-5 text-green-600" /> Recommandation de l'IA
                    </h3>
                    <p className="text-xs text-green-700 dark:text-green-400 mb-3">
                        Devis recommandé : <strong>n°{data.recommandation.devis_recommande}</strong>
                        {data.devis?.find(d => String(d.id) === String(data.recommandation.devis_recommande)) && (
                            <span className="ml-1">— {data.devis.find(d => String(d.id) === String(data.recommandation.devis_recommande))!.nom_fournisseur}</span>
                        )}
                    </p>
                    <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed">{data.recommandation.justification}</p>
                </div>
            )}
        </div>
    );
};

// ── Composant principal ───────────────────────────────────────────────────────

export const AnalyseDevis: React.FC = () => {
    const [view, setView] = useState<'nouvelle' | 'historique'>('nouvelle');
    const [fileSlots, setFileSlots] = useState<(File | null)[]>([null, null, null]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AnalysisData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [progress, setProgress] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const [estimated, setEstimated] = useState(60);

    // Sauvegarde
    const [nomProjet, setNomProjet] = useState('');
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [currentFiles, setCurrentFiles] = useState<FichierInfo[]>([]);

    // Historique
    const [historyItems, setHistoryItems] = useState<SavedAnalysisSummary[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyDeleteId, setHistoryDeleteId] = useState<string | null>(null);
    const [historyViewLoading, setHistoryViewLoading] = useState<string | null>(null);

    const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const elapsedRef  = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentProgressRef = useRef(0);

    const clearTimers = () => {
        if (progressRef.current) clearInterval(progressRef.current);
        if (elapsedRef.current)  clearInterval(elapsedRef.current);
    };

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const data = await getAnalyses();
            setHistoryItems(data.items);
            setHistoryTotal(data.total);
        } catch { /* silencieux */ }
        setHistoryLoading(false);
    };

    const handleViewHistory = () => {
        setView('historique');
        loadHistory();
    };

    const handleSave = async () => {
        if (!result) return;
        setSaveState('saving');
        try {
            await saveAnalysis(nomProjet || null, currentFiles, result);
            setSaveState('saved');
        } catch {
            setSaveState('error');
        }
    };

    const handleLoadFromHistory = async (id: string) => {
        setHistoryViewLoading(id);
        try {
            const saved = await getAnalysis(id);
            setResult(saved.result);
            setCurrentFiles(saved.fichiers_info);
            setNomProjet(saved.nom_projet || '');
            setSaveState('saved');
            setView('nouvelle');
        } catch { /* silencieux */ }
        setHistoryViewLoading(null);
    };

    const handleDeleteHistory = async (id: string) => {
        setHistoryDeleteId(id);
        try {
            await deleteAnalysis(id);
            setHistoryItems(prev => prev.filter(i => i.id !== id));
            setHistoryTotal(prev => prev - 1);
        } catch { /* silencieux */ }
        setHistoryDeleteId(null);
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
            setProgress(() => {
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
        setSaveState('idle');
        setNomProjet('');
        setCurrentFiles(validFiles.map(f => ({ name: f.name, size_bytes: f.size })));
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

                {/* Header avec onglets */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <FileSearch className="w-8 h-8 text-orange-500" />
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analyse des Devis Prestataires</h2>
                    </div>
                    <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <button
                            onClick={() => setView('nouvelle')}
                            className={`px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                                view === 'nouvelle'
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            <FileSearch className="w-4 h-4" /> Nouvelle analyse
                        </button>
                        <button
                            onClick={handleViewHistory}
                            className={`px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors border-l border-gray-200 dark:border-gray-700 ${
                                view === 'historique'
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            <History className="w-4 h-4" /> Historique
                            {historyTotal > 0 && (
                                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${view === 'historique' ? 'bg-white/20' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                    {historyTotal}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* ── VUE HISTORIQUE ── */}
                {view === 'historique' && (
                    <div>
                        {historyLoading ? (
                            <div className="flex items-center justify-center py-16 text-gray-400">
                                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement de l'historique…
                            </div>
                        ) : historyItems.length === 0 ? (
                            <div className="text-center py-16">
                                <FolderOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">Aucune analyse sauvegardée</p>
                                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Lancez une analyse puis cliquez sur "Sauvegarder"</p>
                                <button
                                    onClick={() => setView('nouvelle')}
                                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 hover:text-orange-700"
                                >
                                    <FileSearch className="w-4 h-4" /> Lancer une nouvelle analyse
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {historyItems.map((item) => (
                                    <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 hover:border-orange-300 dark:hover:border-orange-700 transition-colors group">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-900 dark:text-white truncate">
                                                {item.nom_projet || <span className="text-gray-400 italic">Sans nom</span>}
                                            </p>
                                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(item.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Building2 className="w-3 h-3" />
                                                    {item.nb_devis} devis analysé{item.nb_devis > 1 ? 's' : ''}
                                                </span>
                                                {item.fichiers_info.length > 0 && (
                                                    <span className="truncate max-w-[200px]" title={item.fichiers_info.map(f => f.name).join(', ')}>
                                                        {item.fichiers_info.map(f => f.name).join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => handleLoadFromHistory(item.id)}
                                                disabled={historyViewLoading === item.id}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/40 disabled:opacity-50 transition-colors"
                                            >
                                                {historyViewLoading === item.id
                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                    : <FolderOpen className="w-3 h-3" />
                                                }
                                                Consulter
                                            </button>
                                            <button
                                                onClick={() => handleDeleteHistory(item.id)}
                                                disabled={historyDeleteId === item.id}
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                                                title="Supprimer"
                                            >
                                                {historyDeleteId === item.id
                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : <Trash2 className="w-4 h-4" />
                                                }
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    onClick={loadHistory}
                                    className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1.5"
                                >
                                    <RotateCcw className="w-3 h-3" /> Rafraîchir
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── VUE NOUVELLE ANALYSE ── */}
                {view === 'nouvelle' && (
                    <>
                        <p className="text-gray-600 dark:text-gray-400 mb-8">
                            Déposez vos devis (PDF, images) pour les analyser et comparer automatiquement : SIRET, assurance décennale, postes de travaux ligne par ligne.
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
                                            >
                                                <X size={16} />
                                            </button>
                                            <div className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 font-semibold px-3 py-1 rounded text-sm mb-3">
                                                Devis {index + 1}
                                            </div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate w-full text-center px-2" title={file.name}>
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                    ) : (
                                        <div className="w-full h-full p-4 flex flex-col items-center justify-center text-center">
                                            <Upload className="h-8 w-8 text-gray-400 mb-3" />
                                            <div className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 font-medium px-3 py-1 rounded text-xs mb-3">
                                                Devis {index + 1}
                                            </div>
                                            <label className="cursor-pointer text-sm font-medium text-orange-600 hover:text-orange-500">
                                                <span>Sélectionner le fichier</span>
                                                <input type="file" className="sr-only" onChange={(e) => handleFileChange(index, e)} accept=".pdf,image/*" />
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
                                    {loading
                                        ? <><Loader2 className="w-5 h-5 animate-spin" /> Analyse IA en cours...</>
                                        : <><FileSearch className="w-5 h-5" /> Lancer l'analyse comparative</>
                                    }
                                </button>
                            </div>
                        )}

                        {result && (
                            <>
                                {/* Bandeau sauvegarde */}
                                {saveState !== 'saved' && (
                                    <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                        <Save className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-1">Sauvegarder cette analyse</p>
                                            <input
                                                type="text"
                                                value={nomProjet}
                                                onChange={e => setNomProjet(e.target.value)}
                                                placeholder="Nom du projet / chantier (facultatif)"
                                                className="w-full text-sm px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
                                            />
                                        </div>
                                        <button
                                            onClick={handleSave}
                                            disabled={saveState === 'saving'}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors flex-shrink-0"
                                        >
                                            {saveState === 'saving'
                                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sauvegarde…</>
                                                : saveState === 'error'
                                                    ? <><AlertCircle className="w-4 h-4" /> Réessayer</>
                                                    : <><Save className="w-4 h-4" /> Sauvegarder</>
                                            }
                                        </button>
                                    </div>
                                )}
                                {saveState === 'saved' && (
                                    <div className="mt-6 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                        Analyse sauvegardée{nomProjet ? ` — « ${nomProjet} »` : ''}.
                                        <button onClick={handleViewHistory} className="ml-auto underline text-xs hover:no-underline">
                                            Voir l'historique
                                        </button>
                                    </div>
                                )}

                                <AnalysisResults data={result} />
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
