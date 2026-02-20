import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSmtpSettings, updateSmtpSettings, SmtpConfig } from '../api/settings';
import { Mail, Save } from 'lucide-react';

export const AdminSettings: React.FC = () => {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState<SmtpConfig>({ host: '', port: 587, user: '', password: '' });

    const { isLoading } = useQuery({
        queryKey: ['settings_smtp'],
        queryFn: getSmtpSettings,
        meta: {
            onSuccess: (data: SmtpConfig) => {
                setFormData({
                    host: data.host,
                    port: data.port,
                    user: data.user,
                    password: data.password ? '********' : ''
                });
            }
        }
    });

    const updateMutation = useMutation({
        mutationFn: updateSmtpSettings,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings_smtp'] });
            alert("Configuration SMTP sauvegardée");
        },
        onError: (err: any) => {
            alert(err.message || 'Erreur lors de la sauvegarde');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { ...formData };
        if (payload.password === '********') {
            delete payload.password;
        }
        updateMutation.mutate(payload);
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Chargement de la configuration...</div>;

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
                <Mail className="text-indigo-600" />
                Configuration Globale
            </h1>

            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 border-b pb-2 dark:border-gray-700">Serveur d'Email (SMTP)</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    Ces identifiants permettront à l'application d'envoyer des notifications automatiques (ex: Demande de congés).
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hôte (Serveur SMTP)</label>
                            <input type="text" required placeholder="smtp.gmail.com" value={formData.host} onChange={e => setFormData({ ...formData, host: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Port</label>
                            <input type="number" required value={formData.port} onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Utilisateur / Email d'envoi</label>
                            <input type="text" required value={formData.user} onChange={e => setFormData({ ...formData, user: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mot de passe</label>
                            <input type="password" placeholder="Laissez vide pour ne pas modifier" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button type="submit" disabled={updateMutation.isPending} className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                            <Save className="-ml-1 mr-2 h-5 w-5" />
                            {updateMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder et Appliquer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
