import React, { useState } from 'react';
import { Loader2, AlertCircle, FileSearch, Upload, X } from 'lucide-react';
import { analyzeQuotes } from '../../../api/commerce';

export const AnalyseDevis: React.FC = () => {
    // We will keep files in a fixed-size array corresponding to specific slots
    const [fileSlots, setFileSlots] = useState<(File | null)[]>([null, null, null]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

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

        try {
            const data = await analyzeQuotes(validFiles);
            setResult(data.analysis);
        } catch (err: any) {
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
                                <><FileSearch className="w-5 h-5" /> Lancer l'analyse compartive</>
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
