/**
 * Hook pour les données de calques économiques
 */

import { useQuery } from '@tanstack/react-query'

export interface PriceHeatmapCell {
    type: 'Feature'
    geometry: {
        type: 'Polygon'
        coordinates: number[][][]
    }
    properties: {
        center_lon: number
        center_lat: number
        prix_m2: number
        count: number
    }
}

export interface PriceHeatmapData {
    type: 'FeatureCollection'
    features: PriceHeatmapCell[]
    metadata: {
        granularity_m: number
        bbox: string
        total_cells: number
        min_prix_m2: number
        max_prix_m2: number
        avg_prix_m2: number
        generated_at: string
    }
}

export interface PriceEvolution {
    year: number
    prix_moyen: number
    prix_m2_moyen: number
    nombre_transactions: number
    surface_moyenne: number
}

export interface TransactionVolume {
    period: string
    bbox: string
    data: Array<{
        period: string
        count: number
    }>
    total_transactions: number
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function fetchPriceHeatmap(bbox: string, granularity: number): Promise<PriceHeatmapData> {
    const response = await fetch(
        `${API_URL}/api/layers/economic/prix-m2?bbox=${bbox}&granularity=${granularity}`
    )
    if (!response.ok) {
        throw new Error('Failed to fetch price heatmap')
    }
    return response.json()
}

async function fetchPriceEvolution(codeInsee: string, years: number): Promise<PriceEvolution[]> {
    const response = await fetch(
        `${API_URL}/api/layers/economic/evolution-prix?code_insee=${codeInsee}&years=${years}`
    )
    if (!response.ok) {
        throw new Error('Failed to fetch price evolution')
    }
    return response.json()
}

async function fetchTransactionVolume(bbox: string, period: string): Promise<TransactionVolume> {
    const response = await fetch(
        `${API_URL}/api/layers/economic/volume-transactions?bbox=${bbox}&period=${period}`
    )
    if (!response.ok) {
        throw new Error('Failed to fetch transaction volume')
    }
    return response.json()
}

export function usePriceHeatmap(bbox: string, granularity: number, enabled: boolean = true) {
    return useQuery({
        queryKey: ['price-heatmap', bbox, granularity],
        queryFn: () => fetchPriceHeatmap(bbox, granularity),
        enabled: enabled && !!bbox,
        staleTime: 60 * 60 * 1000, // 1 hour
    })
}

export function usePriceEvolution(codeInsee: string, years: number = 5, enabled: boolean = true) {
    return useQuery({
        queryKey: ['price-evolution', codeInsee, years],
        queryFn: () => fetchPriceEvolution(codeInsee, years),
        enabled: enabled && !!codeInsee,
        staleTime: 2 * 60 * 60 * 1000, // 2 hours
    })
}

export function useTransactionVolume(bbox: string, period: string = 'month', enabled: boolean = true) {
    return useQuery({
        queryKey: ['transaction-volume', bbox, period],
        queryFn: () => fetchTransactionVolume(bbox, period),
        enabled: enabled && !!bbox,
        staleTime: 60 * 60 * 1000, // 1 hour
    })
}
