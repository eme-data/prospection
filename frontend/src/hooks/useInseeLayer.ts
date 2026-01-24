/**
 * Hook personnalisé pour gérer les calques INSEE avec MapLibre GL
 * Charge les géométries des communes et prépare les données pour MapLibre
 */

import { useState, useEffect, useMemo } from 'react'
import type { InseeIndicator, InseeData } from '../types'
import { useInseeCommunes } from './useInseeData'
import { getIndicatorColor, getMinMax } from '../utils/colorScales'

interface UseInseeLayerResult {
    geoJsonData: GeoJSON.FeatureCollection | null
    isLoading: boolean
    error: Error | null
    minValue: number
    maxValue: number
}

/**
 * Hook pour charger et préparer les données INSEE pour la carte
 */
export function useInseeLayer(
    communeCodes: string[],
    indicator: InseeIndicator
): UseInseeLayerResult {
    const [geoJsonData, setGeoJsonData] = useState<GeoJSON.FeatureCollection | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    // Récupérer les données INSEE
    const { data: inseeData } = useInseeCommunes(communeCodes)

    // Calculer min/max
    const { min: minValue, max: maxValue } = useMemo(() => {
        if (!inseeData || inseeData.length === 0) {
            return { min: 0, max: 100 }
        }
        return getMinMax(inseeData, indicator)
    }, [inseeData, indicator])

    // Charger les géométries
    useEffect(() => {
        if (communeCodes.length === 0) {
            setGeoJsonData(null)
            return
        }

        let cancelled = false

        const loadGeometries = async () => {
            setIsLoading(true)
            setError(null)

            try {
                const features: GeoJSON.Feature[] = []

                // Charger les géométries par lot pour améliorer les performances
                const batchSize = 10
                for (let i = 0; i < communeCodes.length; i += batchSize) {
                    if (cancelled) break

                    const batch = communeCodes.slice(i, i + batchSize)
                    const batchPromises = batch.map(async (code) => {
                        try {
                            const response = await fetch(
                                `https://geo.api.gouv.fr/communes/${code}?fields=nom,code,codesPostaux,centre,surface,contour&format=geojson&geometry=contour`
                            )

                            if (!response.ok) {
                                console.warn(`Failed to load geometry for commune ${code}`)
                                return null
                            }

                            const feature = await response.json() as GeoJSON.Feature

                            // Enrichir avec les données INSEE
                            if (inseeData) {
                                const data = inseeData.find(d => d.code_commune === code)
                                if (data && feature.properties) {
                                    feature.properties.insee = data
                                    feature.properties.indicator_value = data[indicator]
                                }
                            }

                            return feature
                        } catch (err) {
                            console.warn(`Error loading commune ${code}:`, err)
                            return null
                        }
                    })

                    const batchResults = await Promise.all(batchPromises)
                    features.push(...batchResults.filter((f): f is GeoJSON.Feature => f !== null))
                }

                if (!cancelled) {
                    setGeoJsonData({
                        type: 'FeatureCollection',
                        features,
                    })
                    setIsLoading(false)
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err : new Error('Failed to load geometries'))
                    setIsLoading(false)
                }
            }
        }

        loadGeometries()

        return () => {
            cancelled = true
        }
    }, [communeCodes, inseeData, indicator])

    return {
        geoJsonData,
        isLoading,
        error,
        minValue,
        maxValue,
    }
}

/**
 * Générer le style MapLibre pour un calque choroplèthe
 */
export function generateChoroplethStyle(
    indicator: InseeIndicator,
    colorScale: string[],
    minValue: number,
    maxValue: number,
    opacity: number
) {
    // Créer une expression MapLibre pour interpoler les couleurs
    const valueExpression = ['get', 'indicator_value']

    // Créer l'expression d'interpolation de couleur
    const colorExpression: any = [
        'interpolate',
        ['linear'],
        valueExpression,
    ]

    // Ajouter les stops de couleur
    const steps = colorScale.length
    for (let i = 0; i < steps; i++) {
        const value = minValue + (maxValue - minValue) * (i / (steps - 1))
        colorExpression.push(value, colorScale[i])
    }

    return {
        fillLayer: {
            id: 'insee-fill',
            type: 'fill' as const,
            paint: {
                'fill-color': colorExpression,
                'fill-opacity': opacity,
            },
        },
        lineLayer: {
            id: 'insee-line',
            type: 'line' as const,
            paint: {
                'line-color': '#ffffff',
                'line-width': 1,
                'line-opacity': 0.5,
            },
        },
        highlightLayer: {
            id: 'insee-highlight',
            type: 'line' as const,
            paint: {
                'line-color': '#3b82f6',
                'line-width': 3,
            },
            filter: ['==', ['get', 'code'], ''],
        },
    }
}
