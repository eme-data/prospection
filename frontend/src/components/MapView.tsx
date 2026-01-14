import { useRef, useCallback, useState, useEffect } from 'react'
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
import type { MapViewState, LayerType, Parcelle, DVFTransaction, GeoJSONFeatureCollection } from '../types'

// Style de carte OpenStreetMap
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const SATELLITE_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

interface MapViewProps {
  viewState: MapViewState
  onViewStateChange: (viewState: MapViewState) => void
  activeLayers: Set<LayerType>
  parcelles: GeoJSONFeatureCollection<Parcelle> | null
  transactions: GeoJSONFeatureCollection<DVFTransaction> | null
  onSelectParcelle: (parcelle: Parcelle | null) => void
  onSelectTransaction: (transaction: DVFTransaction | null) => void
}

export function MapView({
  viewState,
  onViewStateChange,
  activeLayers,
  parcelles,
  transactions,
  onSelectParcelle,
  onSelectTransaction,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null)
  const [hoveredParcelleId, setHoveredParcelleId] = useState<string | null>(null)

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
    const parcelleFeature = features.find((f) => f.layer?.id === 'parcelles-fill')

    if (parcelleFeature) {
      setHoveredParcelleId(parcelleFeature.properties?.id || null)
    } else {
      setHoveredParcelleId(null)
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredParcelleId(null)
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
    <MapGL
      ref={mapRef}
      {...viewState}
      onMove={handleMove}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      mapStyle={mapStyle}
      style={{ width: '100%', height: '100%' }}
      interactiveLayerIds={['parcelles-fill', 'dvf-points']}
      cursor={hoveredParcelleId ? 'pointer' : 'grab'}
    >
      <NavigationControl position="top-right" />
      <GeolocateControl position="top-right" />
      <ScaleControl position="bottom-left" />

      {/* Couche des parcelles cadastrales */}
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
  )
}
