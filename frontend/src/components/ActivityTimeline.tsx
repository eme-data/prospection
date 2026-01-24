import { useState, useEffect } from 'react'
import { Clock, Phone, Mail, Calendar, FileText, AlertCircle, CheckCircle2, Edit2, Trash2 } from 'lucide-react'

interface Activity {
  id: string
  parcelle_id: string
  type: string
  date: string
  titre: string
  description: string
  auteur: string
  statut_avant?: string
  statut_apres?: string
  prochaine_action?: string
  date_rappel?: string
  documents: string[]
  metadata: Record<string, any>
}

interface ActivityTimelineProps {
  parcelleId: string
  onEdit?: (activity: Activity) => void
  onDelete?: (activityId: string) => void
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
      return <AlertCircle className="h-4 w-4" />
  }
}

const getActivityColor = (type: string) => {
  switch (type) {
    case 'appel':
      return 'bg-blue-500'
    case 'email':
      return 'bg-purple-500'
    case 'rdv':
      return 'bg-green-500'
    case 'note':
      return 'bg-gray-500'
    case 'changement_statut':
      return 'bg-orange-500'
    default:
      return 'bg-gray-400'
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return `Aujourd'hui à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  } else if (days === 1) {
    return 'Hier'
  } else if (days < 7) {
    return `Il y a ${days} jours`
  } else {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }
}

export function ActivityTimeline({ parcelleId, onEdit, onDelete }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchActivities()
  }, [parcelleId])

  const fetchActivities = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/activities/${parcelleId}`)
      if (!response.ok) throw new Error('Erreur lors du chargement des activités')
      const data = await response.json()
      setActivities(data.activities || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (activityId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette activité ?')) return

    try {
      const response = await fetch(`/api/activities/${activityId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Erreur lors de la suppression')
      
      setActivities(activities.filter(a => a.id !== activityId))
      if (onDelete) onDelete(activityId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500 dark:text-gray-400">
        <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Aucune activité enregistrée</p>
        <p className="text-sm mt-1">Les interactions seront affichées ici</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <div key={activity.id} className="relative">
          {/* Ligne de connexion */}
          {index < activities.length - 1 && (
            <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
          )}

          {/* Carte d'activité */}
          <div className="relative flex gap-4">
            {/* Icône */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full ${getActivityColor(activity.type)} flex items-center justify-center text-white z-10`}>
              {getActivityIcon(activity.type)}
            </div>

            {/* Contenu */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">{activity.titre}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatDate(activity.date)} • {activity.auteur}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(activity)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                      title="Modifier"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => handleDelete(activity.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Description */}
              {activity.description && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                  {activity.description}
                </p>
              )}

              {/* Changement de statut */}
              {activity.statut_avant && activity.statut_apres && (
                <div className="flex items-center gap-2 text-sm mb-3">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                    {activity.statut_avant}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded text-blue-700 dark:text-blue-300">
                    {activity.statut_apres}
                  </span>
                </div>
              )}

              {/* Prochaine action */}
              {activity.prochaine_action && (
                <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm">
                  <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800 dark:text-yellow-300">Prochaine action</p>
                    <p className="text-yellow-700 dark:text-yellow-400">{activity.prochaine_action}</p>
                  </div>
                </div>
              )}

              {/* Rappel */}
              {activity.date_rappel && (
                <div className="flex items-center gap-2 mt-2 text-sm text-orange-600 dark:text-orange-400">
                  <Clock className="h-4 w-4" />
                  <span>Rappel le {new Date(activity.date_rappel).toLocaleDateString('fr-FR', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span>
                </div>
              )}

              {/* Documents */}
              {activity.documents && activity.documents.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Documents ({activity.documents.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activity.documents.map((doc, i) => (
                      <a
                        key={i}
                        href={doc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Document {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
