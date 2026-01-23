import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, TrendingUp, DollarSign, Home, BarChart3 } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getDVFStatistiques } from '../api'
import type { DVFFilters } from '../types'

interface DashboardProps {
  codeInsee: string
  filters: DVFFilters
  projectName?: string
  onClose: () => void
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

export function Dashboard({ codeInsee, filters, projectName, onClose }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'evolution' | 'types'>('overview')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['statistiques', codeInsee, filters],
    queryFn: () => getDVFStatistiques(codeInsee, filters),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Tableau de bord</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="text-center py-8 text-gray-500">Chargement des données...</div>
      </div>
    )
  }

  if (!stats || !stats.statistiques) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Tableau de bord</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="text-center py-8 text-gray-500">Aucune donnée disponible</div>
      </div>
    )
  }

  const formatPrice = (price: number | null) => {
    if (!price) return 'N/A'
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(price)
  }

  // Préparer les données pour le graphique en secteurs
  const pieData = Object.entries(stats.repartition_types).map(([key, value]) => ({
    name: key || 'Non spécifié',
    value,
  }))

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-4xl max-h-[calc(100vh-8rem)] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Tableau de bord
          </h2>
          {projectName && (
            <p className="text-sm text-gray-600 mt-1">Projet: {projectName}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
          title="Fermer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard
          icon={<Home className="h-5 w-5" />}
          label="Transactions"
          value={stats.nb_transactions.toString()}
          color="blue"
        />
        <KPICard
          icon={<DollarSign className="h-5 w-5" />}
          label="Prix moyen"
          value={formatPrice(stats.statistiques.prix_moyen)}
          color="green"
        />
        <KPICard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Prix/m² moyen"
          value={formatPrice(stats.statistiques.prix_m2_moyen)}
          color="yellow"
        />
        <KPICard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Surface moy."
          value={
            stats.statistiques.surface_moyenne
              ? `${Math.round(stats.statistiques.surface_moyenne)} m²`
              : 'N/A'
          }
          color="purple"
        />
      </div>

      {/* Fourchette de prix */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Fourchette de prix</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Minimum</p>
            <p className="text-lg font-semibold text-gray-800">
              {formatPrice(stats.statistiques.prix_min)}
            </p>
          </div>
          <div className="flex-1 mx-4">
            <div className="h-2 bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 rounded-full" />
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Maximum</p>
            <p className="text-lg font-semibold text-gray-800">
              {formatPrice(stats.statistiques.prix_max)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'overview'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Vue d'ensemble
        </button>
        <button
          onClick={() => setActiveTab('evolution')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'evolution'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Évolution
        </button>
        <button
          onClick={() => setActiveTab('types')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'types'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Répartition
        </button>
      </div>

      {/* Contenu des tabs */}
      <div className="mt-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Statistiques détaillées
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <StatItem label="Prix médian" value={formatPrice(stats.statistiques.prix_median)} />
                <StatItem
                  label="Prix/m² min"
                  value={formatPrice(stats.statistiques.prix_m2_min)}
                />
                <StatItem
                  label="Prix/m² max"
                  value={formatPrice(stats.statistiques.prix_m2_max)}
                />
                <StatItem
                  label="Prix/m² médian"
                  value={formatPrice(stats.statistiques.prix_m2_moyen)}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'evolution' && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Évolution des prix par année
            </h3>
            {stats.evolution.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={stats.evolution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="annee" />
                    <YAxis
                      tickFormatter={(value) =>
                        `${Math.round(value / 1000)}k€`
                      }
                    />
                    <Tooltip
                      formatter={(value: number | undefined) => value ? formatPrice(value) : 'N/A'}
                      labelStyle={{ color: '#374151' }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="prix_moyen"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      name="Prix moyen"
                    />
                  </LineChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="100%" height={250} className="mt-6">
                  <BarChart data={stats.evolution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="annee" />
                    <YAxis />
                    <Tooltip labelStyle={{ color: '#374151' }} />
                    <Legend />
                    <Bar
                      dataKey="nb_transactions"
                      fill="#10B981"
                      name="Nombre de transactions"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <p className="text-center py-8 text-gray-500">
                Pas assez de données pour afficher l'évolution
              </p>
            )}
          </div>
        )}

        {activeTab === 'types' && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Répartition par type de bien
            </h3>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} (${percent ? (percent * 100).toFixed(0) : 0}%)`
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((_item, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {pieData.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm text-gray-700">
                        {item.name}: {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center py-8 text-gray-500">Aucune donnée disponible</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface KPICardProps {
  icon: React.ReactNode
  label: string
  value: string
  color: 'blue' | 'green' | 'yellow' | 'purple'
}

function KPICard({ icon, label, value, color }: KPICardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${colorClasses[color]}`}>{icon}</div>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-gray-800 mt-1">{value}</p>
    </div>
  )
}

interface StatItemProps {
  label: string
  value: string
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-lg font-semibold text-gray-800 mt-1">{value}</p>
    </div>
  )
}
