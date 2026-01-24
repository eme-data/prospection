/**
 * Tooltip interactif pour afficher les données INSEE au survol d'une commune
 */

import { TrendingUp, Users, Home, Briefcase } from 'lucide-react'
import type { InseeData, InseeIndicator } from '../../types'
import { formatValue, INDICATOR_SCALES } from '../../utils/colorScales'

interface InseeTooltipProps {
    data: InseeData
    indicator: InseeIndicator
    position: { x: number; y: number }
}

export default function InseeTooltip({ data, indicator, position }: InseeTooltipProps) {
    const indicatorConfig = INDICATOR_SCALES[indicator]
    const indicatorValue = data[indicator]

    // Indicateurs clés à afficher
    const keyIndicators = [
        {
            icon: TrendingUp,
            label: 'Revenu médian',
            value: data.revenu_median ? formatValue(data.revenu_median, 'revenu_median') : 'N/A',
            show: indicator !== 'revenu_median',
        },
        {
            icon: Briefcase,
            label: 'Taux de chômage',
            value: data.taux_chomage ? formatValue(data.taux_chomage, 'taux_chomage') : 'N/A',
            show: indicator !== 'taux_chomage',
        },
        {
            icon: Users,
            label: 'Population',
            value: data.population ? formatValue(data.population, 'population') : 'N/A',
            show: indicator !== 'population',
        },
        {
            icon: Home,
            label: 'Propriétaires',
            value: data.taux_proprietaires ? formatValue(data.taux_proprietaires, 'taux_proprietaires') : 'N/A',
            show: indicator !== 'taux_proprietaires',
        },
    ].filter(i => i.show).slice(0, 2) // Afficher max 2 indicateurs supplémentaires

    return (
        <div
            className="fixed z-[10000] pointer-events-none"
            style={{
                left: `${position.x + 15}px`,
                top: `${position.y}px`,
            }}
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[240px] max-w-[300px]">
                {/* Nom de la commune */}
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">
                    {data.nom_commune}
                </h3>

                {/* Indicateur principal */}
                <div className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {indicatorConfig?.label || indicator}
                    </div>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {typeof indicatorValue === 'number'
                            ? formatValue(indicatorValue, indicator)
                            : 'N/A'}
                    </div>
                </div>

                {/* Indicateurs supplémentaires */}
                {keyIndicators.length > 0 && (
                    <div className="space-y-1.5">
                        {keyIndicators.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                                <item.icon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                <span className="text-gray-600 dark:text-gray-400 flex-1">
                                    {item.label}
                                </span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                    {item.value}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Note */}
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-600">
                    Code INSEE: {data.code_commune}
                </div>
            </div>
        </div>
    )
}
