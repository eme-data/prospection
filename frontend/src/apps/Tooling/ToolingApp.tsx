import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Cog, Home, Archive } from 'lucide-react';
import { ArchivageSharepoint } from './Archivage/ArchivageSharepoint';

const ToolingDashboard: React.FC = () => {
    const navigate = useNavigate();

    const tools = [
        {
            id: 'archivage-sharepoint',
            name: 'Archivage SharePoint',
            description: 'Migrer les fichiers SharePoint non accédés/modifiés depuis 2+ ans vers S3.',
            icon: <Archive className="w-10 h-10 text-cyan-500" />,
            color: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200 dark:bg-cyan-900/20 dark:hover:bg-cyan-900/40 dark:border-cyan-800',
            path: '/tooling/archivage-sharepoint',
        },
    ];

    return (
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-10">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Boîte à outils</h2>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">Sélectionnez un outil pour commencer.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tools.map(tool => (
                        <div
                            key={tool.id}
                            onClick={() => navigate(tool.path)}
                            className={`rounded-xl border-2 p-6 flex flex-col items-center text-center cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${tool.color}`}
                        >
                            {tool.icon}
                            <h3 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">{tool.name}</h3>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{tool.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
};

export const ToolingApp: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isSubPage = location.pathname !== '/tooling';

    return (
        <div className="flex h-screen flex-col">
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigate(isSubPage ? '/tooling' : '/')}
                                className="p-2 mr-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                                title={isSubPage ? 'Retour aux outils' : 'Retour au portail'}
                            >
                                <Home size={20} />
                            </button>
                            <Cog size={28} className="text-cyan-600 dark:text-cyan-400" />
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tooling</h1>
                        </div>
                    </div>
                </div>
            </header>

            <Routes>
                <Route index element={<ToolingDashboard />} />
                <Route path="archivage-sharepoint" element={<ArchivageSharepoint />} />
            </Routes>
        </div>
    );
};
