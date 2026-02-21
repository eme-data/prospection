import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser, updateUser, deleteUser, UserCreatePayload, UserUpdatePayload } from '../api/users';
import { User as AuthUser } from '../contexts/AuthContext';
import { Settings, Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UserFormData extends UserCreatePayload {
    id?: string;
}

const initialFormData: UserFormData = {
    email: '',
    password: '',
    full_name: '',
    role: 'user',
    module_faisabilite: true,
    module_commerce: false,
    module_sav: false,
    module_conges: false,
    module_communication: false,
    manager_id: undefined,
    solde_conges: 25,
};

export const AdminUsersPage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<UserFormData>(initialFormData);
    const [error, setError] = useState<string | null>(null);

    const { data: users, isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: getUsers,
    });

    const createMutation = useMutation({
        mutationFn: createUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            closeModal();
        },
        onError: (err: any) => {
            setError(err.message || 'Erreur lors de la création');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string, payload: UserUpdatePayload }) => updateUser(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            closeModal();
        },
        onError: (err: any) => {
            setError(err.message || 'Erreur lors de la mise à jour');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
        onError: (err: any) => {
            alert(err.message || 'Erreur lors de la suppression');
        }
    });

    const handleOpenModal = (user?: AuthUser) => {
        if (user) {
            setFormData({
                id: user.id,
                email: user.email,
                password: '',
                full_name: user.full_name || '',
                role: user.role || 'user',
                module_faisabilite: user.modules?.faisabilite ?? true,
                module_commerce: user.modules?.commerce ?? false,
                module_sav: user.modules?.sav ?? false,
                module_conges: user.modules?.conges ?? false,
                module_communication: user.modules?.communication ?? false,
                manager_id: user.manager_id,
                solde_conges: user.solde_conges ?? 25,
            });
        } else {
            setFormData(initialFormData);
        }
        setError(null);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setFormData(initialFormData);
        setError(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (formData.id) {
            const payload: UserUpdatePayload = { ...formData };
            if (!payload.password) delete payload.password; // Ne pas modifier si vide
            updateMutation.mutate({ id: formData.id, payload });
        } else {
            if (!formData.password) {
                setError('Le mot de passe est requis pour un nouvel utilisateur.');
                return;
            }
            createMutation.mutate(formData as UserCreatePayload);
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Voulez-vous vraiment supprimer cet utilisateur ?')) {
            deleteMutation.mutate(id);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Chargement des utilisateurs...</div>;

    const moduleKeys = ['faisabilite', 'commerce', 'sav', 'conges', 'communication'] as const;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="sm:flex sm:items-center">
                    <div className="sm:flex-auto flex items-center gap-4">
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="Retour au portail"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Settings className="text-indigo-600" />
                                Administration des Utilisateurs
                            </h1>
                            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                                Gérez les comptes de l'équipe et leurs accès aux différents modules.
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
                        <button
                            onClick={() => handleOpenModal()}
                            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
                        >
                            <Plus className="-ml-1 mr-2 h-5 w-5" />
                            Nouvel Utilisateur
                        </button>
                    </div>
                </div>

                <div className="mt-8 flex flex-col">
                    <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                        <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                                <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 sm:pl-6">Nom</th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Email</th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Rôle</th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 text-center">Modules Actifs</th>
                                            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                        {users?.map((user) => (
                                            <tr key={user.id}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                                                    {user.full_name}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                    {user.email}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                                        {user.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-center">
                                                    <div className="flex justify-center gap-1">
                                                        {moduleKeys.map(key => (
                                                            <div key={key} title={key} className={`w-3 h-3 rounded-full ${user.modules?.[key] ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                    <button onClick={() => handleOpenModal(user)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4">
                                                        <Edit size={18} />
                                                    </button>
                                                    <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
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
                </div>

                {/* Modal de création / édition */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={closeModal}></div>
                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <form onSubmit={handleSubmit} className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div>
                                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                                            {formData.id ? 'Modifier l\'utilisateur' : 'Créer un utilisateur'}
                                        </h3>

                                        {error && (
                                            <div className="mt-2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                                                <span className="block sm:inline">{error}</span>
                                            </div>
                                        )}

                                        <div className="mt-4 space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nom Complet</label>
                                                <input type="text" required value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                                                <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Mot de passe {formData.id && '(Laisser vide pour ne pas modifier)'}
                                                </label>
                                                <input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rôle</label>
                                                <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                                    <option value="user">Utilisateur standard</option>
                                                    <option value="admin">Administrateur</option>
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Responsable (Manager)</label>
                                                    <select value={formData.manager_id || ''} onChange={e => setFormData({ ...formData, manager_id: e.target.value || undefined })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                                        <option value="">-- Aucun --</option>
                                                        {users?.filter(u => u.id !== formData.id).map(u => (
                                                            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Solde Congés (jours)</label>
                                                    <input type="number" step="0.5" required value={formData.solde_conges} onChange={e => setFormData({ ...formData, solde_conges: parseFloat(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Accès aux Modules</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    {moduleKeys.map(key => (
                                                        <div key={key} className="flex items-center">
                                                            <input
                                                                type="checkbox"
                                                                id={`module_${key}`}
                                                                checked={formData[`module_${key}` as keyof UserFormData] as boolean}
                                                                onChange={e => setFormData({ ...formData, [`module_${key}`]: e.target.checked })}
                                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                                                            />
                                                            <label htmlFor={`module_${key}`} className="ml-2 block text-sm text-gray-900 dark:text-gray-300 capitalize">
                                                                {key === 'faisabilite' ? 'Faisabilité' : key}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
                                        <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm">
                                            {(createMutation.isPending || updateMutation.isPending) ? 'Enregistrement...' : 'Enregistrer'}
                                        </button>
                                        <button type="button" onClick={closeModal} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600">
                                            Annuler
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
