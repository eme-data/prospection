import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHistory, deletePost, publishPost, Post } from '../../api/communication';
import { Clock, Trash2, Send, Linkedin, Facebook, Instagram, Loader2 } from 'lucide-react';

export const History: React.FC = () => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(0);
    const limit = 10;
    const [publishingId, setPublishingId] = useState<number | null>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ['communication_history', page],
        queryFn: () => getHistory(limit, page * limit)
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deletePost(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['communication_history'] });
        }
    });

    const publishMutation = useMutation({
        mutationFn: ({ platform, id }: { platform: string, id: number }) => publishPost(platform, id),
        onMutate: (vars) => setPublishingId(vars.id),
        onSettled: () => setPublishingId(null),
        onSuccess: (res) => {
            alert(res.message);
            queryClient.invalidateQueries({ queryKey: ['communication_history'] });
        },
        onError: (err: any) => {
            alert(err.message || 'Erreur lors de la publication');
        }
    });

    const handleDelete = (id: number) => {
        if (window.confirm('Voulez-vous vraiment supprimer ce post historique ?')) {
            deleteMutation.mutate(id);
        }
    };

    const handlePublish = (platform: string, id: number) => {
        if (window.confirm(`Voulez-vous publier ce post sur ${platform} ?`)) {
            publishMutation.mutate({ platform, id });
        }
    };

    const renderPlatformIcon = (platform: string) => {
        switch (platform) {
            case 'linkedin': return <Linkedin className="w-4 h-4" />;
            case 'facebook': return <Facebook className="w-4 h-4" />;
            case 'instagram': return <Instagram className="w-4 h-4" />;
            default: return <Send className="w-4 h-4" />;
        }
    };

    if (isLoading) return <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></div>;
    if (error) return <div className="text-red-500 text-center py-10">Erreur de chargement de l'historique</div>;

    const posts = data?.posts || [];
    const total = data?.pagination?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Clock className="w-6 h-6 text-indigo-500" />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Historique de publication</h2>
                    </div>
                </div>

                {posts.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                        Aucun post généré pour le moment.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {posts.map((post: Post) => (
                            <div key={post.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 flex flex-col bg-gray-50 dark:bg-gray-900/50">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-2">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                            ${post.platform === 'linkedin' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                post.platform === 'facebook' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' :
                                                    'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'}`}
                                        >
                                            {renderPlatformIcon(post.platform)}
                                            {post.platform}
                                        </span>
                                        <span className="px-2.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">
                                            {post.ai_model}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {new Date(post.created_at).toLocaleDateString()}
                                    </span>
                                </div>

                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-1" title={post.topic}>
                                    Sujet: {post.topic}
                                </h4>

                                <div className="flex-1 bg-white dark:bg-gray-800 p-4 rounded border border-gray-100 dark:border-gray-700 overflow-y-auto max-h-48 mb-4 text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                                    {post.content}
                                </div>

                                <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handlePublish(post.platform, post.id)}
                                            disabled={publishingId === post.id}
                                            className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                                        >
                                            {publishingId === post.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                            Publier
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => handleDelete(post.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                        title="Supprimer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-8">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 dark:text-white"
                        >
                            Précédent
                        </button>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            Page {page + 1} sur {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 dark:text-white"
                        >
                            Suivant
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
