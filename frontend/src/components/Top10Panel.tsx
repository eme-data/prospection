import { useQuery } from '@tanstack/react-query'
import { X, Award, MapPin, Loader, AlertTriangle, ShieldCheck } from 'lucide-react'
import { getTop10Faisabilites } from '../api'
import type { Parcelle, Top10Result } from '../types'

interface Top10PanelProps {
    codeInsee: string
    cityName?: string
    onClose: () => void
    onSelectParcelle: (parcelle: Parcelle) => void
}

export function Top10Panel({ codeInsee, cityName, onClose, onSelectParcelle }: Top10PanelProps) {
    const { data: results, isLoading, error } = useQuery({
        queryKey: ['top10', codeInsee],
        queryFn: () => getTop10Faisabilites(codeInsee),
        staleTime: 5 * 60 * 1000, // 5 min
    })

    return (
        <div className="bg-white rounded-lg shadow-lg flex flex-col h-[calc(100vh-8rem)] w-[400px]">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-lg text-white">
                <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-300" />
                    <h2 className="font-semibold">Top 10 Opportunités</h2>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    title="Fermer"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
                <p className="text-sm text-gray-600 flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    Analyse des meilleures parcelles pour : <strong>{cityName || codeInsee}</strong>
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoading && (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-500 space-y-4">
                        <Loader className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="text-sm text-center">
                            Analyse de l'ensemble de la commune en cours...<br />
                            Cela peut prendre quelques secondes.
                        </p>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        Une erreur est survenue lors de l'analyse : {(error as Error).message}
                    </div>
                )}

                {results && results.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                        Aucune opportunité trouvée pour cette commune.
                    </div>
                )}

                {results && results.map((item: Top10Result, index: number) => {
                    const props = item.parcelle_info.properties
                    const report = item.report

                    return (
                        <div
                            key={item.parcelleId}
                            onClick={() => onSelectParcelle(item.parcelle_info)}
                            className="bg-white border-2 border-gray-100 hover:border-blue-400 rounded-lg p-4 cursor-pointer transition-all shadow-sm hover:shadow-md group relative"
                        >
                            {/* Badge Classement */}
                            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-white font-bold flex items-center justify-center shadow-md border-2 border-white z-10">
                                #{index + 1}
                            </div>

                            <div className="flex justify-between items-start mb-3 ml-2">
                                <div>
                                    <h3 className="font-bold text-gray-800">
                                        {props.section} {props.numero}
                                    </h3>
                                    <p className="text-xs text-gray-500 truncate mt-0.5">
                                        {report?.adresse || `${props.commune}`}
                                    </p>
                                </div>
                                {item.score && (
                                    <div
                                        className="flex flex-col items-end"
                                        style={{ color: item.score.color }}
                                    >
                                        <span className="text-xl font-black">{item.score.score}/100</span>
                                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                                            {item.score.niveau}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Résumé Faisabilité */}
                            {report ? (
                                <div className="bg-gray-50 rounded p-2.5 text-xs space-y-2">
                                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                        <span className="text-gray-600">Surface</span>
                                        <span className="font-medium text-gray-800">
                                            {report.surface} m²
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-start pt-1">
                                        <span className="text-gray-600 w-24 shrink-0">Zonage (PLU)</span>
                                        <span className="font-medium text-right text-gray-800 line-clamp-2">
                                            {report.synthese.constructibilite}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-start pt-1">
                                        <span className="text-gray-600 w-24 shrink-0">SDP (Est.)</span>
                                        <span className="font-bold text-right text-blue-700">
                                            {item.sdp || Math.round((report.surface || 0) * 0.6)} m²
                                        </span>
                                    </div>

                                    {report.synthese.conclusion.includes('Favorable') ? (
                                        <div className="flex items-center gap-1.5 text-emerald-600 font-medium pt-1">
                                            <ShieldCheck className="h-4 w-4" />
                                            <span>{report.synthese.conclusion}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-amber-600 font-medium pt-1">
                                            <AlertTriangle className="h-4 w-4" />
                                            <span>{report.synthese.conclusion}</span>
                                        </div>
                                    )}

                                    {report.risques.some(r => r.niveau === 'Fort') && (
                                        <div className="text-red-500 font-medium mt-1 flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            Risque(s) Fort(s) détecté(s)
                                        </div>
                                    )}
                                </div>
                            ) : item.error ? (
                                <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                                    Erreur de génération du rapport: {item.error}
                                </div>
                            ) : null}

                        </div>
                    )
                })}
            </div>
        </div>
    )
}
