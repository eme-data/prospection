import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Map, Users, HardHat, Wrench, LogOut, Layout, Calendar, Settings, MessageSquare } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Moon, Sun } from 'lucide-react';

export const PortalPage: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const apps = [
        {
            id: 'faisabilite',
            name: 'Faisabilité',
            description: 'Outil cartographique de prospection et analyse de parcelles.',
            icon: <Map className="w-12 h-12 mb-4 text-blue-500" />,
            color: 'bg-blue-50 hover:bg-blue-100 border-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:border-blue-800',
            path: '/faisabilite',
            active: user?.modules?.faisabilite ?? false
        },
        {
            id: 'crm',
            name: 'CRM',
            description: 'Gestion des prospects, propriétaires et suivis.',
            icon: <Users className="w-12 h-12 mb-4 text-green-500" />,
            color: 'bg-green-50 hover:bg-green-100 border-green-200 dark:bg-green-900/20 dark:hover:bg-green-900/40 dark:border-green-800',
            path: '/crm',
            active: user?.modules?.crm ?? false
        },
        {
            id: 'communication',
            name: 'Communication',
            description: 'Gérer les réseaux sociaux et la création de contenus',
            icon: <MessageSquare className="w-12 h-12 mb-4 text-emerald-500" />,
            color: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 dark:border-emerald-800',
            path: '/communication',
            active: user?.modules?.communication ?? false
        },
        {
            id: 'travaux',
            name: 'Travaux',
            description: 'Suivi de chantier et avancement des projets.',
            icon: <HardHat className="w-12 h-12 mb-4 text-yellow-500" />,
            color: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/40 dark:border-yellow-800',
            path: '/travaux',
            active: user?.modules?.travaux ?? false
        },
        {
            id: 'sav',
            name: 'SAV',
            description: 'Gestion des garanties et requêtes client.',
            icon: <Wrench className="w-12 h-12 mb-4 text-purple-500" />,
            color: 'bg-purple-50 hover:bg-purple-100 border-purple-200 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 dark:border-purple-800',
            path: '/sav',
            active: user?.modules?.sav ?? false
        },
        {
            id: 'conges',
            name: 'Congés',
            description: 'Gestion des absences et congés de l\'équipe.',
            icon: <Calendar className="w-12 h-12 mb-4 text-teal-500" />,
            color: 'bg-teal-50 hover:bg-teal-100 border-teal-200 dark:bg-teal-900/20 dark:hover:bg-teal-900/40 dark:border-teal-800',
            path: '/conges',
            active: user?.modules?.conges ?? false
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                            <Layout size={28} />
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Portail MDO Services</h1>
                        </div>
                        <div className="flex items-center gap-4">
                            {user?.role === 'admin' && (
                                <button
                                    onClick={() => navigate('/admin/users')}
                                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium text-sm border border-indigo-200 dark:border-indigo-800 rounded-md px-3 py-1.5"
                                >
                                    <Settings size={16} />
                                    Administration
                                </button>
                            )}
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-4 border-l border-gray-300 dark:border-gray-600 pl-4">
                                Bonjour, {user?.full_name || user?.email || 'Utilisateur'}
                            </span>
                            <button
                                onClick={toggleTheme}
                                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                            >
                                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium text-sm"
                            >
                                <LogOut size={16} />
                                Déconnexion
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                        Vos Applications
                    </h2>
                    <p className="mt-4 text-xl text-gray-500 dark:text-gray-400">
                        Choisissez un module pour commencer à travailler.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {apps.map((app) => (
                        <div
                            key={app.id}
                            onClick={() => app.active && navigate(app.path)}
                            className={`relative rounded-xl border-2 p-6 flex flex-col items-center text-center transition-all duration-200 cursor-pointer ${app.color} ${!app.active ? 'opacity-50 cursor-not-allowed filter grayscale' : 'hover:-translate-y-1 hover:shadow-lg'}`}
                        >
                            {!app.active && (
                                <span className="absolute top-2 right-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold px-2 py-1 rounded">
                                    Bientôt
                                </span>
                            )}
                            {app.icon}
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{app.name}</h3>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                {app.description}
                            </p>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};
