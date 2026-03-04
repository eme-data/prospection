import React, { useState, useEffect } from 'react';
import { Search, Trash2, ChevronLeft, Loader2, Newspaper, AlertCircle, FileText, ExternalLink } from 'lucide-react';
import {
    analyzeSentiment,
    analyzeManualTexts,
    getAnalyses,
    getAnalysisDetail,
    deleteAnalysis,
    type SentimentAnalysis as SentimentAnalysisType,
    type SentimentAnalysisDetail,
    type SentimentItem,
} from '../../api/sentiment';

// ─────────────────────────────────────────────
// Sentiment colors & labels
// ─────────────────────────────────────────────

const sentimentColor = (label: string) => {
    switch (label) {
        case 'positif': return 'text-emerald-600 dark:text-emerald-400';
        case 'négatif': return 'text-red-600 dark:text-red-400';
        default: return 'text-gray-500 dark:text-gray-400';
    }
};

const sentimentBg = (label: string) => {
    switch (label) {
        case 'positif': return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
        case 'négatif': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
        default: return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
};

const sentimentEmoji = (label: string) => {
    switch (label) {
        case 'positif': return '😊';
        case 'négatif': return '😡';
        default: return '😐';
    }
};

const sourceIcon = (source: string) => {
    switch (source) {
        case 'twitter': return '𝕏';
        case 'news': return '📰';
        case 'manual': return '📝';
        default: return '📄';
    }
};

const sourceLabel = (source: string) => {
    switch (source) {
        case 'twitter': return 'Twitter/X';
        case 'news': return 'Actualités';
        case 'manual': return 'Manuel';
        default: return source;
    }
};

// ─────────────────────────────────────────────
// Pie Chart (pure SVG)
// ─────────────────────────────────────────────

const PieChart: React.FC<{ positive: number; negative: number; neutral: number }> = ({ positive, negative, neutral }) => {
    const total = positive + negative + neutral;
    if (total === 0) return null;

    const data = [
        { value: positive, color: '#10b981', label: 'Positif' },
        { value: negative, color: '#ef4444', label: 'Négatif' },
        { value: neutral, color: '#9ca3af', label: 'Neutre' },
    ].filter(d => d.value > 0);

    let cumulative = 0;
    const slices = data.map(d => {
        const start = cumulative;
        const angle = (d.value / total) * 360;
        cumulative += angle;
        return { ...d, start, angle };
    });

    const describeArc = (startAngle: number, endAngle: number, radius: number) => {
        const startRad = ((startAngle - 90) * Math.PI) / 180;
        const endRad = ((endAngle - 90) * Math.PI) / 180;
        const x1 = 50 + radius * Math.cos(startRad);
        const y1 = 50 + radius * Math.sin(startRad);
        const x2 = 50 + radius * Math.cos(endRad);
        const y2 = 50 + radius * Math.sin(endRad);
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
        return `M 50 50 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    };

    return (
        <div className="flex items-center gap-6">
            <svg viewBox="0 0 100 100" className="w-32 h-32">
                {slices.map((s, i) => (
                    <path
                        key={i}
                        d={s.angle >= 360 ? `M 50 5 A 45 45 0 1 1 49.99 5 Z` : describeArc(s.start, s.start + s.angle, 45)}
                        fill={s.color}
                        stroke="white"
                        strokeWidth="1"
                    />
                ))}
            </svg>
            <div className="flex flex-col gap-2 text-sm">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-gray-700 dark:text-gray-300">
                            {d.label}: {d.value} ({Math.round((d.value / total) * 100)}%)
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Bar Chart by source (pure SVG)
// ─────────────────────────────────────────────

const SourceBarChart: React.FC<{ items: SentimentItem[] }> = ({ items }) => {
    const sources = [...new Set(items.map(it => it.source))];
    if (sources.length === 0) return null;

    const stats = sources.map(src => {
        const srcItems = items.filter(it => it.source === src);
        const pos = srcItems.filter(it => it.sentiment_label === 'positif').length;
        const neg = srcItems.filter(it => it.sentiment_label === 'négatif').length;
        const neu = srcItems.length - pos - neg;
        return { source: src, positive: pos, negative: neg, neutral: neu, total: srcItems.length };
    });

    const maxTotal = Math.max(...stats.map(s => s.total));

    return (
        <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Par source</h4>
            {stats.map((s, i) => (
                <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                        <span>{sourceIcon(s.source)} {sourceLabel(s.source)}</span>
                        <span>{s.total} items</span>
                    </div>
                    <div className="flex h-5 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700">
                        {s.positive > 0 && (
                            <div
                                className="bg-emerald-500 transition-all"
                                style={{ width: `${(s.positive / maxTotal) * 100}%` }}
                            />
                        )}
                        {s.neutral > 0 && (
                            <div
                                className="bg-gray-400 transition-all"
                                style={{ width: `${(s.neutral / maxTotal) * 100}%` }}
                            />
                        )}
                        {s.negative > 0 && (
                            <div
                                className="bg-red-500 transition-all"
                                style={{ width: `${(s.negative / maxTotal) * 100}%` }}
                            />
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

// ─────────────────────────────────────────────
// Score Gauge
// ─────────────────────────────────────────────

const ScoreGauge: React.FC<{ score: number; label: string }> = ({ score, label }) => {
    const percentage = ((score + 1) / 2) * 100; // -1..1 → 0..100
    const rotation = -90 + (percentage / 100) * 180; // semi-circle

    return (
        <div className="flex flex-col items-center">
            <svg viewBox="0 0 120 70" className="w-40">
                <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="#e5e7eb" strokeWidth="8" strokeLinecap="round" />
                <path
                    d="M 10 60 A 50 50 0 0 1 110 60"
                    fill="none"
                    stroke={score > 0.2 ? '#10b981' : score < -0.2 ? '#ef4444' : '#9ca3af'}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(percentage / 100) * 157} 157`}
                />
                <line
                    x1="60" y1="60" x2="60" y2="18"
                    stroke="#374151" strokeWidth="2" strokeLinecap="round"
                    transform={`rotate(${rotation}, 60, 60)`}
                />
                <circle cx="60" cy="60" r="4" fill="#374151" />
            </svg>
            <div className="text-center -mt-1">
                <span className={`text-lg font-bold ${sentimentColor(label)}`}>
                    {sentimentEmoji(label)} {score > 0 ? '+' : ''}{score.toFixed(2)}
                </span>
                <span className={`block text-xs ${sentimentColor(label)} capitalize`}>{label}</span>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export const SentimentAnalysisPage: React.FC = () => {
    const [analyses, setAnalyses] = useState<SentimentAnalysisType[]>([]);
    const [selectedAnalysis, setSelectedAnalysis] = useState<SentimentAnalysisDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingList, setLoadingList] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [query, setQuery] = useState('');
    const [sourcesNews, setSourcesNews] = useState(true);
    const [sourcesTwitter, setSourcesTwitter] = useState(false);
    const [activeTab, setActiveTab] = useState<'search' | 'manual'>('search');
    const [manualTexts, setManualTexts] = useState('');
    const [manualQuery, setManualQuery] = useState('');

    // Load analyses list
    const loadAnalyses = async () => {
        setLoadingList(true);
        try {
            const data = await getAnalyses();
            setAnalyses(data);
        } catch {
            // silent — fetchJSON handles toast
        } finally {
            setLoadingList(false);
        }
    };

    useEffect(() => { loadAnalyses(); }, []);

    // Launch analysis
    const handleAnalyze = async () => {
        if (!query.trim()) return;
        const sources: string[] = [];
        if (sourcesNews) sources.push('news');
        if (sourcesTwitter) sources.push('twitter');
        if (sources.length === 0) { setError('Sélectionnez au moins une source.'); return; }

        setLoading(true);
        setError(null);
        try {
            const result = await analyzeSentiment(query.trim(), sources);
            setSelectedAnalysis(result);
            setQuery('');
            loadAnalyses();
        } catch (e: any) {
            setError(e.message || 'Erreur lors de l\'analyse.');
        } finally {
            setLoading(false);
        }
    };

    // Manual analysis
    const handleManualAnalyze = async () => {
        const texts = manualTexts.split('\n').map(t => t.trim()).filter(Boolean);
        if (texts.length === 0) { setError('Saisissez au moins un texte.'); return; }

        setLoading(true);
        setError(null);
        try {
            const result = await analyzeManualTexts(texts, manualQuery.trim() || undefined);
            setSelectedAnalysis(result);
            setManualTexts('');
            setManualQuery('');
            loadAnalyses();
        } catch (e: any) {
            setError(e.message || 'Erreur lors de l\'analyse.');
        } finally {
            setLoading(false);
        }
    };

    // View detail
    const handleViewDetail = async (id: number) => {
        setLoading(true);
        try {
            const detail = await getAnalysisDetail(id);
            setSelectedAnalysis(detail);
        } catch {
            // handled by fetchJSON
        } finally {
            setLoading(false);
        }
    };

    // Delete
    const handleDelete = async (id: number) => {
        if (!confirm('Supprimer cette analyse ?')) return;
        try {
            await deleteAnalysis(id);
            if (selectedAnalysis?.id === id) setSelectedAnalysis(null);
            loadAnalyses();
        } catch {
            // handled by fetchJSON
        }
    };

    // ─── Detail view ───
    if (selectedAnalysis) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-8">
                <button
                    onClick={() => setSelectedAnalysis(null)}
                    className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
                >
                    <ChevronLeft size={20} />
                    Retour aux analyses
                </button>

                {/* Header */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                "{selectedAnalysis.query}"
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {selectedAnalysis.total_items} résultats analysés — {new Date(selectedAnalysis.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                        <ScoreGauge score={selectedAnalysis.sentiment_score} label={selectedAnalysis.sentiment_label} />
                    </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Répartition du sentiment</h3>
                        <PieChart
                            positive={selectedAnalysis.positive_count}
                            negative={selectedAnalysis.negative_count}
                            neutral={selectedAnalysis.neutral_count}
                        />
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <SourceBarChart items={selectedAnalysis.items} />
                    </div>
                </div>

                {/* Summary */}
                {selectedAnalysis.summary && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-200 dark:border-indigo-800 p-6 mb-6">
                        <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2">Résumé IA</h3>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{selectedAnalysis.summary}</p>
                    </div>
                )}

                {/* Items list */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                        Détail des résultats ({selectedAnalysis.items.length})
                    </h3>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                        {selectedAnalysis.items.map(item => (
                            <div
                                key={item.id}
                                className={`rounded-xl border p-4 ${sentimentBg(item.sentiment_label)}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg">{sourceIcon(item.source)}</span>
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                {sourceLabel(item.source)}
                                            </span>
                                            {item.published_at && (
                                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                                    {new Date(item.published_at).toLocaleDateString('fr-FR')}
                                                </span>
                                            )}
                                        </div>
                                        {item.title && (
                                            <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1">{item.title}</h4>
                                        )}
                                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{item.content}</p>
                                        {item.author && (
                                            <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 block">— {item.author}</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <span className={`text-lg ${sentimentColor(item.sentiment_label)}`}>
                                            {sentimentEmoji(item.sentiment_label)}
                                        </span>
                                        <span className={`text-xs font-medium ${sentimentColor(item.sentiment_label)}`}>
                                            {item.sentiment_score > 0 ? '+' : ''}{item.sentiment_score.toFixed(1)}
                                        </span>
                                        {item.url && (
                                            <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-500 hover:text-blue-700 transition-colors"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ─── Main dashboard view ───
    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* Title */}
            <div className="text-center mb-8">
                <div className="flex justify-center mb-3">
                    <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-2xl">
                        <Search className="w-10 h-10 text-violet-600 dark:text-violet-400" />
                    </div>
                </div>
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    Analyse de Sentiments
                </h1>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                    Recherchez un terme et analysez le sentiment sur le web et les réseaux sociaux.
                </p>
            </div>

            {/* Tabs */}
            <div className="flex justify-center mb-6">
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                            activeTab === 'search'
                                ? 'bg-white dark:bg-gray-600 text-violet-600 dark:text-violet-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <Search size={14} className="inline mr-1.5 -mt-0.5" />
                        Recherche web
                    </button>
                    <button
                        onClick={() => setActiveTab('manual')}
                        className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                            activeTab === 'manual'
                                ? 'bg-white dark:bg-gray-600 text-violet-600 dark:text-violet-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <FileText size={14} className="inline mr-1.5 -mt-0.5" />
                        Texte manuel
                    </button>
                </div>
            </div>

            {/* Search form */}
            {activeTab === 'search' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !loading && handleAnalyze()}
                            placeholder="Ex : immobilier bordeaux, MDO Services, résidence Azuria..."
                            className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            disabled={loading}
                        />
                        <button
                            onClick={handleAnalyze}
                            disabled={loading || !query.trim()}
                            className="px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium rounded-xl transition-colors flex items-center gap-2 justify-center"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                            Analyser
                        </button>
                    </div>

                    {/* Sources checkboxes */}
                    <div className="flex flex-wrap gap-4 mt-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={sourcesNews}
                                onChange={e => setSourcesNews(e.target.checked)}
                                className="rounded text-violet-600 focus:ring-violet-500"
                            />
                            <Newspaper size={16} className="text-orange-500" />
                            Actualités (NewsAPI)
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={sourcesTwitter}
                                onChange={e => setSourcesTwitter(e.target.checked)}
                                className="rounded text-violet-600 focus:ring-violet-500"
                            />
                            <span className="text-base font-bold">𝕏</span>
                            Twitter / X
                        </label>
                    </div>
                </div>
            )}

            {/* Manual form */}
            {activeTab === 'manual' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                    <input
                        type="text"
                        value={manualQuery}
                        onChange={e => setManualQuery(e.target.value)}
                        placeholder="Nom de l'analyse (optionnel)"
                        className="w-full px-4 py-2.5 mb-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        disabled={loading}
                    />
                    <textarea
                        value={manualTexts}
                        onChange={e => setManualTexts(e.target.value)}
                        placeholder="Collez vos textes ici (un par ligne)..."
                        rows={6}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
                        disabled={loading}
                    />
                    <button
                        onClick={handleManualAnalyze}
                        disabled={loading || !manualTexts.trim()}
                        className="mt-3 px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                        Analyser les textes
                    </button>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
                    <AlertCircle className="text-red-500 shrink-0" size={20} />
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
            )}

            {/* Loading overlay */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 size={40} className="animate-spin text-violet-500 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">Collecte et analyse en cours...</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Cela peut prendre quelques secondes</p>
                </div>
            )}

            {/* Previous analyses */}
            {!loading && (
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Analyses récentes
                    </h2>
                    {loadingList ? (
                        <div className="flex justify-center py-8">
                            <Loader2 size={24} className="animate-spin text-gray-400" />
                        </div>
                    ) : analyses.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                            <Search size={40} className="mx-auto mb-3 opacity-40" />
                            <p>Aucune analyse pour le moment.</p>
                            <p className="text-sm mt-1">Lancez votre première recherche ci-dessus.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {analyses.map(a => (
                                <div
                                    key={a.id}
                                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:border-violet-400 hover:ring-1 hover:ring-violet-400 transition-all cursor-pointer group relative"
                                    onClick={() => handleViewDetail(a.id)}
                                >
                                    <button
                                        onClick={e => { e.stopPropagation(); handleDelete(a.id); }}
                                        className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                                        title="Supprimer"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <div className="flex items-start gap-3">
                                        <span className="text-3xl">{sentimentEmoji(a.sentiment_label)}</span>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 dark:text-white truncate" title={a.query}>
                                                "{a.query}"
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-sm font-medium ${sentimentColor(a.sentiment_label)}`}>
                                                    {a.positive_count > 0 && `${Math.round((a.positive_count / a.total_items) * 100)}% positif`}
                                                    {a.positive_count === 0 && a.sentiment_label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
                                                <span>{a.total_items} items</span>
                                                <span>{a.sources.split(',').map(s => sourceIcon(s)).join(' ')}</span>
                                                <span>{new Date(a.created_at).toLocaleDateString('fr-FR')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
