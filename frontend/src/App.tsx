import { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchBar } from './components/SearchBar'
import { MapView } from './components/MapView'
import { LayerControl } from './components/LayerControl'
import { InfoPanel } from './components/InfoPanel'
import { getParcelles, getDVFTransactions, reverseGeocode } from './api'
import type { MapViewState, LayerType, AddressResult, Parcelle, DVFTransaction } from './types'

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 2.3522,
  latitude: 48.8566,
  zoom: 12,
}

function App() {
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE)
  const [activeLayers, setActiveLayers] = useState<Set<LayerType>>(
    new Set(['parcelles', 'dvf'])
  )
  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null)
  const [selectedParcelle, setSelectedParcelle] = useState<Parcelle | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<DVFTransaction | null>(null)
  const [currentCodeInsee, setCurrentCodeInsee] = useState<string | null>(null)

  // Récupération du code INSEE quand la vue change
  useEffect(() => {
    const fetchCodeInsee = async () => {
      if (viewState.zoom < 13) {
        setCurrentCodeInsee(null)
        return
      }

      try {
        const result = await reverseGeocode(viewState.longitude, viewState.latitude)
        if (result?.citycode) {
          setCurrentCodeInsee(result.citycode)
        }
      } catch {
        // Silently ignore geocoding errors
      }
    }

    const timer = setTimeout(fetchCodeInsee, 500)
    return () => clearTimeout(timer)
  }, [viewState.longitude, viewState.latitude, viewState.zoom])

  // Récupération des parcelles cadastrales
  const { data: parcelles } = useQuery({
    queryKey: ['parcelles', currentCodeInsee],
    queryFn: () => getParcelles(currentCodeInsee!),
    enabled: !!currentCodeInsee && activeLayers.has('parcelles') && viewState.zoom >= 15,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Récupération des transactions DVF
  const { data: transactions } = useQuery({
    queryKey: ['dvf', currentCodeInsee],
    queryFn: () => getDVFTransactions({ codeInsee: currentCodeInsee! }),
    enabled: !!currentCodeInsee && activeLayers.has('dvf'),
    staleTime: 10 * 60 * 1000,
  })

  const handleSelectAddress = useCallback((address: AddressResult) => {
    setSelectedAddress(address)
    setViewState({
      longitude: address.longitude,
      latitude: address.latitude,
      zoom: 17,
    })
    if (address.citycode) {
      setCurrentCodeInsee(address.citycode)
    }
  }, [])

  const handleToggleLayer = useCallback((layer: LayerType) => {
    setActiveLayers((prev) => {
      const next = new Set(prev)
      if (next.has(layer)) {
        next.delete(layer)
      } else {
        next.add(layer)
      }
      return next
    })
  }, [])

  const handleCloseInfoPanel = useCallback(() => {
    setSelectedParcelle(null)
    setSelectedTransaction(null)
  }, [])

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 z-10">
        <h1 className="text-xl font-bold text-gray-800 whitespace-nowrap">
          Prospection Fonciere
        </h1>
        <SearchBar onSelectAddress={handleSelectAddress} />
        <div className="flex-1" />
        {selectedAddress && (
          <div className="text-sm text-gray-500 hidden md:block">
            {selectedAddress.city} ({selectedAddress.postcode})
          </div>
        )}
      </header>

      {/* Main content */}
      <div className="flex-1 relative">
        <MapView
          viewState={viewState}
          onViewStateChange={setViewState}
          activeLayers={activeLayers}
          parcelles={parcelles ?? null}
          transactions={transactions ?? null}
          onSelectParcelle={setSelectedParcelle}
          onSelectTransaction={setSelectedTransaction}
        />

        {/* Layer control */}
        <div className="absolute top-4 left-4 z-10">
          <LayerControl
            activeLayers={activeLayers}
            onToggleLayer={handleToggleLayer}
          />
        </div>

        {/* Info panel */}
        {(selectedParcelle || selectedTransaction) && (
          <div className="absolute bottom-4 left-4 z-10">
            <InfoPanel
              parcelle={selectedParcelle}
              transaction={selectedTransaction}
              onClose={handleCloseInfoPanel}
            />
          </div>
        )}

        {/* Zoom indicator */}
        {viewState.zoom < 15 && activeLayers.has('parcelles') && (
          <div className="absolute bottom-4 right-4 z-10 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg shadow-lg text-sm">
            Zoomez pour voir les parcelles cadastrales (zoom {viewState.zoom.toFixed(0)}/15)
          </div>
        )}

        {/* Loading indicator for INSEE code */}
        {viewState.zoom >= 13 && !currentCodeInsee && (
          <div className="absolute top-4 right-20 z-10 bg-white px-3 py-1.5 rounded-lg shadow text-sm text-gray-500">
            Chargement...
          </div>
        )}

        {/* Current commune indicator */}
        {currentCodeInsee && (
          <div className="absolute top-4 right-20 z-10 bg-white px-3 py-1.5 rounded-lg shadow text-sm text-gray-700">
            Code INSEE: {currentCodeInsee}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
