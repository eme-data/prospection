export interface AddressResult {
  label: string
  score: number
  housenumber?: string
  street?: string
  postcode?: string
  citycode?: string
  city?: string
  context?: string
  longitude: number
  latitude: number
}

export interface Parcelle {
  type: 'Feature'
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
  properties: {
    id: string
    commune: string
    prefixe: string
    section: string
    numero: string
    contenance: number
    arpente: boolean
    created: string
    updated: string
  }
}

export interface DVFTransaction {
  type: 'Feature'
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: {
    date_mutation: string
    nature_mutation: string
    valeur_fonciere: number
    adresse: string
    code_postal: string
    commune: string
    type_local: string
    surface_reelle_bati: number
    nombre_pieces: number
    surface_terrain: number
  }
}

export interface Commune {
  nom: string
  code: string
  codesPostaux: string[]
  centre: {
    type: 'Point'
    coordinates: [number, number]
  }
  contour?: {
    type: 'Polygon'
    coordinates: number[][][]
  }
  population: number
  departement: {
    code: string
    nom: string
  }
}

export interface GeoJSONFeatureCollection<T> {
  type: 'FeatureCollection'
  features: T[]
}

export interface MapViewState {
  longitude: number
  latitude: number
  zoom: number
}

export type LayerType = 'parcelles' | 'dvf' | 'satellite'
