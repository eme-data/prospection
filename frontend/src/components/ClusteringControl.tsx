import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  GitBranch,
  MapPin,
  TrendingUp,
  Combine,
  ChevronDown,
  Loader,
  Info,
} from 'lucide-react'
import type { Map as MapLibreMap } from 'maplibre-gl'

interface ClusteringControlProps {
  map: MapLibreMap | null
  codeInsee: string
  onClusterSelect?: (cluster: any) => void
}

type ClusteringMethod = 'proximity' | 'score' | 'mixed' | null

const METHOD_CONFIGS = {
  proximity: {
    label: 'Proximité',
    icon: MapPin,
    description: 'Regroupement géographique uniquement',
    color: '#3b82f6',
  },
  score: {
    label: 'Score',
    icon: TrendingUp,
    description: 'Regroupement par score (tranches de 20 pts)',
    color: '#10b981',
  },
  mixed: {
    label: 'Mixte',
    icon: Combine,
    description: 'Proximité + similarité de score (±15 pts)',
    color: '#8b5cf6',
  },
}

export function ClusteringControl({ map, codeInsee, onClusterSelect }: ClusteringControlProps) {
  const [activeMethod, setActiveMethod] = useState<ClusteringMethod>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [distanceThreshold, setDistanceThreshold] = useState(0.01)
  const [minClusterSize, setMinClusterSize] = useState(2)
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null)

  // Récupérer les données de clustering
  const { data: clusterData, isLoading } = useQuery({
    queryKey: ['clustering', codeInsee, activeMethod, distanceThreshold, minClusterSize],
    queryFn: async () => {
      if (!activeMethod) return null

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/clustering/${codeInsee}?method=${activeMethod}&distance_threshold=${distanceThreshold}&min_cluster_size=${minClusterSize}`
      )
      if (!response.ok) throw new Error('Erreur lors du chargement des clusters')
      return response.json()
    },
    enabled: !!activeMethod && !!map,
    staleTime: 10 * 60 * 1000,
  })

  // Mettre à jour la carte quand les données changent
  useEffect(() => {
    if (!map || !clusterData || !activeMethod) return

    const sourceId = 'clusters-source'
    const fillLayerId = 'clusters-fill-layer'
    const lineLayerId = 'clusters-line-layer'
    const labelLayerId = 'clusters-label-layer'

    // Supprimer les couches/sources existantes
    ;[labelLayerId, lineLayerId, fillLayerId].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId)
      }
    })
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId)
    }

    // Ajouter la nouvelle source
    map.addSource(sourceId, {
      type: 'geojson',
      data: clusterData,
    })

    const config = METHOD_CONFIGS[activeMethod]

    // Couche de remplissage
    map.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': config.color,
        'fill-opacity': [
          'case',
          ['==', ['get', 'cluster_id'], selectedCluster || ''],
          0.4,
          0.15,
        ],
      },
    })

    // Couche de bordure
    map.addLayer({
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': config.color,
        'line-width': [
          'case',
          ['==', ['get', 'cluster_id'], selectedCluster || ''],
          3,
          2,
        ],
        'line-opacity': 0.8,
      },
    })

    // Couche de labels (nombre de parcelles)
    map.addLayer({
      id: labelLayerId,
      type: 'symbol',
      source: sourceId,
      layout: {
        'text-field': ['get', 'count'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 14,
        'text-offset': [0, 0],
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': config.color,
        'text-halo-width': 2,
      },
    })

    // Gestion des clics
    map.on('click', fillLayerId, (e) => {
      if (!e.features || e.features.length === 0) return

      const feature = e.features[0]
      const clusterId = feature.properties?.cluster_id

      setSelectedCluster(clusterId)
      onClusterSelect?.(feature.properties)

      // Zoom sur le cluster
      const bounds = new (window as any).maplibregl.LngLatBounds()
      const coords = feature.geometry.coordinates[0]
      coords.forEach((coord: [number, number]) => {
        bounds.extend(coord)
      })
      map.fitBounds(bounds, { padding: 50 })
    })

    // Curseur au survol
    map.on('mouseenter', fillLayerId, () => {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mouseleave', fillLayerId, () => {
      map.getCanvas().style.cursor = ''
    })

    // Tooltip au survol
    map.on('mousemove', fillLayerId, (e) => {
      if (!e.features || e.features.length === 0) return

      const props = e.features[0].properties

      const tooltip = document.getElementById('cluster-tooltip')
      if (tooltip && props) {
        tooltip.innerHTML = `
          <div class="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm max-w-xs">
            <div class="font-semibold mb-1">Cluster ${props.cluster_id?.split('_')[1] || ''}</div>
            <div class="space-y-0.5">
              <div>🏘️ ${props.count} parcelle(s)</div>
              <div>📐 ${props.surface_totale?.toLocaleString()} m² total</div>
              ${props.score_moyen ? `<div>⭐ Score moyen: ${props.score_moyen}/100</div>` : ''}
              ${props.niveaux ? `
                <div class="text-xs mt-1 pt-1 border-t border-gray-700">
                  <span class="text-green-400">${props.niveaux.excellent || 0}</span> excellent •
                  <span class="text-blue-400">${props.niveaux.bon || 0}</span> bon •
                  <span class="text-orange-400">${props.niveaux.moyen || 0}</span> moyen •
                  <span class="text-red-400">${props.niveaux.faible || 0}</span> faible
                </div>
              ` : ''}
            </div>
          </div>
        `
        tooltip.style.left = e.point.x + 'px'
        tooltip.style.top = e.point.y + 'px'
        tooltip.style.display = 'block'
      }
    })

    map.on('mouseleave', fillLayerId, () => {
      const tooltip = document.getElementById('cluster-tooltip')
      if (tooltip) {
        tooltip.style.display = 'none'
      }
    })

    return () => {
      // Cleanup
      ;[labelLayerId, lineLayerId, fillLayerId].forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId)
        }
      })
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId)
      }
    }
  }, [map, clusterData, activeMethod, selectedCluster, onClusterSelect])

  const handleMethodChange = (method: ClusteringMethod) => {
    setActiveMethod(method)
    setSelectedCluster(null)
    setIsOpen(false)
  }

  const handleDisable = () => {
    setActiveMethod(null)
    setSelectedCluster(null)
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="font-medium text-gray-900 dark:text-white">
              {activeMethod ? METHOD_CONFIGS[activeMethod].label : 'Clustering'}
            </span>
            {isLoading && <Loader className="h-4 w-4 animate-spin text-blue-600" />}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="border-t border-gray-200 dark:border-gray-700">
            {activeMethod && (
              <button
                onClick={handleDisable}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Désactiver le clustering
              </button>
            )}

            <div className="p-2 space-y-1">
              {(Object.keys(METHOD_CONFIGS) as ClusteringMethod[]).map((method) => {
                if (!method) return null
                const config = METHOD_CONFIGS[method]
                const Icon = config.icon

                return (
                  <button
                    key={method}
                    onClick={() => handleMethodChange(method)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      activeMethod === method
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">{config.label}</div>
                      <div className="text-xs opacity-75">{config.description}</div>
                    </div>
                    {activeMethod === method && (
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    )}
                  </button>
                )
              })}
            </div>

            {activeMethod && (
              <>
                {/* Paramètres */}
                <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Distance de regroupement
                    </label>
                    <select
                      value={distanceThreshold}
                      onChange={(e) => setDistanceThreshold(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                    >
                      <option value={0.005}>Très proche (~500m)</option>
                      <option value={0.01}>Proche (~1km)</option>
                      <option value={0.02}>Moyenne (~2km)</option>
                      <option value={0.05}>Large (~5km)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Taille minimale du cluster
                    </label>
                    <select
                      value={minClusterSize}
                      onChange={(e) => setMinClusterSize(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                    >
                      <option value={2}>2 parcelles minimum</option>
                      <option value={3}>3 parcelles minimum</option>
                      <option value={5}>5 parcelles minimum</option>
                      <option value={10}>10 parcelles minimum</option>
                    </select>
                  </div>
                </div>

                {/* Info */}
                <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-blue-50 dark:bg-blue-900/20">
                  <div className="flex gap-2 text-xs text-blue-800 dark:text-blue-300">
                    <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>
                      Cliquez sur un cluster pour le sélectionner et voir ses détails. Le nombre
                      affiché indique le nombre de parcelles dans le cluster.
                    </div>
                  </div>
                </div>

                {/* Statistiques */}
                {clusterData?.metadata && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-3 text-xs text-gray-500 dark:text-gray-400">
                    <div>Clusters: {clusterData.metadata.total_clusters}</div>
                    <div>Parcelles groupées: {clusterData.metadata.total_parcelles}</div>
                    <div className="mt-1 pt-1 border-t border-gray-300 dark:border-gray-600">
                      Méthode: {clusterData.metadata.method}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Tooltip container */}
      <div
        id="cluster-tooltip"
        style={{
          position: 'absolute',
          display: 'none',
          pointerEvents: 'none',
          zIndex: 1000,
        }}
      />
    </>
  )
}
