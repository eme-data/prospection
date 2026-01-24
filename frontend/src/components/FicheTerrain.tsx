import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  Image,
  FileText,
  StickyNote,
  Tag,
  Loader,
  Camera,
  File,
  Plus,
  Trash2,
  Edit2,
  Save,
  XCircle,
} from 'lucide-react'
import type { Parcelle, Photo, Document, Note } from '../types'

interface FicheTerrainProps {
  parcelle: Parcelle
  onClose: () => void
}

export function FicheTerrain({ parcelle, onClose }: FicheTerrainProps) {
  const parcelleId = parcelle.properties.id
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'photos' | 'documents' | 'notes' | 'tags'>('photos')

  // Récupérer la fiche
  const { data: fiche, isLoading } = useQuery({
    queryKey: ['fiche', parcelleId],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/fiches/${parcelleId}`
      )
      if (!response.ok) throw new Error('Erreur lors du chargement')
      return response.json()
    },
  })

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl p-6">
        <div className="flex items-center justify-center h-64">
          <Loader className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Fiche Terrain Enrichie
            </h2>
            <p className="text-sm opacity-90 mt-1">
              {parcelle.properties.section} {parcelle.properties.numero} •{' '}
              {parcelle.properties.commune} • {parcelle.properties.contenance.toLocaleString()} m²
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          <TabButton
            active={activeTab === 'photos'}
            onClick={() => setActiveTab('photos')}
            icon={<Camera className="h-4 w-4" />}
            label="Photos"
            count={fiche?.photos?.length || 0}
          />
          <TabButton
            active={activeTab === 'documents'}
            onClick={() => setActiveTab('documents')}
            icon={<File className="h-4 w-4" />}
            label="Documents"
            count={fiche?.documents?.length || 0}
          />
          <TabButton
            active={activeTab === 'notes'}
            onClick={() => setActiveTab('notes')}
            icon={<StickyNote className="h-4 w-4" />}
            label="Notes"
            count={fiche?.notes?.length || 0}
          />
          <TabButton
            active={activeTab === 'tags'}
            onClick={() => setActiveTab('tags')}
            icon={<Tag className="h-4 w-4" />}
            label="Tags"
            count={fiche?.tags?.length || 0}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'photos' && <PhotosSection parcelleId={parcelleId} photos={fiche?.photos || []} />}
        {activeTab === 'documents' && <DocumentsSection parcelleId={parcelleId} documents={fiche?.documents || []} />}
        {activeTab === 'notes' && <NotesSection parcelleId={parcelleId} notes={fiche?.notes || []} />}
        {activeTab === 'tags' && <TagsSection parcelleId={parcelleId} tags={fiche?.tags || []} />}
      </div>
    </div>
  )
}

// Tab button component
function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
        active
          ? 'bg-white text-green-600 shadow-lg'
          : 'bg-white/20 text-white hover:bg-white/30'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
      {count > 0 && (
        <span
          className={`px-2 py-0.5 rounded-full text-xs ${
            active ? 'bg-green-100 text-green-800' : 'bg-white/30 text-white'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

// Photos section
function PhotosSection({ parcelleId, photos }: { parcelleId: string; photos: Photo[] }) {
  const queryClient = useQueryClient()
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState({
    url: '',
    type: 'terrain' as Photo['type'],
    description: '',
    source: '',
  })

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/fiches/${parcelleId}/photos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      )
      if (!response.ok) throw new Error('Erreur lors de l\'ajout')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiche', parcelleId] })
      setIsAdding(false)
      setFormData({ url: '', type: 'terrain', description: '', source: '' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/fiches/${parcelleId}/photos/${photoId}`,
        { method: 'DELETE' }
      )
      if (!response.ok) throw new Error('Erreur lors de la suppression')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiche', parcelleId] })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Photos</h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ajouter une photo
        </button>
      </div>

      {isAdding && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            addMutation.mutate(formData)
          }}
          className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              URL de la photo *
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="https://..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as Photo['type'] })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="aerienne">Aérienne</option>
              <option value="terrain">Terrain</option>
              <option value="environnement">Environnement</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Description de la photo..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Source
            </label>
            <input
              type="text"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Source de la photo..."
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {addMutation.isPending ? 'Ajout...' : 'Ajouter'}
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {photos.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Image className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Aucune photo</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="bg-gray-50 dark:bg-gray-900/50 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 transition-colors"
            >
              <img
                src={photo.url}
                alt={photo.description || 'Photo'}
                className="w-full h-48 object-cover"
              />
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
                    {photo.type}
                  </span>
                  <button
                    onClick={() => deleteMutation.mutate(photo.id)}
                    disabled={deleteMutation.isPending}
                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {photo.description && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {photo.description}
                  </p>
                )}
                {photo.source && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Source: {photo.source}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Documents section (similar structure to PhotosSection)
function DocumentsSection({ parcelleId, documents }: { parcelleId: string; documents: Document[] }) {
  const queryClient = useQueryClient()
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState({
    nom: '',
    url: '',
    type: 'autre' as Document['type'],
  })

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/fiches/${parcelleId}/documents`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      )
      if (!response.ok) throw new Error('Erreur lors de l\'ajout')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiche', parcelleId] })
      setIsAdding(false)
      setFormData({ nom: '', url: '', type: 'autre' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/fiches/${parcelleId}/documents/${documentId}`,
        { method: 'DELETE' }
      )
      if (!response.ok) throw new Error('Erreur lors de la suppression')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiche', parcelleId] })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Documents</h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ajouter un document
        </button>
      </div>

      {isAdding && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            addMutation.mutate(formData)
          }}
          className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nom du document *
            </label>
            <input
              type="text"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Plan cadastral.pdf"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              URL du document *
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="https://..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as Document['type'] })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="plu">PLU</option>
              <option value="cadastre">Cadastre</option>
              <option value="courrier">Courrier</option>
              <option value="contrat">Contrat</option>
              <option value="etude">Étude</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {addMutation.isPending ? 'Ajout...' : 'Ajouter'}
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {documents.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Aucun document</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <File className="h-5 w-5 text-blue-600" />
                <div className="flex-1">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {doc.nom}
                  </a>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full">
                      {doc.type}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(doc.dateAjout).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(doc.id)}
                disabled={deleteMutation.isPending}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Notes section
function NotesSection({ parcelleId, notes }: { parcelleId: string; notes: Note[] }) {
  const queryClient = useQueryClient()
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ contenu: '', auteur: '', tags: [] as string[] })

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/fiches/${parcelleId}/notes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      )
      if (!response.ok) throw new Error('Erreur lors de l\'ajout')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiche', parcelleId] })
      setIsAdding(false)
      setFormData({ contenu: '', auteur: '', tags: [] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ noteId, data }: { noteId: string; data: { contenu: string; tags?: string[] } }) => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/fiches/${parcelleId}/notes/${noteId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      )
      if (!response.ok) throw new Error('Erreur lors de la mise à jour')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiche', parcelleId] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/fiches/${parcelleId}/notes/${noteId}`,
        { method: 'DELETE' }
      )
      if (!response.ok) throw new Error('Erreur lors de la suppression')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiche', parcelleId] })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notes</h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ajouter une note
        </button>
      </div>

      {isAdding && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            addMutation.mutate(formData)
          }}
          className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contenu *
            </label>
            <textarea
              value={formData.contenu}
              onChange={(e) => setFormData({ ...formData, contenu: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={4}
              placeholder="Votre note..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Auteur
            </label>
            <input
              type="text"
              value={formData.auteur}
              onChange={(e) => setFormData({ ...formData, auteur: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Votre nom"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {addMutation.isPending ? 'Ajout...' : 'Ajouter'}
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {notes.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <StickyNote className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Aucune note</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4"
            >
              {editingId === note.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    updateMutation.mutate({ noteId: note.id, data: formData })
                  }}
                  className="space-y-3"
                >
                  <textarea
                    value={formData.contenu}
                    onChange={(e) => setFormData({ ...formData, contenu: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows={4}
                    required
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                    >
                      <XCircle className="h-4 w-4" />
                      Annuler
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      {note.auteur && (
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {note.auteur}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(note.date).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingId(note.id)
                          setFormData({ contenu: note.contenu, auteur: note.auteur || '', tags: note.tags || [] })
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(note.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {note.contenu}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Tags section
function TagsSection({ parcelleId, tags }: { parcelleId: string; tags: string[] }) {
  const queryClient = useQueryClient()
  const [newTag, setNewTag] = useState('')

  const addMutation = useMutation({
    mutationFn: async (tag: string) => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/fiches/${parcelleId}/tags`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag }),
        }
      )
      if (!response.ok) throw new Error('Erreur lors de l\'ajout')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiche', parcelleId] })
      setNewTag('')
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (tag: string) => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/fiches/${parcelleId}/tags/${encodeURIComponent(tag)}`,
        { method: 'DELETE' }
      )
      if (!response.ok) throw new Error('Erreur lors de la suppression')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiche', parcelleId] })
    },
  })

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tags</h3>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (newTag.trim()) addMutation.mutate(newTag.trim())
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Nouveau tag..."
        />
        <button
          type="submit"
          disabled={!newTag.trim() || addMutation.isPending}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          Ajouter
        </button>
      </form>

      {tags.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Tag className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Aucun tag</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full"
            >
              <Tag className="h-3 w-3" />
              <span className="text-sm font-medium">{tag}</span>
              <button
                onClick={() => removeMutation.mutate(tag)}
                disabled={removeMutation.isPending}
                className="p-0.5 hover:bg-green-200 dark:hover:bg-green-800 rounded-full transition-colors"
                title="Retirer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
