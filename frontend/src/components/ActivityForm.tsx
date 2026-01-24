import { useState } from 'react'
import { X, Calendar, AlertCircle } from 'lucide-react'

interface ActivityFormProps {
    parcelleId: string
    initialActivity?: any
    onSuccess: () => void
    onCancel: () => void
}

const ACTIVITY_TYPES = [
    { value: 'appel', label: '📞 Appel téléphonique' },
    { value: 'email', label: '📧 Email' },
    { value: 'rdv', label: '📅 Rendez-vous' },
    { value: 'note', label: '📝 Note' },
    { value: 'changement_statut', label: '✅ Changement de statut' },
]

export function ActivityForm({ parcelleId, initialActivity, onSuccess, onCancel }: ActivityFormProps) {
    const [formData, setFormData] = useState({
        type: initialActivity?.type || 'note',
        titre: initialActivity?.titre || '',
        description: initialActivity?.description || '',
        auteur: initialActivity?.auteur || 'Utilisateur',
        prochaine_action: initialActivity?.prochaine_action || '',
        date_rappel: initialActivity?.date_rappel || '',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const url = initialActivity
                ? `/api/activities/${initialActivity.id}`
                : `/api/activities`

            const params = new URLSearchParams({
                parcelle_id: parcelleId,
                type: formData.type,
                titre: formData.titre,
                description: formData.description,
                auteur: formData.auteur,
                ...(formData.prochaine_action && { prochaine_action: formData.prochaine_action }),
                ...(formData.date_rappel && { date_rappel: formData.date_rappel }),
            })

            const response = await fetch(initialActivity ? `${url}?${params}` : `${url}?${params}`, {
                method: initialActivity ? 'PUT' : 'POST',
            })

            if (!response.ok) {
                throw new Error('Erreur lors de l\'enregistrement')
            }

            onSuccess()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur inconnue')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {initialActivity ? 'Modifier l\'activité' : 'Nouvelle activité'}
                    </h2>
                    <button
                        onClick={onCancel}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-start gap-2">
                            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    {/* Type d'activité */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Type d'activité *
                        </label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        >
                            {ACTIVITY_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Titre */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Titre *
                        </label>
                        <input
                            type="text"
                            value={formData.titre}
                            onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Ex: Appel avec le propriétaire"
                            maxLength={200}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Détails de l'activité..."
                            rows={4}
                        />
                    </div>

                    {/* Auteur */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Auteur
                        </label>
                        <input
                            type="text"
                            value={formData.auteur}
                            onChange={(e) => setFormData({ ...formData, auteur: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Votre nom"
                        />
                    </div>

                    {/* Prochaine action */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Prochaine action
                        </label>
                        <input
                            type="text"
                            value={formData.prochaine_action}
                            onChange={(e) => setFormData({ ...formData, prochaine_action: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Ex: Rappeler dans 1 semaine"
                        />
                    </div>

                    {/* Date de rappel */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Date de rappel
                        </label>
                        <input
                            type="datetime-local"
                            value={formData.date_rappel ? new Date(formData.date_rappel).toISOString().slice(0, 16) : ''}
                            onChange={(e) => setFormData({ ...formData, date_rappel: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            disabled={loading}
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? 'Enregistrement...' : initialActivity ? 'Modifier' : 'Créer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
