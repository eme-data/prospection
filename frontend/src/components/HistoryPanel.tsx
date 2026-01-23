import { X, Clock, MapPin, Trash2, Search } from 'lucide-react'
import type { SearchHistory, AddressResult } from '../types'

interface HistoryPanelProps {
  history: SearchHistory[]
  onSelectHistory: (address: AddressResult) => void
  onDeleteHistory: (id: string) => void
  onClearAll: () => void
  onClose: () => void
}

export function HistoryPanel({
  history,
  onSelectHistory,
  onDeleteHistory,
  onClearAll,
  onClose,
}: HistoryPanelProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "À l'instant"
    if (minutes < 60) return `Il y a ${minutes} min`
    if (hours < 24) return `Il y a ${hours}h`
    if (days < 7) return `Il y a ${days}j`
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 max-h-[calc(100vh-8rem)] overflow-y-auto w-96">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Historique des recherches
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
          title="Fermer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {history.length > 0 && (
        <button
          onClick={() => {
            if (confirm('Êtes-vous sûr de vouloir effacer tout l\'historique ?')) {
              onClearAll()
            }
          }}
          className="w-full mb-4 px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
        >
          Effacer tout l'historique
        </button>
      )}

      {history.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Aucune recherche récente</p>
          <p className="text-sm mt-1">Vos recherches apparaîtront ici</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((item) => (
            <div
              key={item.id}
              className="group p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
              onClick={() => onSelectHistory(item.address)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {item.address.label}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-500">{formatDate(item.timestamp)}</p>
                    {item.filters && Object.keys(item.filters).length > 0 && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-blue-600">
                          {Object.keys(item.filters).length} filtre(s)
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteHistory(item.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
