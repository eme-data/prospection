import { useRef, useCallback, useState } from 'react'
import MapGL, {
  NavigationControl,
  GeolocateControl,
  ScaleControl,
  Source,
  Layer,
  MapRef,
  MapLayerMouseEvent,
} from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { MapViewState, LayerType, Parcelle, DVFTransaction, GeoJSONFeatureCollection, InseeLayerConfig, InseeData } from '../types'
import { useInseeLayer, generateChoroplethStyle } from '../hooks/useInseeLayer'
import InseeLegend from './insee/InseeLegend'
import InseeTooltip from './insee/InseeTooltip'

// Style de carte OpenStreetMap
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

// Style Google Satellite (Hybrid)
const SATELLITE_STYLE = {
  version: 8,
  sources: {
    'google-satellite': {
      type: 'raster',
      tiles: [
        'https://mt0.google.com/vt/lyrs=y&hl=fr&x={x}&y={y}&z={z}',
        'https://mt1.google.com/vt/lyrs=y&hl=fr&x={x}&y={y}&z={z}',
        'https://mt2.google.com/vt/lyrs=y&hl=fr&x={x}&y={y}&z={z}',
        'https://mt3.google.com/vt/lyrs=y&hl=fr&x={x}&y={y}&z={z}',
      ],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'google-satellite',
      type: 'raster',
      source: 'google-satellite',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
}

interface MapViewProps {
  viewState: MapViewState
  onViewStateChange: (viewState: MapViewState) => void
  activeLayers: Set<LayerType>
  parcelles: GeoJSONFeatureCollection<Parcelle> | null
  transactions: GeoJSONFeatureCollection<DVFTransaction> | null
  onSelectParcelle: (parcelle: Parcelle | null) => void
  onSelectTransaction: (transaction: DVFTransaction | null) => void
  inseeLayerConfig?: InseeLayerConfig
}

export function MapView({
  viewState,
  onViewStateChange,
  activeLayers,
  parcelles,
  transactions,
  onSelectParcelle,
  onSelectTransaction,
  inseeLayerConfig,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null)
  const [hoveredParcelleId, setHoveredParcelleId] = useState<string | null>(null)
  const [hoveredInseeCommune, setHoveredInseeCommune] = useState<{ code: string; data: InseeData; position: { x: number; y: number } } | null>(null)

  // Codes communes de démonstration (à remplacer par viewport-based loading)
  const [testCommuneCodes] = useState([
    '75056', // Paris
    '13055', // Marseille
    '69123', // Lyon
    '31555', // Toulouse
    '06088', // Nice
    '44109', // Nantes
    '67482', // Strasbourg
    '33063', // Bordeaux
    '59350', // Lille
    '35238', // Rennes
  ])

  // Charger les données INSEE
  const { geoJsonData: inseeGeoJson, minValue, maxValue } = useInseeLayer(
    inseeLayerConfig?.visible ? testCommuneCodes : [],
    inseeLayerConfig?.indicator || 'revenu_median'
  )

  const mapStyle = activeLayers.has('satellite') ? SATELLITE_STYLE : MAP_STYLE

  const handleMove = useCallback(
    (evt: { viewState: MapViewState }) => {
      onViewStateChange(evt.viewState)
    },
    [onViewStateChange]
  )

  const handleClick = useCallback(
    (evt: MapLayerMouseEvent) => {
      const features = evt.features || []

      // Recherche d'une parcelle cliquee
      const parcelleFeature = features.find((f) => f.layer?.id === 'parcelles-fill')
      if (parcelleFeature) {
        onSelectParcelle(parcelleFeature as unknown as Parcelle)
        onSelectTransaction(null)
        return
      }

      // Recherche d'une transaction DVF cliquee
      const dvfFeature = features.find((f) => f.layer?.id === 'dvf-points')
      if (dvfFeature) {
        onSelectTransaction(dvfFeature as unknown as DVFTransaction)
        onSelectParcelle(null)
        return
      }

      // Aucune feature cliquee
      onSelectParcelle(null)
      onSelectTransaction(null)
    },
    [onSelectParcelle, onSelectTransaction]
  )

  const handleMouseMove = useCallback((evt: MapLayerMouseEvent) => {
    const features = evt.features || []

    // Vérifier les features INSEE en premier
    const inseeFeature = features.find((f) => f.layer?.id === 'insee-fill')
    if (inseeFeature && inseeFeature.properties?.insee) {
      const code = inseeFeature.properties.code
      const data = inseeFeature.properties.insee as InseeData
      setHoveredInseeCommune({
        code,
        data,
        position: { x: evt.point.x, y: evt.point.y },
      })
      setHoveredParcelleId(null)
      return
    }

    // Vérifier les parcelles
    const parcelleFeature = features.find((f) => f.layer?.id === 'parcelles-fill')
    if (parcelleFeature) {
      setHoveredParcelleId(parcelleFeature.properties?.id || null)
      setHoveredInseeCommune(null)
    } else {
      setHoveredParcelleId(null)
      setHoveredInseeCommune(null)
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredParcelleId(null)
    setHoveredInseeCommune(null)
  }, [])

  // Couche des parcelles cadastrales
  const parcellesFillLayer = {
    id: 'parcelles-fill',
    type: 'fill' as const,
    paint: {
      'fill-color': [
        'case',
        ['==', ['get', 'id'], hoveredParcelleId || ''],
        '#3b82f6',
        '#93c5fd',
      ] as unknown as string,
      'fill-opacity': 0.3,
    },
  }

  const parcellesLineLayer = {
    id: 'parcelles-line',
    type: 'line' as const,
    paint: {
      'line-color': '#2563eb',
      'line-width': 1,
    },
  }

  // Couche des transactions DVF
  const dvfLayer = {
    id: 'dvf-points',
    type: 'circle' as const,
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 4,
        15, 8,
        18, 12,
      ] as unknown as number,
      'circle-color': [
        'interpolate',
        ['linear'],
        ['get', 'valeur_fonciere'],
        0, '#22c55e',
        200000, '#eab308',
        500000, '#f97316',
        1000000, '#ef4444',
      ] as unknown as string,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
      'circle-opacity': 0.8,
    },
  }

  return (
    <>
      <MapGL
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={['parcelles-fill', 'dvf-points', 'insee-fill']}
        cursor={hoveredParcelleId || hoveredInseeCommune ? 'pointer' : 'grab'}
      >
        <NavigationControl position="top-right" />
        <GeolocateControl position="top-right" />
        <ScaleControl position="bottom-left" />

        {/* Calques INSEE */}
        {inseeLayerConfig?.visible && inseeGeoJson && (() => {
          const styles = generateChoroplethStyle(
            inseeLayerConfig.indicator,
            inseeLayerConfig.colorScale,
            minValue,
            maxValue,
            inseeLayerConfig.opacity
          )
          return (
            <Source id="insee" type="geojson" data={inseeGeoJson}>
              <Layer {...styles.fillLayer} />
              <Layer {...styles.lineLayer} />
            </Source>
          )
        })()}

        {/* Couche des parcelles cad astrales */}
        {activeLayers.has('parcelles') && parcelles && parcelles.features.length > 0 && (
          <Source id="parcelles" type="geojson" data={parcelles}>
            <Layer {...parcellesFillLayer} />
            <Layer {...parcellesLineLayer} />
          </Source>
        )}

        {/* Couche des transactions DVF */}
        {activeLayers.has('dvf') && transactions && transactions.features.length > 0 && (
          <Source id="dvf" type="geojson" data={transactions}>
            <Layer {...dvfLayer} />
          </Source>
        )}
      </MapGL>

      {/* Légende INSEE */}
      {inseeLayerConfig?.visible && (
        <InseeLegend
          indicator={inseeLayerConfig.indicator}
          colorScale={inseeLayerConfig.colorScale}
          min={minValue}
          max={maxValue}
          position="bottom-right"
        />
      )}

      {/* Tooltip INSEE */}
      {hoveredInseeCommune && inseeLayerConfig && (
        <InseeTooltip
          data={hoveredInseeCommune.data}
          indicator={inseeLayerConfig.indicator}
          position={hoveredInseeCommune.position}
        />
      )}
    </>
  )
}
