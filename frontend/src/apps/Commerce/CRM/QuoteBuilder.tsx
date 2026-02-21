import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getArticles, getCompositions, createQuote, updateQuote, getQuote, QuoteItem, getClients, createClient } from '../../../api/commerce';
import { ArrowLeft, Save, Plus, Trash2, Search, Calculator, UserPlus, Printer } from 'lucide-react';

export const QuoteBuilder: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const isEditMode = !!id;
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Data fetching
    const { data: articles } = useQuery({ queryKey: ['articles'], queryFn: getArticles });
    const { data: compositions } = useQuery({ queryKey: ['compositions'], queryFn: getCompositions });
    const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: getClients });
    const { data: existingQuote, isLoading: loadingQuote } = useQuery({
        queryKey: ['quote', id],
        queryFn: () => getQuote(id!),
        enabled: isEditMode
    });

    // Form State
    const [title, setTitle] = useState('');
    const [clientId, setClientId] = useState('');
    const [items, setItems] = useState<QuoteItem[]>([]);

    // Temporary variables for the item being added
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItemType, setSelectedItemType] = useState<"article" | "composition" | "custom">("article");

    const [showNewClientModal, setShowNewClientModal] = useState(false);
    const [newClientName, setNewClientName] = useState('');

    // Pre-fill if edit mode
    useEffect(() => {
        if (isEditMode && existingQuote) {
            setTitle(existingQuote.title);
            setClientId(existingQuote.client_id || '');
            setItems(existingQuote.items || []);
        }
    }, [isEditMode, existingQuote]);

    const saveMutation = useMutation({
        mutationFn: (data: any) => isEditMode ? updateQuote(id!, data) : createQuote(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quotes'] });
            navigate('/commerce/catalogue/quotes');
        }
    });

    const createClientMutation = useMutation({
        mutationFn: createClient,
        onSuccess: (newClient) => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            setClientId(newClient.id);
            setShowNewClientModal(false);
            setNewClientName('');
        }
    });

    const addItem = (catItem: any, type: "article" | "composition" | "custom") => {
        const newItem: QuoteItem = {
            item_type: type,
            item_reference_id: catItem.id,
            name: type === 'article' ? catItem.name : catItem.name,
            description: catItem.description || '',
            quantity: 1,
            unit_price_ht: catItem.total_price || 0,
        };
        setItems([...items, newItem]);
        setSearchQuery('');
    };

    const addCustomItem = () => {
        const newItem: QuoteItem = {
            item_type: 'custom',
            name: 'Nouvelle ligne sans référence',
            quantity: 1,
            unit_price_ht: 0,
        };
        setItems([...items, newItem]);
    };

    const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        if (!title.trim() || items.length === 0 || !clientId) {
            alert("Veuillez donner un titre, choisir un client, et ajouter au moins une ligne.");
            return;
        }

        saveMutation.mutate({
            title,
            client_id: clientId,
            items: items.map((item) => ({
                ...item,
                // ID est ignoré par le backend lors du PUT (pour les items, on drop and replace)
                total_price_ht: item.quantity * item.unit_price_ht
            }))
        });
    };

    const handleCreateClient = () => {
        if (!newClientName.trim()) return;
        createClientMutation.mutate({
            company_name: newClientName,
            client_type: 'prospect',
            country: 'France',
            is_active: true
        });
    };

    const totalHT = items.reduce((sum, item) => sum + (item.quantity * item.unit_price_ht), 0);
    const totalTVA = totalHT * 0.20;
    const totalTTC = totalHT + totalTVA;

    // Autocomplete filtering
    const searchResults = () => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();

        if (selectedItemType === 'article') {
            return articles?.filter(a => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)).slice(0, 5) || [];
        } else if (selectedItemType === 'composition') {
            return compositions?.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)).slice(0, 5) || [];
        }
        return [];
    };

    if (isEditMode && loadingQuote) {
        return <div className="p-8 text-center text-gray-500">Chargement du devis...</div>;
    }

    return (
        <div className="max-w-7xl mx-auto pb-12 print-container">
            {/* EN-TETE ACTIONS (caché à l'impression) */}
            <div className="flex items-center gap-4 mb-6 print:hidden">
                <button
                    onClick={() => navigate('/commerce/catalogue/quotes')}
                    className="p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    title="Retour aux devis"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Calculator className="text-indigo-500" />
                        {isEditMode ? `Édition Devis : ${existingQuote?.quote_number || ''}` : 'Nouveau Devis'}
                    </h2>
                </div>
                <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 transition"
                >
                    <Printer className="w-4 h-4" /> PDF
                </button>
                <button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                    {saveMutation.isPending ? "Sauvegarde..." : <><Save className="w-4 h-4" /> {isEditMode ? 'Mettre à jour' : 'Enregistrer'}</>}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* EN-TETE DEVIS */}
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Informations Générales</h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Titre du Devis / Nom du Projet</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Ex: Construction Villa Larox 145m²"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white py-2 px-3 border"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Client</label>
                                <div className="mt-1 flex gap-2">
                                    <select
                                        value={clientId}
                                        onChange={(e) => setClientId(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 py-2 px-3 border focus:border-indigo-500 focus:ring-indigo-500"
                                    >
                                        <option value="" disabled>Sélectionnez un client</option>
                                        {clients?.map((c) => (
                                            <option key={c.id} value={c.id}>{c.company_name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => setShowNewClientModal(true)}
                                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 flex-shrink-0"
                                        title="Nouveau Client"
                                    >
                                        <UserPlus className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                        {showNewClientModal && (
                            <div className="mt-4 p-4 border border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 rounded-md">
                                <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200">Nom de la société (Nouveau Client)</label>
                                <div className="mt-2 flex gap-2">
                                    <input
                                        type="text"
                                        value={newClientName}
                                        onChange={(e) => setNewClientName(e.target.value)}
                                        className="block w-full rounded-md border-indigo-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2"
                                        placeholder="Ex: SCI Immobilière"
                                    />
                                    <button
                                        onClick={handleCreateClient}
                                        disabled={!newClientName.trim() || createClientMutation.isPending}
                                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                                    >
                                        {createClientMutation.isPending ? 'Création...' : 'Créer'}
                                    </button>
                                    <button onClick={() => setShowNewClientModal(false)} className="text-gray-500 px-3">Annuler</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* LIGNES DU DEVIS */}
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border print:border-none print:shadow-none">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center print:bg-transparent print:border-b-2 print:border-black">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Détail Quantitatif et Estimatif</h3>
                            <button onClick={addCustomItem} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-800 flex items-center gap-1">
                                <Plus size={16} /> Ligne libre
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Désignation</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-24">Quantité</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">P.U HT (€)</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">Total HT (€)</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500 italic">
                                                Aucune ligne dans le devis. Ajoutez des produits depuis le catalogue ci-contre.
                                            </td>
                                        </tr>
                                    ) : items.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                                                    className="block w-full border-0 border-b border-transparent bg-transparent focus:border-indigo-500 focus:ring-0 sm:text-sm text-gray-900 dark:text-white dark:bg-gray-800 px-1 py-1"
                                                />
                                                {item.item_type !== 'custom' && (
                                                    <span className="text-xs text-indigo-500 ml-1 font-medium bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                                                        Lien Catalogue ({item.item_type})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className="block w-full text-right border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-2 py-1 border"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.unit_price_ht}
                                                    onChange={(e) => updateItem(index, 'unit_price_ht', parseFloat(e.target.value) || 0)}
                                                    className="block w-full text-right border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-2 py-1 border"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">
                                                {(item.quantity * item.unit_price_ht).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-3 text-right print:hidden">
                                                <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600">
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* COLONNE DROITE : RECHERCHE CATALOGUE & TOTAL */}
                <div className="space-y-6">
                    {/* AJOUT CATALOGUE VITE FAIT (caché à l'impression) */}
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 print:hidden">
                        <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Search size={18} className="text-indigo-500" /> Insérer depuis Catalogue
                        </h3>

                        <div className="flex rounded-md shadow-sm mb-4">
                            <button
                                type="button"
                                onClick={() => setSelectedItemType('article')}
                                className={`relative flex-1 inline-flex items-center justify-center px-4 py-2 text-sm font-medium border ${selectedItemType === 'article' ? 'bg-indigo-50 border-indigo-500 text-indigo-600 z-10' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'} rounded-l-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200`}
                            >
                                Articles M.O.
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedItemType('composition')}
                                className={`relative flex-1 inline-flex items-center justify-center px-4 py-2 text-sm font-medium border ${selectedItemType === 'composition' ? 'bg-indigo-50 border-indigo-500 text-indigo-600 z-10' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'} rounded-r-md -ml-px dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200`}
                            >
                                Compositions
                            </button>
                        </div>

                        <div className="relative">
                            <input
                                type="text"
                                placeholder={`Rechercher un ${selectedItemType}...`}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="block w-full border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 border shadow-inner"
                            />

                            {searchQuery.trim().length > 0 && (
                                <ul className="mt-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 shadow-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-60 overflow-auto">
                                    {searchResults().length === 0 ? (
                                        <li className="px-4 py-3 text-sm text-gray-500">Aucun résultat.</li>
                                    ) : searchResults().map((res: any) => (
                                        <li
                                            key={res.id}
                                            className="px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 cursor-pointer flex justify-between items-center group transition-colors"
                                            onClick={() => addItem(res, selectedItemType)}
                                        >
                                            <div className="overflow-hidden">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={res.name}>{res.name}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{res.code} - {res.unit}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">€{res.total_price?.toFixed(2)}</span>
                                                <Plus className="w-5 h-5 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                </div>

                {/* RECAP FINANCIER */}
                <div className="bg-indigo-900 rounded-lg shadow-lg p-6 text-white print:bg-white print:text-black print:border print:border-gray-300 print:shadow-none">
                    <h3 className="text-lg font-medium mb-4 text-indigo-100 border-b border-indigo-700 pb-2 print:text-black print:border-gray-300">Résumé Financier</h3>
                    <dl className="mt-4 space-y-3">
                        <div className="flex items-center justify-between text-indigo-200 print:text-gray-800">
                            <dt className="text-sm">Total HT</dt>
                            <dd className="text-right text-base font-medium">{totalHT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</dd>
                        </div>
                        <div className="flex items-center justify-between text-indigo-200 print:text-gray-800">
                            <dt className="text-sm">TVA (20%)</dt>
                            <dd className="text-right text-base font-medium">+ {totalTVA.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</dd>
                        </div>
                        <div className="flex items-center justify-between border-t border-indigo-700 pt-3 mt-3 print:border-gray-400">
                            <dt className="text-base font-bold text-white print:text-black">Total TTC</dt>
                            <dd className="text-right text-xl font-bold text-white print:text-black">{totalTTC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</dd>
                        </div>
                    </dl>
                </div>
            </div>
        </div>
    );
};
