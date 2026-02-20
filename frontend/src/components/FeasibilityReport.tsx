import { useState } from 'react'
import { FaisabiliteReport } from '../types'
import { CheckCircle, AlertTriangle, XCircle, Home, Map as MapIcon, Activity, Calculator, TrendingDown, TrendingUp, HelpCircle } from 'lucide-react'

interface FeasibilityReportProps {
    report: FaisabiliteReport
    onClose: () => void
}

export function FeasibilityReport({ report, onClose }: FeasibilityReportProps) {
    const isFavorable = report.synthese.conclusion === 'Favorable'
    const isComplexe = report.synthese.conclusion.startsWith('Complexe') || report.synthese.conclusion.startsWith('A vérifier')

    const [activeTab, setActiveTab] = useState<'technique' | 'financier'>('technique')

    // Variables du bilan financier (Compte à rebours)
    const [sdpEstimations, setSdpEstimations] = useState(Math.round(report.surface * 0.6)) // Estimation empirique CES/Gabarit
    const [prixVenteM2, setPrixVenteM2] = useState(4000)
    const [coutConstructionM2, setCoutConstructionM2] = useState(1800)
    const [margePct, setMargePct] = useState(10)
    const [fraisDiversPct, setFraisDiversPct] = useState(15) // Honoraires, taxes, com, frais financiers...

    // Calculs à la volée
    const chiffreAffaires = sdpEstimations * prixVenteM2
    const coutTravaux = sdpEstimations * coutConstructionM2
    const marge = chiffreAffaires * (margePct / 100)
    const fraisDivers = chiffreAffaires * (fraisDiversPct / 100)

    // Charge foncière admissible = Prix d'achat maximum du terrain (frais de notaire inclus)
    const chargeFonciere = chiffreAffaires - coutTravaux - marge - fraisDivers

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

                {/* Navigation Tabs */}
                <div className="flex border-b border-gray-200 bg-white px-6 pt-4">
                    <button
                        onClick={() => setActiveTab('technique')}
                        className={`pb-3 px-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'technique'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Activity className="w-4 h-4" /> Analyse Technique
                    </button>
                    <button
                        onClick={() => setActiveTab('financier')}
                        className={`pb-3 px-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'financier'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Calculator className="w-4 h-4" /> Bilan Promoteur
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">

                    {activeTab === 'technique' ? (
                        <>
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

                                    {/* Liste détaillée des zones */}
                                    {report.zonage && report.zonage.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                            <p className="text-gray-500 text-xs mb-1">Détail des zones :</p>
                                            <div className="space-y-1">
                                                {report.zonage.map((z: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center text-sm bg-blue-50/50 p-1.5 rounded">
                                                        <span className="font-medium text-blue-900">{z.typezone}</span>
                                                        <span className="text-blue-700 truncate max-w-[200px]" title={z.libelong || z.libelle}>{z.libelle}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Points de Vigilance */}
                                    {report.synthese.points_vigilance.length > 0 && (
                                        <div className="mt-4 bg-red-50 border border-red-100 rounded-lg p-3">
                                            <p className="text-red-800 font-medium text-sm mb-2">Points de Vigilance :</p>
                                            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                                                {report.synthese.points_vigilance.map((pt: string, idx: number) => (
                                                    <li key={idx}>{pt}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {report.risques.length > 0 && (
                                <div>
                                    <h3 className="text-md font-semibold text-gray-700 mb-3">Risques Naturels</h3>
                                    <div className="grid gap-2">
                                        {report.risques.map((r: { libelle: string, niveau: string }, idx: number) => (
                                            <div key={idx} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                                                <span>{r.libelle}</span>
                                                <span className={`font-medium ${r.niveau === 'Fort' ? 'text-red-600' : 'text-gray-600'}`}>{r.niveau}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                                <h3 className="text-blue-900 font-semibold mb-2 flex items-center gap-2">
                                    <HelpCircle className="w-5 h-5" /> Compte à rebours promoteur
                                </h3>
                                <p className="text-sm text-blue-800">
                                    Estimez rapidement la valeur du terrain (<span className="font-semibold">Charge Foncière Admissible</span>) en soustrayant du Chiffre d'Affaires total : les coûts de construction, les frais divers et la marge cible.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                {/* Formulaire de saisie */}
                                <div className="space-y-4">
                                    <h4 className="font-medium text-gray-700 border-b pb-2">Hypothèses du projet</h4>

                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Surface Constructible (SDP) m²</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            value={sdpEstimations}
                                            onChange={(e) => setSdpEstimations(Number(e.target.value))}
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Parcelle: {report.surface}m² (estimée ici à {Math.round((sdpEstimations / report.surface) * 100)}%)</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Prix de vente cible (€/m²)</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            value={prixVenteM2}
                                            onChange={(e) => setPrixVenteM2(Number(e.target.value))}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Coût de construction (€/m²)</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            value={coutConstructionM2}
                                            onChange={(e) => setCoutConstructionM2(Number(e.target.value))}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-gray-600 mb-1">Frais divers (%)</label>
                                            <input
                                                type="number"
                                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                                value={fraisDiversPct}
                                                onChange={(e) => setFraisDiversPct(Number(e.target.value))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-600 mb-1">Marge cible (%)</label>
                                            <input
                                                type="number"
                                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                                value={margePct}
                                                onChange={(e) => setMargePct(Number(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Affichage des résultats */}
                                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-medium text-gray-700 border-b pb-2 mb-4">Résultat de l'opération</h4>

                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between items-center text-gray-600">
                                                <span>Chiffre d'Affaires</span>
                                                <span className="font-medium">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(chiffreAffaires)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-red-500">
                                                <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Travaux</span>
                                                <span>-{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(coutTravaux)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-orange-500">
                                                <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Frais & Taxes</span>
                                                <span>-{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(fraisDivers)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-blue-600 font-medium pt-2 border-t border-gray-200">
                                                <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Marge nette ({margePct}%)</span>
                                                <span>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(marge)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`mt-6 p-4 rounded-lg flex flex-col items-center justify-center text-center ${chargeFonciere > 0 ? 'bg-emerald-100 border border-emerald-200' : 'bg-red-100 border border-red-200'}`}>
                                        <span className={`text-sm font-medium mb-1 ${chargeFonciere > 0 ? 'text-emerald-800' : 'text-red-800'}`}>Charge Foncière Admissible</span>
                                        <span className={`text-2xl font-bold ${chargeFonciere > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(chargeFonciere)}
                                        </span>
                                        <span className="text-xs text-emerald-700/80 mt-1">Prix d'achat terrain max</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">
                        Fermer
                    </button>
                    {/* Placeholder pour bouton PDF futur */}
                    <button className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-2 opacity-50 cursor-not-allowed">
                        <span>Télécharger PDF (Bientôt)</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
