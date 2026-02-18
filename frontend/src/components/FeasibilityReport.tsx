import React from 'react'
import { FaisabiliteReport } from '../types'
import { CheckCircle, AlertTriangle, XCircle, Home, Map as MapIcon, Activity } from 'lucide-react'

interface FeasibilityReportProps {
    report: FaisabiliteReport
    onClose: () => void
}

export function FeasibilityReport({ report, onClose }: FeasibilityReportProps) {
    const isFavorable = report.synthese.conclusion === 'Favorable'
    const isComplexe = report.synthese.conclusion.startsWith('Complexe') || report.synthese.conclusion.startsWith('A vérifier')

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
                {/* Header */}
                <div className={`p-6 text-white flex justify-between items-start ${isFavorable ? 'bg-emerald-600' : isComplexe ? 'bg-amber-500' : 'bg-red-500'}`}>
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            {isFavorable && <CheckCircle className="w-8 h-8" />}
                            {isComplexe && <AlertTriangle className="w-8 h-8" />}
                            {!isFavorable && !isComplexe && <XCircle className="w-8 h-8" />}
                            Étude de Faisabilité
                        </h2>
                        <p className="mt-2 opacity-90 text-lg font-medium">{report.synthese.conclusion}</p>
                    </div>
                    <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-full">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 flex-1">

                    {/* Identité */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-gray-50 p-3 rounded-lg flex items-start gap-3">
                            <MapIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                                <p className="text-gray-500">Parcelle</p>
                                <p className="font-semibold text-gray-900">{report.parcelle_id}</p>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg flex items-start gap-3">
                            <Home className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                                <p className="text-gray-500">Surface</p>
                                <p className="font-semibold text-gray-900">{report.surface} m²</p>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                            <p className="text-gray-500">Adresse</p>
                            <p className="font-medium text-gray-900">{report.adresse}</p>
                        </div>
                    </div>

                    {/* Synthèse Constructibilité */}
                    <div className="border border-gray-200 rounded-xl p-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-600" />
                            Diagnostic
                        </h3>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-gray-600">Règlementation Urbanisme (PLU)</span>
                                <span className="font-medium px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                                    {report.synthese.constructibilite}
                                </span>
                            </div>

                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-gray-600">État du Terrain</span>
                                <span className={`font-medium px-3 py-1 rounded-full text-sm ${report.is_built ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
                                    {report.is_built ? 'Bâti (Dents Creuses ?)' : 'Terrain Nu'}
                                </span>
                            </div>

                            {/* Points de Vigilance */}
                            {report.synthese.points_vigilance.length > 0 && (
                                <div className="mt-4 bg-red-50 border border-red-100 rounded-lg p-3">
                                    <p className="text-red-800 font-medium text-sm mb-2">Points de Vigilance :</p>
                                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                                        {report.synthese.points_vigilance.map((pt, idx) => (
                                            <li key={idx}>{pt}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Détails Risques */}
                    {report.risques.length > 0 && (
                        <div>
                            <h3 className="text-md font-semibold text-gray-700 mb-3">Risques Naturels</h3>
                            <div className="grid gap-2">
                                {report.risques.map((r, idx) => (
                                    <div key={idx} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                                        <span>{r.libelle}</span>
                                        <span className={`font-medium ${r.niveau === 'Fort' ? 'text-red-600' : 'text-gray-600'}`}>{r.niveau}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">
                        Fermer
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-2">
                        <span>Télécharger PDF</span>
                        {/* Icone PDF */}
                    </button>
                </div>
            </div>
        </div>
    )
}
