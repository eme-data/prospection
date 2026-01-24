/**
 * BasePanel - Composant de base pour les panneaux latéraux slide-in
 */

import { X } from 'lucide-react'
import { ReactNode } from 'react'

interface BasePanelProps {
    isOpen: boolean
    onClose: () => void
    title: string
    subtitle?: string
    children: ReactNode
    width?: 'sm' | 'md' | 'lg' | 'xl'
    footer?: ReactNode
}

const widthClasses = {
    sm: 'w-80',
    md: 'w-96',
    lg: 'w-[480px]',
    xl: 'w-[560px]',
}

export function BasePanel({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    width = 'lg',
    footer,
}: BasePanelProps) {
    return (
        <>
            {/* Backdrop */}
            <div
                className={`
          fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className={`
          fixed top-0 right-0 bottom-0 ${widthClasses[width]} bg-white dark:bg-gray-900
          shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b 
          border-gray-200 dark:border-gray-800">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {title}
                        </h2>
                        {subtitle && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                {subtitle}
                            </p>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-6">
                        {children}
                    </div>
                </div>

                {/* Footer */}
                {footer && (
                    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
                        {footer}
                    </div>
                )}
            </div>
        </>
    )
}
