import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { ShoppingBag, ArrowLeft } from 'lucide-react';

const CommerceDashboard: React.FC = () => {
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
                    Gestion des ventes et suivis commerciaux (En cours de développement).
                </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center text-gray-600 dark:text-gray-300">
                <p>Les fonctionnalités de gestion commerciale seront bientôt disponibles.</p>
            </div>
        </div>
    );
};

export const CommerceApp: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
            <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <button
                                onClick={() => navigate('/')}
                                className="mr-4 p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title="Retour au portail"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <span className="text-xl font-bold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                                <ShoppingBag className="h-6 w-6" />
                                <span className="hidden sm:inline">Hub Commerce</span>
                            </span>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="flex-grow flex flex-col relative h-[calc(100vh-64px)] overflow-auto">
                <Routes>
                    <Route path="/" element={<CommerceDashboard />} />
                </Routes>
            </main>
        </div>
    );
};
