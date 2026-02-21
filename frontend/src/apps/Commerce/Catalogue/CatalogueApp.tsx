import React from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Database } from 'lucide-react';

import { MaterialsList } from './MaterialsList';
import { ServicesList } from './ServicesList';
import { ArticlesList } from './ArticlesList';
import { ImportPage } from './ImportPage';
import { QuoteList } from '../CRM/QuoteList';
import { QuoteBuilder } from '../CRM/QuoteBuilder';

// Placeholder Pages for CRM features (will be replaced by full implementations)
const CatalogueDashboard = () => <div className="p-8">Dashboard Catalogue (En construction)</div>;

export const CatalogueApp: React.FC = () => {
    const location = useLocation();

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            {/* Topbar Catalogue */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 shadow-sm sticky top-0 z-10">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Database className="w-5 h-5 text-blue-500" />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Catalogue & Clients</h2>
                    </div>

                    <div className="flex flex-wrap bg-gray-100 dark:bg-gray-700 p-1 rounded-lg gap-1">
                        <Link
                            to="/commerce/catalogue/dashboard"
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname.includes('/dashboard')
                                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            Tableau de bord
                        </Link>
                        <Link
                            to="/commerce/catalogue/materials"
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname.includes('/materials')
                                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            Matériaux
                        </Link>
                        <Link
                            to="/commerce/catalogue/services"
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname.includes('/services')
                                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            Services
                        </Link>
                        <Link
                            to="/commerce/catalogue/articles"
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname.includes('/articles')
                                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            Articles
                        </Link>
                        <Link
                            to="/commerce/catalogue/import"
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname.includes('/import')
                                ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            Import Excel
                        </Link>
                        <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
                        <Link
                            to="/commerce/catalogue/quotes"
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname.includes('/quotes')
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900 hover:text-indigo-700 dark:hover:text-indigo-300'
                                }`}
                        >
                            Générateur Devis
                        </Link>
                    </div>
                </div>
            </div>

            <div className="flex-grow p-6">
                <Routes>
                    <Route path="/" element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<CatalogueDashboard />} />
                    <Route path="materials" element={<MaterialsList />} />
                    <Route path="services" element={<ServicesList />} />
                    <Route path="articles" element={<ArticlesList />} />
                    <Route path="import" element={<ImportPage />} />

                    {/* CRM Quotes */}
                    <Route path="quotes" element={<QuoteList />} />
                    <Route path="quotes/new" element={<QuoteBuilder />} />
                    <Route path="quotes/:id/edit" element={<QuoteBuilder />} />
                </Routes>
            </div>
        </div>
    );
};
