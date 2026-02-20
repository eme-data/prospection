import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTeamConges, updateCongeStatut, Conge } from '../../api/conges';
import { Users, Check, X } from 'lucide-react';

export const TeamLeaves: React.FC = () => {
    const queryClient = useQueryClient();

    const { data: teamConges, isLoading } = useQuery<Conge[]>({
        queryKey: ['team_conges'],
        queryFn: getTeamConges
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, statut }: { id: string, statut: 'approuve' | 'refuse' }) => updateCongeStatut(id, statut),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['team_conges'] });
        },
        onError: (err: any) => {
            alert(err.message || 'Erreur lors de la mise à jour du statut');
        }
    });

    const handleAvis = (id: string, statut: 'approuve' | 'refuse') => {
        if (window.confirm(`Êtes-vous sûr de vouloir ${statut === 'approuve' ? 'approuver' : 'refuser'} cette demande ?`)) {
            updateStatusMutation.mutate({ id, statut });
        }
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Chargement des demandes de l'équipe...</div>;

    const pendingLeaves = teamConges?.filter(c => c.statut === 'en_attente') || [];
    const pastLeaves = teamConges?.filter(c => c.statut !== 'en_attente') || [];

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-8">
                <Users className="text-indigo-600" />
                Validation Équipe
            </h1>

            <div className="mb-10">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">À Valider ({pendingLeaves.length})</h2>
                {pendingLeaves.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center shadow">
                        <p className="text-gray-500 dark:text-gray-400">Aucune demande en attente.</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                            {pendingLeaves.map((conge) => (
                                <li key={conge.id} className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">
                                                Demande de {conge.type_conge}
                                            </p>
                                            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                                <p>Du {new Date(conge.date_debut).toLocaleDateString('fr-FR')} au {new Date(conge.date_fin).toLocaleDateString('fr-FR')}</p>
                                                {conge.commentaire && <p className="italic mt-1">"{conge.commentaire}"</p>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleAvis(conge.id, 'approuve')}
                                                disabled={updateStatusMutation.isPending}
                                                className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-green-600 hover:bg-green-700"
                                                title="Approuver"
                                            >
                                                <Check className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={() => handleAvis(conge.id, 'refuse')}
                                                disabled={updateStatusMutation.isPending}
                                                className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700"
                                                title="Refuser"
                                            >
                                                <X className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div>
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Historique Récent</h2>
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                            {pastLeaves.slice(0, 10).map((conge) => (
                                <tr key={conge.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        Du {new Date(conge.date_debut).toLocaleDateString()} au {new Date(conge.date_fin).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {conge.type_conge}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium 
                                            ${conge.statut === 'approuve' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {conge.statut === 'approuve' ? 'Approuvé' : 'Refusé'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
