import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  X,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Loader,
  TrendingUp,
  MapPin,
  Calendar,
  FileText,
} from 'lucide-react'
import { ScoreBadge } from './ScoreBadge'
import { ProspectionBadge, STATUT_CONFIG } from './ProspectionBadge'
import type { StatutProspection, ParcelleScore, Parcelle } from '../types'

interface AdvancedSearchProps {
  codeInsee: string
  communeName?: string
  onClose: () => void
  onSelectParcelle?: (parcelle: Parcelle) => void
}

export function AdvancedSearch({
  codeInsee,
  communeName,
  onClose,
  onSelectParcelle,
}: AdvancedSearchProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('parcelle')
  const [filters, setFilters] = useState({
    // Pagination
    page: 1,
    per_page: 50,
    sort_by: 'score' as 'score' | 'surface' | 'date_contact' | 'updated',

    // Options
    include_score: true,

    // Filtres parcelle
    surface_parcelle_min: undefined as number | undefined,
    surface_parcelle_max: undefined as number | undefined,
    section: undefined as string | undefined,

    // Filtres scoring
    score_min: undefined as number | undefined,
    score_max: undefined as number | undefined,
    niveau_score: [] as ParcelleScore['niveau'][],

    // Filtres prospection
    statuts: [] as StatutProspection[],
    date_contact_min: undefined as string | undefined,
    date_contact_max: undefined as string | undefined,

    // Filtres fiche
    tags: [] as string[],
    avec_notes: undefined as boolean | undefined,
    avec_photos: undefined as boolean | undefined,
    avec_documents: undefined as boolean | undefined,
  })

  const searchMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/search/advanced`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code_insee: codeInsee,
            limit_parcelles: 200,
            ...filters,
            // Nettoyer les valeurs undefined
            surface_parcelle_min: filters.surface_parcelle_min || undefined,
            surface_parcelle_max: filters.surface_parcelle_max || undefined,
            score_min: filters.score_min || undefined,
            score_max: filters.score_max || undefined,
            niveau_score: filters.niveau_score.length > 0 ? filters.niveau_score : undefined,
            statuts: filters.statuts.length > 0 ? filters.statuts : undefined,
            tags: filters.tags.length > 0 ? filters.tags : undefined,
          }),
        }
      )
      if (!response.ok) throw new Error('Erreur lors de la recherche')
      return response.json()
    },
  })

  const results = searchMutation.data

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const updateFilter = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const resetFilters = () => {
    setFilters({
      page: 1,
      per_page: 50,
      sort_by: 'score',
      include_score: true,
      surface_parcelle_min: undefined,
      surface_parcelle_max: undefined,
      section: undefined,
      score_min: undefined,
      score_max: undefined,
      niveau_score: [],
      statuts: [],
      date_contact_min: undefined,
      date_contact_max: undefined,
      tags: [],
      avec_notes: undefined,
      avec_photos: undefined,
      avec_documents: undefined,
    })
  }

  const activeFiltersCount = [
    filters.surface_parcelle_min,
    filters.surface_parcelle_max,
    filters.section,
    filters.score_min,
    filters.score_max,
    filters.niveau_score.length > 0,
    filters.statuts.length > 0,
    filters.date_contact_min,
    filters.date_contact_max,
    filters.tags.length > 0,
    filters.avec_notes !== undefined,
    filters.avec_photos !== undefined,
    filters.avec_documents !== undefined,
  ].filter(Boolean).length

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Search className="h-6 w-6" />
              Recherche Avancée
            </h2>
            <p className="text-sm opacity-90 mt-1">{communeName || `Commune ${codeInsee}`}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Filters sidebar */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4 space-y-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtres {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </h3>
            <button
              onClick={resetFilters}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Réinitialiser
            </button>
          </div>

          {/* Parcelle filters */}
          <FilterSection
            title="Parcelle"
            icon={<MapPin className="h-4 w-4" />}
            expanded={expandedSection === 'parcelle'}
            onToggle={() => toggleSection('parcelle')}
          >
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Surface min (m²)
                </label>
                <input
                  type="number"
                  value={filters.surface_parcelle_min || ''}
                  onChange={(e) =>
                    updateFilter('surface_parcelle_min', e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                  placeholder="Ex: 500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Surface max (m²)
                </label>
                <input
                  type="number"
                  value={filters.surface_parcelle_max || ''}
                  onChange={(e) =>
                    updateFilter('surface_parcelle_max', e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                  placeholder="Ex: 2000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Section
                </label>
                <input
                  type="text"
                  value={filters.section || ''}
                  onChange={(e) => updateFilter('section', e.target.value || undefined)}
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                  placeholder="Ex: AB"
                />
              </div>
            </div>
          </FilterSection>

          {/* Score filters */}
          <FilterSection
            title="Score"
            icon={<TrendingUp className="h-4 w-4" />}
            expanded={expandedSection === 'score'}
            onToggle={() => toggleSection('score')}
          >
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Score min
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.score_min || ''}
                  onChange={(e) => updateFilter('score_min', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                  placeholder="0-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Score max
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.score_max || ''}
                  onChange={(e) => updateFilter('score_max', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                  placeholder="0-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Niveau
                </label>
                <div className="space-y-1">
                  {(['excellent', 'bon', 'moyen', 'faible'] as const).map((niveau) => (
                    <label key={niveau} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.niveau_score.includes(niveau)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateFilter('niveau_score', [...filters.niveau_score, niveau])
                          } else {
                            updateFilter(
                              'niveau_score',
                              filters.niveau_score.filter((n) => n !== niveau)
                            )
                          }
                        }}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-sm capitalize">{niveau}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </FilterSection>

          {/* Prospection filters */}
          <FilterSection
            title="Prospection"
            icon={<Calendar className="h-4 w-4" />}
            expanded={expandedSection === 'prospection'}
            onToggle={() => toggleSection('prospection')}
          >
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Statuts
                </label>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {Object.keys(STATUT_CONFIG).map((statut) => (
                    <label key={statut} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.statuts.includes(statut as StatutProspection)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateFilter('statuts', [...filters.statuts, statut])
                          } else {
                            updateFilter(
                              'statuts',
                              filters.statuts.filter((s) => s !== statut)
                            )
                          }
                        }}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <ProspectionBadge statut={statut as StatutProspection} size="sm" />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </FilterSection>

          {/* Fiche filters */}
          <FilterSection
            title="Fiche terrain"
            icon={<FileText className="h-4 w-4" />}
            expanded={expandedSection === 'fiche'}
            onToggle={() => toggleSection('fiche')}
          >
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.avec_notes === true}
                  onChange={(e) => updateFilter('avec_notes', e.target.checked ? true : undefined)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm">Avec notes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.avec_photos === true}
                  onChange={(e) => updateFilter('avec_photos', e.target.checked ? true : undefined)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm">Avec photos</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.avec_documents === true}
                  onChange={(e) => updateFilter('avec_documents', e.target.checked ? true : undefined)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm">Avec documents</span>
              </label>
            </div>
          </FilterSection>

          {/* Search button */}
          <button
            onClick={() => searchMutation.mutate()}
            disabled={searchMutation.isPending}
            className="w-full mt-4 bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {searchMutation.isPending ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Recherche...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Rechercher
              </>
            )}
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {!results ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Search className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Configurez vos filtres et lancez la recherche</p>
                <p className="text-sm mt-2">
                  {activeFiltersCount > 0 ? `${activeFiltersCount} filtre(s) actif(s)` : 'Aucun filtre actif'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Results header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {results.total} résultat(s)
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Page {results.page} sur {results.total_pages}
                  </p>
                </div>
                <select
                  value={filters.sort_by}
                  onChange={(e) => updateFilter('sort_by', e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="score">Trier par score</option>
                  <option value="surface">Trier par surface</option>
                  <option value="date_contact">Trier par date contact</option>
                  <option value="updated">Trier par mise à jour</option>
                </select>
              </div>

              {/* Facettes */}
              {results.facettes && (
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Répartition
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Par score</p>
                      <div className="space-y-1">
                        {Object.entries(results.facettes.scores).map(([niveau, count]) => (
                          <div key={niveau} className="flex items-center justify-between text-sm">
                            <span className="capitalize">{niveau}</span>
                            <span className="font-medium">{String(count)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Par statut</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {Object.entries(results.facettes.statuts).map(([statut, count]) => (
                          <div key={statut} className="flex items-center justify-between text-sm">
                            <ProspectionBadge statut={statut as StatutProspection} size="sm" />
                            <span className="font-medium">{String(count)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Results list */}
              <div className="space-y-3">
                {results.parcelles.map((result: any, index: number) => (
                  <ResultCard
                    key={result.parcelle.properties.id}
                    result={result}
                    rank={(results.page - 1) * results.per_page + index + 1}
                    onSelect={onSelectParcelle}
                  />
                ))}
              </div>

              {/* Pagination */}
              {results.total_pages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => {
                      updateFilter('page', Math.max(1, filters.page - 1))
                      searchMutation.mutate()
                    }}
                    disabled={filters.page === 1 || searchMutation.isPending}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    Précédent
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {results.page} / {results.total_pages}
                  </span>
                  <button
                    onClick={() => {
                      updateFilter('page', Math.min(results.total_pages, filters.page + 1))
                      searchMutation.mutate()
                    }}
                    disabled={filters.page === results.total_pages || searchMutation.isPending}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    Suivant
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Filter section component
function FilterSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string
  icon: React.ReactNode
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
          {icon}
          <span>{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>
      {expanded && <div className="p-3">{children}</div>}
    </div>
  )
}

// Result card component
function ResultCard({
  result,
  rank,
  onSelect,
}: {
  result: any
  rank: number
  onSelect?: (parcelle: Parcelle) => void
}) {
  const props = result.parcelle.properties

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-indigo-500 transition-colors">
      <div className="flex items-start gap-4">
        {/* Rank */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-800 dark:text-indigo-300 font-bold text-sm">
          {rank}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                {props.section} {props.numero}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {props.commune} • {props.contenance.toLocaleString()} m²
              </p>
            </div>
            <div className="flex items-center gap-2">
              {result.score && <ScoreBadge score={result.score} size="sm" />}
              {result.prospection && (
                <ProspectionBadge statut={result.prospection.statut} size="sm" />
              )}
            </div>
          </div>

          {/* Tags & Metadata */}
          {result.fiche && (
            <div className="flex flex-wrap gap-2 text-xs">
              {result.fiche.tags?.map((tag: string) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
                >
                  {tag}
                </span>
              ))}
              {result.fiche.photos?.length > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full">
                  {result.fiche.photos.length} photo(s)
                </span>
              )}
              {result.fiche.documents?.length > 0 && (
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
                  {result.fiche.documents.length} doc(s)
                </span>
              )}
              {result.fiche.notes?.length > 0 && (
                <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full">
                  {result.fiche.notes.length} note(s)
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          {onSelect && (
            <button
              onClick={() => onSelect(result.parcelle)}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              Voir sur la carte →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
