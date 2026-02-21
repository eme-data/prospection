import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { importCatalogue } from '../../../api/commerce';

export const ImportPage: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const processFile = (selectedFile: File) => {
        if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
            setError("Veuillez sélectionner un fichier Excel valide (.xlsx ou .xls)");
            setFile(null);
            return;
        }
        setFile(selectedFile);
        setError(null);
        setResult(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        setError(null);
        setResult(null);

        try {
            const res = await importCatalogue(file);
            setResult(res);
        } catch (err: any) {
            setError(err.message || "Erreur lors de l'importation du fichier.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleCancel = () => {
        setFile(null);
        setResult(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-indigo-600" />
                    Imports Catalogue (Matrice Larox)
                </h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Importez votre fichier Excel "MATRICE DE PRETURI MARMANDE" pour mettre à jour automatiquement
                    les matériaux, les articles et les compositions du catalogue.
                </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">

                {/* Zone de Drag and Drop */}
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500'
                        }`}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".xlsx,.xls"
                        className="hidden"
                    />
                    <Upload className={`w-12 h-12 mb-4 ${isDragging ? 'text-indigo-500' : 'text-gray-400'}`} />
                    <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Glissez et déposez votre fichier Excel ici
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        ou cliquez pour parcourir vos fichiers (.xlsx, .xls)
                    </p>
                </div>

                {/* Fichier sélectionné */}
                {file && !result && (
                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-3 mb-4 sm:mb-0 overflow-hidden w-full">
                            <FileSpreadsheet className="w-8 h-8 text-green-600 shrink-0" />
                            <div className="truncate">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end shrink-0">
                            <button
                                onClick={handleCancel}
                                disabled={isUploading}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 focus:outline-none"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={isUploading}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:bg-indigo-400 disabled:cursor-not-allowed"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Analyse en cours...
                                    </>
                                ) : (
                                    'Lancer l\'importation'
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Erreurs de validation/upload */}
                {error && (
                    <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-red-800 dark:text-red-300">
                            <p className="font-semibold">Erreur d'importation</p>
                            <p className="mt-1">{error}</p>
                        </div>
                    </div>
                )}

                {/* Résultats du traitement */}
                {result && (
                    <div className="mt-8 animate-fade-in">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <CheckCircle className="w-6 h-6 text-green-500" />
                            Rapport d'importation
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Matériaux (MATERIAUX)</p>
                                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{result.stats?.materials_imported || 0}</p>
                            </div>
                            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-100 dark:border-orange-800">
                                <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Articles (ARTICLE)</p>
                                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100 mt-1">{result.stats?.articles_imported || 0}</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800">
                                <p className="text-sm text-green-600 dark:text-green-400 font-medium">Compositions (COMP)</p>
                                <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">{result.stats?.compositions_imported || 0}</p>
                            </div>
                        </div>

                        {result.errors && result.errors.length > 0 && (
                            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-400 flex items-center gap-2 mb-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Avertissements ({result.errors.length})
                                </h4>
                                <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-500 space-y-1">
                                    {result.errors.map((err: string, idx: number) => (
                                        <li key={idx}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex justify-end mt-6">
                            <button
                                onClick={handleCancel}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-200 dark:hover:bg-indigo-800 focus:outline-none"
                            >
                                Faire un nouvel import
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
