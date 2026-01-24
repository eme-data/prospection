/**
 * Carte d'affichage des statistiques socio-économiques INSEE
 */

import React from 'react'
import { TrendingUp, TrendingDown, Users, Home, Briefcase, DollarSign } from 'lucide-react'
import type { InseeData } from '../types'
import {
    formatNumber,
    formatPercentage,
    formatEuros,
    getProfilEconomique,
    getCSPDominante,
    getRevenuColor,
    getChomageColor,
} from '../hooks/useInseeData'

interface InseeStatsCardProps {
    data: InseeData
    compact?: boolean
}

export default function InseeStatsCard({ data, compact = false }: InseeStatsCardProps) {
    const profilEconomique = getProfilEconomique(data.revenu_median)
    const cspDominante = getCSPDominante(data)

    if (compact) {
        return (
            <div className="bg-white rounded-lg shadow p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{data.nom_commune}</h3>
                    <span className="text-xs text-gray-500">
                        Données {data.annee_reference}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <StatItem
                        icon={<Users className="h-4 w-4" />}
                        label="Population"
                        value={formatNumber(data.population)}
                    />
                    <StatItem
                        icon={<DollarSign className="h-4 w-4" />}
                        label="Revenu médian"
                        value={formatEuros(data.revenu_median)}
                        color={getRevenuColor(data.revenu_median)}
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
            {/* En-tête */}
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{data.nom_commune}</h2>
                    <p className="text-sm text-gray-500">
                        Département {data.code_departement} • Code INSEE {data.code_commune}
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-xs text-gray-500">Profil économique</div>
                    <div
                        className="text-lg font-semibold"
                        style={{ color: getRevenuColor(data.revenu_median) }}
                    >
                        {profilEconomique}
                    </div>
                </div>
            </div>

            {/* Indicateurs principaux */}
            <div className="grid grid-cols-2 gap-4">
                {/* Population */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="h-4 w-4" />
                        <span>Population</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                        {formatNumber(data.population)}
                    </div>
                    {data.densite && (
                        <div className="text-xs text-gray-500">
                            Densité : {formatNumber(data.densite)} hab/km²
                        </div>
                    )}
                </div>

                {/* Revenu médian */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <DollarSign className="h-4 w-4" />
                        <span>Revenu médian</span>
                    </div>
                    <div
                        className="text-2xl font-bold"
                        style={{ color: getRevenuColor(data.revenu_median) }}
                    >
                        {formatEuros(data.revenu_median)}
                    </div>
                    {data.revenu_moyen && (
                        <div className="text-xs text-gray-500">
                            Moyen : {formatEuros(data.revenu_moyen)}
                        </div>
                    )}
                </div>

                {/* Taux de chômage */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Briefcase className="h-4 w-4" />
                        <span>Taux de chômage</span>
                    </div>
                    <div
                        className="text-2xl font-bold"
                        style={{ color: getChomageColor(data.taux_chomage) }}
                    >
                        {formatPercentage(data.taux_chomage)}
                    </div>
                    {data.taux_activite && (
                        <div className="text-xs text-gray-500">
                            Activité : {formatPercentage(data.taux_activite)}
                        </div>
                    )}
                </div>

                {/* Logement */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Home className="h-4 w-4" />
                        <span>Logements</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                        {formatNumber(data.nombre_logements)}
                    </div>
                    {data.taux_proprietaires && (
                        <div className="text-xs text-gray-500">
                            Propriétaires : {formatPercentage(data.taux_proprietaires)}
                        </div>
                    )}
                </div>
            </div>

            {/* CSP et démographie */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                {/* CSP dominante */}
                {cspDominante && (
                    <div>
                        <div className="text-xs font-medium text-gray-500 uppercase mb-2">
                            CSP Dominante
                        </div>
                        <div className="text-sm font-semibold text-gray-900">
                            {cspDominante}
                        </div>
                    </div>
                )}

                {/* Âge moyen */}
                {data.age_moyen && (
                    <div>
                        <div className="text-xs font-medium text-gray-500 uppercase mb-2">
                            Âge moyen
                        </div>
                        <div className="text-sm font-semibold text-gray-900">
                            {data.age_moyen.toFixed(1)} ans
                        </div>
                    </div>
                )}

                {/* Taux de pauvreté */}
                {data.taux_pauvrete !== undefined && (
                    <div>
                        <div className="text-xs font-medium text-gray-500 uppercase mb-2">
                            Taux de pauvreté
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-gray-900">
                                {formatPercentage(data.taux_pauvrete)}
                            </div>
                            {data.taux_pauvrete > 15 ? (
                                <TrendingUp className="h-4 w-4 text-red-500" />
                            ) : (
                                <TrendingDown className="h-4 w-4 text-green-500" />
                            )}
                        </div>
                    </div>
                )}

                {/* Prix m² moyen */}
                {data.prix_m2_moyen && (
                    <div>
                        <div className="text-xs font-medium text-gray-500 uppercase mb-2">
                            Prix m² moyen
                        </div>
                        <div className="text-sm font-semibold text-gray-900">
                            {formatEuros(data.prix_m2_moyen)}
                        </div>
                    </div>
                )}
            </div>

            {/* Pied de page */}
            <div className="pt-4 border-t text-xs text-gray-400 text-center">
                Source {data.source} • Année de référence {data.annee_reference}
            </div>
        </div>
    )
}

// Composant pour un indicateur simple
interface StatItemProps {
    icon: React.ReactNode
    label: string
    value: string
    color?: string
}

function StatItem({ icon, label, value, color }: StatItemProps) {
    return (
        <div>
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                {icon}
                <span>{label}</span>
            </div>
            <div className="text-sm font-semibold" style={{ color: color || '#111827' }}>
                {value}
            </div>
        </div>
    )
}
