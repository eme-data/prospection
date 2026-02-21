import React, { useState, useEffect } from 'react';
import { Package, Search, Trash2, Edit2, Plus, Loader2 } from 'lucide-react';
import { getMaterials, deleteMaterial, Material } from '../../../api/commerce';

export const MaterialsList: React.FC = () => {
    const [materials, setMaterials] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const loadMaterials = async () => {
        try {
            setLoading(true);
            const data = await getMaterials();
            setMaterials(data);
        } catch (error) {
            console.error('Erreur chargement matériaux:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMaterials();
    }, []);

    const handleDelete = async (id: string) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce matériau ?')) return;
        try {
            await deleteMaterial(id);
            loadMaterials();
        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('Erreur lors de la suppression');
        }
    };

    const filteredMaterials = materials.filter(m =>
        m.name_fr.toLowerCase().includes(search.toLowerCase()) ||
        m.code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Package className="w-6 h-6 text-orange-500" />
                        Base Matériaux
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gérez votre catalogue de matériaux et fournisseurs.</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-grow sm:flex-grow-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full sm:w-64 pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
                        />
                    </div>
                    <button className="flex-shrink-0 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition">
                        <Plus className="w-4 h-4" />
                        Nouveau
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="p-12 flex justify-center items-center">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
            ) : filteredMaterials.length === 0 ? (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Aucun matériau trouvé.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 font-medium">Code</th>
                                <th className="px-6 py-4 font-medium">Nom</th>
                                <th className="px-6 py-4 font-medium">Unité</th>
                                <th className="px-6 py-4 font-medium text-right">Prix (€)</th>
                                <th className="px-6 py-4 font-medium">Fournisseur</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredMaterials.map((mat) => (
                                <tr key={mat.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                                    <td className="px-6 py-4 font-mono text-xs">{mat.code}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{mat.name_fr}</td>
                                    <td className="px-6 py-4">{mat.unit}</td>
                                    <td className="px-6 py-4 text-right font-medium">{mat.price_eur.toFixed(2)}</td>
                                    <td className="px-6 py-4">{mat.supplier || '-'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <button className="text-blue-500 hover:text-blue-700 transition" title="Modifier">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(mat.id)} className="text-red-500 hover:text-red-700 transition" title="Supprimer">
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
