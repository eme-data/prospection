import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { LeavesTimeline } from './components/LeavesTimeline';
import { getTeamConges, getMyConges, Conge } from '../../api/conges';
import { getUsers } from '../../api/users';
import { useAuth, User } from '../../contexts/AuthContext';

export const Planning: React.FC = () => {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [users, setUsers] = useState<User[]>([]);
    const [conges, setConges] = useState<Conge[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const allUsers = await getUsers();

            // Si on est simple utilisateur, on ne peut voir (normalement) que nos propres demandes via l'API.
            // Le backend filtre `getTeamConges` selon le rôle ou manager_id.
            // Fallback : on fetch `getTeamConges`. 
            // - Si admin: ça renvoie tous les congés.
            // - Si manager: ça renvoie les congés de son équipe (si on veut aussi les siens, il faut les 2).
            // L'idéal est de fetch `getTeamConges` ET `getMyConges` et de fusionner pour s'assurer d'avoir les siens + son équipe.

            try {
                const teamReq = getTeamConges().catch(() => []);
                const myReq = getMyConges().catch(() => ({ historique: [] }));

                const [teamRes, myRes] = await Promise.all([teamReq, myReq]);

                // Fusionner les congés et dédupliquer par ID
                const congesMap = new Map<string, Conge>();

                // My Conges
                ((myRes as any).historique || []).forEach((c: Conge) => congesMap.set(c.id, c));

                // Team Conges
                (teamRes || []).forEach((c: Conge) => congesMap.set(c.id, c));

                const mergedConges = Array.from(congesMap.values());
                setConges(mergedConges);

                // Filtrer les utilisateurs concernés
                // Si l'utilisateur est admin, on affiche tout le monde. 
                // Sinon, on affiche au minimum lui-même, et potentiellement ceux de son équipe.
                let relevantUsers: User[] = [];
                if (user?.role === 'admin') {
                    relevantUsers = allUsers;
                } else {
                    const uniqueUserIdsInConges = new Set(mergedConges.map(c => c.user_id));
                    uniqueUserIdsInConges.add(user!.id); // Always include self

                    relevantUsers = allUsers.filter(u => uniqueUserIdsInConges.has(u.id));

                    // Si un user n'a pas de congé sur la période ou n'est pas dans l'équipe, on s'assure qu'au moins
                    // les subordonnés (manager_id === user.id) sont affichés.
                    const subordinates = allUsers.filter(u => u.manager_id === user?.id);
                    subordinates.forEach(sub => {
                        if (!relevantUsers.find(ru => ru.id === sub.id)) {
                            relevantUsers.push(sub);
                        }
                    });
                }

                // Sort users: Current user first, then alphabetical
                relevantUsers.sort((a, b) => {
                    if (a.id === user?.id) return -1;
                    if (b.id === user?.id) return 1;
                    const nameA = a.full_name || a.email;
                    const nameB = b.full_name || b.email;
                    return nameA.localeCompare(nameB);
                });

                setUsers(relevantUsers);
            } catch (err: any) {
                console.error("Erreur récupération", err);
                setError("Impossible de charger les données du planning.");
            }

        } catch (err: any) {
            setError(err.message || 'Une erreur est survenue lors du chargement des données');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentDate]);

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const formatMonthYear = (date: Date) => {
        const month = date.toLocaleString('fr-FR', { month: 'long' });
        return `${month.charAt(0).toUpperCase() + month.slice(1)} ${date.getFullYear()}`;
    };

    if (isLoading && conges.length === 0) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                <span className="ml-3 text-gray-600 dark:text-gray-400">Chargement du planning...</span>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-4 sm:px-0">

                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-0 flex items-center">
                        Planning des Congés
                    </h2>

                    <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-md p-1">
                        <button
                            onClick={prevMonth}
                            className="p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                            title="Mois précédent"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="min-w-[150px] text-center font-medium mx-4 text-gray-800 dark:text-gray-200">
                            {formatMonthYear(currentDate)}
                        </span>
                        <button
                            onClick={nextMonth}
                            className="p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                            title="Mois suivant"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded-md">
                        <div className="flex">
                            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                        </div>
                    </div>
                )}

                {/* Timeline Grid */}
                <LeavesTimeline
                    currentDate={currentDate}
                    users={users}
                    conges={conges}
                />

            </div>
        </div>
    );
};
