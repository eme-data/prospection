import { useState, useCallback } from 'react'
import { Upload, X, File, CheckCircle, AlertCircle } from 'lucide-react'

interface DocumentUploadProps {
    onUploadComplete: (urls: string[]) => void
    onCancel: () => void
    maxFiles?: number
}

interface UploadedFile {
    name: string
    size: number
    url: string
    status: 'uploading' | 'success' | 'error'
    error?: string
}

export function DocumentUpload({ onUploadComplete, onCancel, maxFiles = 5 }: DocumentUploadProps) {
    const [files, setFiles] = useState<UploadedFile[]>([])
    const [isDragging, setIsDragging] = useState(false)

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        const droppedFiles = Array.from(e.dataTransfer.files)
        handleFiles(droppedFiles)
    }, [files])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files)
            handleFiles(selectedFiles)
        }
    }

    const handleFiles = async (newFiles: File[]) => {
        if (files.length + newFiles.length > maxFiles) {
            alert(`Vous ne pouvez uploader que ${maxFiles} fichiers maximum`)
            return
        }

        const uploadedFiles: UploadedFile[] = newFiles.map(file => ({
            name: file.name,
            size: file.size,
            url: '',
            status: 'uploading' as const
        }))

        setFiles(prev => [...prev, ...uploadedFiles])

        // Simuler l'upload (à remplacer par un vrai upload)
        for (let i = 0; i < uploadedFiles.length; i++) {
            await simulateUpload(uploadedFiles[i], i + files.length)
        }
    }

    const simulateUpload = async (file: UploadedFile, index: number) => {
        try {
            // Simuler un délai d'upload
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))

            // Dans une vraie application, vous uploaderiez vers S3, Azure Blob, etc.
            // Ici, on simule une URL
            const fakeUrl = `/uploads/${Date.now()}-${file.name}`

            setFiles(prev => prev.map((f, i) =>
                i === index
                    ? { ...f, url: fakeUrl, status: 'success' as const }
                    : f
            ))
        } catch (error) {
            setFiles(prev => prev.map((f, i) =>
                i === index
                    ? { ...f, status: 'error' as const, error: 'Erreur lors de l\'upload' }
                    : f
            ))
        }
    }

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
    }

    const handleComplete = () => {
        const successUrls = files
            .filter(f => f.status === 'success')
            .map(f => f.url)

        if (successUrls.length === 0) {
            alert('Aucun fichier uploadé avec succès')
            return
        }

        onUploadComplete(successUrls)
    }

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    const allUploaded = files.length > 0 && files.every(f => f.status !== 'uploading')
    const hasSuccess = files.some(f => f.status === 'success')

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Upload de documents
                    </h2>
                    <button
                        onClick={onCancel}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Drop zone */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                            }`}
                    >
                        <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-700 dark:text-gray-300 mb-2">
                            Glissez-déposez vos fichiers ici ou
                        </p>
                        <label className="inline-block">
                            <input
                                type="file"
                                multiple
                                onChange={handleFileSelect}
                                className="hidden"
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
                            />
                            <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer inline-block">
                                Choisir des fichiers
                            </span>
                        </label>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            Maximum {maxFiles} fichiers • PDF, Word, Excel, Images
                        </p>
                    </div>

                    {/* Files list */}
                    {files.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="font-medium text-gray-900 dark:text-white">
                                Fichiers ({files.length}/{maxFiles})
                            </h3>

                            {files.map((file, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                                >
                                    <File className="h-5 w-5 text-gray-400 flex-shrink-0" />

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {formatFileSize(file.size)}
                                        </p>
                                    </div>

                                    {/* Status */}
                                    <div className="flex-shrink-0">
                                        {file.status === 'uploading' && (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                        )}
                                        {file.status === 'success' && (
                                            <CheckCircle className="h-5 w-5 text-green-500" />
                                        )}
                                        {file.status === 'error' && (
                                            <AlertCircle className="h-5 w-5 text-red-500" />
                                        )}
                                    </div>

                                    {/* Remove button */}
                                    {file.status !== 'uploading' && (
                                        <button
                                            onClick={() => removeFile(index)}
                                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleComplete}
                        disabled={!allUploaded || !hasSuccess}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Terminer ({files.filter(f => f.status === 'success').length} fichier{files.filter(f => f.status === 'success').length !== 1 ? 's' : ''})
                    </button>
                </div>
            </div>
        </div>
    )
}
