import { useState } from 'react'
import { X, FileText, Download, Loader } from 'lucide-react'
import type { DVFFilters } from '../types'

interface ReportGeneratorProps {
  codeInsee: string
  communeName?: string
  filters: DVFFilters
  projectName?: string
  onClose: () => void
}

export function ReportGenerator({
  codeInsee,
  communeName,
  filters,
  projectName,
  onClose,
}: ReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [reportName, setReportName] = useState(
    projectName || `Rapport ${communeName || codeInsee}`
  )
  const [error, setError] = useState<string | null>(null)

  const handleGenerateReport = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        project_name: reportName,
        code_insee: codeInsee,
      })

      // Ajouter les filtres
      if (filters.typeLocal) params.append('type_local', filters.typeLocal)
      if (filters.prixMin) params.append('prix_min', filters.prixMin.toString())
      if (filters.prixMax) params.append('prix_max', filters.prixMax.toString())
      if (filters.surfaceMin) params.append('surface_min', filters.surfaceMin.toString())
      if (filters.surfaceMax) params.append('surface_max', filters.surfaceMax.toString())
      if (filters.anneeMin) params.append('annee_min', filters.anneeMin.toString())
      if (filters.anneeMax) params.append('annee_max', filters.anneeMax.toString())

      const apiUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? '/api/reports/generate'
        : 'http://localhost:8000/api/reports/generate'

      const response = await fetch(
        `${apiUrl}?${params}`,
        {
          method: 'POST',
        }
      )

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du rapport')
      }

      // Télécharger le PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rapport_${reportName.replace(/\s+/g, '_')}_${codeInsee}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Générer un rapport PDF
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
          disabled={isGenerating}
          title="Fermer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-4">
          Créez un rapport professionnel avec les statistiques du marché, l'évolution des prix
          et la liste des parcelles.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Commune :</strong> {communeName || codeInsee}
          </p>
          {Object.keys(filters).length > 0 && (
            <p className="text-sm text-blue-800 mt-1">
              <strong>Filtres :</strong> {Object.keys(filters).length} critère(s) appliqué(s)
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nom du rapport
          </label>
          <input
            type="text"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ex: Prospection Quartier Centre"
            disabled={isGenerating}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onClose}
          disabled={isGenerating}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Annuler
        </button>
        <button
          onClick={handleGenerateReport}
          disabled={isGenerating || !reportName.trim()}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              Génération...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Générer le PDF
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center">
        Le rapport inclura les statistiques du marché, l'évolution des prix et jusqu'à 50
        parcelles
      </p>
    </div>
  )
}
