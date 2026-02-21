import React, { useState, useEffect } from 'react';
import { Hammer, Search, Trash2, Edit2, Plus, Loader2 } from 'lucide-react';
import { getServices, deleteService, Service } from '../../../api/commerce';

export const ServicesList: React.FC = () => {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const loadServices = async () => {
        try {
            setLoading(true);
            const data = await getServices();
            setServices(data);
        } catch (error) {
            console.error('Erreur chargement services:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadServices();
    }, []);

    const handleDelete = async (id: string) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce service ?')) return;
        try {
            await deleteService(id);
            loadServices();
        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('Erreur lors de la suppression');
        }
    };

    const filteredServices = services.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Hammer className="w-6 h-6 text-blue-500" />
                        Opérations & Services
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gérez vos prestations et main-d'œuvre.</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-grow sm:flex-grow-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full sm:w-64 pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        />
                    </div>
                    <button className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition">
                        <Plus className="w-4 h-4" />
                        Nouveau
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="p-12 flex justify-center items-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : filteredServices.length === 0 ? (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                    <Hammer className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Aucun service trouvé.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 font-medium">Code</th>
                                <th className="px-6 py-4 font-medium">Nom</th>
                                <th className="px-6 py-4 font-medium">Unité</th>
                                <th className="px-6 py-4 font-medium text-right">Prix Net (€)</th>
                                <th className="px-6 py-4 font-medium text-right">Prix Brut (€)</th>
                                <th className="px-6 py-4 font-medium text-right">Marge (€)</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredServices.map((srv) => (
                                <tr key={srv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                                    <td className="px-6 py-4 font-mono text-xs">{srv.code}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{srv.name}</td>
                                    <td className="px-6 py-4">{srv.unit}</td>
                                    <td className="px-6 py-4 text-right font-medium">{srv.price_net.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-medium text-blue-600 dark:text-blue-400">{srv.price_gross.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${srv.margin >= 0 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                                            {srv.margin >= 0 ? '+' : ''}{srv.margin.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <button className="text-blue-500 hover:text-blue-700 transition" title="Modifier">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(srv.id)} className="text-red-500 hover:text-red-700 transition" title="Supprimer">
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
