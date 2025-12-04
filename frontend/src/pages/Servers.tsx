import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
  ArrowPathIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface Server {
  id: string
  name: string
  gameType: string
  status: string
  port: number
  memoryLimit: number
  cpuLimit: number
  createdAt: string
  user?: {
    username: string
  }
}

export default function Servers() {
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchServers()
  }, [])

  const fetchServers = async () => {
    try {
      const response = await api.get('/servers')
      setServers(response.data)
    } catch (error) {
      toast.error('Failed to fetch servers')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (serverId: string, action: 'start' | 'stop' | 'restart' | 'delete') => {
    setActionLoading(serverId)
    try {
      if (action === 'delete') {
        if (!confirm('Are you sure you want to delete this server? This action cannot be undone.')) {
          setActionLoading(null)
          return
        }
        await api.delete(`/servers/${serverId}`)
        setServers(servers.filter((s) => s.id !== serverId))
        toast.success('Server deleted')
      } else {
        await api.post(`/servers/${serverId}/${action}`)
        toast.success(`Server ${action === 'start' ? 'starting' : action === 'stop' ? 'stopping' : 'restarting'}...`)
        // Refresh after a short delay
        setTimeout(fetchServers, 2000)
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || `Failed to ${action} server`)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)] animate-pulse'
      case 'starting':
        return 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.6)] animate-pulse'
      case 'stopping':
        return 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.6)]'
      case 'stopped':
        return 'bg-gray-500'
      case 'error':
        return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]'
      default:
        return 'bg-gray-500'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-obsidian-500 shadow-glow"></div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400">Servers</h1>
          <p className="text-gray-400 mt-2">Manage your game servers</p>
        </div>
        <Link to="/servers/create" className="btn btn-primary flex items-center gap-2">
          <PlusIcon className="h-5 w-5" />
          New Server
        </Link>
      </div>

      {servers.length === 0 ? (
        <div className="card text-center py-16 border-dashed border-dark-700">
          <h3 className="text-xl font-medium text-gray-300 mb-2">No servers yet</h3>
          <p className="text-gray-500 mb-6">Create your first game server to get started.</p>
          <Link to="/servers/create" className="btn btn-primary">
            Create Server
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {servers.map((server) => (
            <div key={server.id} className="card flex items-center justify-between hover:border-obsidian-500/30 hover:shadow-glow-sm transition-all duration-300 group">
              <div className="flex items-center gap-4">
                <div className={clsx('h-3 w-3 rounded-full transition-all duration-500', getStatusColor(server.status))} />
                <div>
                  <Link
                    to={`/servers/${server.id}`}
                    className="text-lg font-medium text-gray-200 group-hover:text-obsidian-300 transition-colors"
                  >
                    {server.name}
                  </Link>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                    <span className="capitalize px-2 py-0.5 rounded bg-dark-800 border border-dark-700 text-xs">{server.gameType}</span>
                    <span className="text-dark-600">•</span>
                    <span>Port <span className="font-mono text-obsidian-400">{server.port}</span></span>
                    <span className="text-dark-600">•</span>
                    <span>{server.memoryLimit} MB RAM</span>
                    {server.user && (
                      <>
                        <span className="text-dark-600">•</span>
                        <span>Owner: {server.user.username}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/servers/${server.id}`}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <EyeIcon className="h-4 w-4" />
                  Gérer
                </Link>
                {server.status === 'stopped' && (
                  <button
                    onClick={() => handleAction(server.id, 'start')}
                    disabled={actionLoading === server.id}
                    className="btn btn-success flex items-center gap-2"
                  >
                    <PlayIcon className="h-4 w-4" />
                    Start
                  </button>
                )}
                {server.status === 'running' && (
                  <>
                    <button
                      onClick={() => handleAction(server.id, 'restart')}
                      disabled={actionLoading === server.id}
                      className="btn btn-secondary flex items-center gap-2"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                      Restart
                    </button>
                    <button
                      onClick={() => handleAction(server.id, 'stop')}
                      disabled={actionLoading === server.id}
                      className="btn btn-danger flex items-center gap-2"
                    >
                      <StopIcon className="h-4 w-4" />
                      Stop
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleAction(server.id, 'delete')}
                  disabled={actionLoading === server.id}
                  className="btn btn-secondary text-red-400 hover:text-red-300"
                  title="Delete server"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
