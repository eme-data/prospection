import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSmtpSettings, updateSmtpSettings, SmtpConfig, getApiKeysSettings, updateApiKeysSettings, ApiKeysConfig } from '../api/settings';
import { Mail, Save, Key, ArrowLeft, Settings } from 'lucide-react';

export const AdminSettings: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [smtpData, setSmtpData] = useState<SmtpConfig>({ host: '', port: 587, user: '', password: '' });
    const [apiKeysData, setApiKeysData] = useState<ApiKeysConfig>({
        gemini_api_key: '', groq_api_key: '',
        linkedin_client_id: '', linkedin_client_secret: '',
        facebook_client_id: '', facebook_client_secret: '',
        instagram_client_id: '', instagram_client_secret: ''
    });

    const { isLoading: isSmtpLoading } = useQuery({
        queryKey: ['settings_smtp'],
        queryFn: getSmtpSettings,
        meta: {
            onSuccess: (data: SmtpConfig) => {
                setSmtpData({
                    host: data.host,
                    port: data.port,
                    user: data.user,
                    password: data.password ? '********' : ''
                });
            }
        }
    });

    const { isLoading: isApiKeysLoading } = useQuery({
        queryKey: ['settings_apikeys'],
        queryFn: getApiKeysSettings,
        meta: {
            onSuccess: (data: ApiKeysConfig) => {
                setApiKeysData({
                    gemini_api_key: data.gemini_api_key ? '********' : '',
                    groq_api_key: data.groq_api_key ? '********' : '',
                    linkedin_client_id: data.linkedin_client_id ? '********' : '',
                    linkedin_client_secret: data.linkedin_client_secret ? '********' : '',
                    facebook_client_id: data.facebook_client_id ? '********' : '',
                    facebook_client_secret: data.facebook_client_secret ? '********' : '',
                    instagram_client_id: data.instagram_client_id ? '********' : '',
                    instagram_client_secret: data.instagram_client_secret ? '********' : '',
                });
            }
        }
    });

    const updateSmtpMutation = useMutation({
        mutationFn: updateSmtpSettings,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings_smtp'] });
            alert("Configuration SMTP sauvegardée");
        },
        onError: (err: any) => {
            alert(err.message || 'Erreur lors de la sauvegarde SMTP');
        }
    });

    const updateApiKeysMutation = useMutation({
        mutationFn: updateApiKeysSettings,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings_apikeys'] });
            alert("Configuration des clés API sauvegardée");
        },
        onError: (err: any) => {
            alert(err.message || 'Erreur lors de la sauvegarde des clés API');
        }
    });

    const handleSubmitSmtp = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { ...smtpData };
        if (payload.password === '********') {
            delete payload.password;
        }
        updateSmtpMutation.mutate(payload);
    };

    const handleSubmitApiKeys = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { ...apiKeysData };
        if (payload.gemini_api_key === '********') delete payload.gemini_api_key;
        if (payload.groq_api_key === '********') delete payload.groq_api_key;
        if (payload.linkedin_client_id === '********') delete payload.linkedin_client_id;
        if (payload.linkedin_client_secret === '********') delete payload.linkedin_client_secret;
        if (payload.facebook_client_id === '********') delete payload.facebook_client_id;
        if (payload.facebook_client_secret === '********') delete payload.facebook_client_secret;
        if (payload.instagram_client_id === '********') delete payload.instagram_client_id;
        if (payload.instagram_client_secret === '********') delete payload.instagram_client_secret;
        updateApiKeysMutation.mutate(payload);
    };

    if (isSmtpLoading || isApiKeysLoading) return <div className="p-8 text-center text-gray-500">Chargement de la configuration...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Retour au portail"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Settings className="text-indigo-600" />
                        Configuration Globale
                    </h1>
                </div>

                <div className="space-y-8">
                    {/* SMTP section */}
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 border-b pb-2 dark:border-gray-700 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-indigo-500" />
                            Serveur d'Email (SMTP)
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            Ces identifiants permettront à l'application d'envoyer des notifications automatiques.
                        </p>

                        <form onSubmit={handleSubmitSmtp} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hôte (Serveur SMTP)</label>
                                    <input type="text" required placeholder="smtp.gmail.com" value={smtpData.host} onChange={e => setSmtpData({ ...smtpData, host: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Port</label>
                                    <input type="number" required value={smtpData.port} onChange={e => setSmtpData({ ...smtpData, port: parseInt(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Utilisateur / Email d'envoi</label>
                                    <input type="text" required value={smtpData.user} onChange={e => setSmtpData({ ...smtpData, user: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mot de passe</label>
                                    <input type="password" placeholder="Laissez vide pour ne pas modifier" value={smtpData.password} onChange={e => setSmtpData({ ...smtpData, password: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button type="submit" disabled={updateSmtpMutation.isPending} className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                                    <Save className="-ml-1 mr-2 h-5 w-5" />
                                    {updateSmtpMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder et Appliquer'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* API Keys section */}
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 border-b pb-2 dark:border-gray-700 flex items-center gap-2">
                            <Key className="w-5 h-5 text-green-500" />
                            Clés d'API (Environnement)
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            Configurez ici vos clés d'API (remplaçant le fichier .env) pour les interactions avec l'IA (Gemini / Groq).
                        </p>

                        <form onSubmit={handleSubmitApiKeys} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Clé API Google Gemini</label>
                                    <input
                                        type="password"
                                        placeholder="Laissez vide pour ne pas modifier"
                                        value={apiKeysData.gemini_api_key}
                                        onChange={e => setApiKeysData({ ...apiKeysData, gemini_api_key: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Clé API Groq</label>
                                    <input
                                        type="password"
                                        placeholder="Laissez vide pour ne pas modifier"
                                        value={apiKeysData.groq_api_key}
                                        onChange={e => setApiKeysData({ ...apiKeysData, groq_api_key: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t dark:border-gray-700">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">LinkedIn Client ID</label>
                                    <input
                                        type="password"
                                        placeholder="Laissez vide pour ne pas modifier"
                                        value={apiKeysData.linkedin_client_id}
                                        onChange={e => setApiKeysData({ ...apiKeysData, linkedin_client_id: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">LinkedIn Client Secret</label>
                                    <input
                                        type="password"
                                        placeholder="Laissez vide pour ne pas modifier"
                                        value={apiKeysData.linkedin_client_secret}
                                        onChange={e => setApiKeysData({ ...apiKeysData, linkedin_client_secret: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Facebook App ID</label>
                                    <input
                                        type="password"
                                        placeholder="Laissez vide pour ne pas modifier"
                                        value={apiKeysData.facebook_client_id}
                                        onChange={e => setApiKeysData({ ...apiKeysData, facebook_client_id: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Facebook App Secret</label>
                                    <input
                                        type="password"
                                        placeholder="Laissez vide pour ne pas modifier"
                                        value={apiKeysData.facebook_client_secret}
                                        onChange={e => setApiKeysData({ ...apiKeysData, facebook_client_secret: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Instagram App ID</label>
                                    <input
                                        type="password"
                                        placeholder="Laissez vide pour ne pas modifier"
                                        value={apiKeysData.instagram_client_id}
                                        onChange={e => setApiKeysData({ ...apiKeysData, instagram_client_id: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Instagram App Secret</label>
                                    <input
                                        type="password"
                                        placeholder="Laissez vide pour ne pas modifier"
                                        value={apiKeysData.instagram_client_secret}
                                        onChange={e => setApiKeysData({ ...apiKeysData, instagram_client_secret: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button type="submit" disabled={updateApiKeysMutation.isPending} className="inline-flex items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
                                    <Save className="-ml-1 mr-2 h-5 w-5" />
                                    {updateApiKeysMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder et Appliquer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
