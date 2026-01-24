/**
 * Renderer MapLibre GL pour les polygones isochrones
 */

import { useEffect } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import type { IsochroneData } from '../../hooks/useIsochrones'

interface IsochroneLayerProps {
    data: IsochroneData | undefined
    center: [number, number] | null
}

// Mapping couleurs par durée (en secondes)
const COLOR_MAP: Record<number, string> = {
    300: '#10b981',   // 5min - vert
    600: '#fbbf24',   // 10min - jaune
    900: '#fb923c',   // 15min - orange
    1800: '#ef4444',  // 30min - rouge
    2700: '#dc2626',  // 45min - rouge foncé
    3600: '#991b1b',  // 60min - rouge très foncé
}

const OPACITY_MAP: Record<number, number> = {
    300: 0.3,
    600: 0.25,
    900: 0.2,
    1800: 0.15,
    2700: 0.12,
    3600: 0.1,
}

export function IsochroneLayer({ data, center }: IsochroneLayerProps) {
    const { current: mapRef } = useMap()

    useEffect(() => {
        if (!mapRef || !data) return

        const map = mapRef.getMap()
        if (!map) return

        const sourceId = 'isochrones-source'
        const layerIdPrefix = 'isochrones-layer'

        // Supprimer les anciens layers
        const existingLayers = map.getStyle()?.layers || []
        existingLayers.forEach((layer: any) => {
            if (layer.id.startsWith(layerIdPrefix)) {
                map.removeLayer(layer.id)
            }
        })

        // Supprimer l'ancienne source
        if (map.getSource(sourceId)) {
            map.removeSource(sourceId)
        }

        // Ajouter la source
        map.addSource(sourceId, {
            type: 'geojson',
            data: data as any,
        })

        // Ajouter un layer pour chaque isochrone (ordre inversé pour Z-index)
        const sortedFeatures = [...data.features].sort((a, b) => b.properties.value - a.properties.value)

        sortedFeatures.forEach((feature, index) => {
            const value = feature.properties.value
            const color = COLOR_MAP[value] || '#94a3b8'
            const opacity = OPACITY_MAP[value] || 0.15

            const layerId = `${layerIdPrefix}-${value}`

            // Layer de remplissage
            map.addLayer({
                id: layerId,
                type: 'fill',
                source: sourceId,
                filter: ['==', ['get', 'value'], value],
                paint: {
                    'fill-color': color,
                    'fill-opacity': opacity,
                },
            })

            // Layer de bordure
            map.addLayer({
                id: `${layerId}-outline`,
                type: 'line',
                source: sourceId,
                filter: ['==', ['get', 'value'], value],
                paint: {
                    'line-color': color,
                    'line-width': 2,
                    'line-opacity': 0.6,
                },
            })

            // Interaction hover
            map.on('mouseenter', layerId, () => {
                map.getCanvas().style.cursor = 'pointer'
            })

            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = ''
            })
        })

        // Ajouter marker au centre
        if (center) {
            const markerSourceId = 'isochrone-marker'
            const markerLayerId = 'isochrone-marker-layer'

            // Supprimer l'ancien marker
            if (map.getLayer(markerLayerId)) {
                map.removeLayer(markerLayerId)
            }
            if (map.getSource(markerSourceId)) {
                map.removeSource(markerSourceId)
            }

            // Ajouter le nouveau marker
            map.addSource(markerSourceId, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'Point',
                        coordinates: center,
                    },
                },
            })

            map.addLayer({
                id: markerLayerId,
                type: 'circle',
                source: markerSourceId,
                paint: {
                    'circle-radius': 8,
                    'circle-color': '#8b5cf6',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff',
                },
            })
        }

        // Cleanup
        return () => {
            const layers = map.getStyle()?.layers || []
            layers.forEach((layer: any) => {
                if (layer.id.startsWith(layerIdPrefix) || layer.id === 'isochrone-marker-layer') {
                    map.removeLayer(layer.id)
                }
            })

            if (map.getSource(sourceId)) {
                map.removeSource(sourceId)
            }
            if (map.getSource('isochrone-marker')) {
                map.removeSource('isochrone-marker')
            }
        }
    }, [mapRef, data, center])

    return null
}
