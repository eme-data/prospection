import React, { useState } from 'react';
import { Paintbrush, Download, RefreshCw, Image, Trash2, CheckCircle2, Loader2, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { saveLogo, getLogos, deleteLogo } from '../../api/communication';

const API_URL = import.meta.env.VITE_API_URL ?? '';
const GALLERY_PAGE_SIZE = 12;

export const LogoCreator: React.FC = () => {
    const [provider, setProvider] = useState('claude');
    const [companyName, setCompanyName] = useState('');
    const [industry, setIndustry] = useState('');
    const [style, setStyle] = useState('moderne');
    const [colors, setColors] = useState('');
    const [description, setDescription] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentSVG, setCurrentSVG] = useState<string | null>(null);

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
        let prompt = `Tu es un designer de logos professionnel expert en création SVG. Génère un logo DÉTAILLÉ et ÉLABORÉ au format SVG pour l'entreprise suivante:\n\nNom de l'entreprise: ${companyName}`;
        if (industry) prompt += `\nSecteur: ${industry}`;
        prompt += `\nStyle: ${style}`;

        if (colors) {
            prompt += `\nCouleurs souhaitées: ${colors}`;
        } else {
            prompt += `\nChoisis une palette de couleurs harmonieuse et moderne (3-5 couleurs)`;
        }

        if (description) prompt += `\nDescription additionnelle: ${description}`;

        prompt += `\n\nCRÉE UN LOGO PROFESSIONNEL ET DÉTAILLÉ en suivant ces directives OBLIGATOIRES:
NIVEAU DE DÉTAIL REQUIS:
- Le logo DOIT être visuellement riche et élaboré, PAS simpliste
- Utilise des formes complexes et détaillées, PAS de simples cercles ou traits
- Ajoute de la profondeur, des textures visuelles et des détails subtils

TECHNIQUES SVG À UTILISER:
- <path> avec courbes de Bézier pour des formes organiques et sophistiquées
- <linearGradient> ou <radialGradient> pour ajouter de la profondeur
- <g> pour grouper et organiser les éléments complexes
- Utilise opacity, stroke, fill avec variations pour créer du relief

COMPOSITION:
- Design équilibré et professionnel digne d'une grande marque
- Plusieurs éléments visuels qui se complètent

STYLE VISUEL:
- Adapté au secteur d'activité avec des références visuelles pertinentes
- Évolutif (scalable) mais RICHE en détails à toutes les tailles

IMPORTANT - FORMAT DE RÉPONSE:
Réponds UNIQUEMENT avec le code SVG complet. Pas de markdown, pas de texte.
Commence directement par <svg et termine par </svg>.
Le SVG doit avoir un viewBox="0 0 500 500" et être complet et auto-suffisant.`;

        return prompt;
    };

    const handleGenerate = async () => {
        if (!companyName.trim()) {
            setError('Veuillez entrer le nom de l\'entreprise');
            return;
        }

        setError(null);
        setIsLoading(true);

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
                const svg = data.content[0].text;
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
                                        onClick={() => { setCurrentSVG(logo.svg_content); setCompanyName(logo.company_name); }}
                                        className="w-full aspect-square p-3 flex items-center justify-center"
                                        title="Charger ce logo"
                                    >
                                        <div
                                            className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
                                            dangerouslySetInnerHTML={{ __html: logo.svg_content }}
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
                                placeholder="Ex: TechCorp"
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
                                    <option value="technologie">Technologie</option>
                                    <option value="immobilier">Immobilier / BTP</option>
                                    <option value="finance">Finance</option>
                                    <option value="restauration">Restauration</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Style</label>
                                <select
                                    value={style}
                                    onChange={(e) => setStyle(e.target.value)}
                                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="moderne">Moderne & Minimaliste</option>
                                    <option value="géométrique">Géométrique</option>
                                    <option value="abstrait">Abstrait</option>
                                    <option value="élégant">Élégant & Luxueux</option>
                                    <option value="professionnel">Corporate</option>
                                </select>
                            </div>
                        </div>

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
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instructions additionnelles</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                placeholder="Détails spécifiques sur ce que vous souhaitez voir..."
                                className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
                                {error}
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
                                    Génération en cours...
                                </>
                            ) : (
                                <>
                                    <Paintbrush className="-ml-1 mr-2 h-5 w-5" />
                                    Générer le Logo
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
                                dangerouslySetInnerHTML={{ __html: currentSVG }}
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
                                    onClick={() => { setShowGallery(true); loadGallery(); }}
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
