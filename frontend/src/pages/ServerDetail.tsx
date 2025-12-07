import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../lib/api'
import { getSocket } from '../lib/socket'
import toast from 'react-hot-toast'
import {
  PlayIcon,
  StopIcon,
  ArrowPathIcon,
  TrashIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  Squares2X2Icon,
  FolderIcon,
  UsersIcon,
  ArchiveBoxIcon,
  CalendarIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

// Tab components
import {
  OverviewTab,
  ConsoleTab,
  FileManagerTab,
  SettingsTab,
  ActivityLogsTab,
  PlayerManagerTab,
  BackupManagerTab,
  SchedulesTab,
} from '../components/server'

interface Server {
  id: string
  name: string
  gameType: string
  status: string
  port: number
  queryPort: number | null
  rconPort: number | null
  memoryLimit: number
  cpuLimit: number
  diskLimit: number
  dataPath: string
  gameConfig: string
  createdAt: string
  lastStartedAt: string | null
  user?: {
    id: string
    username: string
    email: string
  }
}

interface ServerStats {
  cpuUsage: number
  memoryUsage: number
  memoryLimit: number
  networkRx: number
  networkTx: number
}

type Tab = 'overview' | 'console' | 'files' | 'players' | 'backups' | 'schedules' | 'activity' | 'settings'

export default function ServerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [server, setServer] = useState<Server | null>(null)
  const [stats, setStats] = useState<ServerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  useEffect(() => {
    fetchServer()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [id])

  useEffect(() => {
    if (server) {
      const socket = getSocket()
      // Subscribe only for stats updates, console handles its own log subscription
      socket.emit('server:subscribe:stats', server.id)

      socket.on('server:stats', ({ stats: serverStats }: { stats: ServerStats }) => {
        setStats(serverStats)
      })

      return () => {
        socket.emit('server:unsubscribe:stats', server.id)
        socket.off('server:stats')
      }
    }
  }, [server])

  const fetchServer = async () => {
    try {
      const response = await api.get(`/servers/${id}`)
      setServer(response.data)
    } catch (error) {
      toast.error('Serveur non trouvé')
      navigate('/servers')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    if (!server || server.status !== 'running') return
    try {
      const response = await api.get(`/servers/${id}/stats`)
      setStats(response.data)
    } catch (error) {
      // Ignore stats errors
    }
  }

  const handleAction = async (action: 'start' | 'stop' | 'restart' | 'delete' | 'kill' | 'sync') => {
    setActionLoading(true)
    try {
      if (action === 'delete') {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce serveur ?')) {
          setActionLoading(false)
          return
        }
        await api.delete(`/servers/${id}`)
        toast.success('Serveur supprimé')
        navigate('/servers')
        return
      }

      if (action === 'kill') {
        if (!confirm('Forcer l\'arrêt du serveur ? Les données non sauvegardées seront perdues.')) {
          setActionLoading(false)
          return
        }
      }

      await api.post(`/servers/${id}/${action}`)
      const messages: Record<string, string> = {
        start: 'Démarrage en cours...',
        stop: 'Arrêt en cours...',
        restart: 'Redémarrage en cours...',
        kill: 'Serveur forcé à l\'arrêt',
        sync: 'Statut synchronisé'
      }
      toast.success(messages[action] || 'Action effectuée')
      setTimeout(fetchServer, 1000)
    } catch (error: any) {
      toast.error(error.response?.data?.error || `Erreur lors de l'action`)
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500'
      case 'starting':
        return 'bg-yellow-500'
      case 'stopping':
        return 'bg-orange-500'
      case 'stopped':
        return 'bg-gray-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return 'En ligne'
      case 'starting':
        return 'Démarrage...'
      case 'stopping':
        return 'Arrêt...'
      case 'stopped':
        return 'Arrêté'
      case 'error':
        return 'Erreur'
      default:
        return status
    }
  }

  const tabs = [
    { id: 'overview' as Tab, name: 'Vue d\'ensemble', icon: Squares2X2Icon },
    { id: 'console' as Tab, name: 'Console', icon: CommandLineIcon },
    { id: 'files' as Tab, name: 'Fichiers', icon: FolderIcon },
    { id: 'players' as Tab, name: 'Joueurs', icon: UsersIcon },
    { id: 'backups' as Tab, name: 'Backups', icon: ArchiveBoxIcon },
    { id: 'schedules' as Tab, name: 'Planifications', icon: CalendarIcon },
    { id: 'activity' as Tab, name: 'Activité', icon: ClipboardDocumentListIcon },
    { id: 'settings' as Tab, name: 'Paramètres', icon: Cog6ToothIcon },
  ]

  const renderTabContent = () => {
    if (!server) return null

    switch (activeTab) {
      case 'overview':
        return <OverviewTab server={server} stats={stats} />
      case 'files':
        return <FileManagerTab server={server} />
      case 'players':
        return <PlayerManagerTab server={server} />
      case 'backups':
        return <BackupManagerTab server={server} />
      case 'schedules':
        return <SchedulesTab server={server} />
      case 'activity':
        return <ActivityLogsTab server={server} />
      case 'settings':
        return <SettingsTab server={server} onUpdate={fetchServer} />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-obsidian-500"></div>
      </div>
    )
  }

  if (!server) return null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to="/servers" 
            className="p-2 text-gray-400 hover:text-obsidian-400 hover:bg-dark-700/50 rounded-lg transition-all"
          >
            ← Retour
          </Link>
          <div className="flex items-center gap-3">
            <div className={clsx(
              'h-3 w-3 rounded-full',
              getStatusColor(server.status),
              server.status === 'running' && 'shadow-[0_0_8px_rgba(34,197,94,0.6)]',
              server.status === 'error' && 'shadow-[0_0_8px_rgba(239,68,68,0.6)]'
            )} />
            <div>
              <h1 className="text-2xl font-bold text-gray-100">{server.name}</h1>
              <p className="text-sm text-gray-400 capitalize">{server.gameType}</p>
            </div>
            <span
              className={clsx(
                'ml-2 px-2.5 py-1 rounded-full text-xs font-medium',
                server.status === 'running' && 'bg-green-500/20 text-green-400',
                server.status === 'stopped' && 'bg-gray-500/20 text-gray-400',
                server.status === 'starting' && 'bg-yellow-500/20 text-yellow-400',
                server.status === 'stopping' && 'bg-orange-500/20 text-orange-400',
                server.status === 'error' && 'bg-red-500/20 text-red-400'
              )}
            >
              {getStatusText(server.status)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {server.status === 'stopped' && (
            <button
              onClick={() => handleAction('start')}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] disabled:opacity-50 text-white font-medium rounded-lg transition-all"
            >
              <PlayIcon className="h-4 w-4" />
              Démarrer
            </button>
          )}
          {server.status === 'running' && (
            <>
              <button
                onClick={() => handleAction('restart')}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-dark-700/80 hover:bg-dark-600 border border-dark-600 disabled:opacity-50 text-white font-medium rounded-lg transition-all"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Redémarrer
              </button>
              <button
                onClick={() => handleAction('stop')}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] disabled:opacity-50 text-white font-medium rounded-lg transition-all"
              >
                <StopIcon className="h-4 w-4" />
                Arrêter
              </button>
            </>
          )}
          {(server.status === 'starting' || server.status === 'stopping' || server.status === 'error') && (
            <>
              <button
                onClick={() => handleAction('sync')}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition-all"
                title="Synchroniser le statut avec Docker"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Sync
              </button>
              <button
                onClick={() => handleAction('kill')}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] disabled:opacity-50 text-white font-medium rounded-lg transition-all"
                title="Forcer l'arrêt (kill)"
              >
                <StopIcon className="h-4 w-4" />
                Forcer l'arrêt
              </button>
            </>
          )}
          <button
            onClick={() => handleAction('delete')}
            disabled={actionLoading}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-600/20 rounded-lg transition-all"
            title="Supprimer"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-dark-700/50">
        <nav className="flex space-x-1 overflow-x-auto pb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition-all duration-300',
                activeTab === tab.id
                  ? 'border-obsidian-500 text-obsidian-400 bg-obsidian-500/10'
                  : 'border-transparent text-gray-400 hover:text-white hover:border-dark-600 hover:bg-dark-800/30'
              )}
            >
              <tab.icon className={clsx('h-5 w-5', activeTab === tab.id && 'text-obsidian-400')} />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {/* Console is always mounted but hidden when not active - for instant switching */}
        {server && (
          <div style={{ display: activeTab === 'console' ? 'block' : 'none' }}>
            <ConsoleTab server={server} visible={activeTab === 'console'} />
          </div>
        )}
        {activeTab !== 'console' && renderTabContent()}
      </div>
    </div>
  )
}
