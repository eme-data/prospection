import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Paintbrush, Download, RefreshCw, Image, Trash2, CheckCircle2, Loader2, X, RotateCcw, Pencil } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { saveLogo, getLogos, deleteLogo } from '../../api/communication';

/** Sanitise un SVG pour supprimer tout script/event handler malveillant */
function sanitizeSVG(raw: string): string {
    return DOMPurify.sanitize(raw, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ['use'],
    });
}

/** Extrait le SVG pur depuis une réponse IA (retire markdown, texte, etc.) */
function extractSVG(raw: string): string | null {
    // Tente d'extraire depuis un bloc markdown ```svg ... ``` ou ``` ... ```
    const mdMatch = raw.match(/```(?:svg|xml)?\s*\n?([\s\S]*?)```/);
    if (mdMatch) {
        const inner = mdMatch[1].trim();
        if (inner.startsWith('<svg')) return inner;
    }
    // Tente d'extraire directement <svg ...>...</svg>
    const svgMatch = raw.match(/<svg[\s\S]*<\/svg>/i);
    if (svgMatch) return svgMatch[0];
    return null;
}

const API_URL = import.meta.env.VITE_API_URL ?? '';
const GALLERY_PAGE_SIZE = 12;

export const LogoCreator: React.FC = () => {
    const [provider, setProvider] = useState('claude');
    const [companyName, setCompanyName] = useState('');
    const [industry, setIndustry] = useState('');
    const [style, setStyle] = useState('icone-texte');
    const [colors, setColors] = useState('');
    const [shapeFill, setShapeFill] = useState<'auto' | 'filled' | 'outline'>('auto');
    const [description, setDescription] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentSVG, setCurrentSVG] = useState<string | null>(null);
    const [iterateMode, setIterateMode] = useState(false); // true = modifier le logo actuel

    // Barre de progression
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState('');
    const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopProgress = useCallback(() => {
        if (progressTimer.current) {
            clearInterval(progressTimer.current);
            progressTimer.current = null;
        }
    }, []);

    const startProgress = useCallback(() => {
        stopProgress();
        setProgress(0);
        setProgressLabel('Envoi de la requête...');
        const isIterate = iterateMode && !!currentSVG;
        const steps = isIterate ? [
            { at: 5, label: 'Connexion au modèle IA...' },
            { at: 15, label: 'Analyse du logo existant...' },
            { at: 30, label: 'Application des modifications...' },
            { at: 50, label: 'Reconstruction du SVG...' },
            { at: 70, label: 'Vérification de la cohérence...' },
            { at: 85, label: 'Finalisation...' },
            { at: 92, label: 'Presque terminé...' },
        ] : [
            { at: 5, label: 'Connexion au modèle IA...' },
            { at: 15, label: 'Analyse du brief créatif...' },
            { at: 30, label: 'Conception des formes...' },
            { at: 50, label: 'Construction du SVG...' },
            { at: 70, label: 'Ajout des dégradés et détails...' },
            { at: 85, label: 'Finalisation du logo...' },
            { at: 92, label: 'Presque terminé...' },
        ];
        let current = 0;
        progressTimer.current = setInterval(() => {
            current += 1;
            if (current > 95) current = 95;
            const step = [...steps].reverse().find(s => current >= s.at);
            if (step) setProgressLabel(step.label);
            setProgress(current);
        }, 600);
    }, [stopProgress]);

    useEffect(() => stopProgress, [stopProgress]);

    // Galerie
    const [showGallery, setShowGallery] = useState(false);
    const [galleryLimit, setGalleryLimit] = useState(GALLERY_PAGE_SIZE);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const queryClient = useQueryClient();

    const { data: gallery = [], isLoading: galleryLoading, refetch: refetchGallery } = useQuery({
        queryKey: ['logos'],
        queryFn: getLogos,
        enabled: showGallery,
        staleTime: 30_000,
    });

    const buildPrompt = () => {
        // Mode itération : on envoie le SVG actuel avec les instructions de modification
        if (iterateMode && currentSVG) {
            const parts = [
`Voici le code SVG d'un logo existant. Tu dois le MODIFIER selon les consignes de l'utilisateur ci-dessous.

IMPORTANT :
- NE PAS repartir de zéro. Conserve la structure, le style et l'identité du logo actuel.
- Applique UNIQUEMENT les modifications demandées par l'utilisateur.
- Tout ce qui n'est pas mentionné dans les consignes doit rester inchangé.

LOGO SVG ACTUEL :
${currentSVG}

RÈGLES SVG :
- viewBox="0 0 500 500", xmlns="http://www.w3.org/2000/svg"
- Pas de <image>, pas de xlink:href, pas de CSS externe
- Utilise <path>, <line>, <circle>, <rect>, <text>, <g>
- Couleurs en attributs fill/stroke directs, pas de classes CSS

FORMAT DE RÉPONSE :
Réponds UNIQUEMENT avec le code SVG modifié. Pas de markdown, pas de texte explicatif.
Commence directement par <svg et termine par </svg>.`,
            ];

            if (description) {
                parts.push(`
CONSIGNES DE MODIFICATION DE L'UTILISATEUR (à respecter impérativement) :
${description}`);
            } else {
                parts.push(`
L'utilisateur n'a pas précisé de consignes spécifiques. Améliore légèrement le logo en conservant son identité : affine les proportions, équilibre la composition, améliore la lisibilité si nécessaire.`);
            }

            return parts.join('\n');
        }

        // Mode création : prompt complet depuis zéro
        const colorDirective = colors
            ? `Couleurs imposées : ${colors}. Utilise UNIQUEMENT ces couleurs (+ noir/gris pour le texte si besoin).`
            : 'Choisis 1 à 2 couleurs sobres et élégantes adaptées au secteur (tons naturels, bleu marine, vert sapin, taupe, terracotta, doré…). Évite les couleurs vives ou saturées.';

        const sectorDirective = industry
            ? `Secteur d'activité (pour orienter le style, les couleurs et les formes UNIQUEMENT — NE PAS écrire le nom du secteur sur le logo) : ${industry}.`
            : '';

        const styleGuides: Record<string, string> = {
            'typographique': 'Style typographique : le logo repose sur un jeu de lettres créatif (monogramme, ligature, lettrine stylisée). La ou les premières lettres du nom forment le symbole principal. Typographie élégante avec empattements fins ou sans-serif épuré. Peut inclure un petit élément décoratif subtil (trait, arc, vague).',
            'icone-texte': 'Style icône + texte : une icône minimaliste simple (quelques traits/formes) au-dessus ou à gauche du nom écrit en dessous. L\'icône doit être sobre, reconnaissable, en lien avec l\'activité. Le nom est en typographie claire et lisible.',
            'symbole-pur': 'Style symbole pur : uniquement un pictogramme/symbole, sans aucun texte. Formes géométriques épurées, traits fins, design très minimaliste. Doit être identifiable en petit format.',
            'forme-fond': 'Style avec forme en arrière-plan : une forme géométrique douce (cercle, ovale, rectangle arrondi, médaillon, tache organique) est placée EN ARRIÈRE-PLAN, c\'est-à-dire DERRIÈRE le texte et les éléments du logo. La forme doit avoir une opacité réduite (opacity="0.08" à "0.15") ou un fill très clair/pastel pour créer un effet de fond subtil et ne pas gêner la lecture du texte par-dessus. Le texte (nom de l\'entreprise) et les icônes sont placés PAR-DESSUS la forme. L\'ordre des couches SVG est : 1) forme de fond en premier, 2) texte et icônes au-dessus. Les contours internes de la forme doivent être invisibles ou très discrets pour ne pas interférer avec le texte.',
            'elegant': 'Style élégant : typographie raffinée avec empattements, traits fins décoratifs, éventuellement une lettrine ornée. Rendu haut de gamme et sobre. Couleurs neutres ou dorées.',
        };

        const styleDirective = styleGuides[style] || styleGuides['icone-texte'];

        const shapeFillDirective = shapeFill === 'filled'
            ? 'REMPLISSAGE DES FORMES : Les formes et icônes doivent être REMPLIES avec une couleur de fond pleine (fill). Pas de formes vides avec seulement des contours.'
            : shapeFill === 'outline'
            ? 'REMPLISSAGE DES FORMES : Les formes et icônes doivent être en CONTOURS uniquement (stroke, sans fill ou avec fill="none"). Style filaire, traits fins, pas de remplissage plein.'
            : '';

        const parts = [
`Crée un logo SVG professionnel pour "${companyName}".
${sectorDirective}

DIRECTION ARTISTIQUE :
${styleDirective}
${colorDirective}
${shapeFillDirective ? shapeFillDirective + '\n' : ''}
PRINCIPES DE DESIGN (TRÈS IMPORTANT) :
- SOBRIÉTÉ : le logo doit être épuré, élégant, pas chargé. Peu de couleurs (1-2 + noir/gris), peu de formes.
- LIGNES FINES : privilégie les traits fins (stroke-width 1-3), les formes ouvertes, l'espace négatif. Pas de formes pleines massives.
- PAS DE DÉGRADÉS LOURDS : couleurs aplat ou un seul dégradé très subtil maximum. Pas d'effets 3D, pas d'ombres, pas de textures.
- TYPOGRAPHIE : si du texte est inclus, utilise <text> avec font-family="Georgia, 'Times New Roman', serif" pour un style élégant, ou font-family="'Helvetica Neue', Arial, sans-serif" pour un style moderne. Espacement des lettres avec letter-spacing="2" à "6" pour un rendu aéré.
- COMPOSITION AÉRÉE : laisse de l'espace autour des éléments, ne remplis pas tout le viewBox. Le logo doit respirer.
- PROFESSIONNEL : le résultat doit ressembler à un vrai logo d'entreprise haut de gamme, pas à un clipart ou une illustration enfantine.
- PAS DE SECTEUR SUR LE LOGO : n'écris JAMAIS le nom du secteur d'activité, le métier ou la catégorie professionnelle sur le logo. Seul le nom de l'entreprise (et éventuellement un slogan si demandé) doit apparaître en texte.

RÈGLES SVG :
- viewBox="0 0 500 500", xmlns="http://www.w3.org/2000/svg"
- Pas de <image>, pas de xlink:href, pas de CSS externe
- Utilise <path>, <line>, <circle>, <rect>, <text>, <g>
- Couleurs en attributs fill/stroke directs, pas de classes CSS`,
        ];

        parts.push(`
FORMAT DE RÉPONSE :
Réponds UNIQUEMENT avec le code SVG brut. Pas de markdown, pas de texte explicatif.
Commence directement par <svg et termine par </svg>.`);

        if (description) {
            parts.push(`
DEMANDES PRIORITAIRES DE L'UTILISATEUR (à respecter impérativement, elles priment sur les règles ci-dessus) :
${description}`);
        }

        return parts.filter(Boolean).join('\n');
    };

    const handleGenerate = async () => {
        if (!companyName.trim()) {
            setError('Veuillez entrer le nom de l\'entreprise');
            return;
        }

        setError(null);
        setIsLoading(true);
        startProgress();

        try {
            const prompt = buildPrompt();
            const token = localStorage.getItem('prospection_token');
            const response = await fetch(`${API_URL}/api/communication/logo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ prompt, provider })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || 'Erreur lors de la génération du logo.');
            }

            const data = await response.json();

            if (data.content && data.content[0] && data.content[0].text) {
                const raw = data.content[0].text;
                const svg = extractSVG(raw);
                if (!svg) {
                    throw new Error('Le modèle n\'a pas retourné de SVG valide. Réessayez.');
                }
                stopProgress();
                setProgress(100);
                setProgressLabel('Logo généré !');
                setCurrentSVG(svg);
                // Auto-save silencieux en arrière-plan
                saveLogo({
                    company_name: companyName,
                    sector: industry || undefined,
                    style,
                    colors: colors || undefined,
                    svg_content: svg,
                }).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['logos'] });
                }).catch(() => { /* silencieux */ });
            } else {
                throw new Error('Format de réponse invalide');
            }

        } catch (err: any) {
            setError(err.message || 'Une erreur est survenue');
        } finally {
            stopProgress();
            setIsLoading(false);
        }
    };

    const downloadSVG = (svg: string, name: string) => {
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name || 'logo'}.svg`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDeleteFromGallery = async (id: string) => {
        setDeleteId(id);
        try {
            await deleteLogo(id);
            queryClient.setQueryData(['logos'], (prev: typeof gallery) =>
                prev.filter(l => l.id !== id)
            );
        } catch { /* silencieux */ }
        setDeleteId(null);
    };

    const visibleLogos = gallery.slice(0, galleryLimit);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Paintbrush className="h-8 w-8 text-emerald-500" />
                        Générateur de Logos IA
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Créez des logos vectoriels uniques en utilisant la puissance de Claude, Gemini et Groq.
                    </p>
                </div>
                <button
                    onClick={() => setShowGallery(v => !v)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        showGallery
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                    <Image className="w-4 h-4" />
                    Galerie
                    {gallery.length > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${showGallery ? 'bg-white/20' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                            {gallery.length}
                        </span>
                    )}
                </button>
            </div>

            {/* ── Galerie ── */}
            {showGallery && (
                <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Image className="w-5 h-5 text-emerald-500" /> Logos sauvegardés
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => refetchGallery()}
                                disabled={galleryLoading}
                                className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-50"
                                title="Rafraîchir"
                            >
                                <RefreshCw className={`w-4 h-4 ${galleryLoading ? 'animate-spin' : ''}`} />
                            </button>
                            <button onClick={() => setShowGallery(false)} className="p-1 rounded text-gray-400 hover:text-gray-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    {galleryLoading && gallery.length === 0 ? (
                        <div className="flex items-center justify-center py-10 text-gray-400">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…
                        </div>
                    ) : gallery.length === 0 ? (
                        <p className="text-center text-gray-400 py-8">Aucun logo sauvegardé. Générez votre premier logo !</p>
                    ) : (
                        <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {visibleLogos.map((logo) => (
                                <div key={logo.id} className="group relative bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors">
                                    {/* Miniature SVG */}
                                    <button
                                        onClick={() => { setCurrentSVG(logo.svg_content); setCompanyName(logo.company_name); setIterateMode(false); }}
                                        className="w-full aspect-square p-3 flex items-center justify-center"
                                        title="Charger ce logo"
                                    >
                                        <div
                                            className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
                                            dangerouslySetInnerHTML={{ __html: sanitizeSVG(logo.svg_content) }}
                                        />
                                    </button>
                                    {/* Infos */}
                                    <div className="px-2 pb-2">
                                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{logo.company_name}</p>
                                        <p className="text-[10px] text-gray-400">{new Date(logo.created_at).toLocaleDateString('fr-FR')}</p>
                                    </div>
                                    {/* Actions overlay */}
                                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => downloadSVG(logo.svg_content, logo.company_name)}
                                            className="p-1 bg-white dark:bg-gray-700 rounded shadow text-gray-600 dark:text-gray-300 hover:text-emerald-600"
                                            title="Télécharger"
                                        >
                                            <Download className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteFromGallery(logo.id)}
                                            disabled={deleteId === logo.id}
                                            className="p-1 bg-white dark:bg-gray-700 rounded shadow text-gray-600 dark:text-gray-300 hover:text-red-500 disabled:opacity-50"
                                            title="Supprimer"
                                        >
                                            {deleteId === logo.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {gallery.length > galleryLimit && (
                            <div className="mt-4 text-center">
                                <button
                                    onClick={() => setGalleryLimit(l => l + GALLERY_PAGE_SIZE)}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Charger plus ({galleryLimit}/{gallery.length})
                                </button>
                            </div>
                        )}
                        {gallery.length > 0 && (
                            <p className="mt-3 text-xs text-gray-400 text-center">
                                Affichage de {Math.min(galleryLimit, gallery.length)} sur {gallery.length} logo{gallery.length > 1 ? 's' : ''}
                            </p>
                        )}
                        </>
                    )}
                </div>
            )}

            {/* ── Formulaire + Aperçu ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-fit">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Paramètres du Logo</h2>

                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Modèle d'IA</label>
                            <select
                                value={provider}
                                onChange={(e) => setProvider(e.target.value)}
                                className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="claude">✦ Claude (Anthropic) — Recommandé</option>
                                <option value="auto">🔄 Auto (Claude → Groq si échec)</option>
                                <option value="gemini">🔵 Gemini Flash (Google)</option>
                                <option value="groq">⚡ Llama 3.3 70B (Groq)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom de l'entreprise *</label>
                            <input
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="Ex: Résidence Les Moulineaux"
                                className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Secteur d'activité</label>
                                <select
                                    value={industry}
                                    onChange={(e) => setIndustry(e.target.value)}
                                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="">Sélectionner...</option>
                                    <option value="immobilier résidentiel">Immobilier résidentiel</option>
                                    <option value="promotion immobilière">Promotion immobilière</option>
                                    <option value="construction / BTP">Construction / BTP</option>
                                    <option value="architecture">Architecture</option>
                                    <option value="hôtellerie / résidence de tourisme">Hôtellerie / Tourisme</option>
                                    <option value="finance / investissement">Finance</option>
                                    <option value="technologie">Technologie</option>
                                    <option value="restauration">Restauration</option>
                                    <option value="santé / bien-être">Santé / Bien-être</option>
                                    <option value="commerce">Commerce</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Style</label>
                                <select
                                    value={style}
                                    onChange={(e) => setStyle(e.target.value)}
                                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="icone-texte">Icône + Nom</option>
                                    <option value="typographique">Typographique / Monogramme</option>
                                    <option value="symbole-pur">Symbole pur (sans texte)</option>
                                    <option value="forme-fond">Forme en arrière-plan</option>
                                    <option value="elegant">Élégant / Raffiné</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Couleurs préférées</label>
                                <input
                                    type="text"
                                    value={colors}
                                    onChange={(e) => setColors(e.target.value)}
                                    placeholder="Ex: bleu marine, doré"
                                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Formes / Icônes</label>
                                <select
                                    value={shapeFill}
                                    onChange={(e) => setShapeFill(e.target.value as 'auto' | 'filled' | 'outline')}
                                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="auto">Auto (laisser l'IA décider)</option>
                                    <option value="filled">Remplies (couleur de fond)</option>
                                    <option value="outline">Contours uniquement</option>
                                </select>
                            </div>
                        </div>

                        {/* Mode itération / nouveau logo */}
                        {currentSVG && (
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Mode de génération</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIterateMode(false)}
                                        className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                                            !iterateMode
                                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                                        }`}
                                    >
                                        <RotateCcw className="w-4 h-4 flex-shrink-0" />
                                        <div className="text-left">
                                            <div>Nouveau logo</div>
                                            <div className="text-xs font-normal opacity-70">Repartir de zéro</div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIterateMode(true)}
                                        className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                                            iterateMode
                                                ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400'
                                                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                                        }`}
                                    >
                                        <Pencil className="w-4 h-4 flex-shrink-0" />
                                        <div className="text-left">
                                            <div>Modifier le logo</div>
                                            <div className="text-xs font-normal opacity-70">Affiner le logo actuel</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {iterateMode && currentSVG ? 'Consignes de modification' : 'Instructions additionnelles'}
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                placeholder={iterateMode && currentSVG
                                    ? "Ex: Enlève le trait horizontal, change la couleur en bleu marine, agrandis le texte..."
                                    : "Détails spécifiques sur ce que vous souhaitez voir..."
                                }
                                className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
                                {error}
                            </div>
                        )}

                        {isLoading && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                                        {progressLabel}
                                    </span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
                                        {progress}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleGenerate}
                            disabled={isLoading}
                            className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <RefreshCw className="animate-spin -ml-1 mr-2 h-5 w-5" />
                                    {iterateMode && currentSVG ? 'Modification en cours...' : 'Génération en cours...'}
                                </>
                            ) : (
                                <>
                                    {iterateMode && currentSVG ? (
                                        <><Pencil className="-ml-1 mr-2 h-5 w-5" />Modifier le Logo</>
                                    ) : (
                                        <><Paintbrush className="-ml-1 mr-2 h-5 w-5" />Générer le Logo</>
                                    )}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col h-fit sticky top-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Aperçu</h2>

                    <div className="flex-grow flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg p-8 min-h-[400px]">
                        {currentSVG ? (
                            <div
                                className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[400px]"
                                dangerouslySetInnerHTML={{ __html: sanitizeSVG(currentSVG) }}
                            />
                        ) : (
                            <div className="text-center text-gray-400 flex flex-col items-center">
                                <Paintbrush className="w-16 h-16 mb-4 opacity-20" />
                                <p>Remplissez le formulaire à gauche<br />pour générer votre premier logo.</p>
                            </div>
                        )}
                    </div>

                    {currentSVG && (
                        <div className="mt-4 space-y-2">
                            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Logo sauvegardé automatiquement en galerie
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => downloadSVG(currentSVG, companyName)}
                                    className="flex-1 flex justify-center items-center py-2 px-4 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Télécharger SVG
                                </button>
                                <button
                                    onClick={() => setShowGallery(true)}
                                    className="flex-1 flex justify-center items-center py-2 px-4 border border-emerald-300 dark:border-emerald-700 shadow-sm text-sm font-medium rounded-md text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                                >
                                    <Image className="mr-2 h-4 w-4" />
                                    Voir la galerie
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
