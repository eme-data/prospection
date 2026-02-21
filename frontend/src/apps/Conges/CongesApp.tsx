import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MyLeaves } from './MyLeaves';
import { TeamLeaves } from './TeamLeaves';
import { Planning } from './Planning';
import { Calendar, Users, LogOut, CalendarDays } from 'lucide-react';

export const CongesApp: React.FC = () => {
    const { logout, user } = useAuth();
    const location = useLocation();

    // Vérifie si l'utilisateur est admin ou a des subordonnés (géré en backend, pour l'UI, on va laisser TeamLeaves accessible s'ils sont admin, ou s'ils cliquent)
    // Pour l'UX, on affiche l'onglet Validation Equipe si c'est un manager ou un admin (par simplicité on la montre car le backend filtrera de toute facon)

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            {/* Header Navigation */}
            <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center">
                                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                    Congés & Absences
                                </span>
                            </div>
                            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                <Link
                                    to="/conges/mes-demandes"
                                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${location.pathname.includes('/mes-demandes') ? 'border-indigo-500 text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                                >
                                    <Calendar className="mr-2 h-4 w-4" />
                                    Mes Demandes
                                </Link>
                                <Link
                                    to="/conges/planning"
                                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${location.pathname.includes('/planning') ? 'border-indigo-500 text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                                >
                                    <CalendarDays className="mr-2 h-4 w-4" />
                                    Planning
                                </Link>
                                <Link
                                    to="/conges/equipe"
                                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${location.pathname.includes('/equipe') ? 'border-indigo-500 text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                                >
                                    <Users className="mr-2 h-4 w-4" />
                                    Validation Équipe
                                </Link>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                                {user?.full_name || user?.email}
                            </span>
                            <Link
                                to="/portal"
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
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
            <main>
                <Routes>
                    <Route path="/" element={<MyLeaves />} />
                    <Route path="/mes-demandes" element={<MyLeaves />} />
                    <Route path="/planning" element={<Planning />} />
                    <Route path="/equipe" element={<TeamLeaves />} />
                </Routes>
            </main>
        </div>
    );
};
