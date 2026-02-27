import React, { useState, useEffect, useRef } from 'react';
import {
    Loader2, AlertCircle, FileSearch, Upload, X, Clock,
    CheckCircle2, Award, AlertTriangle, ChevronDown, ChevronUp,
    Building2, Hash, Euro, Timer, Star, Phone, Mail, MapPin,
    Shield, ShieldCheck, ShieldAlert, CreditCard, Calendar, Info,
    FileDown
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

                {result && <AnalysisResults data={result} />}
            </div>
        </div>
    );
};
