/**
 * Légende dynamique pour les calques INSEE
 * Affiche un dégradé de couleurs avec les valeurs min/max
 */

import { useMemo } from 'react'
import type { InseeIndicator } from '../../types'
import { INDICATOR_SCALES, formatValue } from '../../utils/colorScales'

interface InseeLegendProps {
    indicator: InseeIndicator
    colorScale: string[]
    min: number
    max: number
    position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
}

export default function InseeLegend({
    indicator,
    colorScale,
    min,
    max,
    position = 'bottom-right',
}: InseeLegendProps) {
    const config = INDICATOR_SCALES[indicator]
    const label = config?.label || indicator

    // Générer le dégradé CSS
    const gradient = useMemo(() => {
        return `linear-gradient(to right, ${colorScale.join(', ')})`
    }, [colorScale])

    // Calculer la valeur médiane
    const median = (min + max) / 2

    // Classes de positionnement
    const positionClasses = {
        'bottom-left': 'bottom-4 left-4',
        'bottom-right': 'bottom-4 right-4',
        'top-left': 'top-20 left-4',
        'top-right': 'top-20 right-4',
    }

    return (
        <div
            className={`absolute ${positionClasses[position]} z-[1000] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 min-w-[280px]`}
            style={{ pointerEvents: 'none' }}
        >
            {/* Titre */}
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {label}
            </div>

            {/* Barre de dégradé */}
            <div className="relative">
                <div
                    className="h-4 rounded"
                    style={{ background: gradient }}
                />

                {/* Labels de valeurs */}
                <div className="flex justify-between mt-1 text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-medium">{formatValue(min, indicator)}</span>
                    <span className="text-gray-500 dark:text-gray-500">
                        {formatValue(median, indicator)}
                    </span>
                    <span className="font-medium">{formatValue(max, indicator)}</span>
                </div>
            </div>

            {/* Note */}
            <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-500 italic">
                Données INSEE par commune
            </div>
        </div>
    )
}
