/**
 * Tooltip pour afficher les informations de prix au survol
 */

interface PriceHeatmapTooltipProps {
    prixM2: number
    count: number
    position: { x: number; y: number }
}

export function PriceHeatmapTooltip({ prixM2, count, position }: PriceHeatmapTooltipProps) {
    return (
        <div
            className="absolute z-50 pointer-events-none"
            style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -120%)',
            }}
        >
            <div className="bg-gray-900 dark:bg-gray-800 text-white px-3 py-2 rounded-lg shadow-xl border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Prix au m²</div>
                <div className="text-lg font-bold">{prixM2.toLocaleString('fr-FR')} €</div>
                <div className="text-xs text-gray-400 mt-1">
                    {count} transaction{count > 1 ? 's' : ''}
                </div>
                {/* Triangle pointer */}
                <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-full">
                    <div className="border-8 border-transparent border-t-gray-900 dark:border-t-gray-800" />
                </div>
            </div>
        </div>
    )
}
