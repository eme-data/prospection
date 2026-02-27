import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, Layout, Paintbrush, ArrowLeft, Home } from 'lucide-react';
import { LogoCreator } from './LogoCreator';

const CommunicationDashboard: React.FC = () => {
    const navigate = useNavigate();


    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-10 text-center">
                <div className="flex justify-center mb-4">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl">
                        <MessageSquare className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
                    </div>
                </div>
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    Module Communication
                </h1>
                <p className="mt-4 text-xl text-gray-500 dark:text-gray-400">
                    Gérez votre présence en ligne et créez du contenu visuel.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-12">
                {/* Réseaux Sociaux Card */}
                <button
                    onClick={() => navigate('/communication/reseaux-sociaux')}
                    className="flex flex-col items-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:ring-2 hover:ring-blue-500 hover:ring-opacity-50 transition-all duration-200 group text-left w-full relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-200">
                        <Layout className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Réseaux Sociaux</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-center text-lg">
                        Planifiez et gérez vos publications automatisées sur LinkedIn, Facebook, etc.
                    </p>
                </button>

                {/* Création Logo Card */}
                <button
                    onClick={() => navigate('/communication/creation-logo')}
                    className="flex flex-col items-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 hover:border-emerald-500 hover:ring-2 hover:ring-emerald-500 hover:ring-opacity-50 transition-all duration-200 group text-left w-full relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-200">
                        <Paintbrush className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Création de Logo</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-center text-lg">
                        Générez des logos SVG vectoriels sur mesure grâce à l'Intelligence Artificielle.
                    </p>
                </button>
            </div>
        </div>
    );
};

import { Generator } from './Generator';
import { History } from './History';
import { SocialAccounts } from './SocialAccounts';
import { Link, Navigate } from 'react-router-dom';

const AutopostIntegration: React.FC = () => {
    const location = useLocation();

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 shadow-sm sticky top-0 z-10">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Layout className="w-5 h-5 text-blue-500" />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Réseaux Sociaux (Autopost)</h2>
                    </div>

                    <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                        <Link
                            to="/communication/reseaux-sociaux/generateur"
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname.includes('/generateur')
                                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            Générateur IA
                        </Link>
                        <Link
                            to="/communication/reseaux-sociaux/historique"
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname.includes('/historique')
                                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            Historique
                        </Link>
                        <Link
                            to="/communication/reseaux-sociaux/comptes"
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname.includes('/comptes')
                                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            Comptes Sociaux
                        </Link>
                    </div>
                </div>
            </div>

            <div className="flex-grow p-6">
                <Routes>
                    <Route path="/" element={<Navigate to="generateur" replace />} />
                    <Route path="generateur" element={<Generator />} />
                    <Route path="historique" element={<History />} />
                    <Route path="comptes" element={<SocialAccounts />} />
                </Routes>
            </div>
        </div>
    );
};

export const CommunicationApp: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Si on est à la racine, on n'affiche pas le bouton "Retour", sinon oui
    const isRoot = location.pathname === '/communication' || location.pathname === '/communication/';

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
            {/* Header / Topbar simple (sans la grosse navigation) */}
            <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <button
                                onClick={() => navigate('/')}
                                className="p-2 mr-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                                title="Retour au portail"
                            >
                                <Home size={20} />
                            </button>
                            {!isRoot ? (
                                <button
                                    onClick={() => navigate('/communication')}
                                    className="mr-4 p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    title="Retour au menu Communication"
                                >
                                    <ArrowLeft className="w-6 h-6" />
                                </button>
                            ) : null}
                            <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-2">
                                <MessageSquare className="h-6 w-6 text-emerald-600" />
                                <span className="hidden sm:inline">Hub Communication</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/portal')}
                                className="text-sm font-medium text-gray-600 hover:text-emerald-600 dark:text-gray-300 dark:hover:text-emerald-400 px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600"
                            >
                                Portail Principal
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Application Area */}
            <main className="flex-grow flex flex-col relative h-[calc(100vh-64px)] overflow-auto">
                <Routes>
                    <Route path="/" element={<CommunicationDashboard />} />
                    <Route path="/reseaux-sociaux/*" element={<AutopostIntegration />} />
                    <Route path="/creation-logo" element={<div className="py-8"><LogoCreator /></div>} />
                </Routes>
            </main>
        </div>
    );
};
