import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, MapPin, X } from 'lucide-react'
import { searchAddress } from '../api'
import { useDebounce } from '../hooks/useDebounce'
import type { AddressResult } from '../types'

interface SearchBarProps {
  onSelectAddress: (address: AddressResult) => void
}

export function SearchBar({ onSelectAddress }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  const { data: results, isLoading } = useQuery({
    queryKey: ['address-search', debouncedQuery],
    queryFn: () => searchAddress(debouncedQuery),
    enabled: debouncedQuery.length >= 3,
  })

  useEffect(() => {
    if (results && results.length > 0) {
      setIsOpen(true)
    }
  }, [results])

  const handleSelect = (address: AddressResult) => {
    setQuery(address.label)
    setIsOpen(false)
    onSelectAddress(address)
  }

  const handleClear = () => {
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results && results.length > 0 && setIsOpen(true)}
          placeholder="Rechercher une adresse..."
          className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {isOpen && results && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={`${result.label}-${index}`}
              onClick={() => handleSelect(result)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start gap-3 border-b border-gray-100 last:border-b-0"
            >
              <MapPin className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-gray-900">{result.label}</div>
                {result.context && (
                  <div className="text-sm text-gray-500">{result.context}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {isLoading && query.length >= 3 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
          Recherche en cours...
        </div>
      )}
    </div>
  )
}
