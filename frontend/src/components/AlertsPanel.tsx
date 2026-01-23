import { useState } from 'react'
import { X, Bell, Plus, Edit, Trash2, BellOff } from 'lucide-react'
import type { Alert, DVFFilters } from '../types'

interface AlertsPanelProps {
  alerts: Alert[]
  onCreateAlert: (alert: Omit<Alert, 'id' | 'createdAt'>) => void
  onUpdateAlert: (alertId: string, updates: Partial<Alert>) => void
  onDeleteAlert: (alertId: string) => void
  onClose: () => void
}

export function AlertsPanel({
  alerts,
  onCreateAlert,
  onUpdateAlert,
  onDeleteAlert,
  onClose,
}: AlertsPanelProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null)

  const handleEditAlert = (alert: Alert) => {
    setEditingAlert(alert)
    setShowCreateModal(true)
  }

  const activeAlerts = alerts.filter((a) => a.enabled)
  const inactiveAlerts = alerts.filter((a) => !a.enabled)

  return (
    <>
      <div className="bg-white rounded-lg shadow-lg p-4 max-h-[calc(100vh-8rem)] overflow-y-auto w-96">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alertes personnalisées
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            title="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <button
          onClick={() => {
            setEditingAlert(null)
            setShowCreateModal(true)
          }}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 mb-4"
        >
          <Plus className="h-4 w-4" />
          Nouvelle alerte
        </button>

        <p className="text-xs text-gray-500 mb-4">
          Recevez une notification lorsque de nouvelles transactions correspondent à vos critères
        </p>

        {/* Alertes actives */}
        {activeAlerts.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Actives</h3>
            <div className="space-y-2">
              {activeAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onEdit={() => handleEditAlert(alert)}
                  onToggle={() => onUpdateAlert(alert.id, { enabled: !alert.enabled })}
                  onDelete={() => onDeleteAlert(alert.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Alertes inactives */}
        {inactiveAlerts.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Inactives</h3>
            <div className="space-y-2">
              {inactiveAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onEdit={() => handleEditAlert(alert)}
                  onToggle={() => onUpdateAlert(alert.id, { enabled: !alert.enabled })}
                  onDelete={() => onDeleteAlert(alert.id)}
                />
              ))}
            </div>
          </div>
        )}

        {alerts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Aucune alerte configurée</p>
            <p className="text-sm mt-1">Créez votre première alerte</p>
          </div>
        )}
      </div>

      {/* Modal de création/édition */}
      {showCreateModal && (
        <AlertModal
          alert={editingAlert}
          onSave={(alert) => {
            if (editingAlert) {
              onUpdateAlert(editingAlert.id, alert)
            } else {
              onCreateAlert(alert)
            }
            setShowCreateModal(false)
            setEditingAlert(null)
          }}
          onClose={() => {
            setShowCreateModal(false)
            setEditingAlert(null)
          }}
        />
      )}
    </>
  )
}

interface AlertCardProps {
  alert: Alert
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}

function AlertCard({ alert, onEdit, onToggle, onDelete }: AlertCardProps) {
  const filterCount = Object.keys(alert.filters).length

  return (
    <div
      className={`p-3 rounded-lg border-2 transition-all ${
        alert.enabled
          ? 'border-green-200 bg-green-50'
          : 'border-gray-200 bg-gray-50 opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          className={`flex-shrink-0 mt-0.5 ${
            alert.enabled ? 'text-green-600' : 'text-gray-400'
          }`}
          title={alert.enabled ? 'Désactiver' : 'Activer'}
        >
          {alert.enabled ? (
            <Bell className="h-5 w-5 fill-current" />
          ) : (
            <BellOff className="h-5 w-5" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-800 truncate">{alert.name}</h4>
          <p className="text-xs text-gray-600 mt-1">Code INSEE: {alert.codeInsee}</p>
          {filterCount > 0 && (
            <p className="text-xs text-blue-600 mt-1">{filterCount} critère(s) défini(s)</p>
          )}
          {alert.lastChecked && (
            <p className="text-xs text-gray-500 mt-1">
              Dernière vérif: {new Date(alert.lastChecked).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1 hover:bg-gray-200 rounded"
            title="Éditer"
          >
            <Edit className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={() => {
              if (confirm('Êtes-vous sûr de vouloir supprimer cette alerte ?')) {
                onDelete()
              }
            }}
            className="p-1 hover:bg-red-100 rounded"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface AlertModalProps {
  alert: Alert | null
  onSave: (alert: Omit<Alert, 'id' | 'createdAt'>) => void
  onClose: () => void
}

function AlertModal({ alert, onSave, onClose }: AlertModalProps) {
  const [name, setName] = useState(alert?.name || '')
  const [codeInsee, setCodeInsee] = useState(alert?.codeInsee || '')
  const [filters, setFilters] = useState<DVFFilters>(alert?.filters || {})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim() && codeInsee.trim()) {
      onSave({
        name: name.trim(),
        codeInsee: codeInsee.trim(),
        filters,
        enabled: true,
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">
          {alert ? 'Éditer l\'alerte' : 'Nouvelle alerte'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de l'alerte *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Appartements Rennes"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code INSEE *
            </label>
            <input
              type="text"
              value={codeInsee}
              onChange={(e) => setCodeInsee(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: 35238"
              pattern="[0-9]{5}"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Code à 5 chiffres</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Critères de filtrage (optionnel)
            </label>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Type de bien</label>
                <select
                  value={filters.typeLocal || ''}
                  onChange={(e) =>
                    setFilters({ ...filters, typeLocal: e.target.value || undefined })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Tous types</option>
                  <option value="Maison">Maison</option>
                  <option value="Appartement">Appartement</option>
                  <option value="Local industriel">Local industriel</option>
                  <option value="Dépendance">Dépendance</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Prix min (€)</label>
                  <input
                    type="number"
                    value={filters.prixMin || ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        prixMin: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Prix max (€)</label>
                  <input
                    type="number"
                    value={filters.prixMax || ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        prixMax: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="999999999"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Surface min (m²)</label>
                  <input
                    type="number"
                    value={filters.surfaceMin || ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        surfaceMin: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Surface max (m²)</label>
                  <input
                    type="number"
                    value={filters.surfaceMax || ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        surfaceMax: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="9999"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {alert ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
