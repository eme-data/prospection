import React from 'react';
import { Brain } from 'lucide-react';

export const SecondaryBrainApp: React.FC = () => {
    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col">
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                            <Brain size={28} />
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Secondary Brain</h1>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                {/* 
                  On charge directement l'interface d'Open WebUI ici via l'iFrame.
                  Il sera accessible via le port 3000 tel que configuré dans Docker.
                */}
                <iframe
                    src="https://brain.mdoservices.fr"
                    className="w-full h-full border-none"
                    title="Secondary Brain Chat"
                    allow="clipboard-write; clipboard-read; microphone; camera"
                />
            </main>
        </div>
    );
};
