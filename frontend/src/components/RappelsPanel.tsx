import { useState, useEffect } from 'react'
import { Bell, Clock, X, Phone, Mail, Calendar, FileText, CheckCircle2 } from 'lucide-react'
import type { Activity, RappelsResponse } from '../types'

interface RappelsPanelProps {
    onClose: () => void
}

const getActivityIcon = (type: string) => {
    switch (type) {
        case 'appel':
            return <Phone className="h-4 w-4" />
        case 'email':
            return <Mail className="h-4 w-4" />
        case 'rdv':
            return <Calendar className="h-4 w-4" />
        case 'note':
            return <FileText className="h-4 w-4" />
        case 'changement_statut':
            return <CheckCircle2 className="h-4 w-4" />
        default:
            return <Clock className="h-4 w-4" />
    }
}

const formatRappelDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (diff < 0) {
        return { text: 'En retard', color: 'text-red-600 dark:text-red-400', urgent: true }
    } else if (days === 0 && hours < 2) {
        return { text: 'Dans moins de 2h', color: 'text-orange-600 dark:text-orange-400', urgent: true }
    } else if (days === 0) {
        return { text: `Aujourd'hui à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, color: 'text-orange-600 dark:text-orange-400', urgent: false }
    } else if (days === 1) {
        return { text: 'Demain', color: 'text-yellow-600 dark:text-yellow-400', urgent: false }
    } else if (days < 7) {
        return { text: `Dans ${days} jours`, color: 'text-blue-600 dark:text-blue-400', urgent: false }
    } else {
        return { text: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }), color: 'text-gray-600 dark:text-gray-400', urgent: false }
    }
}

export function RappelsPanel({ onClose }: RappelsPanelProps) {
    const [rappels, setRappels] = useState<Activity[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchRappels()
    }, [])

    const fetchRappels = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/activities/rappels/list?limit=50')
            if (!response.ok) throw new Error('Erreur lors du chargement des rappels')
            const data: RappelsResponse = await response.json()
            setRappels(data.rappels || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur inconnue')
        } finally {
            setLoading(false)
        }
    }

    const rappelsUrgents = rappels.filter(r => {
        const diff = new Date(r.date_rappel!).getTime() - new Date().getTime()
        return diff < 2 * 60 * 60 * 1000 // Moins de 2h
    })

    return (
        <div className="absolute top-16 right-4 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                        Rappels
                    </h3>
                    {rappelsUrgents.length > 0 && (
                        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 text-xs font-medium rounded-full">
                            {rappelsUrgents.length} urgent{rappelsUrgents.length > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {!loading && !error && rappels.length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Aucun rappel programmé</p>
                        <p className="text-sm mt-1">Les rappels apparaîtront ici</p>
                    </div>
                )}

                {!loading && !error && rappels.length > 0 && (
                    <div className="space-y-3">
                        {rappels.map((rappel) => {
                            const dateInfo = formatRappelDate(rappel.date_rappel!)

                            return (
                                <div
                                    key={rappel.id}
                                    className={`p-3 rounded-lg border ${dateInfo.urgent
                                            ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                                        } hover:shadow-md transition-shadow`}
                                >
                                    {/* Header */}
                                    <div className="flex items-start gap-2 mb-2">
                                        <div className="flex-shrink-0 mt-0.5">
                                            {getActivityIcon(rappel.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                                {rappel.titre}
                                            </h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                Parcelle: {rappel.parcelle_id}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Date */}
                                    <div className={`flex items-center gap-1.5 text-sm font-medium ${dateInfo.color}`}>
                                        <Clock className="h-3.5 w-3.5" />
                                        <span>{dateInfo.text}</span>
                                    </div>

                                    {/* Prochaine action */}
                                    {rappel.prochaine_action && (
                                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-2">
                                            {rappel.prochaine_action}
                                        </p>
                                    )}

                                    {/* Description */}
                                    {rappel.description && (
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
                                            {rappel.description}
                                        </p>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            {!loading && rappels.length > 0 && (
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {rappels.length} rappel{rappels.length > 1 ? 's' : ''} programmé{rappels.length > 1 ? 's' : ''}
                    </p>
                </div>
            )}
        </div>
    )
}
