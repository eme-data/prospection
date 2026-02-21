import React, { useState, useEffect } from 'react';
import { Layers, Search, Trash2, Edit2, Plus, Loader2 } from 'lucide-react';
import { getArticles, deleteArticle, Article } from '../../../api/commerce';

export const ArticlesList: React.FC = () => {
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const loadArticles = async () => {
        try {
            setLoading(true);
            const data = await getArticles();
            setArticles(data);
        } catch (error) {
            console.error('Erreur chargement articles:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadArticles();
    }, []);

    const handleDelete = async (id: string) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet article composé ?')) return;
        try {
            await deleteArticle(id);
            loadArticles();
        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('Erreur lors de la suppression');
        }
    };

    const filteredArticles = articles.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Layers className="w-6 h-6 text-purple-500" />
                        Articles Composés
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Vos ouvrages composés de matériaux et main-d'œuvre.</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-grow sm:flex-grow-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full sm:w-64 pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                        />
                    </div>
                    <button className="flex-shrink-0 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition">
                        <Plus className="w-4 h-4" />
                        Ouvrage
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="p-12 flex justify-center items-center">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
            ) : filteredArticles.length === 0 ? (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                    <Layers className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Aucun article trouvé.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 font-medium">Code</th>
                                <th className="px-6 py-4 font-medium">Nom de l'Ouvrage</th>
                                <th className="px-6 py-4 font-medium">Unité</th>
                                <th className="px-6 py-4 font-medium text-right">Coût Matière</th>
                                <th className="px-6 py-4 font-medium text-right">Coût MO</th>
                                <th className="px-6 py-4 font-medium text-right">Prix de Vente</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredArticles.map((art) => (
                                <tr key={art.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                                    <td className="px-6 py-4 font-mono text-xs">{art.code}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{art.name}</td>
                                    <td className="px-6 py-4">{art.unit}</td>
                                    <td className="px-6 py-4 text-right text-orange-600 dark:text-orange-400 font-medium">{art.material_cost.toFixed(2)} €</td>
                                    <td className="px-6 py-4 text-right text-blue-600 dark:text-blue-400 font-medium">{art.labor_cost.toFixed(2)} €</td>
                                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white font-bold">{art.total_price.toFixed(2)} €</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <button className="text-blue-500 hover:text-blue-700 transition" title="Modifier">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(art.id)} className="text-red-500 hover:text-red-700 transition" title="Supprimer">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
