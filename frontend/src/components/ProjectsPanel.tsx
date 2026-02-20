import { useState } from 'react'
import { X, Plus, FolderOpen, Archive, CheckCircle, Edit, Trash2 } from 'lucide-react'
import { useQueries } from '@tanstack/react-query'
import { getParcelleById } from '../api'
import type { Project, Parcelle } from '../types'

interface ProjectsPanelProps {
  projects: Project[]
  selectedProject: string | null
  onSelectProject: (projectId: string | null) => void
  onCreateProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void
  onUpdateProject: (projectId: string, updates: Partial<Project>) => void
  onDeleteProject: (projectId: string) => void
  onSelectParcelle: (parcelle: Parcelle) => void
  onClose: () => void
}

const PROJECT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // yellow
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
]

export function ProjectsPanel({
  projects,
  selectedProject,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onSelectParcelle,
  onClose,
}: ProjectsPanelProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const activeProjects = projects.filter((p) => p.status === 'active')
  const completedProjects = projects.filter((p) => p.status === 'completed')
  const archivedProjects = projects.filter((p) => p.status === 'archived')

  const handleCreateProject = (name: string, description: string, color: string) => {
    onCreateProject({
      name,
      description,
      color,
      parcelles: [],
      status: 'active',
    })
    setShowCreateModal(false)
  }

  const handleEditProject = (project: Project) => {
    setEditingProject(project)
    setShowCreateModal(true)
  }

  const handleSaveEdit = (name: string, description: string, color: string) => {
    if (editingProject) {
      onUpdateProject(editingProject.id, { name, description, color })
      setEditingProject(null)
      setShowCreateModal(false)
    }
  }

  const handleChangeStatus = (projectId: string, status: Project['status']) => {
    onUpdateProject(projectId, { status })
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-lg p-4 max-h-[calc(100vh-8rem)] overflow-y-auto w-96">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Projets de prospection
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            title="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <button
          onClick={() => {
            setEditingProject(null)
            setShowCreateModal(true)
          }}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 mb-4"
        >
          <Plus className="h-4 w-4" />
          Nouveau projet
        </button>

        {/* Projets actifs */}
        {activeProjects.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Actifs</h3>
            <div className="space-y-2">
              {activeProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isSelected={selectedProject === project.id}
                  onSelect={() => onSelectProject(project.id === selectedProject ? null : project.id)}
                  onEdit={() => handleEditProject(project)}
                  onDelete={() => onDeleteProject(project.id)}
                  onChangeStatus={handleChangeStatus}
                  onSelectParcelle={onSelectParcelle}
                />
              ))}
            </div>
          </div>
        )}

        {/* Projets terminés */}
        {completedProjects.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Terminés</h3>
            <div className="space-y-2">
              {completedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isSelected={selectedProject === project.id}
                  onSelect={() => onSelectProject(project.id === selectedProject ? null : project.id)}
                  onEdit={() => handleEditProject(project)}
                  onDelete={() => onDeleteProject(project.id)}
                  onChangeStatus={handleChangeStatus}
                  onSelectParcelle={onSelectParcelle}
                />
              ))}
            </div>
          </div>
        )}

        {/* Projets archivés */}
        {archivedProjects.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Archivés</h3>
            <div className="space-y-2">
              {archivedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isSelected={selectedProject === project.id}
                  onSelect={() => onSelectProject(project.id === selectedProject ? null : project.id)}
                  onEdit={() => handleEditProject(project)}
                  onDelete={() => onDeleteProject(project.id)}
                  onChangeStatus={handleChangeStatus}
                  onSelectParcelle={onSelectParcelle}
                />
              ))}
            </div>
          </div>
        )}

        {projects.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Aucun projet pour le moment</p>
            <p className="text-sm">Créez votre premier projet</p>
          </div>
        )}
      </div>

      {/* Modal de création/édition */}
      {showCreateModal && (
        <ProjectModal
          project={editingProject}
          colors={PROJECT_COLORS}
          onSave={editingProject ? handleSaveEdit : handleCreateProject}
          onClose={() => {
            setShowCreateModal(false)
            setEditingProject(null)
          }}
        />
      )}
    </>
  )
}

interface ProjectCardProps {
  project: Project
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onChangeStatus: (projectId: string, status: Project['status']) => void
  onSelectParcelle: (parcelle: Parcelle) => void
}

function ProjectCard({
  project,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onChangeStatus,
  onSelectParcelle,
}: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div
      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${isSelected
        ? 'border-blue-500 bg-blue-50'
        : 'border-gray-200 hover:border-gray-300 bg-white'
        }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5"
          style={{ backgroundColor: project.color }}
        />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-800 truncate">{project.name}</h4>
          {project.description && (
            <p className="text-sm text-gray-600 line-clamp-2 mt-1">{project.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span>{project.parcelles.length} parcelles</span>
            <span>•</span>
            <span>Créé le {new Date(project.createdAt).toLocaleDateString('fr-FR')}</span>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Edit className="h-4 w-4 text-gray-500" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-6 bg-white shadow-lg rounded-lg border border-gray-200 py-1 z-10 w-40">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                  setShowMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Éditer
              </button>
              {project.status === 'active' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onChangeStatus(project.id, 'completed')
                    setShowMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Marquer terminé
                </button>
              )}
              {project.status === 'active' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onChangeStatus(project.id, 'archived')
                    setShowMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                >
                  <Archive className="h-4 w-4" />
                  Archiver
                </button>
              )}
              {project.status !== 'active' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onChangeStatus(project.id, 'active')
                    setShowMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                >
                  <FolderOpen className="h-4 w-4" />
                  Réactiver
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) {
                    onDelete()
                  }
                  setShowMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>

      {isSelected && (
        <ProjectParcelles
          projectId={project.id}
          parcelleIds={project.parcelles}
          onSelectParcelle={onSelectParcelle}
        />
      )}
    </div>
  )
}

interface ProjectModalProps {
  project: Project | null
  colors: string[]
  onSave: (name: string, description: string, color: string) => void
  onClose: () => void
}

function ProjectModal({ project, colors, onSave, onClose }: ProjectModalProps) {
  const [name, setName] = useState(project?.name || '')
  const [description, setDescription] = useState(project?.description || '')
  const [selectedColor, setSelectedColor] = useState(project?.color || colors[0])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onSave(name.trim(), description.trim(), selectedColor)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4">
          {project ? 'Éditer le projet' : 'Nouveau projet'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom du projet *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Quartier Saint-Martin"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Description du projet..."
              rows={3}
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Couleur</label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-10 h-10 rounded-lg transition-all ${selectedColor === color
                    ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                    : 'hover:scale-105'
                    }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {project ? 'Enregistrer' : 'Créer le projet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ProjectParcelles({
  parcelleIds,
  onSelectParcelle
}: {
  projectId: string
  parcelleIds: string[]
  onSelectParcelle: (parcelle: Parcelle) => void
}) {
  const parcelleQueries = useQueries({
    queries: parcelleIds.map(id => ({
      queryKey: ['parcelle', id],
      queryFn: () => getParcelleById(id),
      staleTime: 10 * 60 * 1000,
    }))
  })

  if (parcelleIds.length === 0) {
    return (
      <div className="mt-3 text-sm text-gray-500 italic px-2">
        Aucune parcelle dans ce projet.
      </div>
    )
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 px-2">
        Parcelles du projet
      </h5>
      <ul className="space-y-1">
        {parcelleQueries.map((query, index) => {
          const id = parcelleIds[index]
          if (query.isLoading) {
            return (
              <li key={id} className="text-sm px-2 py-1.5 text-gray-400 animate-pulse">
                Chargement {id}...
              </li>
            )
          }
          if (query.isError || !query.data) {
            return (
              <li key={id} className="text-sm px-2 py-1.5 text-red-400">
                Erreur: {id}
              </li>
            )
          }

          const parcelle = query.data
          const { section, numero, commune } = parcelle.properties

          return (
            <li key={id}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectParcelle(parcelle)
                }}
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors flex items-center justify-between group"
              >
                <span className="font-medium text-gray-700">
                  {section} {numero}
                </span>
                <span className="text-xs text-gray-500 truncate ml-2">
                  {commune}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
