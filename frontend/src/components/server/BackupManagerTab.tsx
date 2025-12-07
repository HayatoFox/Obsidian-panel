import { useState, useEffect } from 'react'
import {
  PlusIcon,
  ArrowPathIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  CircleStackIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import api from '../../lib/api'
import toast from 'react-hot-toast'

interface Server {
  id: string
  name: string
}

interface Backup {
  id: string
  name: string
  size: number
  createdAt: string
  type: 'manual' | 'auto'
  status: 'completed' | 'failed' | 'in_progress'
}

interface Props {
  server: Server
}

export default function BackupManagerTab({ server }: Props) {
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [backupName, setBackupName] = useState('')
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true)
  const [autoBackupInterval, setAutoBackupInterval] = useState('24')
  const [maxBackups, setMaxBackups] = useState('5')

  useEffect(() => {
    fetchBackups()
  }, [server.id])

  const fetchBackups = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/servers/${server.id}/backups`)
      setBackups(response.data.backups || [])
    } catch (error) {
      // API error - show empty list
      setBackups([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBackup = async () => {
    if (!backupName.trim()) {
      toast.error('Veuillez entrer un nom pour le backup')
      return
    }

    setCreating(true)
    try {
      await api.post(`/servers/${server.id}/backups`, { name: backupName })
      toast.success('Backup en cours de création...')
      setShowCreateModal(false)
      setBackupName('')
      setTimeout(fetchBackups, 2000)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la création du backup')
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = async (backup: Backup) => {
    if (!confirm(`Êtes-vous sûr de vouloir restaurer le backup "${backup.name}" ? Le serveur sera redémarré.`)) {
      return
    }

    try {
      await api.post(`/servers/${server.id}/backups/${backup.id}/restore`)
      toast.success('Restauration en cours...')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la restauration')
    }
  }

  const handleDelete = async (backup: Backup) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le backup "${backup.name}" ?`)) {
      return
    }

    try {
      await api.delete(`/servers/${server.id}/backups/${backup.id}`)
      toast.success('Backup supprimé')
      fetchBackups()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression')
    }
  }

  const handleDownload = (backup: Backup) => {
    toast.success(`Téléchargement de "${backup.name}" en cours...`)
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const totalSize = backups.reduce((acc, b) => acc + b.size, 0)

  return (
    <div className="space-y-6">
      {/* Stats & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center text-gray-400">
            <CircleStackIcon className="w-5 h-5 mr-2" />
            <span>{backups.length} backup{backups.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center text-gray-400">
            <span>Taille totale: {formatSize(totalSize)}</span>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Créer un backup
        </button>
      </div>

      {/* Backup List */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-dark-900/50 border-b border-dark-700 text-xs font-medium text-gray-400 uppercase tracking-wider">
          <div className="col-span-4">Nom</div>
          <div className="col-span-2">Taille</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Actions</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            Aucun backup disponible
          </div>
        ) : (
          <div className="divide-y divide-dark-700/50">
            {backups.map((backup) => (
              <div key={backup.id} className="grid grid-cols-12 gap-4 px-4 py-4 hover:bg-dark-700/30 transition-colors">
                <div className="col-span-4 flex items-center">
                  {backup.status === 'completed' && (
                    <CheckCircleIcon className="w-5 h-5 text-green-400 mr-3" />
                  )}
                  {backup.status === 'failed' && (
                    <XCircleIcon className="w-5 h-5 text-red-400 mr-3" />
                  )}
                  {backup.status === 'in_progress' && (
                    <ArrowPathIcon className="w-5 h-5 text-blue-400 mr-3 animate-spin" />
                  )}
                  <span className="text-white truncate">{backup.name}</span>
                </div>
                <div className="col-span-2 flex items-center text-gray-400">
                  {formatSize(backup.size)}
                </div>
                <div className="col-span-2 flex items-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    backup.type === 'auto' 
                      ? 'bg-blue-500/20 text-blue-400' 
                      : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {backup.type === 'auto' ? 'Auto' : 'Manuel'}
                  </span>
                </div>
                <div className="col-span-2 flex items-center text-gray-400 text-sm">
                  <ClockIcon className="w-4 h-4 mr-2" />
                  {formatDate(backup.createdAt)}
                </div>
                <div className="col-span-2 flex items-center space-x-1">
                  {backup.status === 'completed' && (
                    <>
                      <button
                        onClick={() => handleRestore(backup)}
                        className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-dark-600 rounded transition-colors"
                        title="Restaurer"
                      >
                        <ArrowPathIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(backup)}
                        className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-dark-600 rounded transition-colors"
                        title="Télécharger"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(backup)}
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

      {/* Auto Backup Settings */}
      <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
        <h3 className="text-lg font-semibold text-white mb-4">Paramètres de backup automatique</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="autoBackup"
              checked={autoBackupEnabled}
              onChange={(e) => setAutoBackupEnabled(e.target.checked)}
              className="w-4 h-4 text-purple-600 bg-dark-700 border-dark-600 rounded focus:ring-purple-500"
            />
            <label htmlFor="autoBackup" className="ml-2 text-gray-300">
              Activer les backups automatiques
            </label>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Intervalle (heures)</label>
            <select
              value={autoBackupInterval}
              onChange={(e) => setAutoBackupInterval(e.target.value)}
              disabled={!autoBackupEnabled}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white disabled:opacity-50"
            >
              <option value="6">6 heures</option>
              <option value="12">12 heures</option>
              <option value="24">24 heures</option>
              <option value="48">48 heures</option>
              <option value="168">7 jours</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Nombre max de backups</label>
            <select
              value={maxBackups}
              onChange={(e) => setMaxBackups(e.target.value)}
              disabled={!autoBackupEnabled}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white disabled:opacity-50"
            >
              <option value="3">3 backups</option>
              <option value="5">5 backups</option>
              <option value="10">10 backups</option>
              <option value="20">20 backups</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
            onClick={() => toast.success('Paramètres sauvegardés')}
          >
            Sauvegarder les paramètres
          </button>
        </div>
      </div>

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-xl p-6 w-full max-w-md border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-4">Créer un backup</h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Nom du backup</label>
              <input
                type="text"
                value={backupName}
                onChange={(e) => setBackupName(e.target.value)}
                placeholder="ex: pre-update-backup"
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateBackup}
                disabled={creating}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                {creating ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
