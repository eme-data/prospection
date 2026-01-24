import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { ParcelleScore } from '../types'

interface ScoreBadgeProps {
  score: ParcelleScore
  size?: 'sm' | 'md' | 'lg'
  showDetails?: boolean
}

export function ScoreBadge({ score, size = 'md', showDetails = false }: ScoreBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  const getIcon = () => {
    if (score.score >= 70) return <TrendingUp className={iconSizes[size]} />
    if (score.score >= 40) return <Minus className={iconSizes[size]} />
    return <TrendingDown className={iconSizes[size]} />
  }

  const getNiveauLabel = () => {
    switch (score.niveau) {
      case 'excellent':
        return 'Excellent'
      case 'bon':
        return 'Bon'
      case 'moyen':
        return 'Moyen'
      case 'faible':
        return 'Faible'
      default:
        return 'N/A'
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <div
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${sizeClasses[size]}`}
        style={{
          backgroundColor: `${score.color}20`,
          color: score.color,
          border: `2px solid ${score.color}`,
        }}
      >
        {getIcon()}
        <span>{score.score}/100</span>
        {size !== 'sm' && (
          <span className="font-normal opacity-80">• {getNiveauLabel()}</span>
        )}
      </div>

      {showDetails && (
        <div className="mt-2 space-y-1">
          <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
            Détails du score:
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <ScoreDetail label="Prix" value={score.details.prix} max={25} />
            <ScoreDetail label="Surface" value={score.details.surface} max={20} />
            <ScoreDetail label="Localisation" value={score.details.localisation} max={25} />
            <ScoreDetail label="Marché" value={score.details.marche} max={15} />
            <ScoreDetail label="PLU" value={score.details.plu} max={15} />
          </div>
        </div>
      )}
    </div>
  )
}

interface ScoreDetailProps {
  label: string
  value: number
  max: number
}

function ScoreDetail({ label, value, max }: ScoreDetailProps) {
  const percentage = (value / max) * 100
  const color =
    percentage >= 80
      ? '#10b981'
      : percentage >= 60
        ? '#3b82f6'
        : percentage >= 40
          ? '#f59e0b'
          : '#ef4444'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-700 dark:text-gray-300">{label}</span>
        <span className="font-medium" style={{ color }}>
          {value.toFixed(1)}/{max}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  )
}

interface ScoreRecommendationsProps {
  score: ParcelleScore
}

export function ScoreRecommendations({ score }: ScoreRecommendationsProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: score.color }}
        />
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
          Recommandations
        </h3>
      </div>
      <ul className="space-y-2">
        {score.recommandations.map((recommandation, index) => (
          <li
            key={index}
            className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2"
          >
            <span className="text-blue-500 mt-0.5">•</span>
            <span>{recommandation}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
