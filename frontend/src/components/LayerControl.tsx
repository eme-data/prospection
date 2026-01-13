import { Layers, Map, Home, TrendingUp } from 'lucide-react'
import type { LayerType } from '../types'

interface LayerControlProps {
  activeLayers: Set<LayerType>
  onToggleLayer: (layer: LayerType) => void
}

const layers: { id: LayerType; label: string; icon: typeof Map }[] = [
  { id: 'parcelles', label: 'Parcelles cadastrales', icon: Home },
  { id: 'dvf', label: 'Transactions DVF', icon: TrendingUp },
  { id: 'satellite', label: 'Vue satellite', icon: Map },
]

export function LayerControl({ activeLayers, onToggleLayer }: LayerControlProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-3">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
        <Layers className="h-5 w-5 text-gray-600" />
        <span className="font-medium text-gray-700">Couches</span>
      </div>
      <div className="space-y-2">
        {layers.map(({ id, label, icon: Icon }) => (
          <label
            key={id}
            className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-md"
          >
            <input
              type="checkbox"
              checked={activeLayers.has(id)}
              onChange={() => onToggleLayer(id)}
              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <Icon className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700">{label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
