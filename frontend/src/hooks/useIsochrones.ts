/**
 * Hook React Query pour calculer les isochrones
 */

import { useQuery } from '@tanstack/react-query'

export interface IsochroneProfile {
    id: string
    name: string
    icon: string
}

export interface IsochroneFeature {
    type: 'Feature'
    properties: {
        value: number
        center: [number, number]
        profile: string
    }
    geometry: {
        type: 'Polygon'
        coordinates: number[][][]
    }
}

export interface IsochroneData {
    type: 'FeatureCollection'
    features: IsochroneFeature[]
    metadata: {
        profile: string
        center: [number, number]
        ranges: number[]
        attribution: string
    }
}

interface UseIsochronesParams {
    lon: number | null
    lat: number | null
    profile: string
    ranges: number[]  // en secondes
    enabled: boolean
}

export function useIsochrones({
    lon,
    lat,
    profile,
    ranges,
    enabled
}: UseIsochronesParams) {
    return useQuery<IsochroneData>({
        queryKey: ['isochrones', lon, lat, profile, ranges.join(',')],
        queryFn: async () => {
            if (!lon || !lat) {
                throw new Error('Coordonnées manquantes')
            }

            const params = new URLSearchParams({
                lon: lon.toString(),
                lat: lat.toString(),
                profile,
                ranges: ranges.join(',')
            })

            const response = await fetch(`/api/isochrones/calculate?${params}`)

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.detail || 'Erreur lors du calcul des isochrones')
            }

            return response.json()
        },
        enabled: enabled && lon !== null && lat !== null,
        staleTime: 24 * 60 * 60 * 1000, // 24h
        retry: 2
    })
}

export function useIsochroneProfiles() {
    return useQuery<{ profiles: IsochroneProfile[] }>({
        queryKey: ['isochrone-profiles'],
        queryFn: async () => {
            const response = await fetch('/api/isochrones/profiles')

            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des profils')
            }

            return response.json()
        },
        staleTime: Infinity, // Profiles ne changent jamais
    })
}
