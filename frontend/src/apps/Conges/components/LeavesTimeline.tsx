import React from 'react';
import { Conge } from '../../../api/conges';
import { User } from '../../../contexts/AuthContext';

interface LeavesTimelineProps {
    currentDate: Date;
    users: User[];
    conges: Conge[];
}

export const LeavesTimeline: React.FC<LeavesTimelineProps> = ({ currentDate, users, conges }) => {
    // Calculer les jours du mois
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-indexed
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    const days = Array.from({ length: daysInMonth }, (_, i) => {
        const date = new Date(year, month, i + 1);
        return {
            date,
            dayOfWeek: date.getDay(), // 0 (Sun) to 6 (Sat)
            dayNumber: i + 1,
            isWeekend: date.getDay() === 0 || date.getDay() === 6
        };
    });

    const getDayName = (dayIndex: number) => {
        const daysShort = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
        return daysShort[dayIndex];
    };

    // Filter conges to only those that overlap with the current month
    const monthConges = conges.filter(conge => {
        const start = new Date(conge.date_debut);
        const end = new Date(conge.date_fin);
        return (start <= lastDay && end >= firstDay);
    });

    // Helper to find if a user has a conge on a specific day
    const getCongeForDay = (userId: string, dayDate: Date) => {
        // Strip time component for accurate comparison
        const dayStart = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate()).getTime();

        return monthConges.find(conge => {
            if (conge.user_id !== userId) return false;

            const start = new Date(conge.date_debut);
            const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();

            const end = new Date(conge.date_fin);
            const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();

            return startMidnight <= dayStart && endMidnight >= dayStart;
        });
    };

    const getCongeColorStyle = (statut: string) => {
        switch (statut) {
            case 'en_attente':
                return 'bg-orange-400 dark:bg-orange-500';
            case 'approuve':
                return 'bg-teal-500 dark:bg-teal-600';
            case 'refuse':
                return 'bg-red-400 dark:bg-red-500';
            default:
                return 'bg-gray-400';
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-x-auto">
            <div className="min-w-max border-b border-gray-200 dark:border-gray-700">
                {/* Header Row: Days */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <div className="w-48 flex-shrink-0 p-3 sticky left-0 bg-gray-50 dark:bg-gray-900/50 z-10 border-r border-gray-200 dark:border-gray-700">
                        {/* Empty top-left corner */}
                    </div>
                    <div className="flex flex-1">
                        {days.map(day => (
                            <div
                                key={day.dayNumber}
                                className={`flex-1 min-w-[32px] text-center text-xs py-2 border-r border-gray-200 dark:border-gray-700 ${day.isWeekend ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                            >
                                <div className="text-gray-500 dark:text-gray-400 font-medium">{getDayName(day.dayOfWeek)}</div>
                                <div className={`mt-1 ${day.date.toDateString() === new Date().toDateString() ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto' : 'text-gray-900 dark:text-gray-300'}`}>
                                    {day.dayNumber}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* User Rows */}
                {users.map(user => (
                    <div key={user.id} className="flex border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="w-48 flex-shrink-0 p-3 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-10 truncate">
                            {user.full_name || user.email}
                        </div>
                        <div className="flex flex-1">
                            {days.map(day => {
                                const conge = getCongeForDay(user.id, day.date);
                                const isStart = conge && new Date(conge.date_debut).toDateString() === day.date.toDateString();
                                const isEnd = conge && new Date(conge.date_fin).toDateString() === day.date.toDateString();

                                let roundedClass = '';
                                if (conge) {
                                    if (isStart && isEnd) roundedClass = 'rounded-md mx-1';
                                    else if (isStart) roundedClass = 'rounded-l-md ml-1';
                                    else if (isEnd) roundedClass = 'rounded-r-md mr-1';
                                }

                                return (
                                    <div
                                        key={day.dayNumber}
                                        className={`flex-1 min-w-[32px] border-r border-gray-100 dark:border-gray-700 ${day.isWeekend ? 'bg-gray-50 dark:bg-gray-800/50' : ''} p-[2px]`}
                                    >
                                        {conge ? (
                                            <div
                                                className={`h-full w-full min-h-[24px] ${getCongeColorStyle(conge.statut)} ${roundedClass}`}
                                                title={`${conge.type_conge} - ${conge.statut}`}
                                            />
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="p-4 flex items-center space-x-6 bg-gray-50 dark:bg-gray-900/30 text-sm rounded-b-lg">
                <div className="flex items-center">
                    <div className="w-4 h-4 bg-teal-500 rounded mr-2"></div>
                    <span className="text-gray-700 dark:text-gray-300">Approuvé</span>
                </div>
                <div className="flex items-center">
                    <div className="w-4 h-4 bg-orange-400 rounded mr-2"></div>
                    <span className="text-gray-700 dark:text-gray-300">En attente / Prévisionnelle</span>
                </div>
                <div className="flex items-center">
                    <div className="w-4 h-4 bg-red-400 rounded mr-2"></div>
                    <span className="text-gray-700 dark:text-gray-300">Refusé</span>
                </div>
            </div>
        </div>
    );
};
