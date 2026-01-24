import type { StatutProspection } from '../types'

interface ProspectionBadgeProps {
  statut: StatutProspection
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

// Couleurs et labels pour chaque statut
const STATUT_CONFIG: Record<
  StatutProspection,
  { label: string; color: string; bgColor: string }
> = {
  a_prospecter: {
    label: 'À prospecter',
    color: '#64748b',
    bgColor: '#f1f5f9',
  },
  en_cours: {
    label: 'En cours',
    color: '#3b82f6',
    bgColor: '#dbeafe',
  },
  contacte: {
    label: 'Contacté',
    color: '#8b5cf6',
    bgColor: '#ede9fe',
  },
  interesse: {
    label: 'Intéressé',
    color: '#10b981',
    bgColor: '#d1fae5',
  },
  en_negociation: {
    label: 'En négociation',
    color: '#f59e0b',
    bgColor: '#fef3c7',
  },
  promesse_signee: {
    label: 'Promesse signée',
    color: '#14b8a6',
    bgColor: '#ccfbf1',
  },
  acquis: {
    label: 'Acquis',
    color: '#22c55e',
    bgColor: '#dcfce7',
  },
  refuse: {
    label: 'Refusé',
    color: '#ef4444',
    bgColor: '#fee2e2',
  },
  abandonne: {
    label: 'Abandonné',
    color: '#6b7280',
    bgColor: '#f3f4f6',
  },
}

export function ProspectionBadge({
  statut,
  size = 'md',
  showLabel = true,
}: ProspectionBadgeProps) {
  const config = STATUT_CONFIG[statut]

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  }

  const dotSizes = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
      }}
    >
      <span
        className={`${dotSizes[size]} rounded-full`}
        style={{ backgroundColor: config.color }}
      />
      {showLabel && <span>{config.label}</span>}
    </span>
  )
}

// Export de la configuration pour réutilisation
export { STATUT_CONFIG }
