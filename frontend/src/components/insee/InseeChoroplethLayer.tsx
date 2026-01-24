/**
 * Calque choroplèthe pour afficher les données INSEE sur la carte
 * Colore les communes selon un indicateur socio-économique
 */

import { useEffect, useState, useMemo } from 'react'
import { GeoJSON } from 'react-leaflet'
import type { PathOptions, LeafletMouseEvent } from 'leaflet'
import type { InseeIndicator, InseeData } from '../../types'
import { useInseeCommunes } from '../../hooks/useInseeData'
import { getIndicatorColor, getMinMax } from '../../utils/colorScales'

interface InseeChoroplethLayerProps {
    indicator: InseeIndicator
    colorScale: string[]
    opacity: number
    onCommuneClick?: (codeCommune: string, data: InseeData) => void
    onCommuneHover?: (codeCommune: string | null, data: InseeData | null) => void
}

// Cache des géométries communales
const geometryCache = new Map<string, GeoJSON.Feature>()

export default function InseeChoroplethLayer({
    indicator,
    colorScale,
    opacity,
    onCommuneClick,
    onCommuneHover,
}: InseeChoroplethLayerProps) {
    const [communeCodes, setCommuneCodes] = useState<string[]>([])
    const [geoJsonData, setGeoJsonData] = useState<GeoJSON.FeatureCollection | null>(null)

    // Récupérer les données INSEE pour les communes
    const { data: inseeData } = useInseeCommunes(communeCodes)

    // Calculer min/max pour l'indicateur
    const { min, max } = useMemo(() => {
        if (!inseeData || inseeData.length === 0) {
            return { min: 0, max: 100 }
        }
        return getMinMax(inseeData, indicator)
    }, [inseeData, indicator])

    // Pour l'instant, utiliser un ensemble de codes communes de test
    // TODO: Récupérer dynamiquement les communes visibles dans la viewport
    useEffect(() => {
        // Codes de quelques communes pour démonstration
        const testCodes = [
            '75056', // Paris
            '13055', // Marseille
            '69123', // Lyon
            '31555', // Toulouse
            '06088', // Nice
            '44109', // Nantes
            '67482', // Strasbourg
            '33063', // Bordeaux
        ]
        setCommuneCodes(testCodes)
    }, [])

    // Charger les géométries des communes
    useEffect(() => {
        if (communeCodes.length === 0) return

        const loadGeometries = async () => {
            try {
                const features: GeoJSON.Feature[] = []

                for (const code of communeCodes) {
                    // Vérifier le cache
                    if (geometryCache.has(code)) {
                        features.push(geometryCache.get(code)!)
                        continue
                    }

                    // Charger depuis l'API Geo Data Gouv
                    const response = await fetch(
                        `https://geo.api.gouv.fr/communes/${code}?fields=nom,code,codesPostaux,centre,surface,contour&format=geojson&geometry=contour`
                    )

                    if (response.ok) {
                        const feature = await response.json() as GeoJSON.Feature
                        geometryCache.set(code, feature)
                        features.push(feature)
                    }
                }

                setGeoJsonData({
                    type: 'FeatureCollection',
                    features,
                })
            } catch (error) {
                console.error('Erreur lors du chargement des géométries:', error)
            }
        }

        loadGeometries()
    }, [communeCodes])

    // Fonction de style pour chaque commune
    const style = (feature: GeoJSON.Feature | undefined): PathOptions => {
        if (!feature || !feature.properties || !inseeData) {
            return {
                fillColor: '#cccccc',
                weight: 1,
                opacity: 1,
                color: '#666666',
                fillOpacity: opacity,
            }
        }

        const code = feature.properties.code
        const data = inseeData.find(d => d.code_commune === code)

        if (!data || !data[indicator]) {
            return {
                fillColor: '#cccccc',
                weight: 1,
                opacity: 1,
                color: '#666666',
                fillOpacity: opacity * 0.5,
            }
        }

        const value = data[indicator] as number
        const color = getIndicatorColor(indicator, value, min, max)

        return {
            fillColor: color,
            weight: 1,
            opacity: 1,
            color: '#ffffff',
            fillOpacity: opacity,
        }
    }

    // Gestionnaires d'événements
    const onEachFeature = (feature: GeoJSON.Feature, layer: any) => {
        if (!feature.properties) return

        const code = feature.properties.code
        const data = inseeData?.find(d => d.code_commune === code)

        layer.on({
            mouseover: (e: LeafletMouseEvent) => {
                const layer = e.target
                layer.setStyle({
                    weight: 3,
                    color: '#3b82f6',
                    fillOpacity: Math.min(opacity * 1.2, 1),
                })
                layer.bringToFront()

                if (data && onCommuneHover) {
                    onCommuneHover(code, data)
                }
            },
            mouseout: (e: LeafletMouseEvent) => {
                const layer = e.target
                layer.setStyle(style(feature))

                if (onCommuneHover) {
                    onCommuneHover(null, null)
                }
            },
            click: () => {
                if (data && onCommuneClick) {
                    onCommuneClick(code, data)
                }
            },
        })
    }

    if (!geoJsonData) {
        return null
    }

    return (
        <GeoJSON
            key={`choropleth-${indicator}-${communeCodes.join('-')}`}
            data={geoJsonData}
            style={style}
            onEachFeature={onEachFeature}
        />
    )
}
