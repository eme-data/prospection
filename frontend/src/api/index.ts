import type {
  AddressResult,
  Commune,
  GeoJSONFeatureCollection,
  Parcelle,
  DVFTransaction,
  DVFFilters,
  DVFStatistiques,
  RisquesResponse,
  ZonageResponse,
  FaisabiliteReport,
  Top10Result,
} from '../types'

const API_BASE = '/api'

export async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('prospection_token')

  const headers = new Headers(options.headers || {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(url, {
    ...options,
    headers
  })

  if (!response.ok) {
    if (response.status === 401) {
      // Pourrait déclencher un événement global de déconnexion ici
      console.warn('Non autorisé, token expiré ou invalide')
    }
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

export async function login(email: string, password: string): Promise<{ access_token: string; token_type: string; user: any }> {
  const formData = new URLSearchParams()
  formData.append('username', email)
  formData.append('password', password)

  const response = await fetch(`${API_BASE}/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  })

  if (!response.ok) {
    throw new Error('Identifiants invalides')
  }

  return response.json()
}

export async function loginWithMicrosoft(accessToken: string): Promise<{ access_token: string; token_type: string; user: any }> {
  const response = await fetch(`${API_BASE}/auth/microsoft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ access_token: accessToken }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || 'Erreur lors de la connexion via Microsoft')
  }

  return response.json()
}

export async function getFaisabiliteReport(parcelleId: string): Promise<FaisabiliteReport> {
  try {
    return await fetchJSON<FaisabiliteReport>(`${API_BASE}/faisabilite/${parcelleId}`)
  } catch (error: any) {
    console.error('Erreur getFaisabiliteReport:', error)
    if (error.message && error.message.includes('404')) {
      throw new Error('Parcelle non trouvée ou erreur API Cadastre')
    }
    throw error
  }
}

export async function getTop10Faisabilites(codeInsee: string, minSdp: number = 2000): Promise<Top10Result[]> {
  try {
    return await fetchJSON<Top10Result[]>(`${API_BASE}/faisabilite/top10/${codeInsee}?min_sdp=${minSdp}`)
  } catch (error: any) {
    console.error('Erreur getTop10Faisabilites:', error)
    throw error
  }
}

// ============== ADRESSES ==============

export async function searchAddress(query: string): Promise<AddressResult[]> {
  const data = await fetchJSON<{ results: AddressResult[] }>(
    `${API_BASE}/address/search?q=${encodeURIComponent(query)}`
  )
  return data.results
}

export async function reverseGeocode(lon: number, lat: number): Promise<AddressResult | null> {
  const data = await fetchJSON<{ result: AddressResult | null }>(
    `${API_BASE}/address/reverse?lon=${lon}&lat=${lat}`
  )
  return data.result
}

// ============== CADASTRE ==============

export async function getParcelles(
  codeInsee: string,
  section?: string,
  numero?: string
): Promise<GeoJSONFeatureCollection<Parcelle>> {
  let url = `${API_BASE}/cadastre/parcelles?code_insee=${codeInsee}`
  if (section) url += `&section=${section}`
  if (numero) url += `&numero=${numero}`
  return fetchJSON<GeoJSONFeatureCollection<Parcelle>>(url)
}

export async function getParcelleById(parcelleId: string): Promise<Parcelle> {
  return fetchJSON<Parcelle>(`${API_BASE}/cadastre/parcelle/${parcelleId}`)
}

// ============== DVF ==============

export async function getDVFTransactions(params: {
  codeInsee?: string
  lon?: number
  lat?: number
  rayon?: number
}): Promise<GeoJSONFeatureCollection<DVFTransaction>> {
  const searchParams = new URLSearchParams()
  if (params.codeInsee) searchParams.set('code_insee', params.codeInsee)
  if (params.lon !== undefined) searchParams.set('lon', params.lon.toString())
  if (params.lat !== undefined) searchParams.set('lat', params.lat.toString())
  if (params.rayon !== undefined) searchParams.set('rayon', params.rayon.toString())

  return fetchJSON<GeoJSONFeatureCollection<DVFTransaction>>(
    `${API_BASE}/dvf/transactions?${searchParams.toString()}`
  )
}

export async function getDVFStatistiques(
  codeInsee: string,
  filters?: DVFFilters
): Promise<DVFStatistiques> {
  const searchParams = new URLSearchParams()
  searchParams.set('code_insee', codeInsee)

  if (filters?.typeLocal) searchParams.set('type_local', filters.typeLocal)
  if (filters?.anneeMin) searchParams.set('annee_min', filters.anneeMin.toString())
  if (filters?.anneeMax) searchParams.set('annee_max', filters.anneeMax.toString())

  return fetchJSON<DVFStatistiques>(
    `${API_BASE}/dvf/statistiques?${searchParams.toString()}`
  )
}

// ============== GEO ==============

export async function searchCommunes(params: {
  nom?: string
  codePostal?: string
  codeDepartement?: string
}): Promise<Commune[]> {
  const searchParams = new URLSearchParams()
  if (params.nom) searchParams.set('nom', params.nom)
  if (params.codePostal) searchParams.set('code_postal', params.codePostal)
  if (params.codeDepartement) searchParams.set('code_departement', params.codeDepartement)

  const data = await fetchJSON<{ communes: Commune[] }>(
    `${API_BASE}/geo/communes?${searchParams.toString()}`
  )
  return data.communes
}

export async function getCommune(codeInsee: string): Promise<Commune> {
  return fetchJSON<Commune>(`${API_BASE}/geo/commune/${codeInsee}`)
}

export async function getNearbyPOIs(lat: number, lon: number, radius: number = 500): Promise<any[]> {
  const searchParams = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    radius: radius.toString()
  })

  const data = await fetchJSON<{ pois: any[] }>(
    `${API_BASE}/geo/pois?${searchParams.toString()}`
  )
  return data.pois
}

export async function getDepartements(): Promise<{ code: string; nom: string }[]> {
  const data = await fetchJSON<{ departements: { code: string; nom: string }[] }>(
    `${API_BASE}/geo/departements`
  )
  return data.departements
}

// ============== RISQUES ==============

export async function getRisquesCommune(codeInsee: string): Promise<RisquesResponse> {
  return fetchJSON<RisquesResponse>(`${API_BASE}/risques/commune/${codeInsee}`)
}

export async function getRisquesParcelle(lon: number, lat: number): Promise<RisquesResponse> {
  return fetchJSON<RisquesResponse>(`${API_BASE}/risques/parcelle?lon=${lon}&lat=${lat}`)
}

export async function getRisquesInondation(lon: number, lat: number): Promise<{
  longitude: number
  latitude: number
  zones_inondables: unknown[]
  count: number
}> {
  return fetchJSON(`${API_BASE}/risques/inondation?lon=${lon}&lat=${lat}`)
}

// ============== URBANISME ==============

export async function getZonagePLU(lon: number, lat: number): Promise<ZonageResponse> {
  return fetchJSON<ZonageResponse>(`${API_BASE}/urbanisme/zonage?lon=${lon}&lat=${lat}`)
}

export async function getCommuneZonagePLU(codeInsee: string): Promise<{ code_insee: string; zones: any[]; count: number }> {
  return fetchJSON(`${API_BASE}/urbanisme/commune/${codeInsee}/zones`)
}

export async function getPrescriptionsPLU(lon: number, lat: number): Promise<{
  longitude: number
  latitude: number
  prescriptions: { libelle: string; txt: string; typepsc: string }[]
  count: number
}> {
  return fetchJSON(`${API_BASE}/urbanisme/prescriptions?lon=${lon}&lat=${lat}`)
}

// ============== EXPORT ==============

export function getExportDVFCSVUrl(codeInsee: string, filters?: DVFFilters): string {
  const searchParams = new URLSearchParams()
  searchParams.set('code_insee', codeInsee)

  if (filters?.typeLocal) searchParams.set('type_local', filters.typeLocal)
  if (filters?.prixMin) searchParams.set('prix_min', filters.prixMin.toString())
  if (filters?.prixMax) searchParams.set('prix_max', filters.prixMax.toString())
  if (filters?.surfaceMin) searchParams.set('surface_min', filters.surfaceMin.toString())
  if (filters?.surfaceMax) searchParams.set('surface_max', filters.surfaceMax.toString())

  return `${API_BASE}/export/dvf/csv?${searchParams.toString()}`
}

export function getExportDVFGeoJSONUrl(codeInsee: string, filters?: DVFFilters): string {
  const searchParams = new URLSearchParams()
  searchParams.set('code_insee', codeInsee)

  if (filters?.typeLocal) searchParams.set('type_local', filters.typeLocal)
  if (filters?.prixMin) searchParams.set('prix_min', filters.prixMin.toString())
  if (filters?.prixMax) searchParams.set('prix_max', filters.prixMax.toString())

  return `${API_BASE}/export/dvf/geojson?${searchParams.toString()}`
}

export function getExportParcellesGeoJSONUrl(codeInsee: string, section?: string): string {
  const searchParams = new URLSearchParams()
  searchParams.set('code_insee', codeInsee)
  if (section) searchParams.set('section', section)

  return `${API_BASE}/export/parcelles/geojson?${searchParams.toString()}`
}

// ============== FILTRAGE LOCAL ==============

export function filterTransactions(
  transactions: DVFTransaction[],
  filters: DVFFilters
): DVFTransaction[] {
  return transactions.filter((t) => {
    const props = t.properties

    if (filters.typeLocal && props.type_local !== filters.typeLocal) {
      return false
    }

    if (filters.prixMin && props.valeur_fonciere < filters.prixMin) {
      return false
    }

    if (filters.prixMax && props.valeur_fonciere > filters.prixMax) {
      return false
    }

    if (filters.surfaceMin && props.surface_reelle_bati < filters.surfaceMin) {
      return false
    }

    if (filters.surfaceMax && props.surface_reelle_bati > filters.surfaceMax) {
      return false
    }

    if (filters.anneeMin || filters.anneeMax) {
      const year = parseInt(props.date_mutation?.substring(0, 4) || '0')
      if (filters.anneeMin && year < filters.anneeMin) return false
      if (filters.anneeMax && year > filters.anneeMax) return false
    }

    return true
  })
}
// ============== RECHERCHE AVANCÉE ==============

export async function searchParcelles(
  codeInsee: string,
  filters: DVFFilters
): Promise<any> {
  const body = {
    code_insee: codeInsee,
    section: filters.section,
    surface_min: filters.surfaceParcelleMin,
    surface_max: filters.surfaceParcelleMax,
    zone_types: filters.zoneTypes?.length ? filters.zoneTypes : undefined,
    non_bati: filters.nonBati,
    dent_creuse: filters.dentCreuse,
    score_min: undefined,
    include_score: true,
    page: 1,
    per_page: 200,
    sort_by: 'score'
  }

  // Nettoyage des undefined recursif si besoin, mais ici JSON.stringify ignore undefined

  return fetchJSON(`${API_BASE}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}


