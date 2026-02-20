import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  X,
  Clock,
  User,
  Phone,
  Mail,
  FileText,
  ChevronRight,
  Loader,
  MessageSquare,
  Plus,
  FolderOpen,
} from 'lucide-react'
import { ProspectionBadge } from './ProspectionBadge'
import { ActivityTimeline } from './ActivityTimeline'
import { ActivityForm } from './ActivityForm'
import type { Parcelle, ProspectionInfo, StatutProspection, Activity, Project } from '../types'

interface ProspectionPanelProps {
  parcelle: Parcelle
  onClose: () => void
  projects: Project[]
  selectedProjectId: string | null
  onChangeProject: (parcelleId: string, projectId: string | null) => void
}

export function ProspectionPanel({ parcelle, onClose, projects, selectedProjectId, onChangeProject }: ProspectionPanelProps) {
  const parcelleId = parcelle.properties.id
  const queryClient = useQueryClient()
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)

  // Récupérer les données de prospection
  const { data: prospection, isLoading } = useQuery({
    queryKey: ['prospection', parcelleId],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/prospection/${parcelleId}`
      )
      if (response.status === 404) return null
      if (!response.ok) throw new Error('Erreur lors du chargement')
      return response.json() as Promise<ProspectionInfo>
    },
  })

  // Mutation pour créer une prospection
  const createMutation = useMutation({
    mutationFn: async (data: Partial<ProspectionInfo> & { projectIdToJoin?: string }) => {
      const { projectIdToJoin, ...rest } = data
      const response = await fetch(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/prospection`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parcelleId, ...rest }),
        }
      )
      if (!response.ok) throw new Error('Erreur lors de la création')
      const created = await response.json()
      if (projectIdToJoin) {
        onChangeProject(parcelleId, projectIdToJoin)
      }
      return created
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospection', parcelleId] })
    },
  })

  // Mutation pour mettre à jour le statut
  const updateStatutMutation = useMutation({
    mutationFn: async (data: { statut: StatutProspection; notes?: string }) => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/prospection/${parcelleId}/statut`,
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
      queryClient.invalidateQueries({ queryKey: ['prospection', parcelleId] })
    },
  })

  // Mutation pour mettre à jour les contacts
  const updateContactMutation = useMutation({
    mutationFn: async (data: {
      interlocuteur?: string
      telephone?: string
      email?: string
      notes?: string
    }) => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/prospection/${parcelleId}/contact`,
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
      queryClient.invalidateQueries({ queryKey: ['prospection', parcelleId] })
    },
  })

  // Mutation pour ajouter une note
  const addNoteMutation = useMutation({
    mutationFn: async (notes: string) => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/prospection/${parcelleId}/notes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes }),
        }
      )
      if (!response.ok) throw new Error('Erreur lors de l\'ajout')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospection', parcelleId] })
    },
  })

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl p-6">
        <div className="flex items-center justify-center h-64">
          <Loader className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Gestion de Prospection
            </h2>
            <p className="text-sm opacity-90 mt-1">
              {parcelle.properties.section} {parcelle.properties.numero} •{' '}
              {parcelle.properties.commune}
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
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {!prospection ? (
          <InitialProspectionForm
            onCreate={createMutation.mutate}
            projects={projects}
            selectedProjectId={selectedProjectId}
          />
        ) : (
          <>
            <StatusWorkflow
              currentStatut={prospection.statut}
              onChangeStatut={(statut, notes) =>
                updateStatutMutation.mutate({ statut, notes })
              }
              isLoading={updateStatutMutation.isPending}
            />

            <ProjectAssociationSection
              parcelleId={parcelleId}
              projects={projects}
              onChangeProject={onChangeProject}
            />

            <ContactInfoSection
              parcelle={parcelle}
              prospection={prospection}
              onUpdate={updateContactMutation.mutate}
              isLoading={updateContactMutation.isPending}
            />

            <NotesSection
              onAddNote={addNoteMutation.mutate}
              isLoading={addNoteMutation.isPending}
            />

            {/* Section Activités CRM */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Activités CRM
                </h3>
                <button
                  onClick={() => setShowActivityForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Nouvelle activité
                </button>
              </div>
              <ActivityTimeline
                parcelleId={parcelleId}
                onEdit={(activity: any) => {
                  setEditingActivity(activity)
                  setShowActivityForm(true)
                }}
              />
            </div>

            <HistoryTimeline historique={prospection.historique} />
          </>
        )}
      </div>

      {/* Modal formulaire d'activité */}
      {showActivityForm && (
        <ActivityForm
          parcelleId={parcelleId}
          initialActivity={editingActivity || undefined}
          onSuccess={() => {
            setShowActivityForm(false)
            setEditingActivity(null)
            // Invalider le cache pour rafraîchir la timeline
            queryClient.invalidateQueries({ queryKey: ['activities', parcelleId] })
          }}
          onCancel={() => {
            setShowActivityForm(false)
            setEditingActivity(null)
          }}
        />
      )}
    </div>
  )
}

function ProjectAssociationSection({
  parcelleId,
  projects,
  onChangeProject
}: {
  parcelleId: string
  projects: Project[]
  onChangeProject: (parcelleId: string, projectId: string | null) => void
}) {
  const currentProject = projects.find(p => p.parcelles.includes(parcelleId))
  const [projectId, setProjectId] = useState(currentProject?.id || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = () => {
    setIsSaving(true)
    onChangeProject(parcelleId, projectId || null)
    setTimeout(() => setIsSaving(false), 500)
  }

  const hasChanged = projectId !== (currentProject?.id || '')

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
        <FolderOpen className="h-4 w-4" />
        Dossier de Prospection / Projet
      </h3>
      <div className="flex gap-2 items-center">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Aucun projet (hors projet)</option>
          {projects.filter(p => p.status === 'active' || p.id === currentProject?.id).map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {hasChanged && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        )}
      </div>
    </div>
  )
}

// Formulaire initial pour créer une prospection
function InitialProspectionForm({
  onCreate,
  projects,
  selectedProjectId,
}: {
  onCreate: (data: Partial<ProspectionInfo> & { projectIdToJoin?: string }) => void
  projects?: Project[]
  selectedProjectId?: string | null
}) {
  const [statut, setStatut] = useState<StatutProspection>('a_prospecter')
  const [notes, setNotes] = useState('')
  const [projectId, setProjectId] = useState<string>(selectedProjectId || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onCreate({ statut, notesContact: notes, projectIdToJoin: projectId || undefined })
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Créer une fiche de prospection
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Statut initial
          </label>
          <div className="flex flex-wrap gap-2">
            {(['a_prospecter', 'en_cours'] as StatutProspection[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatut(s)}
                className={`px-4 py-2 rounded-lg transition-all ${statut === s
                  ? 'ring-2 ring-blue-500 scale-105'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
              >
                <ProspectionBadge statut={s} />
              </button>
            ))}
          </div>
        </div>
        {projects && projects.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Associer à un projet
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shrink-0 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Aucun projet (hors projet)</option>
              {projects.filter(p => p.status === 'active').map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes initiales (optionnel)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            rows={3}
            placeholder="Notes sur cette parcelle..."
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Créer la fiche
        </button>
      </form>
    </div>
  )
}

// Workflow de changement de statut
function StatusWorkflow({
  currentStatut,
  onChangeStatut,
  isLoading,
}: {
  currentStatut: StatutProspection
  onChangeStatut: (statut: StatutProspection, notes?: string) => void
  isLoading: boolean
}) {
  const [selectedStatut, setSelectedStatut] = useState<StatutProspection | null>(null)
  const [notes, setNotes] = useState('')

  // Définir les transitions possibles depuis chaque statut
  const transitions: Record<StatutProspection, StatutProspection[]> = {
    a_prospecter: ['en_cours', 'abandonne'],
    en_cours: ['contacte', 'abandonne'],
    contacte: ['interesse', 'refuse', 'abandonne'],
    interesse: ['en_negociation', 'refuse', 'abandonne'],
    en_negociation: ['promesse_signee', 'refuse', 'abandonne'],
    promesse_signee: ['acquis', 'abandonne'],
    acquis: [],
    refuse: ['a_prospecter'],
    abandonne: ['a_prospecter'],
  }

  const nextStatuts = transitions[currentStatut] || []

  const handleConfirm = () => {
    if (selectedStatut) {
      onChangeStatut(selectedStatut, notes)
      setSelectedStatut(null)
      setNotes('')
    }
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Statut actuel
      </h3>
      <div className="mb-4">
        <ProspectionBadge statut={currentStatut} size="lg" />
      </div>

      {nextStatuts.length > 0 && (
        <>
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            Actions possibles
          </h4>
          <div className="flex flex-wrap gap-2 mb-4">
            {nextStatuts.map((statut) => (
              <button
                key={statut}
                onClick={() => setSelectedStatut(statut)}
                disabled={isLoading}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${selectedStatut === statut
                  ? 'ring-2 ring-blue-500 scale-105'
                  : 'hover:bg-white dark:hover:bg-gray-800'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <ChevronRight className="h-4 w-4 text-blue-600" />
                <ProspectionBadge statut={statut} size="sm" />
              </button>
            ))}
          </div>

          {selectedStatut && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Changer vers:
                </span>
                <ProspectionBadge statut={selectedStatut} />
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes sur ce changement de statut..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleConfirm}
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {isLoading ? 'Mise à jour...' : 'Confirmer'}
                </button>
                <button
                  onClick={() => {
                    setSelectedStatut(null)
                    setNotes('')
                  }}
                  disabled={isLoading}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Section d'informations de contact
function ContactInfoSection({
  parcelle,
  prospection,
  onUpdate,
  isLoading,
}: {
  parcelle: Parcelle
  prospection: ProspectionInfo
  onUpdate: (data: any) => void
  isLoading: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    interlocuteur: prospection.interlocuteur || '',
    telephone: prospection.telephone || '',
    email: prospection.email || '',
    notes: prospection.notesContact || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdate(formData)
    setIsEditing(false)
  }

  const hasContact =
    prospection.interlocuteur || prospection.telephone || prospection.email

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Informations de contact
        </h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {isEditing ? 'Annuler' : hasContact ? 'Modifier' : 'Ajouter'}
        </button>
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Interlocuteur
            </label>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={formData.interlocuteur}
                onChange={(e) =>
                  setFormData({ ...formData, interlocuteur: e.target.value })
                }
                className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                placeholder="Nom du contact"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Téléphone
            </label>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <input
                type="tel"
                value={formData.telephone}
                onChange={(e) =>
                  setFormData({ ...formData, telephone: e.target.value })
                }
                className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                placeholder="Numéro de téléphone"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Email
            </label>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                placeholder="Email"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              rows={3}
              placeholder="Notes de contact..."
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {isLoading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      ) : hasContact ? (
        <div className="space-y-2 text-sm">
          {prospection.interlocuteur && (
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <User className="h-4 w-4 text-gray-400" />
              <span>{prospection.interlocuteur}</span>
            </div>
          )}
          {prospection.telephone && (
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Phone className="h-4 w-4 text-gray-400" />
              <a href={`tel:${prospection.telephone}`} className="hover:text-blue-600">
                {prospection.telephone}
              </a>
            </div>
          )}
          {prospection.email && (
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Mail className="h-4 w-4 text-gray-400" />
              <a href={`mailto:${prospection.email}`} className="hover:text-blue-600">
                {prospection.email}
              </a>
            </div>
          )}
          {prospection.notesContact && (
            <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {prospection.notesContact}
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          Aucun contact enregistré
        </p>
      )}

      {/* Bouton Contacter Mairie CERFA */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <a
          href={`mailto:?subject=${encodeURIComponent(`Demande de matrice cadastrale - ${parcelle.properties.commune}`)}&body=${encodeURIComponent(`Madame, Monsieur le Maire,

Je vous prie de bien vouloir me faire parvenir un extrait de la matrice cadastrale concernant la parcelle suivante :
- Commune : ${parcelle.properties.commune}
- Section : ${parcelle.properties.section}
- Numéro : ${parcelle.properties.numero}
- Contenance : ${parcelle.properties.contenance} m²

En vous remerciant par avance pour votre diligence, je vous prie d'agréer, Madame, Monsieur le Maire, l'expression de mes salutations distinguées.

Cordialement,`)}`}
          className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 rounded-lg text-sm font-medium transition-colors"
        >
          <FileText className="w-4 h-4" />
          Générer e-mail Mairie (CERFA)
        </a>
      </div>
    </div>
  )
}

// Section de notes
function NotesSection({
  onAddNote,
  isLoading,
}: {
  onAddNote: (note: string) => void
  isLoading: boolean
}) {
  const [note, setNote] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (note.trim()) {
      onAddNote(note)
      setNote('')
    }
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Ajouter une note
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ajouter une note à l'historique..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          rows={3}
        />
        <button
          type="submit"
          disabled={!note.trim() || isLoading}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Ajout...' : 'Ajouter la note'}
        </button>
      </form>
    </div>
  )
}

// Timeline de l'historique
function HistoryTimeline({
  historique,
}: {
  historique: ProspectionInfo['historique']
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Historique
      </h3>
      <div className="space-y-4">
        {[...historique].reverse().map((entry, index) => (
          <div key={entry.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              {index < historique.length - 1 && (
                <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 mt-2" />
              )}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <ProspectionBadge statut={entry.statut} size="sm" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(entry.date).toLocaleString('fr-FR')}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                {entry.action}
              </p>
              {entry.notes && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {entry.notes}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
