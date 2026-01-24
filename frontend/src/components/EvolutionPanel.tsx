import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  DollarSign,
  BarChart3,
  Loader,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'

interface EvolutionPanelProps {
  codeInsee: string
  communeName?: string
  onClose: () => void
}

type Grouping = 'month' | 'quarter' | 'year'
type ChartType = 'line' | 'area' | 'bar'

export function EvolutionPanel({ codeInsee, communeName, onClose }: EvolutionPanelProps) {
  const [grouping, setGrouping] = useState<Grouping>('month')
  const [chartType, setChartType] = useState<ChartType>('area')
  const [metric, setMetric] = useState<'prix_m2' | 'valeur'>('prix_m2')

  // Récupérer les données d'évolution
  const { data: evolutionData, isLoading } = useQuery({
    queryKey: ['evolution', codeInsee, grouping],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/evolution/${codeInsee}?grouping=${grouping}`
      )
      if (!response.ok) throw new Error('Erreur lors du chargement')
      return response.json()
    },
    staleTime: 10 * 60 * 1000,
  })

  const series = evolutionData?.series || []
  const stats = evolutionData?.stats
  const tendance = stats?.tendance

  // Préparer les données pour le graphique
  const chartData = series.map((item: any) => ({
    period: item.label,
    count: item.count,
    prix_m2_moyen: item.prix_m2_moyen,
    prix_m2_median: item.prix_m2_median,
    valeur_moyenne: item.valeur_moyenne,
    valeur_mediane: item.valeur_mediane,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Évolution Temporelle des Prix
            </h2>
            <p className="text-sm opacity-90 mt-1">{communeName || `Commune ${codeInsee}`}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tendance globale */}
        {tendance && (
          <div className="mt-4 bg-white/10 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {tendance.direction === 'hausse' ? (
                  <TrendingUp className="h-5 w-5" />
                ) : tendance.direction === 'baisse' ? (
                  <TrendingDown className="h-5 w-5" />
                ) : (
                  <Minus className="h-5 w-5" />
                )}
                <span className="font-semibold">
                  {tendance.direction === 'hausse'
                    ? 'Tendance à la hausse'
                    : tendance.direction === 'baisse'
                      ? 'Tendance à la baisse'
                      : 'Stable'}
                </span>
              </div>
              <div className="text-right">
                <div
                  className={`text-2xl font-bold ${
                    tendance.variation_pct > 0
                      ? 'text-green-300'
                      : tendance.variation_pct < 0
                        ? 'text-red-300'
                        : 'text-gray-300'
                  }`}
                >
                  {tendance.variation_pct > 0 ? '+' : ''}
                  {tendance.variation_pct}%
                </div>
                <div className="text-xs opacity-75">
                  {tendance.first_period} → {tendance.last_period}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <select
            value={grouping}
            onChange={(e) => setGrouping(e.target.value as Grouping)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
          >
            <option value="month">Par mois</option>
            <option value="quarter">Par trimestre</option>
            <option value="year">Par année</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as 'prix_m2' | 'valeur')}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
          >
            <option value="prix_m2">Prix au m²</option>
            <option value="valeur">Valeur totale</option>
          </select>
        </div>

        <div className="flex items-center gap-1 bg-white dark:bg-gray-700 rounded-lg p-1 border border-gray-300 dark:border-gray-600">
          <button
            onClick={() => setChartType('line')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              chartType === 'line'
                ? 'bg-violet-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            Ligne
          </button>
          <button
            onClick={() => setChartType('area')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              chartType === 'area'
                ? 'bg-violet-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            Zone
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              chartType === 'bar'
                ? 'bg-violet-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            Barres
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader className="h-8 w-8 animate-spin text-violet-600" />
          </div>
        ) : series.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                Aucune donnée d'évolution disponible
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Graphique principal */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                {metric === 'prix_m2' ? 'Prix au m² moyen' : 'Valeur moyenne'} - Évolution
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                {chartType === 'line' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis
                      dataKey="period"
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      formatter={(value: number) =>
                        metric === 'prix_m2'
                          ? `${value?.toFixed(2)} €/m²`
                          : `${value?.toLocaleString()} €`
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey={metric === 'prix_m2' ? 'prix_m2_moyen' : 'valeur_moyenne'}
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      name="Moyenne"
                      dot={{ fill: '#8b5cf6', r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey={metric === 'prix_m2' ? 'prix_m2_median' : 'valeur_mediane'}
                      stroke="#06b6d4"
                      strokeWidth={2}
                      name="Médiane"
                      dot={{ fill: '#06b6d4', r: 4 }}
                    />
                  </LineChart>
                ) : chartType === 'area' ? (
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis
                      dataKey="period"
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      formatter={(value: number) =>
                        metric === 'prix_m2'
                          ? `${value?.toFixed(2)} €/m²`
                          : `${value?.toLocaleString()} €`
                      }
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey={metric === 'prix_m2' ? 'prix_m2_moyen' : 'valeur_moyenne'}
                      fill="#8b5cf6"
                      stroke="#8b5cf6"
                      name="Moyenne"
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey={metric === 'prix_m2' ? 'prix_m2_median' : 'valeur_mediane'}
                      fill="#06b6d4"
                      stroke="#06b6d4"
                      name="Médiane"
                      fillOpacity={0.4}
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis
                      dataKey="period"
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      formatter={(value: number) =>
                        metric === 'prix_m2'
                          ? `${value?.toFixed(2)} €/m²`
                          : `${value?.toLocaleString()} €`
                      }
                    />
                    <Legend />
                    <Bar
                      dataKey={metric === 'prix_m2' ? 'prix_m2_moyen' : 'valeur_moyenne'}
                      fill="#8b5cf6"
                      name="Moyenne"
                    />
                    <Bar
                      dataKey={metric === 'prix_m2' ? 'prix_m2_median' : 'valeur_mediane'}
                      fill="#06b6d4"
                      name="Médiane"
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Graphique volume de transactions */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Volume de transactions
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                  <XAxis
                    dataKey="period"
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Bar dataKey="count" fill="#10b981" name="Nb transactions" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Statistiques globales */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Total transactions"
                  value={stats.total_transactions}
                  color="blue"
                />
                {metric === 'prix_m2' && stats.prix_m2_moyen_global && (
                  <>
                    <StatCard
                      label="Prix m² moyen"
                      value={`${stats.prix_m2_moyen_global.toFixed(2)} €`}
                      color="violet"
                    />
                    <StatCard
                      label="Prix m² médian"
                      value={`${stats.prix_m2_median_global.toFixed(2)} €`}
                      color="cyan"
                    />
                  </>
                )}
                {metric === 'valeur' && (
                  <>
                    <StatCard
                      label="Valeur moyenne"
                      value={`${stats.valeur_moyenne_globale.toLocaleString()} €`}
                      color="violet"
                    />
                    <StatCard
                      label="Valeur médiane"
                      value={`${stats.valeur_mediane_globale.toLocaleString()} €`}
                      color="cyan"
                    />
                  </>
                )}
                <StatCard
                  label="Périodes"
                  value={series.length}
                  color="green"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Stat card component
function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color: 'blue' | 'violet' | 'cyan' | 'green'
}) {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300',
    cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  }

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="text-xs opacity-75 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  )
}
