import React, { useState } from 'react';
import { generatePost, GeneratePostParams, Post } from '../../api/communication';
import { Bot, FileText, Send, Loader2, Sparkles, Hash, Smile, AlignLeft } from 'lucide-react';

export const Generator: React.FC = () => {
    const [params, setParams] = useState<GeneratePostParams>({
        topic: '',
        platform: 'linkedin',
        ai_model: 'gemini',
        tone: 'professional',
        length: 'medium',
        include_hashtags: true,
        include_emojis: false
    });

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<Post | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await generatePost(params);
            if (res.success) {
                setResult(res.post);
            }
        } catch (err: any) {
            setError(err.message || 'Une erreur est survenue lors de la génération.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Sparkles className="w-6 h-6 text-indigo-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nouveau Post</h2>
                </div>

                <form onSubmit={handleGenerate} className="space-y-6">
                    {/* Topic */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Sujet du post <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={params.topic}
                            onChange={(e) => setParams(prev => ({ ...prev, topic: e.target.value }))}
                            placeholder="Ex: Lancement de notre nouveau service de prospection foncière assistée par l'IA..."
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white h-32 resize-none"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Platform */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                <Send className="w-4 h-4 inline-block mr-2" />
                                Plateforme cible
                            </label>
                            <select
                                value={params.platform}
                                onChange={(e) => setParams(prev => ({ ...prev, platform: e.target.value }))}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="linkedin">LinkedIn</option>
                                <option value="facebook">Facebook</option>
                                <option value="instagram">Instagram</option>
                            </select>
                        </div>

                        {/* AI Model */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                <Bot className="w-4 h-4 inline-block mr-2" />
                                Modèle IA
                            </label>
                            <select
                                value={params.ai_model}
                                onChange={(e) => setParams(prev => ({ ...prev, ai_model: e.target.value }))}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="gemini">Google Gemini (Recommandé)</option>
                                <option value="groq">Groq (Llama 3)</option>
                                <option value="claude">Claude (Anthropic)</option>
                            </select>
                        </div>

                        {/* Tone */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                <FileText className="w-4 h-4 inline-block mr-2" />
                                Ton
                            </label>
                            <select
                                value={params.tone}
                                onChange={(e) => setParams(prev => ({ ...prev, tone: e.target.value }))}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="professional">Professionnel</option>
                                <option value="casual">Décontracté</option>
                                <option value="enthusiastic">Enthousiaste</option>
                                <option value="informative">Informatif</option>
                            </select>
                        </div>

                        {/* Length */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                <AlignLeft className="w-4 h-4 inline-block mr-2" />
                                Longueur
                            </label>
                            <select
                                value={params.length}
                                onChange={(e) => setParams(prev => ({ ...prev, length: e.target.value }))}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="short">Court (~100 mots)</option>
                                <option value="medium">Moyen (~200 mots)</option>
                                <option value="long">Long (~350 mots)</option>
                            </select>
                        </div>
                    </div>

                    {/* Options Extras */}
                    <div className="flex gap-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={params.include_hashtags}
                                onChange={(e) => setParams(prev => ({ ...prev, include_hashtags: e.target.checked }))}
                                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            />
                            <Hash className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Inclure des hashtags</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={params.include_emojis}
                                onChange={(e) => setParams(prev => ({ ...prev, include_emojis: e.target.checked }))}
                                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            />
                            <Smile className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Inclure des emojis</span>
                        </label>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={loading || !params.topic}
                            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition-colors ${loading || !params.topic
                                    ? 'bg-indigo-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Génération en cours...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    Générer le post
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Result Section */}
            {result && (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border-2 border-indigo-100 dark:border-indigo-900 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Résultat généré</h3>
                        <div className="flex gap-2">
                            <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full text-xs font-medium uppercase tracking-wider">
                                {result.platform}
                            </span>
                            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
                                via {result.ai_model}
                            </span>
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 whitespace-pre-wrap text-gray-800 dark:text-gray-200 font-medium leading-relaxed border border-gray-200 dark:border-gray-700 shadow-inner min-h-[150px]">
                        {result.content}
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => {
                                navigator.clipboard.writeText(result.content);
                                alert("Texte copié !");
                            }}
                        >
                            Copier
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
