import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Layers, TrendingUp, DollarSign, Zap, Grid, ChevronDown, Loader } from 'lucide-react'
import type { Map as MapLibreMap } from 'maplibre-gl'

interface HeatmapControlProps {
  map: MapLibreMap | null
  codeInsee: string
  onHeatmapChange?: (type: string | null) => void
}

type HeatmapType = 'score' | 'prix' | 'potentiel' | 'densite' | null

const HEATMAP_CONFIGS = {
  score: {
    label: 'Score',
    icon: TrendingUp,
    description: 'Densité des scores de parcelles',
    colors: [
      [0, '#ef4444'],      // 0% - rouge (faible)
      [0.3, '#f59e0b'],    // 30% - orange (moyen)
      [0.6, '#3b82f6'],    // 60% - bleu (bon)
      [1, '#10b981'],      // 100% - vert (excellent)
    ] as [number, string][],
  },
  prix: {
    label: 'Prix au m²',
    icon: DollarSign,
    description: 'Densité des prix DVF',
    colors: [
      [0, '#dbeafe'],      // 0% - bleu clair (bas)
      [0.5, '#3b82f6'],    // 50% - bleu
      [1, '#1e40af'],      // 100% - bleu foncé (élevé)
    ] as [number, string][],
  },
  potentiel: {
    label: 'Potentiel',
    icon: Zap,
    description: 'Potentiel global (score + prix)',
    colors: [
      [0, '#fef3c7'],      // 0% - jaune clair
      [0.5, '#f59e0b'],    // 50% - orange
      [1, '#dc2626'],      // 100% - rouge vif
    ] as [number, string][],
  },
  densite: {
    label: 'Densité',
    icon: Grid,
    description: 'Densité de parcelles',
    colors: [
      [0, '#f3f4f6'],      // 0% - gris clair
      [0.5, '#6b7280'],    // 50% - gris
      [1, '#1f2937'],      // 100% - gris foncé
    ] as [number, string][],
  },
}

export function HeatmapControl({ map, codeInsee, onHeatmapChange }: HeatmapControlProps) {
  const [activeType, setActiveType] = useState<HeatmapType>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [gridSize, setGridSize] = useState(0.01)

  // Récupérer les données de heatmap
  const { data: heatmapData, isLoading } = useQuery({
    queryKey: ['heatmap', codeInsee, activeType, gridSize],
    queryFn: async () => {
      if (!activeType) return null

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/heatmap/${codeInsee}?heatmap_type=${activeType}&grid_size=${gridSize}`
      )
      if (!response.ok) throw new Error('Erreur lors du chargement de la heatmap')
      return response.json()
    },
    enabled: !!activeType && !!map,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Mettre à jour la carte quand les données changent
  useEffect(() => {
    if (!map || !heatmapData || !activeType) return

    const sourceId = 'heatmap-source'
    const layerId = 'heatmap-layer'

    // Supprimer les couches/sources existantes
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId)
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId)
    }

    // Ajouter la nouvelle source
    map.addSource(sourceId, {
      type: 'geojson',
      data: heatmapData,
    })

    // Ajouter la couche de heatmap
    const config = HEATMAP_CONFIGS[activeType]

    map.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['get', 'intensity'],
          ...config.colors.flat(),
        ],
        'fill-opacity': 0.6,
        'fill-outline-color': 'transparent',
      },
    })

    // Ajouter une couche de bordures légères
    map.addLayer({
      id: `${layerId}-outline`,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': '#ffffff',
        'line-width': 0.5,
        'line-opacity': 0.3,
      },
    })

    // Ajouter les tooltips
    map.on('mousemove', layerId, (e) => {
      if (!e.features || e.features.length === 0) return

      map.getCanvas().style.cursor = 'pointer'

      const feature = e.features[0]
      const props = feature.properties

      const tooltip = document.getElementById('heatmap-tooltip')
      if (tooltip) {
        tooltip.innerHTML = `
          <div class="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm">
            <div class="font-semibold mb-1">${config.label}</div>
            <div>Valeur: ${props?.value || 'N/A'}</div>
            <div>Parcelles: ${props?.count || 0}</div>
          </div>
        `
        tooltip.style.left = e.point.x + 'px'
        tooltip.style.top = e.point.y + 'px'
        tooltip.style.display = 'block'
      }
    })

    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = ''
      const tooltip = document.getElementById('heatmap-tooltip')
      if (tooltip) {
        tooltip.style.display = 'none'
      }
    })

    return () => {
      // Cleanup
      if (map.getLayer(`${layerId}-outline`)) {
        map.removeLayer(`${layerId}-outline`)
      }
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId)
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId)
      }
    }
  }, [map, heatmapData, activeType])

  const handleTypeChange = (type: HeatmapType) => {
    setActiveType(type)
    onHeatmapChange?.(type)
    setIsOpen(false)
  }

  const handleDisable = () => {
    setActiveType(null)
    onHeatmapChange?.(null)
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="font-medium text-gray-900 dark:text-white">
              {activeType ? HEATMAP_CONFIGS[activeType].label : 'Heatmap'}
            </span>
            {isLoading && <Loader className="h-4 w-4 animate-spin text-blue-600" />}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="border-t border-gray-200 dark:border-gray-700">
            {activeType && (
              <button
                onClick={handleDisable}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Désactiver la heatmap
              </button>
            )}

            <div className="p-2 space-y-1">
              {(Object.keys(HEATMAP_CONFIGS) as HeatmapType[]).map((type) => {
                if (!type) return null
                const config = HEATMAP_CONFIGS[type]
                const Icon = config.icon

                return (
                  <button
                    key={type}
                    onClick={() => handleTypeChange(type)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      activeType === type
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">{config.label}</div>
                      <div className="text-xs opacity-75">{config.description}</div>
                    </div>
                    {activeType === type && (
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    )}
                  </button>
                )
              })}
            </div>

            {activeType && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-3">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Taille de la grille
                </label>
                <select
                  value={gridSize}
                  onChange={(e) => setGridSize(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                >
                  <option value={0.005}>Très fine (~500m)</option>
                  <option value={0.01}>Fine (~1km)</option>
                  <option value={0.02}>Moyenne (~2km)</option>
                  <option value={0.05}>Large (~5km)</option>
                </select>
              </div>
            )}

            {/* Légende */}
            {activeType && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-3">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Légende
                </div>
                <div className="space-y-1">
                  {HEATMAP_CONFIGS[activeType].colors.map(([value, color], index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {index === 0
                          ? 'Faible'
                          : index === HEATMAP_CONFIGS[activeType].colors.length - 1
                            ? 'Élevé'
                            : 'Moyen'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Métadonnées */}
            {heatmapData?.metadata && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-3 text-xs text-gray-500 dark:text-gray-400">
                <div>Cellules: {heatmapData.metadata.total_cells}</div>
                {heatmapData.metadata.total_parcelles && (
                  <div>Parcelles: {heatmapData.metadata.total_parcelles}</div>
                )}
                {heatmapData.metadata.prix_moyen && (
                  <>
                    <div>Prix moyen: {heatmapData.metadata.prix_moyen.toFixed(2)} €/m²</div>
                    <div>
                      Min: {heatmapData.metadata.prix_min.toFixed(2)} € - Max:{' '}
                      {heatmapData.metadata.prix_max.toFixed(2)} €
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tooltip container */}
      <div
        id="heatmap-tooltip"
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
