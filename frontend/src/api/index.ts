import type { AddressResult, Commune, GeoJSONFeatureCollection, Parcelle, DVFTransaction } from '../types'

const API_BASE = '/api'

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

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

export async function getDepartements(): Promise<{ code: string; nom: string }[]> {
  const data = await fetchJSON<{ departements: { code: string; nom: string }[] }>(
    `${API_BASE}/geo/departements`
  )
  return data.departements
}
