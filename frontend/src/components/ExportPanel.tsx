import { Download, FileSpreadsheet, Map, X } from 'lucide-react'
import { getExportDVFCSVUrl, getExportDVFGeoJSONUrl, getExportParcellesGeoJSONUrl } from '../api'
import type { DVFFilters } from '../types'

interface ExportPanelProps {
  codeInsee: string
  filters?: DVFFilters
  onClose: () => void
}

export function ExportPanel({ codeInsee, filters, onClose }: ExportPanelProps) {
  const handleExport = (url: string) => {
    window.open(url, '_blank')
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-purple-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          <span className="font-semibold">Exporter les donnees</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-purple-700 rounded transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-sm text-gray-600 mb-4">
          Exportez les donnees de la commune {codeInsee} avec les filtres actuels.
        </p>

        {/* Export DVF */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">Transactions DVF</div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport(getExportDVFCSVUrl(codeInsee, filters))}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={() => handleExport(getExportDVFGeoJSONUrl(codeInsee, filters))}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Map className="h-4 w-4" />
              GeoJSON
            </button>
          </div>
        </div>

        {/* Export Parcelles */}
        <div className="space-y-2 pt-3 border-t border-gray-200">
          <div className="text-sm font-medium text-gray-700">Parcelles cadastrales</div>
          <button
            onClick={() => handleExport(getExportParcellesGeoJSONUrl(codeInsee))}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Map className="h-4 w-4" />
            GeoJSON
          </button>
        </div>

        <p className="text-xs text-gray-500 pt-2">
          Les fichiers CSV peuvent etre ouverts dans Excel. Les fichiers GeoJSON peuvent etre importes dans QGIS ou d'autres SIG.
        </p>
      </div>
    </div>
  )
}
