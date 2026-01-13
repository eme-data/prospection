import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, X, Droplets, Flame, Mountain, Factory } from 'lucide-react'
import { getRisquesCommune, getZonagePLU } from '../api'

interface RiskPanelProps {
  codeInsee?: string
  longitude?: number
  latitude?: number
  onClose: () => void
}

const getRiskIcon = (code: string) => {
  if (code.includes('inondation') || code.includes('submersion')) {
    return <Droplets className="h-5 w-5 text-blue-500" />
  }
  if (code.includes('feu') || code.includes('incendie')) {
    return <Flame className="h-5 w-5 text-orange-500" />
  }
  if (code.includes('sisme') || code.includes('mouvement')) {
    return <Mountain className="h-5 w-5 text-brown-500" />
  }
  if (code.includes('industriel') || code.includes('technologique')) {
    return <Factory className="h-5 w-5 text-gray-500" />
  }
  return <AlertTriangle className="h-5 w-5 text-yellow-500" />
}

const getRiskColor = (niveau: string) => {
  switch (niveau?.toLowerCase()) {
    case 'tres eleve':
    case 'fort':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'eleve':
    case 'moyen':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'modere':
    case 'faible':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

export function RiskPanel({ codeInsee, longitude, latitude, onClose }: RiskPanelProps) {
  const { data: risques, isLoading: risquesLoading } = useQuery({
    queryKey: ['risques', codeInsee],
    queryFn: () => getRisquesCommune(codeInsee!),
    enabled: !!codeInsee,
    staleTime: 10 * 60 * 1000,
  })

  const { data: zonage, isLoading: zonageLoading } = useQuery({
    queryKey: ['zonage', longitude, latitude],
    queryFn: () => getZonagePLU(longitude!, latitude!),
    enabled: !!longitude && !!latitude,
    staleTime: 10 * 60 * 1000,
  })

  const isLoading = risquesLoading || zonageLoading

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-sm">
      <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-semibold">Risques & Urbanisme</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-red-700 rounded transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {/* Zonage PLU */}
        {zonage && zonage.zonages.length > 0 && (
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">Zonage PLU</div>
            <div className="space-y-2">
              {zonage.zonages.map((zone, index) => (
                <div
                  key={index}
                  className="bg-blue-50 border border-blue-200 rounded-lg p-3"
                >
                  <div className="font-medium text-blue-800">
                    {zone.libelle || zone.typezone}
                  </div>
                  {zone.libelong && (
                    <div className="text-sm text-blue-600 mt-1">{zone.libelong}</div>
                  )}
                  {zone.destdomi && (
                    <div className="text-xs text-gray-500 mt-1">
                      Destination: {zone.destdomi}
                    </div>
                  )}
                  {zone.urlfic && (
                    <a
                      href={zone.urlfic}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                    >
                      Voir le reglement
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risques naturels */}
        {risques && risques.risques.length > 0 ? (
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              Risques identifies ({risques.count})
            </div>
            <div className="space-y-2">
              {risques.risques.map((risque, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-3 ${getRiskColor(risque.niveau)}`}
                >
                  <div className="flex items-start gap-2">
                    {getRiskIcon(risque.libelle?.toLowerCase() || '')}
                    <div className="flex-1">
                      <div className="font-medium">{risque.libelle}</div>
                      {risque.niveau && (
                        <div className="text-xs mt-1">Niveau: {risque.niveau}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <div>Aucun risque majeur identifie</div>
          </div>
        )}

        {/* Légende */}
        <div className="pt-3 border-t border-gray-200 text-xs text-gray-500">
          <div className="font-medium mb-1">Sources:</div>
          <ul className="list-disc list-inside space-y-1">
            <li>Georisques (BRGM)</li>
            <li>Geoportail de l'urbanisme (GPU)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
