/**
 * Sidebar Navigation verticale - Style Promolead
 */

import {
    Map,
    Layers,
    Filter,
    BarChart3,
    Target,
    Users,
    TrendingUp,
    FolderOpen,
    Star,
    Clock,
    Settings,
    LucideIcon
} from 'lucide-react'

interface SidebarItem {
    icon: LucideIcon
    label: string
    id: string
    separator?: boolean
}

interface SidebarProps {
    activeItem: string
    onItemClick: (id: string) => void
}

const sidebarItems: SidebarItem[] = [
    { icon: Map, label: 'Carte', id: 'map' },
    { icon: Layers, label: 'Calques', id: 'layers' },
    { icon: Filter, label: 'Filtres', id: 'filters' },
    { icon: BarChart3, label: 'Analyse', id: 'analysis' },
    { icon: Target, label: 'Scoring', id: 'scoring' },
    { icon: Users, label: 'CRM', id: 'crm' },
    { icon: TrendingUp, label: 'INSEE', id: 'insee' },
    { separator: true, icon: Map, label: '', id: 'sep1' },
    { icon: FolderOpen, label: 'Projets', id: 'projects' },
    { icon: Star, label: 'Favoris', id: 'favorites' },
    { icon: Clock, label: 'Historique', id: 'history' },
    { separator: true, icon: Map, label: '', id: 'sep2' },
    { icon: Settings, label: 'Paramètres', id: 'settings' },
]

export function Sidebar({ activeItem, onItemClick }: SidebarProps) {
    return (
        <div className="fixed left-0 top-0 h-screen w-[60px] bg-gray-900 dark:bg-gray-950 flex flex-col items-center py-4 z-40">
            {/* Logo / Brand */}
            <div className="mb-6">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">P</span>
                </div>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 flex flex-col gap-2 w-full px-2">
                {sidebarItems.map((item) => {
                    if (item.separator) {
                        return (
                            <div
                                key={item.id}
                                className="h-px bg-gray-700 dark:bg-gray-800 my-2"
                            />
                        )
                    }

                    const Icon = item.icon
                    const isActive = activeItem === item.id

                    return (
                        <button
                            key={item.id}
                            onClick={() => onItemClick(item.id)}
                            className={`
                group relative w-full h-11 flex items-center justify-center rounded-lg
                transition-all duration-200
                ${isActive
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'text-gray-400 hover:bg-gray-800 dark:hover:bg-gray-850 hover:text-gray-300'
                                }
              `}
                            title={item.label}
                        >
                            <Icon className="w-5 h-5" />

                            {/* Tooltip on hover */}
                            <div className={`
                absolute left-full ml-3 px-3 py-1.5 bg-gray-800 text-white text-sm
                rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100
                group-hover:visible transition-all duration-200 pointer-events-none
                shadow-xl z-50
              `}>
                                {item.label}
                                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-px 
                  border-4 border-transparent border-r-gray-800" />
                            </div>
                        </button>
                    )
                })}
            </nav>
        </div>
    )
}
