import { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Filter,
  FolderOpen,
  Award,
  Download,
  AlertTriangle,
  Star,
  Clock,
  Bell,
  FileText,
  Moon,
  Sun,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { SearchBar } from './SearchBar'
import { MapView } from './MapView'
import { LayerControl } from './LayerControl'
import { InfoPanel } from './InfoPanel'
import { FilterPanel } from './FilterPanel'
import { ExportPanel } from './ExportPanel'
import { RiskPanel } from './RiskPanel'
import { FavoritesPanel } from './FavoritesPanel'
import { ProjectsPanel } from './ProjectsPanel'
import { Top10Panel } from './Top10Panel'
import { HistoryPanel } from './HistoryPanel'
import { ReportGenerator } from './ReportGenerator'
import { RappelsPanel } from './RappelsPanel'
import { FeasibilityReport } from './FeasibilityReport'
import { ProspectionPanel } from './ProspectionPanel'
import { getParcelles, getDVFTransactions, reverseGeocode, filterTransactions, searchParcelles, getFaisabiliteReport } from '../api'
import type {
  MapViewState,
  LayerType,
  AddressResult,
  Parcelle,
  DVFTransaction,
  DVFFilters,
  FavoriteParcelle,
  GeoJSONFeatureCollection,
  Project,
  SearchHistory,
  FaisabiliteReport as FaisabiliteReportType,
} from '../types'

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 2.3522,
  latitude: 48.8566,
  zoom: 12,
}

import { useNavigate } from 'react-router-dom'
import { Home } from 'lucide-react'

const FAVORITES_STORAGE_KEY = 'prospection-favorites'
const PROJECTS_STORAGE_KEY = 'prospection-projects'
const HISTORY_STORAGE_KEY = 'prospection-history'

export function FaisabiliteApp() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
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
  const [showExport, setShowExport] = useState(false)
  const [showRisks, setShowRisks] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)
  const [favorites, setFavorites] = useState<FavoriteParcelle[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('Failed to load favorites:', error)
      return []
    }
  })

  // Nouveaux états pour les fonctionnalités avancées
  const [showProjects, setShowProjects] = useState(false)
  const [showTop10, setShowTop10] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showReportGenerator, setShowReportGenerator] = useState(false)
  const [showRappels, setShowRappels] = useState(false)
  const [feasibilityReport, setFeasibilityReport] = useState<FaisabiliteReportType | null>(null)
  const [showProspection, setShowProspection] = useState(false)

  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(PROJECTS_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('Failed to load projects:', error)
      return []
    }
  })
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('Failed to load history:', error)
      return []
    }
  })

  // Sauvegarde de l'historique
  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(searchHistory))
  }, [searchHistory])

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

  // Récupération des parcelles (Standard ou Recherche Avancée)
  const { data: parcellesData } = useQuery({
    queryKey: ['parcelles', currentCodeInsee, filters], // Ajouter filters aux dépendances
    queryFn: async () => {
      if (!currentCodeInsee) return null

      // Vérifier si on doit utiliser la recherche avancée
      const hasAdvancedFilters =
        filters.zoneTypes?.length ||
        filters.surfaceParcelleMin ||
        filters.surfaceParcelleMax ||
        filters.section

      if (hasAdvancedFilters) {
        const result = await searchParcelles(currentCodeInsee, filters)
        // searchParcelles retourne { parcelles: [...], facettes: ... }
        // On doit adapter pour retourner un GeoJSONFeatureCollection comme attendu par MapView
        return {
          type: 'FeatureCollection',
          features: result.parcelles.map((p: any) => p.parcelle) // p est enrichi {parcelle, score, ...}
        } as GeoJSONFeatureCollection<Parcelle>
      } else {
        return getParcelles(currentCodeInsee)
      }
    },
    enabled: !!currentCodeInsee && activeLayers.has('parcelles') && viewState.zoom >= 15,
    staleTime: 5 * 60 * 1000, // Réduire un peu le cache pour la recherche
  })

  // Adapter pour MapView (qui attend parcelles)
  const parcelles = parcellesData

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

    // Ajouter à l'historique
    const historyItem: SearchHistory = {
      id: Date.now().toString(),
      query: address.label,
      address,
      timestamp: new Date().toISOString(),
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    }
    setSearchHistory((prev) => [historyItem, ...prev.slice(0, 49)]) // Limiter à 50
  }, [filters])

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

  // Gestion des projets
  const handleCreateProject = useCallback((project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProject: Project = {
      ...project,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setProjects((prev) => [newProject, ...prev])
  }, [])

  const handleUpdateProject = useCallback((projectId: string, updates: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      )
    )
  }, [])

  const handleDeleteProject = useCallback((projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId))
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null)
    }
  }, [selectedProjectId])

  const handleChangeProject = useCallback((parcelleId: string, newProjectId: string | null) => {
    setProjects(prev => prev.map((p: Project) => {
      const hasParcelle = p.parcelles.includes(parcelleId)

      if (p.id === newProjectId && !hasParcelle) {
        return { ...p, parcelles: [...p.parcelles, parcelleId], updatedAt: new Date().toISOString() }
      }
      if (p.id !== newProjectId && hasParcelle) {
        return { ...p, parcelles: p.parcelles.filter(id => id !== parcelleId), updatedAt: new Date().toISOString() }
      }
      return p
    }))
  }, [])

  // Gestion de l'historique
  const handleDeleteHistory = useCallback((id: string) => {
    setSearchHistory((prev) => prev.filter((h) => h.id !== id))
  }, [])

  const handleClearHistory = useCallback(() => {
    setSearchHistory([])
  }, [])

  const handleSelectProjectParcelle = useCallback((parcelle: Parcelle) => {
    let lon = viewState.longitude
    let lat = viewState.latitude

    if (parcelle.geometry.type === 'Polygon') {
      const coords = parcelle.geometry.coordinates as number[][][]
      lon = coords[0][0][0]
      lat = coords[0][0][1]
    } else if (parcelle.geometry.type === 'MultiPolygon') {
      const coords = parcelle.geometry.coordinates as number[][][][]
      lon = coords[0][0][0][0]
      lat = coords[0][0][0][1]
    }

    setViewState((prev: MapViewState) => ({
      ...prev,
      longitude: lon,
      latitude: lat,
      zoom: 18,
      transitionDuration: 1000,
    }))
    setSelectedParcelle(parcelle)
    setShowProjects(false)
  }, [viewState])

  const handleShowFeasibility = useCallback(async () => {
    if (!selectedParcelle) return
    try {
      const report = await getFaisabiliteReport(selectedParcelle.properties.id)
      setFeasibilityReport(report)
    } catch (e) {
      console.error("Erreur faisabilité", e)
      alert("Impossible de générer le rapport pour l'instant.")
    }
  }, [selectedParcelle])

  // Nombre de filtres actifs
  const activeFiltersCount = Object.values(filters).filter((v) => v !== undefined).length

  // Projet sélectionné
  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 z-10 shadow-sm relative">
        <button
          onClick={() => navigate('/')}
          className="p-2 mr-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
          title="Retour au portail"
        >
          <Home size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white whitespace-nowrap">
          Prospection Foncière
        </h1>
        <SearchBar onSelectAddress={handleSelectAddress} />

        {/* Boutons d'action */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowProjects(!showProjects)}
            className={`p - 2 rounded - lg transition - colors ${showProjects
              ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
              } `}
            title="Projets"
          >
            <FolderOpen className="h-5 w-5" />
          </button>

          <button
            onClick={() => {
              setShowTop10(!showTop10)
              if (!showTop10) {
                setShowProjects(false)
                setShowHistory(false)
              }
            }}
            className={`p - 2 rounded - lg transition - colors ${showTop10
              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
              } `}
            title="Top 10 Opportunités"
            disabled={!currentCodeInsee}
          >
            <Award className="h-5 w-5" />
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p - 2 rounded - lg transition - colors relative ${showHistory
              ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
              } `}
            title="Historique"
          >
            <Clock className="h-5 w-5" />
            {searchHistory.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                {Math.min(searchHistory.length, 9)}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowRappels(!showRappels)}
            className={`p - 2 rounded - lg transition - colors relative ${showRappels
              ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
              } `}
            title="Rappels CRM"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-xs px-1 min-w-[16px] h-4 rounded-full flex items-center justify-center font-semibold">
              !
            </span>
          </button>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p - 2 rounded - lg transition - colors relative ${showFilters || activeFiltersCount > 0
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
              } `}
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
            onClick={() => setShowRisks(!showRisks)}
            className={`p - 2 rounded - lg transition - colors ${showRisks
              ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
              } `}
            title="Risques & PLU"
            disabled={!currentCodeInsee}
          >
            <AlertTriangle className="h-5 w-5" />
          </button>

          <button
            onClick={() => setShowReportGenerator(!showReportGenerator)}
            className={`p - 2 rounded - lg transition - colors ${showReportGenerator
              ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
              } `}
            title="Rapport PDF"
            disabled={!currentCodeInsee}
          >
            <FileText className="h-5 w-5" />
          </button>

          <button
            onClick={() => setShowExport(!showExport)}
            className={`p - 2 rounded - lg transition - colors ${showExport
              ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
              } `}
            title="Exporter"
            disabled={!currentCodeInsee}
          >
            <Download className="h-5 w-5" />
          </button>

          <button
            onClick={() => setShowFavorites(!showFavorites)}
            className={`p - 2 rounded - lg transition - colors relative ${showFavorites
              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
              } `}
            title="Favoris"
          >
            <Star className="h-5 w-5" />
            {favorites.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                {favorites.length}
              </span>
            )}
          </button>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>

        <div className="flex-1" />

        {selectedAddress && (
          <div className="text-sm text-gray-500 dark:text-gray-400 hidden lg:block">
            {selectedAddress.city} ({selectedAddress.postcode})
          </div>
        )}
        {selectedProject && (
          <div className="hidden lg:flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedProject.color }}
            />
            <span className="text-gray-700 dark:text-gray-300">{selectedProject.name}</span>
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

        {/* Panneaux latéraux gauche */}
        <div className="absolute top-4 left-4 z-10 space-y-4" style={{ width: '400px' }}>
          {showProjects && (
            <ProjectsPanel
              projects={projects}
              selectedProject={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              onCreateProject={handleCreateProject}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
              onClose={() => setShowProjects(false)}
              onSelectParcelle={handleSelectProjectParcelle}
            />
          )}

          {showTop10 && currentCodeInsee && (
            <Top10Panel
              codeInsee={currentCodeInsee}
              cityName={selectedAddress?.city || currentCodeInsee}
              onClose={() => setShowTop10(false)}
              onSelectParcelle={handleSelectProjectParcelle}
            />
          )}

          {showHistory && (
            <HistoryPanel
              history={searchHistory}
              onSelectHistory={handleSelectAddress}
              onDeleteHistory={handleDeleteHistory}
              onClearAll={handleClearHistory}
              onClose={() => setShowHistory(false)}
            />
          )}

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

          {showRappels && (
            <div className="absolute top-16 right-4 z-10">
              <RappelsPanel onClose={() => setShowRappels(false)} />
            </div>
          )}

          {showReportGenerator && currentCodeInsee && (
            <ReportGenerator
              codeInsee={currentCodeInsee}
              communeName={selectedAddress?.city}
              filters={filters}
              projectName={selectedProject?.name}
              onClose={() => setShowReportGenerator(false)}
            />
          )}

          {showProspection && selectedParcelle && (
            <div className="w-[400px]">
              <ProspectionPanel
                parcelle={selectedParcelle}
                onClose={() => setShowProspection(false)}
                projects={projects}
                selectedProjectId={selectedProjectId}
                onChangeProject={handleChangeProject}
              />
            </div>
          )}
        </div>

        {/* Info panel avec bouton favoris */}
        {(selectedParcelle || selectedTransaction) && (
          <div className="absolute bottom-4 left-4 z-10">
            <div className="relative">
              <InfoPanel
                parcelle={selectedParcelle}
                transaction={selectedTransaction}
                allParcelles={parcelles}
                onClose={handleCloseInfoPanel}
                onShowFeasibility={handleShowFeasibility}
                onShowProspection={() => setShowProspection(true)}
              />
              {selectedParcelle && (
                <button
                  onClick={() =>
                    isParcelleInFavorites
                      ? handleRemoveFavorite(selectedParcelle.properties.id)
                      : handleAddFavorite(selectedParcelle)
                  }
                  className={`absolute top-3 right-12 p-1.5 rounded transition-colors ${isParcelleInFavorites
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

        {/* Modal Rapport Faisabilité */}
        {feasibilityReport && (
          <FeasibilityReport
            report={feasibilityReport}
            onClose={() => setFeasibilityReport(null)}
          />
        )}

        {/* Zoom indicator */}
        {viewState.zoom < 15 && activeLayers.has('parcelles') && (
          <div className="absolute bottom-4 right-4 z-10 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded-lg shadow-lg text-sm">
            Zoomez pour voir les parcelles cadastrales (zoom {viewState.zoom.toFixed(0)}/15)
          </div>
        )}

        {/* Current commune indicator */}
        {currentCodeInsee && (
          <div className="absolute bottom-4 right-4 z-10 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg shadow text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
            Code INSEE: {currentCodeInsee}
            {transactions && (
              <span className="ml-2 text-blue-600 dark:text-blue-400">
                ({transactions.features.length} transactions)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
