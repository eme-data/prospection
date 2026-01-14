import { useQuery } from '@tanstack/react-query'
import { BarChart3, TrendingUp, TrendingDown, X, Euro, Home, Ruler } from 'lucide-react'
import { getDVFStatistiques } from '../api'
import type { DVFFilters } from '../types'

interface StatsPanelProps {
  codeInsee: string
  filters?: DVFFilters
  onClose: () => void
}

export function StatsPanel({ codeInsee, filters, onClose }: StatsPanelProps) {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dvf-stats', codeInsee, filters],
    queryFn: () => getDVFStatistiques(codeInsee, filters),
    enabled: !!codeInsee,
    staleTime: 5 * 60 * 1000,
  })

  const formatPrice = (price: number | null) => {
    if (price === null) return '-'
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(price)
  }

  const formatNumber = (num: number | null) => {
    if (num === null) return '-'
    return new Intl.NumberFormat('fr-FR').format(Math.round(num))
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-4 text-red-600">
        Erreur lors du chargement des statistiques
      </div>
    )
  }

  const evolution = stats.evolution || []
  const lastYear = evolution[evolution.length - 1]
  const prevYear = evolution[evolution.length - 2]
  const prixTrend = lastYear && prevYear && lastYear.prix_m2_moyen && prevYear.prix_m2_moyen
    ? ((lastYear.prix_m2_moyen - prevYear.prix_m2_moyen) / prevYear.prix_m2_moyen) * 100
    : null

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-md">
      <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          <span className="font-semibold">Statistiques DVF</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-green-700 rounded transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Résumé */}
        <div className="text-center pb-3 border-b border-gray-200">
          <div className="text-3xl font-bold text-gray-800">
            {stats.nb_transactions}
          </div>
          <div className="text-sm text-gray-500">transactions</div>
        </div>

        {stats.statistiques && (
          <>
            {/* Prix moyen au m² */}
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Euro className="h-5 w-5 text-blue-600" />
                  <span className="text-sm text-gray-600">Prix moyen au m2</span>
                </div>
                {prixTrend !== null && (
                  <div className={`flex items-center gap-1 text-sm ${prixTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {prixTrend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {Math.abs(prixTrend).toFixed(1)}%
                  </div>
                )}
              </div>
              <div className="text-2xl font-bold text-blue-700 mt-1">
                {formatPrice(stats.statistiques.prix_m2_moyen)}/m2
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Min: {formatPrice(stats.statistiques.prix_m2_min)} - Max: {formatPrice(stats.statistiques.prix_m2_max)}
              </div>
            </div>

            {/* Prix moyen */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Home className="h-4 w-4" />
                  Prix moyen
                </div>
                <div className="text-lg font-semibold text-gray-800 mt-1">
                  {formatPrice(stats.statistiques.prix_moyen)}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Ruler className="h-4 w-4" />
                  Surface moy.
                </div>
                <div className="text-lg font-semibold text-gray-800 mt-1">
                  {formatNumber(stats.statistiques.surface_moyenne)} m2
                </div>
              </div>
            </div>

            {/* Prix min/max */}
            <div className="text-sm text-gray-600 flex justify-between px-1">
              <span>Min: {formatPrice(stats.statistiques.prix_min)}</span>
              <span>Median: {formatPrice(stats.statistiques.prix_median)}</span>
              <span>Max: {formatPrice(stats.statistiques.prix_max)}</span>
            </div>
          </>
        )}

        {/* Répartition par type */}
        {stats.repartition_types && Object.keys(stats.repartition_types).length > 0 && (
          <div className="pt-3 border-t border-gray-200">
            <div className="text-sm font-medium text-gray-700 mb-2">Repartition par type</div>
            <div className="space-y-2">
              {Object.entries(stats.repartition_types)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([type, count]) => {
                  const percentage = (count / stats.nb_transactions) * 100
                  return (
                    <div key={type} className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700 truncate">{type}</span>
                          <span className="text-gray-500">{count}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full mt-1">
                          <div
                            className="h-2 bg-blue-500 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Évolution annuelle */}
        {evolution.length > 1 && (
          <div className="pt-3 border-t border-gray-200">
            <div className="text-sm font-medium text-gray-700 mb-2">Evolution du prix/m2</div>
            <div className="flex items-end justify-between h-20 gap-1">
              {evolution.slice(-6).map((year) => {
                const maxPrix = Math.max(...evolution.map((e) => e.prix_m2_moyen || 0))
                const height = year.prix_m2_moyen ? (year.prix_m2_moyen / maxPrix) * 100 : 0
                return (
                  <div key={year.annee} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-blue-500 rounded-t"
                      style={{ height: `${height}%` }}
                      title={`${year.annee}: ${formatPrice(year.prix_m2_moyen)}/m2`}
                    />
                    <div className="text-xs text-gray-500 mt-1">{year.annee.slice(-2)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
