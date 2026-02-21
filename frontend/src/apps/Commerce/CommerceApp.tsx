import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, ArrowLeft, FileSearch, Database } from 'lucide-react';

// Placeholder imports for submodules (will be implemented next)
import { AnalyseDevis } from './Analyse/AnalyseDevis';
import { CatalogueApp } from './Catalogue/CatalogueApp';

const CommerceDashboard: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-10 text-center">
                <div className="flex justify-center mb-4">
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-2xl">
                        <ShoppingBag className="w-12 h-12 text-orange-600 dark:text-orange-400" />
                    </div>
                </div>
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    Module Commerce
                </h1>
                <p className="mt-4 text-xl text-gray-500 dark:text-gray-400">
                    Gérez votre catalogue BTP et analysez les devis de vos sous-traitants.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mt-12">
                {/* Carte Analyse Devis */}
                <button
                    onClick={() => navigate('/commerce/analyse')}
                    className="flex flex-col items-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 hover:border-orange-500 hover:ring-2 hover:ring-orange-500 hover:ring-opacity-50 transition-all duration-200 group text-left w-full relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-2 h-full bg-orange-500"></div>
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/30 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-200">
                        <FileSearch className="w-10 h-10 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Analyse Devis Prestataires</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-center text-lg">
                        Importez et analysez automatiquement les devis via l'IA pour les comparer.
                    </p>
                </button>

                {/* Carte CRM Catalogue */}
                <button
                    onClick={() => navigate('/commerce/catalogue')}
                    className="flex flex-col items-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:ring-2 hover:ring-blue-500 hover:ring-opacity-50 transition-all duration-200 group text-left w-full relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-200">
                        <Database className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Catalogue & Clients</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-center text-lg">
                        Gérez vos bases de données de matériaux, services, articles et contacts.
                    </p>
                </button>
            </div>
        </div>
    );
};

export const CommerceApp: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isRoot = location.pathname === '/commerce' || location.pathname === '/commerce/';

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
            <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            {!isRoot && (
                                <button
                                    onClick={() => navigate('/commerce')}
                                    className="mr-4 p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    title="Retour au menu Commerce"
                                >
                                    <ArrowLeft className="w-6 h-6" />
                                </button>
                            )}
                            <span className="text-xl font-bold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                                <ShoppingBag className="h-6 w-6" />
                                <span className="hidden sm:inline">Hub Commerce</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/portal')}
                                className="text-sm font-medium text-gray-600 hover:text-orange-600 dark:text-gray-300 dark:hover:text-orange-400 px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600"
                            >
                                Portail Principal
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="flex-grow flex flex-col relative h-[calc(100vh-64px)] overflow-auto">
                <Routes>
                    <Route path="/" element={<CommerceDashboard />} />
                    <Route path="/analyse/*" element={<AnalyseDevis />} />
                    <Route path="/catalogue/*" element={<CatalogueApp />} />
                </Routes>
            </main>
        </div>
    );
};
