import { useState } from 'react'
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react'
import type { DVFFilters } from '../types'

interface FilterPanelProps {
  filters: DVFFilters
  onFiltersChange: (filters: DVFFilters) => void
  onClose: () => void
}

const TYPE_LOCAL_OPTIONS = [
  { value: '', label: 'Tous les types' },
  { value: 'Maison', label: 'Maison' },
  { value: 'Appartement', label: 'Appartement' },
  { value: 'Local industriel. commercial ou assimile', label: 'Local commercial' },
  { value: 'Dependance', label: 'Dependance' },
]

const CURRENT_YEAR = new Date().getFullYear()

export function FilterPanel({ filters, onFiltersChange, onClose }: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const handleChange = (key: keyof DVFFilters, value: string | number | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value === '' ? undefined : value,
    })
  }

  const handleReset = () => {
    onFiltersChange({})
  }

  const hasFilters = Object.values(filters).some((v) => v !== undefined)

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div
        className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <span className="font-semibold">Filtres DVF</span>
          {hasFilters && (
            <span className="bg-blue-500 text-xs px-2 py-0.5 rounded-full">Actifs</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="p-1 hover:bg-blue-700 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Type de bien */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type de bien
            </label>
            <select
              value={filters.typeLocal || ''}
              onChange={(e) => handleChange('typeLocal', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {TYPE_LOCAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Prix */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prix (EUR)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.prixMin || ''}
                onChange={(e) => handleChange('prixMin', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-1/2 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.prixMax || ''}
                onChange={(e) => handleChange('prixMax', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-1/2 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Surface */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Surface batie (m2)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.surfaceMin || ''}
                onChange={(e) => handleChange('surfaceMin', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-1/2 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.surfaceMax || ''}
                onChange={(e) => handleChange('surfaceMax', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-1/2 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Années */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Periode
            </label>
            <div className="flex gap-2">
              <select
                value={filters.anneeMin || ''}
                onChange={(e) => handleChange('anneeMin', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-1/2 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Depuis</option>
                {Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <select
                value={filters.anneeMax || ''}
                onChange={(e) => handleChange('anneeMax', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-1/2 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Jusqu'a</option>
                {Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          {hasFilters && (
            <button
              onClick={handleReset}
              className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
            >
              Reinitialiser les filtres
            </button>
          )}
        </div>
      )}
    </div>
  )
}
