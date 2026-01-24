/**
 * Panel de contrôle pour les zones isochrones
 */

import { useState } from 'react'
import { MapPin, X, Car, Bike, Navigation } from 'lucide-react'
import { useIsochroneProfiles } from '../hooks/useIsochrones'

interface IsochronePanelProps {
    isOpen: boolean
    onClose: () => void
    onCalculate: (profile: string, ranges: number[]) => void
    isActive: boolean
    onToggleActive: () => void
}

const DEFAULT_RANGES = [300, 600, 900, 1800] // 5, 10, 15, 30 min

const RANGE_OPTIONS = [
    { value: 300, label: '5 min' },
    { value: 600, label: '10 min' },
    { value: 900, label: '15 min' },
    { value: 1800, label: '30 min' },
    { value: 2700, label: '45 min' },
    { value: 3600, label: '60 min' },
]

const ICON_MAP: Record<string, any> = {
    'driving-car': Car,
    'cycling-regular': Bike,
    'foot-walking': Navigation,
}

export function IsochronePanel({
    isOpen,
    onClose,
    onCalculate,
    isActive,
    onToggleActive
}: IsochronePanelProps) {
    const { data: profilesData } = useIsochroneProfiles()
    const [selectedProfile, setSelectedProfile] = useState('driving-car')
    const [selectedRanges, setSelectedRanges] = useState<number[]>(DEFAULT_RANGES)

    if (!isOpen) return null

    const profiles = profilesData?.profiles || []

    const handleRangeToggle = (range: number) => {
        setSelectedRanges(prev =>
            prev.includes(range)
                ? prev.filter(r => r !== range)
                : [...prev, range].sort((a, b) => a - b)
        )
    }

    const handleProfileChange = (profileId: string) => {
        setSelectedProfile(profileId)
        if (isActive) {
            onCalculate(profileId, selectedRanges)
        }
    }

    const handleRangesChange = () => {
        if (isActive && selectedRanges.length > 0) {
            onCalculate(selectedProfile, selectedRanges)
        }
    }

    const getColorForRange = (range: number) => {
        if (range <= 300) return 'bg-green-500'
        if (range <= 600) return 'bg-yellow-500'
        if (range <= 900) return 'bg-orange-500'
        if (range <= 1800) return 'bg-red-500'
        if (range <= 2700) return 'bg-red-600'
        return 'bg-red-700'
    }

    return (
        <div className="absolute top-20 right-4 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-20">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-purple-600" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                        Zones de Chalandise
                    </h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {/* Toggle activation */}
                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {isActive ? '✨ Cliquez sur la carte' : 'Mode isochrones'}
                    </span>
                    <button
                        onClick={onToggleActive}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive
                                ? 'bg-purple-600'
                                : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>

                {/* Mode de transport */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Mode de transport
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {profiles.map((profile) => {
                            const Icon = ICON_MAP[profile.id] || MapPin
                            const isSelected = selectedProfile === profile.id

                            return (
                                <button
                                    key={profile.id}
                                    onClick={() => handleProfileChange(profile.id)}
                                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${isSelected
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                                        }`}
                                >
                                    <Icon className={`h-5 w-5 ${isSelected ? 'text-purple-600' : 'text-gray-600 dark:text-gray-400'
                                        }`} />
                                    <span className="text-xs font-medium">{profile.name}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Durées */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Durées (sélection multiple)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {RANGE_OPTIONS.map((option) => {
                            const isSelected = selectedRanges.includes(option.value)

                            return (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        handleRangeToggle(option.value)
                                        setTimeout(handleRangesChange, 0)
                                    }}
                                    className={`flex items-center justify-center gap-2 p-2 rounded-lg border-2 transition-all ${isSelected
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                                        }`}
                                >
                                    <div className={`w-3 h-3 rounded ${getColorForRange(option.value)}`} />
                                    <span className="text-sm font-medium">{option.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Instructions */}
                {isActive && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                            💡 Cliquez sur la carte pour calculer les zones accessibles
                        </p>
                    </div>
                )}

                {/* Légende */}
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        🌍 Données OpenRouteService
                    </p>
                </div>
            </div>
        </div>
    )
}
