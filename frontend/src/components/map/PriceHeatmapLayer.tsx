/**
 * Composant MapLibre pour afficher la heatmap des prix au m²
 */

import { useEffect } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import type { PriceHeatmapData } from '../../hooks/useEconomicLayers'

interface PriceHeatmapLayerProps {
    data: PriceHeatmapData | undefined
    opacity?: number
}

export function PriceHeatmapLayer({ data, opacity = 0.6 }: PriceHeatmapLayerProps) {
    const { current: mapRef } = useMap()

    useEffect(() => {
        if (!mapRef || !data) return

        const map = mapRef.getMap()
        if (!map) return

        const sourceId = 'economic-prix-m2-source'
        const layerId = 'economic-prix-m2-layer'

        // Ajouter la source si elle n'existe pas
        if (!map.getSource(sourceId)) {
            map.addSource(sourceId, {
                type: 'geojson',
                data: data as any,
            })
        } else {
            // Mettre à jour les données (cast to GeoJSONSource for setData)
            const source = map.getSource(sourceId) as any
            if (source && source.type === 'geojson') {
                source.setData(data)
            }
        }

        // Calculer min/max pour la color scale
        const { min_prix_m2, max_prix_m2 } = data.metadata

        // Ajouter le layer si il n'existe pas
        if (!map.getLayer(layerId)) {
            map.addLayer({
                id: layerId,
                type: 'fill',
                source: sourceId,
                paint: {
                    'fill-color': [
                        'interpolate',
                        ['linear'],
                        ['get', 'prix_m2'],
                        min_prix_m2,
                        '#10b981', // Vert (prix bas)
                        (min_prix_m2 + max_prix_m2) / 2,
                        '#fbbf24', // Jaune (prix moyen)
                        max_prix_m2,
                        '#ef4444', // Rouge (prix élevé)
                    ],
                    'fill-opacity': opacity,
                },
            })

            // Ajouter un layer de bordure
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

            // Ajouter interaction hover
            map.on('mousemove', layerId, () => {
                map.getCanvas().style.cursor = 'pointer'
            })

            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = ''
            })
        }

        // Cleanup
        return () => {
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
    }, [mapRef, data, opacity])

    // This component doesn't render anything directly
    return null
}
