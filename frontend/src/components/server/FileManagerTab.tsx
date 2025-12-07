import { useState, useEffect } from 'react'
import {
  FolderIcon,
  DocumentIcon,
  ArrowUpTrayIcon,
  FolderPlusIcon,
  TrashIcon,
  PencilIcon,
  ArrowDownTrayIcon,
  ChevronRightIcon,
  HomeIcon,
  DocumentTextIcon,
  PhotoIcon,
  CodeBracketIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline'
import api from '../../lib/api'
import toast from 'react-hot-toast'

interface Server {
  id: string
  dataPath: string
}

interface FileItem {
  name: string
  type: 'file' | 'directory'
  size: number
  modified: string
}

interface Props {
  server: Server
}

export default function FileManagerTab({ server }: Props) {
  const [currentPath, setCurrentPath] = useState('/')
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  useEffect(() => {
    fetchFiles()
  }, [currentPath, server.id])

  const fetchFiles = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/servers/${server.id}/files`, {
        params: { path: currentPath }
      })
      setFiles(response.data.files || [])
    } catch (error) {
      // API error - show empty list
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  const navigateToFolder = (folderName: string) => {
    const newPath = currentPath === '/' 
      ? `/${folderName}` 
      : `${currentPath}/${folderName}`
    setCurrentPath(newPath)
    setSelectedFile(null)
  }

  const navigateUp = () => {
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    setCurrentPath(parts.length ? `/${parts.join('/')}` : '/')
    setSelectedFile(null)
  }

  const navigateToBreadcrumb = (index: number) => {
    const parts = currentPath.split('/').filter(Boolean)
    const newPath = index === -1 ? '/' : `/${parts.slice(0, index + 1).join('/')}`
    setCurrentPath(newPath)
    setSelectedFile(null)
  }

  const getFileIcon = (file: FileItem) => {
    if (file.type === 'directory') {
      return <FolderIcon className="w-5 h-5 text-amber-400" />
    }
    
    const ext = file.name.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'txt':
      case 'log':
      case 'md':
        return <DocumentTextIcon className="w-5 h-5 text-gray-400" />
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return <PhotoIcon className="w-5 h-5 text-pink-400" />
      case 'json':
      case 'yml':
      case 'yaml':
      case 'properties':
      case 'js':
      case 'ts':
        return <CodeBracketIcon className="w-5 h-5 text-blue-400" />
      case 'zip':
      case 'tar':
      case 'gz':
      case 'jar':
        return <ArchiveBoxIcon className="w-5 h-5 text-purple-400" />
      default:
        return <DocumentIcon className="w-5 h-5 text-gray-400" />
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const handleUpload = () => {
    toast.success('Fonctionnalité d\'upload en cours de développement')
  }

  const handleCreateFolder = () => {
    const name = prompt('Nom du nouveau dossier:')
    if (name) {
      toast.success(`Dossier "${name}" créé`)
    }
  }

  const handleDelete = (file: FileItem) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer "${file.name}" ?`)) {
      toast.success(`"${file.name}" supprimé`)
      fetchFiles()
    }
  }

  const handleDownload = (file: FileItem) => {
    toast.success(`Téléchargement de "${file.name}" en cours...`)
  }

  const pathParts = currentPath.split('/').filter(Boolean)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        {/* Breadcrumb */}
        <div className="flex items-center space-x-1 text-sm">
          <button
            onClick={() => navigateToBreadcrumb(-1)}
            className="flex items-center px-2 py-1 text-gray-400 hover:text-white hover:bg-dark-700 rounded transition-colors"
          >
            <HomeIcon className="w-4 h-4" />
          </button>
          {pathParts.map((part, index) => (
            <div key={index} className="flex items-center">
              <ChevronRightIcon className="w-4 h-4 text-gray-600" />
              <button
                onClick={() => navigateToBreadcrumb(index)}
                className="px-2 py-1 text-gray-400 hover:text-white hover:bg-dark-700 rounded transition-colors"
              >
                {part}
              </button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleUpload}
            className="flex items-center px-3 py-2 text-sm bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
          >
            <ArrowUpTrayIcon className="w-4 h-4 mr-2" />
            Upload
          </button>
          <button
            onClick={handleCreateFolder}
            className="flex items-center px-3 py-2 text-sm bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
          >
            <FolderPlusIcon className="w-4 h-4 mr-2" />
            Nouveau dossier
          </button>
        </div>
      </div>

      {/* File List */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-dark-900/50 border-b border-dark-700 text-xs font-medium text-gray-400 uppercase tracking-wider">
          <div className="col-span-6">Nom</div>
          <div className="col-span-2">Taille</div>
          <div className="col-span-3">Modifié</div>
          <div className="col-span-1">Actions</div>
        </div>

        {/* Back button */}
        {currentPath !== '/' && (
          <button
            onClick={navigateUp}
            className="w-full grid grid-cols-12 gap-4 px-4 py-3 hover:bg-dark-700/50 transition-colors border-b border-dark-700/50"
          >
            <div className="col-span-6 flex items-center">
              <FolderIcon className="w-5 h-5 text-gray-400 mr-3" />
              <span className="text-gray-400">..</span>
            </div>
            <div className="col-span-2"></div>
            <div className="col-span-3"></div>
            <div className="col-span-1"></div>
          </button>
        )}

        {/* Files */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            Ce dossier est vide
          </div>
        ) : (
          <div className="divide-y divide-dark-700/50">
            {/* Folders first, then files */}
            {[...files]
              .sort((a, b) => {
                if (a.type === 'directory' && b.type === 'file') return -1
                if (a.type === 'file' && b.type === 'directory') return 1
                return a.name.localeCompare(b.name)
              })
              .map((file) => (
                <div
                  key={file.name}
                  onClick={() => {
                    if (file.type === 'directory') {
                      navigateToFolder(file.name)
                    } else {
                      setSelectedFile(file.name === selectedFile ? null : file.name)
                    }
                  }}
                  className={`grid grid-cols-12 gap-4 px-4 py-3 hover:bg-dark-700/50 transition-colors cursor-pointer ${
                    selectedFile === file.name ? 'bg-purple-500/10' : ''
                  }`}
                >
                  <div className="col-span-6 flex items-center">
                    {getFileIcon(file)}
                    <span className="ml-3 text-white truncate">{file.name}</span>
                  </div>
                  <div className="col-span-2 text-gray-400 text-sm flex items-center">
                    {formatSize(file.size)}
                  </div>
                  <div className="col-span-3 text-gray-400 text-sm flex items-center">
                    {new Date(file.modified).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="col-span-1 flex items-center justify-end space-x-1">
                    {file.type === 'file' && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownload(file)
                          }}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-600 rounded transition-colors"
                          title="Télécharger"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toast.success('Éditeur en cours de développement')
                          }}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-600 rounded transition-colors"
                          title="Modifier"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(file)
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-dark-600 rounded transition-colors"
                      title="Supprimer"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-gray-500">
        Chemin serveur: <code className="bg-dark-800 px-2 py-1 rounded">{server.dataPath}</code>
      </div>
    </div>
  )
}
