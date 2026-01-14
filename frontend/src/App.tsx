import { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Filter,
  BarChart3,
  Download,
  AlertTriangle,
  Star,
} from 'lucide-react'
import { SearchBar } from './components/SearchBar'
import { MapView } from './components/MapView'
import { LayerControl } from './components/LayerControl'
import { InfoPanel } from './components/InfoPanel'
import { FilterPanel } from './components/FilterPanel'
import { StatsPanel } from './components/StatsPanel'
import { ExportPanel } from './components/ExportPanel'
import { RiskPanel } from './components/RiskPanel'
import { FavoritesPanel } from './components/FavoritesPanel'
import { getParcelles, getDVFTransactions, reverseGeocode, filterTransactions } from './api'
import type {
  MapViewState,
  LayerType,
  AddressResult,
  Parcelle,
  DVFTransaction,
  DVFFilters,
  FavoriteParcelle,
  GeoJSONFeatureCollection,
} from './types'

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 2.3522,
  latitude: 48.8566,
  zoom: 12,
}

const FAVORITES_STORAGE_KEY = 'prospection-favorites'

function App() {
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE)
  const [activeLayers, setActiveLayers] = useState<Set<LayerType>>(
    new Set(['parcelles', 'dvf'])
  )
  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null)
  const [selectedParcelle, setSelectedParcelle] = useState<Parcelle | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<DVFTransaction | null>(null)
  const [currentCodeInsee, setCurrentCodeInsee] = useState<string | null>(null)

  // Nouveaux états pour les fonctionnalités avancées
  const [filters, setFilters] = useState<DVFFilters>({})
  const [showFilters, setShowFilters] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showRisks, setShowRisks] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)
  const [favorites, setFavorites] = useState<FavoriteParcelle[]>(() => {
    const saved = localStorage.getItem(FAVORITES_STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })

  // Sauvegarde des favoris dans localStorage
  useEffect(() => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites))
  }, [favorites])

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
    staleTime: 10 * 60 * 1000,
  })

  // Récupération des transactions DVF
  const { data: rawTransactions } = useQuery({
    queryKey: ['dvf', currentCodeInsee],
    queryFn: () => getDVFTransactions({ codeInsee: currentCodeInsee! }),
    enabled: !!currentCodeInsee && activeLayers.has('dvf'),
    staleTime: 10 * 60 * 1000,
  })

  // Filtrage des transactions
  const transactions: GeoJSONFeatureCollection<DVFTransaction> | null = rawTransactions
    ? {
        ...rawTransactions,
        features: filterTransactions(rawTransactions.features, filters),
      }
    : null

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

  // Gestion des favoris
  const handleAddFavorite = useCallback((parcelle: Parcelle) => {
    const newFavorite: FavoriteParcelle = {
      id: parcelle.properties.id,
      parcelle,
      addedAt: new Date().toISOString(),
    }
    setFavorites((prev) => {
      if (prev.some((f) => f.id === parcelle.properties.id)) {
        return prev
      }
      return [...prev, newFavorite]
    })
  }, [])

  const handleRemoveFavorite = useCallback((id: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const handleUpdateFavoriteNote = useCallback((id: string, note: string) => {
    setFavorites((prev) =>
      prev.map((f) => (f.id === id ? { ...f, note } : f))
    )
  }, [])

  const handleSelectFavorite = useCallback((favorite: FavoriteParcelle) => {
    setSelectedParcelle(favorite.parcelle)
    // Centrer sur la parcelle
    const coords = favorite.parcelle.geometry.coordinates
    if (coords && coords[0]) {
      const firstCoord = Array.isArray(coords[0][0]) ? coords[0][0] : coords[0]
      if (Array.isArray(firstCoord) && firstCoord.length >= 2) {
        setViewState({
          longitude: firstCoord[0] as number,
          latitude: firstCoord[1] as number,
          zoom: 18,
        })
      }
    }
    setShowFavorites(false)
  }, [])

  const isParcelleInFavorites = selectedParcelle
    ? favorites.some((f) => f.id === selectedParcelle.properties.id)
    : false

  // Nombre de filtres actifs
  const activeFiltersCount = Object.values(filters).filter((v) => v !== undefined).length

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 z-10">
        <h1 className="text-xl font-bold text-gray-800 whitespace-nowrap">
          Prospection Fonciere
        </h1>
        <SearchBar onSelectAddress={handleSelectAddress} />

        {/* Boutons d'action */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors relative ${
              showFilters || activeFiltersCount > 0
                ? 'bg-blue-100 text-blue-600'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="Filtres"
          >
            <Filter className="h-5 w-5" />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowStats(!showStats)}
            className={`p-2 rounded-lg transition-colors ${
              showStats ? 'bg-green-100 text-green-600' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="Statistiques"
            disabled={!currentCodeInsee}
          >
            <BarChart3 className="h-5 w-5" />
          </button>

          <button
            onClick={() => setShowRisks(!showRisks)}
            className={`p-2 rounded-lg transition-colors ${
              showRisks ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="Risques & PLU"
            disabled={!currentCodeInsee}
          >
            <AlertTriangle className="h-5 w-5" />
          </button>

          <button
            onClick={() => setShowExport(!showExport)}
            className={`p-2 rounded-lg transition-colors ${
              showExport ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="Exporter"
            disabled={!currentCodeInsee}
          >
            <Download className="h-5 w-5" />
          </button>

          <button
            onClick={() => setShowFavorites(!showFavorites)}
            className={`p-2 rounded-lg transition-colors relative ${
              showFavorites ? 'bg-yellow-100 text-yellow-600' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="Favoris"
          >
            <Star className="h-5 w-5" />
            {favorites.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                {favorites.length}
              </span>
            )}
          </button>
        </div>

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
          transactions={transactions}
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

        {/* Panneaux latéraux droite */}
        <div className="absolute top-4 right-4 z-10 space-y-4 max-w-sm">
          {showFilters && (
            <FilterPanel
              filters={filters}
              onFiltersChange={setFilters}
              onClose={() => setShowFilters(false)}
            />
          )}

          {showStats && currentCodeInsee && (
            <StatsPanel
              codeInsee={currentCodeInsee}
              filters={filters}
              onClose={() => setShowStats(false)}
            />
          )}

          {showRisks && currentCodeInsee && (
            <RiskPanel
              codeInsee={currentCodeInsee}
              longitude={viewState.longitude}
              latitude={viewState.latitude}
              onClose={() => setShowRisks(false)}
            />
          )}

          {showExport && currentCodeInsee && (
            <ExportPanel
              codeInsee={currentCodeInsee}
              filters={filters}
              onClose={() => setShowExport(false)}
            />
          )}

          {showFavorites && (
            <FavoritesPanel
              favorites={favorites}
              onRemove={handleRemoveFavorite}
              onSelect={handleSelectFavorite}
              onUpdateNote={handleUpdateFavoriteNote}
              onClose={() => setShowFavorites(false)}
            />
          )}
        </div>

        {/* Info panel avec bouton favoris */}
        {(selectedParcelle || selectedTransaction) && (
          <div className="absolute bottom-4 left-4 z-10">
            <div className="relative">
              <InfoPanel
                parcelle={selectedParcelle}
                transaction={selectedTransaction}
                onClose={handleCloseInfoPanel}
              />
              {selectedParcelle && (
                <button
                  onClick={() =>
                    isParcelleInFavorites
                      ? handleRemoveFavorite(selectedParcelle.properties.id)
                      : handleAddFavorite(selectedParcelle)
                  }
                  className={`absolute top-3 right-12 p-1.5 rounded transition-colors ${
                    isParcelleInFavorites
                      ? 'text-yellow-500 bg-yellow-50'
                      : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                  }`}
                  title={isParcelleInFavorites ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  <Star className={`h-5 w-5 ${isParcelleInFavorites ? 'fill-current' : ''}`} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Zoom indicator */}
        {viewState.zoom < 15 && activeLayers.has('parcelles') && (
          <div className="absolute bottom-4 right-4 z-10 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg shadow-lg text-sm">
            Zoomez pour voir les parcelles cadastrales (zoom {viewState.zoom.toFixed(0)}/15)
          </div>
        )}

        {/* Current commune indicator */}
        {currentCodeInsee && (
          <div className="absolute bottom-4 right-4 z-10 bg-white px-3 py-1.5 rounded-lg shadow text-sm text-gray-700">
            Code INSEE: {currentCodeInsee}
            {transactions && (
              <span className="ml-2 text-blue-600">
                ({transactions.features.length} transactions)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
