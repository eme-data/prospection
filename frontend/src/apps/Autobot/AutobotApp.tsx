import React from 'react';
import { Bot, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AutobotApp: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col">
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigate('/')}
                                className="p-2 mr-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                                title="Retour au portail"
                            >
                                <Home size={20} />
                            </button>
                            <Bot size={28} className="text-indigo-600 dark:text-indigo-400" />
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Autobot</h1>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6 flex items-center justify-center">
                <div className="text-center">
                    <Bot className="h-24 w-24 text-gray-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Module Autobot en construction</h2>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">Cette fonctionnalité sera bientôt disponible.</p>
                </div>
            </main>
        </div>
    );
};
