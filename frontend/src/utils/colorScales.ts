/**
 * Échelles de couleurs pour les calques INSEE
 * Fournit des palettes prédéfinies et des fonctions d'interpolation
 */

export type ColorScale = string[]

/**
 * Palettes de couleurs prédéfinies
 */
export const COLOR_SCALES = {
    // Vert (bon) -> Rouge (mauvais) - Pour revenus, emploi
    greenRed: ['#10b981', '#84cc16', '#fbbf24', '#fb923c', '#ef4444'],

    // Rouge (mauvais) -> Vert (bon) - Pour chômage, pauvreté
    redGreen: ['#ef4444', '#fb923c', '#fbbf24', '#84cc16', '#10b981'],

    // Bleu clair -> Bleu foncé - Pour densité, population
    blueScale: ['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8'],

    // Violet clair -> Violet foncé
    purpleScale: ['#f3e8ff', '#d8b4fe', '#c084fc', '#a855f7', '#7e22ce'],

    // Arc-en-ciel
    rainbow: ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'],

    // Palette accessible (daltonisme)
    accessible: ['#0173b2', '#029e73', '#fbdd85', '#cc78bc', '#ca9161'],
} as const

/**
 * Configuration des échelles par indicateur
 */
export const INDICATOR_SCALES: Record<string, {
    scale: ColorScale
    reverse?: boolean
    label: string
    unit?: string
}> = {
    revenu_median: {
        scale: COLOR_SCALES.greenRed,
        label: 'Revenu médian',
        unit: '€',
    },
    revenu_moyen: {
        scale: COLOR_SCALES.greenRed,
        label: 'Revenu moyen',
        unit: '€',
    },
    taux_chomage: {
        scale: COLOR_SCALES.redGreen,
        label: 'Taux de chômage',
        unit: '%',
    },
    taux_pauvrete: {
        scale: COLOR_SCALES.redGreen,
        label: 'Taux de pauvreté',
        unit: '%',
    },
    densite: {
        scale: COLOR_SCALES.blueScale,
        label: 'Densité de population',
        unit: 'hab/km²',
    },
    population: {
        scale: COLOR_SCALES.purpleScale,
        label: 'Population',
        unit: 'habitants',
    },
    taux_proprietaires: {
        scale: COLOR_SCALES.greenRed,
        label: 'Taux de propriétaires',
        unit: '%',
    },
}

/**
 * Interpoler une valeur dans une échelle de couleurs
 */
export function interpolateColor(
    value: number,
    min: number,
    max: number,
    colorScale: ColorScale
): string {
    // Normaliser la valeur entre 0 et 1
    const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)))

    // Déterminer l'index dans l'échelle
    const index = normalized * (colorScale.length - 1)
    const lowerIndex = Math.floor(index)
    const upperIndex = Math.ceil(index)

    // Si on tombe pile sur une couleur
    if (lowerIndex === upperIndex) {
        return colorScale[lowerIndex]
    }

    // Interpoler entre deux couleurs
    const lowerColor = hexToRgb(colorScale[lowerIndex])
    const upperColor = hexToRgb(colorScale[upperIndex])
    const factor = index - lowerIndex

    const r = Math.round(lowerColor.r + (upperColor.r - lowerColor.r) * factor)
    const g = Math.round(lowerColor.g + (upperColor.g - lowerColor.g) * factor)
    const b = Math.round(lowerColor.b + (upperColor.b - lowerColor.b) * factor)

    return rgbToHex(r, g, b)
}

/**
 * Obtenir la couleur pour une valeur donnée d'un indicateur
 */
export function getIndicatorColor(
    indicator: string,
    value: number,
    min: number,
    max: number
): string {
    const config = INDICATOR_SCALES[indicator]
    if (!config) {
        // Échelle par défaut
        return interpolateColor(value, min, max, COLOR_SCALES.blueScale)
    }

    return interpolateColor(value, min, max, config.scale)
}

/**
 * Obtenir une palette de couleurs discrètes (pour légendes)
 */
export function getDiscreteColors(
    colorScale: ColorScale,
    steps: number
): string[] {
    const colors: string[] = []

    for (let i = 0; i < steps; i++) {
        const normalized = i / (steps - 1)
        const index = normalized * (colorScale.length - 1)
        const lowerIndex = Math.floor(index)
        const upperIndex = Math.ceil(index)

        if (lowerIndex === upperIndex) {
            colors.push(colorScale[lowerIndex])
        } else {
            const lowerColor = hexToRgb(colorScale[lowerIndex])
            const upperColor = hexToRgb(colorScale[upperIndex])
            const factor = index - lowerIndex

            const r = Math.round(lowerColor.r + (upperColor.r - lowerColor.r) * factor)
            const g = Math.round(lowerColor.g + (upperColor.g - lowerColor.g) * factor)
            const b = Math.round(lowerColor.b + (upperColor.b - lowerColor.b) * factor)

            colors.push(rgbToHex(r, g, b))
        }
    }

    return colors
}

/**
 * Convertir hex en RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) {
        throw new Error(`Invalid hex color: ${hex}`)
    }

    return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
    }
}

/**
 * Convertir RGB en hex
 */
function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16)
        return hex.length === 1 ? '0' + hex : hex
    }).join('')
}

/**
 * Obtenir les valeurs min/max pour un indicateur depuis un dataset
 */
export function getMinMax(
    data: Array<Record<string, any>>,
    indicator: string
): { min: number; max: number } {
    const values = data
        .map(d => d[indicator])
        .filter(v => typeof v === 'number' && !isNaN(v))

    if (values.length === 0) {
        return { min: 0, max: 100 }
    }

    return {
        min: Math.min(...values),
        max: Math.max(...values),
    }
}

/**
 * Formater une valeur avec son unité
 */
export function formatValue(value: number, indicator: string): string {
    const config = INDICATOR_SCALES[indicator]
    const unit = config?.unit || ''

    // Formatage selon le type de valeur
    if (unit === '€') {
        return `${Math.round(value).toLocaleString('fr-FR')} €`
    } else if (unit === '%') {
        return `${value.toFixed(1)} %`
    } else if (unit === 'habitants' || unit === 'hab/km²') {
        return `${Math.round(value).toLocaleString('fr-FR')} ${unit}`
    }

    return `${value.toFixed(1)} ${unit}`.trim()
}
