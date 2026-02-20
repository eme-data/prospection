import { X, MapPin, Euro, Calendar, Maximize2, Home, FileText } from 'lucide-react'
import type { Parcelle, DVFTransaction } from '../types'

interface InfoPanelProps {
  parcelle?: Parcelle | null
  transaction?: DVFTransaction | null
  onClose: () => void
  onShowFeasibility: () => void
  onShowProspection: () => void
}

export function InfoPanel({ parcelle, transaction, onClose, onShowFeasibility, onShowProspection }: InfoPanelProps) {
  if (!parcelle && !transaction) return null

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold">
          {parcelle ? 'Parcelle cadastrale' : 'Transaction DVF'}
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-blue-700 rounded transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {parcelle && (
          <>
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm text-gray-500">Identifiant</div>
                <div className="font-medium">{parcelle.properties.id}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Home className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm text-gray-500">Section / Numero</div>
                <div className="font-medium">
                  {parcelle.properties.section} {parcelle.properties.numero}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Maximize2 className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm text-gray-500">Contenance</div>
                <div className="font-medium">
                  {formatArea(parcelle.properties.contenance)}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Commune</div>
              <div className="font-medium">{parcelle.properties.commune}</div>
            </div>

            <div className="pt-3 border-t border-gray-200 space-y-2">
              <button
                onClick={onShowProspection}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <Home className="h-4 w-4" />
                Ajouter à la prospection
              </button>
              <button
                onClick={onShowFeasibility}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Étude de Faisabilité
              </button>
            </div>
          </>
        )}

        {transaction && (
          <>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm text-gray-500">Date de mutation</div>
                <div className="font-medium">
                  {formatDate(transaction.properties.date_mutation)}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Euro className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm text-gray-500">Valeur fonciere</div>
                <div className="font-medium text-lg text-green-600">
                  {formatPrice(transaction.properties.valeur_fonciere)}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm text-gray-500">Adresse</div>
                <div className="font-medium">
                  {transaction.properties.adresse}
                </div>
                <div className="text-sm text-gray-500">
                  {transaction.properties.code_postal} {transaction.properties.commune}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
              <div>
                <div className="text-sm text-gray-500">Type</div>
                <div className="font-medium">
                  {transaction.properties.type_local || 'Non renseigne'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Nature</div>
                <div className="font-medium">
                  {transaction.properties.nature_mutation}
                </div>
              </div>
            </div>

            {(transaction.properties.surface_reelle_bati || transaction.properties.surface_terrain) && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                {transaction.properties.surface_reelle_bati > 0 && (
                  <div>
                    <div className="text-sm text-gray-500">Surface bati</div>
                    <div className="font-medium">
                      {transaction.properties.surface_reelle_bati} m2
                    </div>
                  </div>
                )}
                {transaction.properties.surface_terrain > 0 && (
                  <div>
                    <div className="text-sm text-gray-500">Surface terrain</div>
                    <div className="font-medium">
                      {formatArea(transaction.properties.surface_terrain)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {transaction.properties.nombre_pieces > 0 && (
              <div className="pt-2 border-t border-gray-200">
                <div className="text-sm text-gray-500">Nombre de pieces</div>
                <div className="font-medium">
                  {transaction.properties.nombre_pieces} pieces
                </div>
              </div>
            )}

            {transaction.properties.valeur_fonciere > 0 && transaction.properties.surface_reelle_bati > 0 && (
              <div className="pt-2 border-t border-gray-200 bg-blue-50 -mx-4 -mb-4 px-4 py-3">
                <div className="text-sm text-blue-700">Prix au m2</div>
                <div className="font-bold text-blue-800 text-lg">
                  {formatPrice(transaction.properties.valeur_fonciere / transaction.properties.surface_reelle_bati)}/m2
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
