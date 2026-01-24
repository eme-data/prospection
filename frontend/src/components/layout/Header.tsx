/**
 * Header principal - Style Promolead
 */

import { Download, Bell, FileText, Moon, Sun, User } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { SearchBar } from '../SearchBar'
import type { AddressResult } from '../../types'

interface HeaderProps {
    onAddressSelect: (address: AddressResult) => void
    onExportClick: () => void
    onAlertsClick: () => void
    onReportsClick: () => void
}

export function Header({
    onAddressSelect,
    onExportClick,
    onAlertsClick,
    onReportsClick,
}: HeaderProps) {
    const { theme, toggleTheme } = useTheme()

    return (
        <header className="fixed top-0 left-[60px] right-0 h-[60px] bg-white dark:bg-gray-900 
      border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-4 z-30">

            {/* Logo & Brand */}
            <div className="flex items-center gap-3 min-w-[200px]">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg 
          flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-lg">P</span>
                </div>
                <div>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Prospection
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Foncière v2.2
                    </p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-2xl">
                <SearchBar onSelectAddress={onAddressSelect} />
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2">
                {/* Export */}
                <button
                    onClick={onExportClick}
                    className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg 
            transition-colors group relative"
                    title="Export"
                >
                    <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>

                {/* Alerts */}
                <button
                    onClick={onAlertsClick}
                    className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg 
            transition-colors relative"
                    title="Alertes"
                >
                    <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    {/* Badge notification */}
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full 
            ring-2 ring-white dark:ring-gray-900" />
                </button>

                {/* Reports */}
                <button
                    onClick={onReportsClick}
                    className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    title="Rapports"
                >
                    <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>

                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
                >
                    {theme === 'dark' ? (
                        <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    ) : (
                        <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    )}
                </button>

                {/* Separator */}
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1" />

                {/* User Menu */}
                <button className="flex items-center gap-2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 
          rounded-lg transition-colors">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full 
            flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                    </div>
                </button>
            </div>
        </header>
    )
}
