import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  X,
  TrendingUp,
  Filter,
  ChevronDown,
  ChevronUp,
  Star,
  MapPin,
  Loader,
} from 'lucide-react'
import { ScoreBadge, ScoreRecommendations } from './ScoreBadge'
import type { ParcelleScore, Parcelle } from '../types'

interface ScoringPanelProps {
  codeInsee: string
  communeName?: string
  onClose: () => void
  onSelectParcelle?: (parcelle: Parcelle) => void
}

type NiveauFilter = 'tous' | 'excellent' | 'bon' | 'moyen' | 'faible'

export function ScoringPanel({
  codeInsee,
  communeName,
  onClose,
  onSelectParcelle,
}: ScoringPanelProps) {
  const [niveauFilter, setNiveauFilter] = useState<NiveauFilter>('tous')
  const [selectedParcelle, setSelectedParcelle] = useState<string | null>(null)
  const [limit, setLimit] = useState(50)

  const { data, isLoading, error } = useQuery({
    queryKey: ['scoring-commune', codeInsee, limit],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/scoring/commune/${codeInsee}?limit=${limit}`
      )
      if (!response.ok) throw new Error('Erreur lors du chargement des scores')
      return response.json()
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  const filteredParcelles = data?.parcelles_scorees?.filter((item: any) => {
    if (niveauFilter === 'tous') return true
    return item.score.niveau === niveauFilter
  }) || []

  const stats = data?.stats || {
    score_moyen: 0,
    excellent: 0,
    bon: 0,
    moyen: 0,
    faible: 0,
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Scoring des Parcelles
            </h2>
            <p className="text-sm opacity-90 mt-1">
              {communeName || `Commune ${codeInsee}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stats Overview */}
        {!isLoading && (
          <div className="grid grid-cols-5 gap-3 mt-4">
            <StatCard
              label="Score moyen"
              value={Math.round(stats.score_moyen)}
              color="#ffffff"
            />
            <StatCard
              label="Excellent"
              value={stats.excellent}
              color="#10b981"
              onClick={() => setNiveauFilter('excellent')}
              active={niveauFilter === 'excellent'}
            />
            <StatCard
              label="Bon"
              value={stats.bon}
              color="#3b82f6"
              onClick={() => setNiveauFilter('bon')}
              active={niveauFilter === 'bon'}
            />
            <StatCard
              label="Moyen"
              value={stats.moyen}
              color="#f59e0b"
              onClick={() => setNiveauFilter('moyen')}
              active={niveauFilter === 'moyen'}
            />
            <StatCard
              label="Faible"
              value={stats.faible}
              color="#ef4444"
              onClick={() => setNiveauFilter('faible')}
              active={niveauFilter === 'faible'}
            />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {filteredParcelles.length} parcelle(s)
            {niveauFilter !== 'tous' && ` • Filtre: ${niveauFilter}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNiveauFilter('tous')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              niveauFilter === 'tous'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Tous
          </button>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <option value={25}>25 parcelles</option>
            <option value={50}>50 parcelles</option>
            <option value={100}>100 parcelles</option>
            <option value={200}>200 parcelles</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-600 dark:text-red-400 mb-2">
                Erreur lors du chargement des scores
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {error instanceof Error ? error.message : 'Erreur inconnue'}
              </p>
            </div>
          </div>
        ) : filteredParcelles.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                Aucune parcelle avec ce niveau de score
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredParcelles.map((item: any, index: number) => (
              <ParcelleScoreCard
                key={item.parcelle.properties.id}
                parcelle={item.parcelle}
                score={item.score}
                rank={index + 1}
                isExpanded={selectedParcelle === item.parcelle.properties.id}
                onToggle={() =>
                  setSelectedParcelle(
                    selectedParcelle === item.parcelle.properties.id
                      ? null
                      : item.parcelle.properties.id
                  )
                }
                onSelect={onSelectParcelle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: number | string
  color: string
  onClick?: () => void
  active?: boolean
}

function StatCard({ label, value, color, onClick, active }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white/20 rounded-lg p-3 ${
        onClick ? 'cursor-pointer hover:bg-white/30' : ''
      } ${active ? 'ring-2 ring-white' : ''} transition-all`}
    >
      <div className="text-xs opacity-90">{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: active ? '#fff' : color }}>
        {value}
      </div>
    </div>
  )
}

interface ParcelleScoreCardProps {
  parcelle: Parcelle
  score: ParcelleScore
  rank: number
  isExpanded: boolean
  onToggle: () => void
  onSelect?: (parcelle: Parcelle) => void
}

function ParcelleScoreCard({
  parcelle,
  score,
  rank,
  isExpanded,
  onToggle,
  onSelect,
}: ParcelleScoreCardProps) {
  const props = parcelle.properties

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      <div
        className="p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            {/* Rank */}
            <div className="flex-shrink-0">
              {rank <= 3 ? (
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    rank === 1
                      ? 'bg-yellow-400 text-yellow-900'
                      : rank === 2
                        ? 'bg-gray-300 text-gray-700'
                        : 'bg-orange-400 text-orange-900'
                  }`}
                >
                  {rank}
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-400">
                  {rank}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {props.section} {props.numero}
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {props.id}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                <span>📐 {props.contenance.toLocaleString()} m²</span>
                <span>•</span>
                <span>{props.commune}</span>
              </div>
            </div>

            {/* Score Badge */}
            <div className="flex-shrink-0">
              <ScoreBadge score={score} size="md" />
            </div>
          </div>

          {/* Expand Icon */}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50 space-y-4">
          <ScoreBadge score={score} size="md" showDetails />
          <ScoreRecommendations score={score} />

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {onSelect && (
              <button
                onClick={() => onSelect(parcelle)}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <MapPin className="h-4 w-4" />
                Voir sur la carte
              </button>
            )}
            <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Star className="h-4 w-4" />
              Favoris
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
