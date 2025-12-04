import { useState, useEffect } from 'react'
import {
  FunnelIcon,
  PlayIcon,
  StopIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  ArchiveBoxIcon,
  TrashIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import api from '../../lib/api'

interface Server {
  id: string
}

interface ActivityLog {
  id: string
  action: string
  user: string
  details: string
  timestamp: string
}

interface Props {
  server: Server
}

const actionIcons: Record<string, typeof PlayIcon> = {
  start: PlayIcon,
  stop: StopIcon,
  restart: ArrowPathIcon,
  settings: Cog6ToothIcon,
  command: CommandLineIcon,
  backup: ArchiveBoxIcon,
  delete: TrashIcon,
}

const actionColors: Record<string, string> = {
  start: 'bg-green-500/20 text-green-400',
  stop: 'bg-red-500/20 text-red-400',
  restart: 'bg-blue-500/20 text-blue-400',
  settings: 'bg-purple-500/20 text-purple-400',
  command: 'bg-amber-500/20 text-amber-400',
  backup: 'bg-cyan-500/20 text-cyan-400',
  delete: 'bg-red-500/20 text-red-400',
}

const actionLabels: Record<string, string> = {
  start: 'Démarrage',
  stop: 'Arrêt',
  restart: 'Redémarrage',
  settings: 'Modification paramètres',
  command: 'Commande exécutée',
  backup: 'Backup créé',
  delete: 'Suppression',
}

export default function ActivityLogsTab({ server }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetchLogs()
  }, [server.id])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/servers/${server.id}/activity`)
      setLogs(response.data.logs || [])
    } catch (error) {
      // Mock data en cas d'erreur
      setLogs([
        { id: '1', action: 'start', user: 'admin', details: 'Serveur démarré', timestamp: new Date(Date.now() - 3600000).toISOString() },
        { id: '2', action: 'command', user: 'admin', details: 'say Hello everyone!', timestamp: new Date(Date.now() - 7200000).toISOString() },
        { id: '3', action: 'settings', user: 'admin', details: 'RAM modifiée: 2048MB → 4096MB', timestamp: new Date(Date.now() - 86400000).toISOString() },
        { id: '4', action: 'backup', user: 'admin', details: 'Backup automatique créé', timestamp: new Date(Date.now() - 172800000).toISOString() },
        { id: '5', action: 'restart', user: 'moderator', details: 'Redémarrage manuel', timestamp: new Date(Date.now() - 259200000).toISOString() },
        { id: '6', action: 'stop', user: 'admin', details: 'Serveur arrêté pour maintenance', timestamp: new Date(Date.now() - 345600000).toISOString() },
        { id: '7', action: 'start', user: 'admin', details: 'Serveur redémarré après maintenance', timestamp: new Date(Date.now() - 345700000).toISOString() },
        { id: '8', action: 'command', user: 'moderator', details: 'kick PlayerX Comportement inapproprié', timestamp: new Date(Date.now() - 432000000).toISOString() },
      ])
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.action === filter)

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return 'À l\'instant'
    if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`
    if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)}h`
    if (diff < 604800000) return `Il y a ${Math.floor(diff / 86400000)}j`
    
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const actionTypes = ['all', 'start', 'stop', 'restart', 'settings', 'command', 'backup']

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center space-x-2">
        <FunnelIcon className="w-5 h-5 text-gray-400" />
        <span className="text-sm text-gray-400">Filtrer:</span>
        <div className="flex flex-wrap gap-2">
          {actionTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === type
                  ? 'bg-purple-600 text-white'
                  : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600'
              }`}
            >
              {type === 'all' ? 'Tout' : actionLabels[type] || type}
            </button>
          ))}
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-dark-800 rounded-xl border border-dark-700">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            Aucune activité trouvée
          </div>
        ) : (
          <div className="divide-y divide-dark-700">
            {filteredLogs.map((log) => {
              const Icon = actionIcons[log.action] || Cog6ToothIcon
              const colorClass = actionColors[log.action] || 'bg-gray-500/20 text-gray-400'
              
              return (
                <div key={log.id} className="flex items-start p-4 hover:bg-dark-700/30 transition-colors">
                  <div className={`p-2 rounded-lg ${colorClass} mr-4`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-white">
                        {actionLabels[log.action] || log.action}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="flex items-center text-sm text-gray-400">
                        <UserIcon className="w-3.5 h-3.5 mr-1" />
                        {log.user}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1 truncate">{log.details}</p>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Load More */}
      {filteredLogs.length >= 8 && (
        <div className="text-center">
          <button className="px-4 py-2 text-sm text-purple-400 hover:text-purple-300 transition-colors">
            Charger plus d'activités
          </button>
        </div>
      )}
    </div>
  )
}
