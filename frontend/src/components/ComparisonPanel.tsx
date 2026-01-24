import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  X,
  Plus,
  Trash2,
  TrendingUp,
  MapPin,
  Ruler,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  Minus,
  Loader,
} from 'lucide-react'
import { ScoreBadge } from './ScoreBadge'
import { ProspectionBadge } from './ProspectionBadge'
import type { Parcelle, ParcelleScore, ProspectionInfo } from '../types'

interface ComparisonPanelProps {
  parcelles: Parcelle[]
  onClose: () => void
  onRemoveParcelle: (parcelleId: string) => void
  onAddMore?: () => void
}

interface ParcelleEnriched {
  parcelle: Parcelle
  score?: ParcelleScore | null
  prospection?: ProspectionInfo | null
  fiche?: any
}

export function ComparisonPanel({
  parcelles,
  onClose,
  onRemoveParcelle,
  onAddMore,
}: ComparisonPanelProps) {
  const maxParcelles = 4

  // Récupérer les données enrichies pour chaque parcelle
  const parcellesQueries = parcelles.map((parcelle) => {
    const parcelleId = parcelle.properties.id

    // Score
    const scoreQuery = useQuery({
      queryKey: ['score-compare', parcelleId],
      queryFn: async () => {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/scoring/parcelle/${parcelleId}?code_insee=${parcelle.properties.commune}`
          )
          if (!response.ok) return null
          return response.json()
        } catch {
          return null
        }
      },
      staleTime: 10 * 60 * 1000,
    })

    // Prospection
    const prospectionQuery = useQuery({
      queryKey: ['prospection-compare', parcelleId],
      queryFn: async () => {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/prospection/${parcelleId}`
          )
          if (!response.ok) return null
          return response.json()
        } catch {
          return null
        }
      },
      staleTime: 10 * 60 * 1000,
    })

    // Fiche
    const ficheQuery = useQuery({
      queryKey: ['fiche-compare', parcelleId],
      queryFn: async () => {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/fiches/${parcelleId}`
          )
          if (!response.ok) return null
          return response.json()
        } catch {
          return null
        }
      },
      staleTime: 10 * 60 * 1000,
    })

    return {
      parcelle,
      score: scoreQuery.data,
      prospection: prospectionQuery.data,
      fiche: ficheQuery.data,
      isLoading: scoreQuery.isLoading || prospectionQuery.isLoading || ficheQuery.isLoading,
    }
  })

  const isAnyLoading = parcellesQueries.some((q) => q.isLoading)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-7xl max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Comparaison de Parcelles
            </h2>
            <p className="text-sm opacity-90 mt-1">
              {parcelles.length} / {maxParcelles} parcelles sélectionnées
            </p>
          </div>
          <div className="flex items-center gap-2">
            {parcelles.length < maxParcelles && onAddMore && (
              <button
                onClick={onAddMore}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2"
                title="Ajouter une parcelle"
              >
                <Plus className="h-5 w-5" />
                <span className="text-sm">Ajouter</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {isAnyLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="p-6">
            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${parcelles.length}, minmax(280px, 1fr))` }}>
              {parcellesQueries.map((enriched, index) => (
                <ParcelleColumn
                  key={enriched.parcelle.properties.id}
                  enriched={enriched}
                  onRemove={() => onRemoveParcelle(enriched.parcelle.properties.id)}
                  position={index + 1}
                />
              ))}
            </div>

            {/* Tableau comparatif */}
            {parcelles.length > 1 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Tableau comparatif
                </h3>
                <ComparisonTable parcelles={parcellesQueries} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Colonne pour une parcelle
function ParcelleColumn({
  enriched,
  onRemove,
  position,
}: {
  enriched: ParcelleEnriched
  onRemove: () => void
  position: number
}) {
  const props = enriched.parcelle.properties

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
                {position}
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                {props.section} {props.numero}
              </h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{props.commune}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{props.id}</p>
          </div>
          <button
            onClick={onRemove}
            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Retirer de la comparaison"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Score */}
      {enriched.score && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Score</span>
            <ScoreBadge score={enriched.score} size="sm" />
          </div>
          <div className="space-y-1 text-xs">
            {Object.entries(enriched.score.details).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400 capitalize">{key}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {(value as number).toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prospection */}
      {enriched.prospection && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Prospection
            </span>
            <ProspectionBadge statut={enriched.prospection.statut} size="sm" />
          </div>
          {enriched.prospection.interlocuteur && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Contact: {enriched.prospection.interlocuteur}
            </p>
          )}
        </div>
      )}

      {/* Caractéristiques */}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Ruler className="h-4 w-4 text-gray-400" />
          <span className="text-gray-700 dark:text-gray-300">
            {props.contenance.toLocaleString()} m²
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-gray-700 dark:text-gray-300">
            MAJ: {new Date(props.updated).toLocaleDateString('fr-FR')}
          </span>
        </div>
        {enriched.fiche && (
          <>
            {enriched.fiche.photos?.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <span>📷 {enriched.fiche.photos.length} photo(s)</span>
              </div>
            )}
            {enriched.fiche.documents?.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <span>📄 {enriched.fiche.documents.length} doc(s)</span>
              </div>
            )}
            {enriched.fiche.notes?.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                <span>📝 {enriched.fiche.notes.length} note(s)</span>
              </div>
            )}
            {enriched.fiche.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {enriched.fiche.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Tableau comparatif
function ComparisonTable({ parcelles }: { parcelles: ParcelleEnriched[] }) {
  const rows = [
    {
      label: 'Surface',
      icon: Ruler,
      getValue: (p: ParcelleEnriched) => `${p.parcelle.properties.contenance.toLocaleString()} m²`,
      compare: (a: ParcelleEnriched, b: ParcelleEnriched) =>
        a.parcelle.properties.contenance - b.parcelle.properties.contenance,
    },
    {
      label: 'Score total',
      icon: TrendingUp,
      getValue: (p: ParcelleEnriched) => (p.score ? `${p.score.score}/100` : 'N/A'),
      compare: (a: ParcelleEnriched, b: ParcelleEnriched) =>
        (a.score?.score || 0) - (b.score?.score || 0),
    },
    {
      label: 'Score prix',
      icon: DollarSign,
      getValue: (p: ParcelleEnriched) =>
        p.score ? `${p.score.details.prix.toFixed(1)}/25` : 'N/A',
      compare: (a: ParcelleEnriched, b: ParcelleEnriched) =>
        (a.score?.details.prix || 0) - (b.score?.details.prix || 0),
    },
    {
      label: 'Score localisation',
      icon: MapPin,
      getValue: (p: ParcelleEnriched) =>
        p.score ? `${p.score.details.localisation.toFixed(1)}/25` : 'N/A',
      compare: (a: ParcelleEnriched, b: ParcelleEnriched) =>
        (a.score?.details.localisation || 0) - (b.score?.details.localisation || 0),
    },
    {
      label: 'Prospection',
      icon: CheckCircle,
      getValue: (p: ParcelleEnriched) => (p.prospection ? 'Oui' : 'Non'),
      compare: () => 0,
    },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-800">
            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600">
              Critère
            </th>
            {parcelles.map((enriched, index) => (
              <th
                key={enriched.parcelle.properties.id}
                className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600"
              >
                Parcelle {index + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const Icon = row.icon
            const values = parcelles.map((p) => row.getValue(p))
            const bestIndex = parcelles.findIndex(
              (p, i) =>
                row.compare(p, parcelles[0]) ===
                Math.max(...parcelles.map((p2, j) => row.compare(p2, parcelles[0])))
            )

            return (
              <tr key={row.label} className="border-b border-gray-200 dark:border-gray-700">
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gray-400" />
                    <span>{row.label}</span>
                  </div>
                </td>
                {values.map((value, index) => (
                  <td
                    key={index}
                    className={`px-4 py-3 text-sm ${
                      index === bestIndex && value !== 'N/A'
                        ? 'font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
