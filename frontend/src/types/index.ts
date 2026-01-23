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

// Nouveaux types pour les fonctionnalités avancées

export interface DVFFilters {
  typeLocal?: string
  prixMin?: number
  prixMax?: number
  surfaceMin?: number
  surfaceMax?: number
  anneeMin?: number
  anneeMax?: number
}

export interface DVFStatistiques {
  code_insee: string
  nb_transactions: number
  statistiques: {
    prix_min: number | null
    prix_max: number | null
    prix_moyen: number | null
    prix_median: number | null
    surface_moyenne: number | null
    prix_m2_moyen: number | null
    prix_m2_min: number | null
    prix_m2_max: number | null
  } | null
  evolution: {
    annee: string
    nb_transactions: number
    prix_moyen: number | null
    prix_m2_moyen: number | null
  }[]
  repartition_types: Record<string, number>
}

export interface Risque {
  code: string
  libelle: string
  niveau: string
  commune?: string
}

export interface RisquesResponse {
  code_insee?: string
  longitude?: number
  latitude?: number
  risques: Risque[]
  count: number
}

export interface ZonagePLU {
  libelle: string
  libelong: string
  typezone: string
  destdomi: string
  nomfic: string
  urlfic: string
  partition: string
}

export interface ZonageResponse {
  longitude: number
  latitude: number
  zonages: ZonagePLU[]
  count: number
}

export interface PrescriptionPLU {
  libelle: string
  txt: string
  typepsc: string
  stypepsc: string
  nomfic: string
  urlfic: string
}

export interface FavoriteParcelle {
  id: string
  parcelle: Parcelle
  note?: string
  addedAt: string
  transactions?: DVFTransaction[]
}

// Gestion de projets
export interface Project {
  id: string
  name: string
  description: string
  color: string
  parcelles: string[] // IDs des parcelles
  createdAt: string
  updatedAt: string
  status: 'active' | 'archived' | 'completed'
}

// Historique des recherches
export interface SearchHistory {
  id: string
  query: string
  address: AddressResult
  timestamp: string
  filters?: DVFFilters
}

// Alertes personnalisées
export interface Alert {
  id: string
  name: string
  codeInsee: string
  filters: DVFFilters
  enabled: boolean
  createdAt: string
  lastChecked?: string
}
