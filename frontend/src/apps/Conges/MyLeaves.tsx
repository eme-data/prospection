import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyConges, createConge, CongeCreatePayload, UserCongesData } from '../../api/conges';
import { Calendar, Plus } from 'lucide-react';

export const MyLeaves: React.FC = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<CongeCreatePayload>({
        date_debut: '',
        date_fin: '',
        type_conge: 'CP',
        commentaire: ''
    });

    const { data: userConges, isLoading } = useQuery<UserCongesData>({
        queryKey: ['my_conges'],
        queryFn: getMyConges
    });

    const createMutation = useMutation({
        mutationFn: createConge,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my_conges'] });
            setIsModalOpen(false);
            setFormData({ date_debut: '', date_fin: '', type_conge: 'CP', commentaire: '' });
        },
        onError: (err: any) => {
            alert(err.message || 'Erreur lors de la création de la demande');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate(formData);
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Chargement...</div>;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="sm:flex sm:items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Calendar className="text-indigo-600" />
                        Mes Congés
                    </h1>
                </div>
                <div className="mt-4 flex sm:mt-0 sm:ml-4 flex-col sm:flex-row items-center gap-4">
                    <div className="bg-indigo-100 dark:bg-indigo-900 rounded-lg px-4 py-2 flex text-indigo-800 dark:text-indigo-200 shadow-sm border border-indigo-200 dark:border-indigo-800">
                        <span className="font-semibold text-lg mr-2">{userConges?.solde ?? 0}</span> jours restants
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                    >
                        <Plus className="-ml-1 mr-2 h-5 w-5" />
                        Nouvelle Demande
                    </button>
                </div>
            </div>

            <div className="mt-8">
                <div className="-mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Dates</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Type</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Commentaire</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Statut</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                    {userConges?.historique?.map((conge) => (
                                        <tr key={conge.id}>
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 dark:text-white">
                                                Du {new Date(conge.date_debut).toLocaleDateString('fr-FR')} au {new Date(conge.date_fin).toLocaleDateString('fr-FR')}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                {conge.type_conge}
                                            </td>
                                            <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                {conge.commentaire || '-'}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium 
                                                    ${conge.statut === 'approuve' ? 'bg-green-100 text-green-800' :
                                                        conge.statut === 'refuse' ? 'bg-red-100 text-red-800' :
                                                            'bg-yellow-100 text-yellow-800'}`}>
                                                    {conge.statut === 'approuve' ? 'Approuvé' : conge.statut === 'refuse' ? 'Refusé' : 'En Attente'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!userConges?.historique || userConges.historique.length === 0) && (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                                Aucun historique de demande de congés.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto w-full">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>
                        <div className="inline-block relative align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <form onSubmit={handleSubmit} className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">Poser un Congé</h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date de début</label>
                                            <input type="date" required value={formData.date_debut} onChange={e => setFormData({ ...formData, date_debut: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date de fin</label>
                                            <input type="date" required value={formData.date_fin} onChange={e => setFormData({ ...formData, date_fin: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type de congé</label>
                                        <select value={formData.type_conge} onChange={e => setFormData({ ...formData, type_conge: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                            <option value="CP">Congés Payés (CP)</option>
                                            <option value="RTT">RTT</option>
                                            <option value="Maladie">Arrêt Maladie</option>
                                            <option value="Sans Solde">Sans Solde</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Motif / Commentaire</label>
                                        <textarea rows={3} value={formData.commentaire} onChange={e => setFormData({ ...formData, commentaire: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                    </div>
                                </div>
                                <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
                                    <button type="submit" disabled={createMutation.isPending} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:ml-3 sm:w-auto sm:text-sm">
                                        {createMutation.isPending ? 'Envoi...' : 'Soumettre'}
                                    </button>
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:w-auto sm:text-sm">
                                        Annuler
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
