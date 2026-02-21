import React, { useState } from 'react';
import { Loader2, AlertCircle, FileSearch, Upload } from 'lucide-react';
import { analyzeQuotes } from '../../../api/commerce';

export const AnalyseDevis: React.FC = () => {
    const [files, setFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const handleAnalyze = async () => {
        if (files.length === 0) {
            setError("Veuillez sélectionner au moins un devis.");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const data = await analyzeQuotes(files);
            setResult(data.analysis);
        } catch (err: any) {
            setError(err.message || 'Erreur inconnue.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                    <FileSearch className="w-8 h-8 text-orange-500" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analyse des Devis Prestataires</h2>
                </div>

                <p className="text-gray-600 dark:text-gray-400 mb-8">
                    Déposez vos devis (PDF, images) pour les analyser et les comparer automatiquement via l'IA.
                </p>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4 flex justify-center text-sm leading-6 text-gray-600 dark:text-gray-400">
                        <label className="relative cursor-pointer rounded-md bg-white dark:bg-gray-800 font-semibold text-orange-600 dark:text-orange-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-orange-600 focus-within:ring-offset-2 hover:text-orange-500">
                            <span>Sélectionner des fichiers</span>
                            <input type="file" multiple className="sr-only" onChange={handleFileChange} accept=".pdf,image/*" />
                        </label>
                        <p className="pl-1">ou glissez-déposez ici</p>
                    </div>
                    <p className="text-xs leading-5 text-gray-500 dark:text-gray-500 mt-2">PDF, PNG, JPG jusqu'à 10MB</p>
                </div>

                {files.length > 0 && (
                    <div className="mt-6">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Devis analysés ({files.length}) :</h4>
                        <ul className="space-y-2">
                            {files.map((f, i) => (
                                <li key={i} className="flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 font-semibold px-2.5 py-1 rounded text-xs whitespace-nowrap">
                                            Devis {i + 1}
                                        </div>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{f.name}</span>
                                    </div>
                                    <button
                                        onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                                        className="text-red-500 hover:text-red-700 text-sm font-medium ml-4 shrink-0 transition"
                                    >
                                        Retirer
                                    </button>
                                </li>
                            ))}
                        </ul>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={handleAnalyze}
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Analyse IA en cours...</>
                                ) : (
                                    <><FileSearch className="w-5 h-5" /> Analyser les devis avec Gemini</>
                                )}
                            </button>
                        </div>
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
