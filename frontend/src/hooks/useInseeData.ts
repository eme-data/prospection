/**
 * Hook personnalisé pour gérer les données socio-économiques INSEE
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { InseeData, TerritoryStats, InseeCacheInfo } from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Récupérer les données d'une commune
export function useInseeCommune(codeCommune: string | null) {
    return useQuery({
        queryKey: ['insee', 'commune', codeCommune],
        queryFn: async () => {
            if (!codeCommune) return null

            const response = await fetch(`${API_URL}/api/insee/commune/${codeCommune}`)
            if (!response.ok) {
                if (response.status === 404) {
                    return null // Données non disponibles
                }
                throw new Error('Erreur lors de la récupération des données INSEE')
            }
            return response.json() as Promise<InseeData>
        },
        enabled: !!codeCommune,
        staleTime: 1000 * 60 * 60 * 24, // 24 heures
    })
}

// Récupérer les données de plusieurs communes
export function useInseeCommunes(codesCommune: string[]) {
    return useQuery({
        queryKey: ['insee', 'communes', codesCommune.sort().join(',')],
        queryFn: async () => {
            if (codesCommune.length === 0) return []

            const params = new URLSearchParams()
            codesCommune.forEach(code => params.append('codes_commune', code))

            const response = await fetch(`${API_URL}/api/insee/communes?${params}`)
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des données INSEE')
            }
            return response.json() as Promise<InseeData[]>
        },
        enabled: codesCommune.length > 0,
        staleTime: 1000 * 60 * 60 * 24, // 24 heures
    })
}

// Récupérer les statistiques d'un territoire
export function useTerritoryStats(codesCommune: string[]) {
    return useQuery({
        queryKey: ['insee', 'territory-stats', codesCommune.sort().join(',')],
        queryFn: async () => {
            if (codesCommune.length === 0) return null

            const params = new URLSearchParams()
            codesCommune.forEach(code => params.append('codes_commune', code))

            const response = await fetch(`${API_URL}/api/insee/stats-territoire?${params}`)
            if (!response.ok) {
                throw new Error('Erreur lors du calcul des statistiques')
            }
            return response.json() as Promise<TerritoryStats>
        },
        enabled: codesCommune.length > 0,
        staleTime: 1000 * 60 * 60, // 1 heure
    })
}

// Récupérer les infos du cache
export function useInseeCacheInfo() {
    return useQuery({
        queryKey: ['insee', 'cache-info'],
        queryFn: async () => {
            const response = await fetch(`${API_URL}/api/insee/cache-info`)
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des infos cache')
            }
            return response.json() as Promise<InseeCacheInfo>
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    })
}

// Mutation pour ajouter/mettre à jour des données INSEE
export function useAddInseeData() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: InseeData) => {
            const response = await fetch(`${API_URL}/api/insee/commune`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                throw new Error('Erreur lors de l\'ajout des données')
            }

            return response.json()
        },
        onSuccess: (_, data) => {
            // Invalider les caches concernés
            queryClient.invalidateQueries({ queryKey: ['insee', 'commune', data.code_commune] })
            queryClient.invalidateQueries({ queryKey: ['insee', 'communes'] })
            queryClient.invalidateQueries({ queryKey: ['insee', 'territory-stats'] })
            queryClient.invalidateQueries({ queryKey: ['insee', 'cache-info'] })
        },
    })
}

// Utilitaires pour les données INSEE

/**
 * Détermine le profil économique d'une commune
 */
export function getProfilEconomique(revenuMedian?: number): string {
    if (!revenuMedian) return 'Données insuffisantes'

    if (revenuMedian > 25000) return 'Aisé'
    if (revenuMedian > 20000) return 'Confortable'
    if (revenuMedian > 15000) return 'Moyen'
    return 'Modeste'
}

/**
 * Détermine la CSP dominante
 */
export function getCSPDominante(data: InseeData): string | null {
    const cspValues: Record<string, number> = {
        'Agriculteurs': data.csp_agriculteurs || 0,
        'Artisans/Commerçants': data.csp_artisans_commercants || 0,
        'Cadres': data.csp_cadres || 0,
        'Prof. intermédiaires': data.csp_professions_intermediaires || 0,
        'Employés': data.csp_employes || 0,
        'Ouvriers': data.csp_ouvriers || 0,
        'Retraités': data.csp_retraites || 0,
    }

    const maxValue = Math.max(...Object.values(cspValues))
    if (maxValue === 0) return null

    const dominante = Object.entries(cspValues).find(([_, value]) => value === maxValue)
    return dominante ? dominante[0] : null
}

/**
 * Formate un nombre avec séparateurs de milliers
 */
export function formatNumber(value?: number): string {
    if (value === undefined || value === null) return 'N/A'
    return value.toLocaleString('fr-FR')
}

/**
 * Formate un pourcentage
 */
export function formatPercentage(value?: number): string {
    if (value === undefined || value === null) return 'N/A'
    return `${value.toFixed(1)} %`
}

/**
 * Formate un montant en euros
 */
export function formatEuros(value?: number): string {
    if (value === undefined || value === null) return 'N/A'
    return `${formatNumber(Math.round(value))} €`
}

/**
 * Obtient une couleur pour un indicateur de revenu
 */
export function getRevenuColor(revenu?: number): string {
    if (!revenu) return '#gray'

    if (revenu > 25000) return '#10b981' // vert
    if (revenu > 20000) return '#3b82f6' // bleu
    if (revenu > 15000) return '#f59e0b' // orange
    return '#ef4444' // rouge
}

/**
 * Obtient une couleur pour le taux de chômage
 */
export function getChomageColor(taux?: number): string {
    if (!taux) return '#gray'

    if (taux < 6) return '#10b981'  // vert
    if (taux < 9) return '#f59e0b'  // orange
    return '#ef4444'  // rouge
}
