import { useState } from 'react'
import { Star, X, Trash2, MapPin, Edit2, Check, ExternalLink } from 'lucide-react'
import type { FavoriteParcelle } from '../types'

interface FavoritesPanelProps {
  favorites: FavoriteParcelle[]
  onRemove: (id: string) => void
  onSelect: (favorite: FavoriteParcelle) => void
  onUpdateNote: (id: string, note: string) => void
  onClose: () => void
}

export function FavoritesPanel({
  favorites,
  onRemove,
  onSelect,
  onUpdateNote,
  onClose,
}: FavoritesPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState('')

  const handleStartEdit = (favorite: FavoriteParcelle) => {
    setEditingId(favorite.id)
    setEditNote(favorite.note || '')
  }

  const handleSaveNote = (id: string) => {
    onUpdateNote(id, editNote)
    setEditingId(null)
    setEditNote('')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatArea = (area: number) => {
    if (area >= 10000) {
      return `${(area / 10000).toFixed(2)} ha`
    }
    return `${area.toLocaleString('fr-FR')} m2`
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-sm">
      <div className="bg-yellow-500 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          <span className="font-semibold">Mes favoris ({favorites.length})</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-yellow-600 rounded transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {favorites.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Star className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>Aucune parcelle en favoris</p>
            <p className="text-sm mt-2">
              Cliquez sur une parcelle puis sur l'etoile pour l'ajouter
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {favorites.map((favorite) => (
              <div key={favorite.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <button
                    onClick={() => onSelect(favorite)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-gray-800">
                        {favorite.parcelle.properties.section} {favorite.parcelle.properties.numero}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {favorite.parcelle.properties.commune}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatArea(favorite.parcelle.properties.contenance)}
                    </div>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(favorite)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                      title="Modifier la note"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onRemove(favorite.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Supprimer des favoris"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Note */}
                {editingId === favorite.id ? (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="Ajouter une note..."
                      className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveNote(favorite.id)}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ) : favorite.note ? (
                  <div className="mt-2 text-sm text-gray-600 bg-yellow-50 rounded px-2 py-1">
                    {favorite.note}
                  </div>
                ) : null}

                <div className="text-xs text-gray-400 mt-2">
                  Ajoute le {formatDate(favorite.addedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {favorites.length > 0 && (
        <div className="border-t border-gray-200 p-3">
          <button
            onClick={() => {
              const data = JSON.stringify(favorites, null, 2)
              const blob = new Blob([data], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `favoris_${new Date().toISOString().split('T')[0]}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Exporter les favoris
          </button>
        </div>
      )}
    </div>
  )
}
