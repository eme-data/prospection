/**
 * Panneau de contrôle des calques économiques
 */

import { useState } from 'react'
import { TrendingUp, DollarSign, BarChart3, X } from 'lucide-react'
import { LoadingSpinner } from './LoadingSpinner'

interface EconomicLayersPanelProps {
    isOpen: boolean
    onClose: () => void
    onLayerToggle: (layerId: string, enabled: boolean) => void
}

export function EconomicLayersPanel({
    isOpen,
    onClose,
    onLayerToggle,
}: EconomicLayersPanelProps) {
    const [activeLayer, setActiveLayer] = useState<string | null>(null)
    const [granularity, setGranularity] = useState(200)
    const [opacity, setOpacity] = useState(0.6)

    const layers = [
        {
            id: 'prix-m2',
            name: 'Prix au m²',
            icon: DollarSign,
            description: 'Heatmap des prix moyens par zone',
            color: 'text-green-600',
        },
        {
            id: 'evolution-prix',
            name: 'Évolution des prix',
            icon: TrendingUp,
            description: 'Tendance sur 5 ans',
            color: 'text-blue-600',
        },
        {
            id: 'volume-transactions',
            name: 'Volume de transactions',
            icon: BarChart3,
            description: 'Densité de transactions',
            color: 'text-purple-600',
        },
    ]

    const handleLayerToggle = (layerId: string) => {
        const newState = activeLayer === layerId ? null : layerId
        setActiveLayer(newState)
        onLayerToggle(layerId, newState !== null)
    }

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed top-0 right-0 bottom-0 w-96 bg-white dark:bg-gray-900 
        shadow-2xl z-50 flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b 
          border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg 
              flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Calques Économiques
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Données DVF
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Layers List */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Calques disponibles
                        </h3>

                        {layers.map((layer) => {
                            const Icon = layer.icon
                            const isActive = activeLayer === layer.id

                            return (
                                <button
                                    key={layer.id}
                                    onClick={() => handleLayerToggle(layer.id)}
                                    className={`
                    w-full p-4 rounded-lg border-2 transition-all text-left
                    ${isActive
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }
                  `}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-0.5 ${layer.color}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900 dark:text-white">
                                                {layer.name}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                                {layer.description}
                                            </div>
                                            {isActive && (
                                                <div className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                                                    ✓ Activé
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    {/* Controls */}
                    {activeLayer === 'prix-m2' && (
                        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Paramètres
                            </h3>

                            {/* Granularité */}
                            <div>
                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                                    Granularité: {granularity}m
                                </label>
                                <input
                                    type="range"
                                    min="100"
                                    max="1000"
                                    step="50"
                                    value={granularity}
                                    onChange={(e) => setGranularity(Number(e.target.value))}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Précis</span>
                                    <span>Large</span>
                                </div>
                            </div>

                            {/* Opacité */}
                            <div>
                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                                    Opacité: {Math.round(opacity * 100)}%
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={opacity}
                                    onChange={(e) => setOpacity(Number(e.target.value))}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    )}

                    {/* Info Box */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 
            dark:border-blue-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className="text-blue-600 dark:text-blue-400 mt-0.5">
                                ℹ️
                            </div>
                            <div className="text-sm text-blue-900 dark:text-blue-100">
                                <p className="font-medium mb-1">Données DVF</p>
                                <p className="text-blue-700 dark:text-blue-300">
                                    Basé sur les transactions immobilières (Demandes de Valeurs Foncières)
                                    des 5 dernières années.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                {activeLayer && (
                    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
                        <button
                            onClick={() => handleLayerToggle(activeLayer)}
                            className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 
                dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
                        >
                            Désactiver le calque
                        </button>
                    </div>
                )}
            </div>
        </>
    )
}
