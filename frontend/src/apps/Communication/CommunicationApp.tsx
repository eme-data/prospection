import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MessageSquare, Layout, LogOut, Paintbrush } from 'lucide-react';
import { LogoCreator } from './LogoCreator';

export const CommunicationApp: React.FC = () => {
    const { logout, user } = useAuth();
    const location = useLocation();

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            {/* Header Navigation */}
            <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center">
                                <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-2">
                                    <MessageSquare className="h-6 w-6 text-emerald-600" />
                                    Communication
                                </span>
                            </div>
                            <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                                <Link
                                    to="/communication/reseaux-sociaux"
                                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${location.pathname.includes('/reseaux-sociaux') ? 'border-emerald-500 text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                                >
                                    <Layout className="mr-2 h-4 w-4" />
                                    Réseaux Sociaux
                                </Link>
                                <Link
                                    to="/communication/creation-logo"
                                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${location.pathname.includes('/creation-logo') ? 'border-emerald-500 text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                                >
                                    <Paintbrush className="mr-2 h-4 w-4" />
                                    Création de Logo
                                </Link>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                                {user?.full_name || user?.email}
                            </span>
                            <Link
                                to="/portal"
                                className="text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Portail
                            </Link>
                            <button
                                onClick={logout}
                                className="inline-flex items-center p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-500"
                                title="Déconnexion"
                            >
                                <LogOut className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Sub-routing area */}
            <main className="h-[calc(100vh-64px)] overflow-auto bg-gray-50 dark:bg-gray-900">
                <Routes>
                    <Route path="/" element={<div className="p-8 text-center text-gray-500 dark:text-gray-400">Sélectionnez un outil dans le menu ci-dessus.</div>} />
                    <Route path="/reseaux-sociaux" element={
                        <div className="w-full h-full"> {/* This will house the AutoPost iframe */}
                            <iframe
                                src="http://localhost:3000" // Assuming default Dev port for autopost frontend
                                className="w-full h-full border-0"
                                title="Autopost Integration"
                            />
                        </div>
                    } />
                    <Route path="/creation-logo" element={<LogoCreator />} />
                </Routes>
            </main>
        </div>
    );
};
