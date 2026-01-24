/**
 * Panneau de contrôle des calques socio-économiques INSEE
 */

import { useState } from 'react'
import { Layers, ChevronDown, ChevronUp, Info, Eye, EyeOff } from 'lucide-react'
import type { InseeLayerConfig, InseeIndicator } from '../types'

interface InseeLayersPanelProps {
    config: InseeLayerConfig
    onConfigChange: (config: InseeLayerConfig) => void
    onClose?: () => void
}

const INDICATORS: Array<{ value: InseeIndicator; label: string; description: string }> = [
    {
        value: 'revenu_median',
        label: 'Revenu médian',
        description: 'Revenu médian par unité de consommation'
    },
    {
        value: 'taux_chomage',
        label: 'Taux de chômage',
        description: 'Pourcentage de la population active au chômage'
    },
    {
        value: 'densite',
        label: 'Densité de population',
        description: 'Nombre d\'habitants par km²'
    },
    {
        value: 'population',
        label: 'Population',
        description: 'Nombre total d\'habitants'
    },
    {
        value: 'taux_proprietaires',
        label: 'Taux de propriétaires',
        description: 'Pourcentage de ménages propriétaires'
    },
    {
        value: 'revenu_moyen',
        label: 'Revenu moyen',
        description: 'Revenu moyen par unité de consommation'
    },
    {
        value: 'taux_pauvrete',
        label: 'Taux de pauvreté',
        description: 'Pourcentage de la population sous le seuil de pauvreté'
    },
]

const COLOR_SCALES: Array<{ name: string; colors: string[], description: string }> = [
    {
        name: 'Vert-Rouge',
        colors: ['#10b981', '#84cc16', '#fbbf24', '#fb923c', '#ef4444'],
        description: 'Du meilleur au moins bon'
    },
    {
        name: 'Bleu',
        colors: ['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8'],
        description: 'Intensité croissante'
    },
    {
        name: 'Rouge',
        colors: ['#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#dc2626'],
        description: 'Intensité croissante'
    },
    {
        name: 'Arc-en-ciel',
        colors: ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'],
        description: 'Multi-couleurs'
    },
]

export default function InseeLayersPanel({ config, onConfigChange, onClose }: InseeLayersPanelProps) {
    const [expanded, setExpanded] = useState(true)
    const [showAdvanced, setShowAdvanced] = useState(false)

    const currentIndicator = INDICATORS.find(ind => ind.value === config.indicator)
    const currentColorScale = COLOR_SCALES.find(scale =>
        JSON.stringify(scale.colors) === JSON.stringify(config.colorScale)
    ) || COLOR_SCALES[0]

    return (
        <div className="bg-white rounded-lg shadow-lg w-80 overflow-hidden">
            {/* En-tête */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5" />
                        <h3 className="font-semibold">Calques INSEE</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="p-1 hover:bg-white/20 rounded transition-colors"
                            aria-label={expanded ? 'Réduire' : 'Développer'}
                        >
                            {expanded ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-white/20 rounded transition-colors"
                                aria-label="Fermer"
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {expanded && (
                <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                    {/* Toggle visibilité */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">
                            Afficher le calque
                        </span>
                        <button
                            onClick={() => onConfigChange({ ...config, visible: !config.visible })}
                            className={`p-2 rounded-lg transition-colors ${config.visible
                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                }`}
                            aria-label={config.visible ? 'Masquer' : 'Afficher'}
                        >
                            {config.visible ? (
                                <Eye className="h-4 w-4" />
                            ) : (
                                <EyeOff className="h-4 w-4" />
                            )}
                        </button>
                    </div>

                    {/* Sélection de l'indicateur */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Indicateur
                        </label>
                        <select
                            value={config.indicator}
                            onChange={(e) => onConfigChange({
                                ...config,
                                indicator: e.target.value as InseeIndicator
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                            {INDICATORS.map(ind => (
                                <option key={ind.value} value={ind.value}>
                                    {ind.label}
                                </option>
                            ))}
                        </select>
                        {currentIndicator && (
                            <p className="text-xs text-gray-500 flex items-start gap-1">
                                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                <span>{currentIndicator.description}</span>
                            </p>
                        )}
                    </div>

                    {/* Échelle de couleurs */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Palette de couleurs
                        </label>
                        <div className="space-y-2">
                            {COLOR_SCALES.map(scale => (
                                <button
                                    key={scale.name}
                                    onClick={() => onConfigChange({ ...config, colorScale: scale.colors })}
                                    className={`w-full p-3 rounded-lg border-2 transition-all ${currentColorScale.name === scale.name
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-900">
                                            {scale.name}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {scale.description}
                                        </span>
                                    </div>
                                    <div className="flex gap-1 h-6">
                                        {scale.colors.map((color, idx) => (
                                            <div
                                                key={idx}
                                                className="flex-1 rounded"
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Opacité */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-700">
                                Opacité
                            </label>
                            <span className="text-sm text-gray-500">
                                {Math.round(config.opacity * 100)}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={config.opacity}
                            onChange={(e) => onConfigChange({
                                ...config,
                                opacity: parseFloat(e.target.value)
                            })}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    {/* Options avancées */}
                    <div className="border-t pt-4">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900"
                        >
                            <span>Options avancées</span>
                            {showAdvanced ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </button>

                        {showAdvanced && (
                            <div className="mt-4 space-y-3">
                                {/* Type de calque */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">
                                        Type de calque
                                    </label>
                                    <select
                                        value={config.type}
                                        onChange={(e) => onConfigChange({
                                            ...config,
                                            type: e.target.value as any
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                    >
                                        <option value="choropleth">Carte choroplèthe</option>
                                        <option value="heatmap">Carte de chaleur</option>
                                        <option value="proportional">Cercles proportionnels</option>
                                        <option value="categorical">Catégoriel</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Légende */}
                    <div className="border-t pt-4">
                        <div className="text-sm font-medium text-gray-700 mb-3">
                            Légende
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-gray-600">
                                <span>Valeur faible</span>
                                <span>Valeur élevée</span>
                            </div>
                            <div className="flex h-6 rounded overflow-hidden">
                                {config.colorScale.map((color, idx) => (
                                    <div
                                        key={idx}
                                        className="flex-1"
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
