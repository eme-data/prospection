import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSocialAccounts, SocialAccount } from '../../api/communication';
import { Linkedin, Facebook, Instagram, AlertTriangle, Link as LinkIcon, CheckCircle2, Loader2 } from 'lucide-react';

export const SocialAccounts: React.FC = () => {
    const { data, isLoading } = useQuery({
        queryKey: ['social_accounts'],
        queryFn: getSocialAccounts
    });

    const accounts = data?.accounts || [];

    const getAccountStatus = (platform: string) => {
        return accounts.find((a: SocialAccount) => a.platform === platform);
    };

    const handleConnect = (platform: string) => {
        // Here we would normally redirect to the OAuth URL
        // Example: window.location.href = `/api/communication/oauth/${platform}`;
        alert(`La connexion OAuth vers ${platform} n'est pas encore entièrement implémentée.\n\nIl faudra configurer les applications et les callbacks.`);
    };

    const renderPlatformCard = (platform: string, name: string, icon: React.ReactNode, bgColor: string, hoverColor: string) => {
        const account = getAccountStatus(platform);
        const isConnected = !!account;
        const isValid = account?.isValid;

        return (
            <div className={`p-6 rounded-xl border-2 transition-all ${isConnected
                    ? (isValid ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20')
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}>
                <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg text-white ${bgColor}`}>
                        {icon}
                    </div>
                    {isConnected ? (
                        isValid ? (
                            <span className="flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900 px-2.5 py-1 rounded-full">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Connecté
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-xs font-semibold text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900 px-2.5 py-1 rounded-full">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Expiré
                            </span>
                        )
                    ) : null}
                </div>

                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    {isConnected
                        ? (isValid ? `Votre compte ${name} est lié et prêt pour la publication.` : `Votre jeton d'accès a expiré. Veuillez vous reconnecter.`)
                        : `Liez votre compte ${name} pour publier directement.`}
                </p>

                <button
                    onClick={() => handleConnect(platform)}
                    className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${isConnected
                            ? 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            : `text-white ${bgColor} ${hoverColor}`
                        }`}
                >
                    <LinkIcon className="w-4 h-4" />
                    {isConnected ? 'Reconnecter le compte' : 'Connecter le compte'}
                </button>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Comptes Sociaux</h2>
                <p className="text-gray-500 dark:text-gray-400">
                    Gérez vos connexions aux réseaux sociaux pour activer la publication automatisée.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {renderPlatformCard('linkedin', 'LinkedIn', <Linkedin className="w-8 h-8" />, 'bg-[#0077b5]', 'hover:bg-[#006097]')}
                {renderPlatformCard('facebook', 'Facebook', <Facebook className="w-8 h-8" />, 'bg-[#1877f2]', 'hover:bg-[#166fe5]')}
                {renderPlatformCard('instagram', 'Instagram', <Instagram className="w-8 h-8" />, 'bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888]', 'hover:opacity-90')}
            </div>
        </div>
    );
};
