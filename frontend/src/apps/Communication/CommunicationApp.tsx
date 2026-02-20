import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MessageSquare, Layout, LogOut, Paintbrush, ArrowLeft, Settings } from 'lucide-react';
import { LogoCreator } from './LogoCreator';

const CommunicationDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

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

const AutopostIntegration: React.FC = () => {
    // Permet à l'utilisateur de configurer l'URL locale de son instance Autopost
    const [autopostUrl, setAutopostUrl] = useState(() => {
        return localStorage.getItem('autopost_iframe_url') || 'http://localhost:5174';
    });
    const [isEditingUrl, setIsEditingUrl] = useState(false);
    const [tempUrl, setTempUrl] = useState(autopostUrl);

    const saveUrl = () => {
        setAutopostUrl(tempUrl);
        localStorage.setItem('autopost_iframe_url', tempUrl);
        setIsEditingUrl(false);
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
            {/* Toolbar for Iframe Settings */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <Layout className="w-5 h-5 text-blue-500" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Autopost (Réseaux Sociaux)</h2>
                </div>

                <div className="flex items-center gap-3">
                    {isEditingUrl ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="url"
                                value={tempUrl}
                                onChange={(e) => setTempUrl(e.target.value)}
                                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-white"
                                placeholder="http://localhost:5174"
                            />
                            <button onClick={saveUrl} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded">Enregistrer</button>
                            <button onClick={() => setIsEditingUrl(false)} className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded">Annuler</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsEditingUrl(true)}
                            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 px-3 py-1.5 rounded-md transition-colors"
                            title="Modifier l'URL source de l'intégration"
                        >
                            <Settings className="w-4 h-4" />
                            <span className="hidden sm:inline">URL Source: {autopostUrl}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* IFrame Container */}
            <div className="flex-grow relative bg-gray-100 dark:bg-gray-800">
                {!autopostUrl ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">URL Source manquante</h3>
                            <p className="text-gray-500 mt-2">Veuillez configurer l'URL de votre instance Autopost en haut à droite.</p>
                        </div>
                    </div>
                ) : (
                    <iframe
                        src={autopostUrl}
                        className="w-full h-full border-0 absolute inset-0"
                        title="Autopost Integration"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                    />
                )}
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
                    <Route path="/reseaux-sociaux" element={<AutopostIntegration />} />
                    <Route path="/creation-logo" element={<div className="py-8"><LogoCreator /></div>} />
                </Routes>
            </main>
        </div>
    );
};
