import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  GlobeAltIcon,
  UsersIcon,
  CpuChipIcon,
  CircleStackIcon,
  ClockIcon,
  ServerIcon,
} from '@heroicons/react/24/outline'
import api from '../../lib/api'

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
  createdAt: string
  lastStartedAt: string | null
  user?: {
    username: string
  }
}

interface ServerStats {
  cpuUsage: number
  memoryUsage: number
  memoryLimit: number
  networkRx: number
  networkTx: number
}

interface Props {
  server: Server
  stats: ServerStats | null
}

interface HistoryPoint {
  time: string
  cpu: number
  memory: number
}

export default function OverviewTab({ server, stats }: Props) {
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [playerCount, setPlayerCount] = useState<number>(0)
  const [maxPlayers, setMaxPlayers] = useState<number>(20)

  // Simuler l'historique des stats
  useEffect(() => {
    if (stats && server.status === 'running') {
      setHistory((prev) => {
        const newPoint = {
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          cpu: stats.cpuUsage,
          memory: (stats.memoryUsage / stats.memoryLimit) * 100,
        }
        const updated = [...prev, newPoint].slice(-20)
        return updated
      })
    }
  }, [stats, server.status])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatUptime = (startedAt: string | null) => {
    if (!startedAt || server.status !== 'running') return '-'
    const start = new Date(startedAt)
    const now = new Date()
    const diff = now.getTime() - start.getTime()
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) return `${days}j ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const infoCards = [
    {
      label: 'IP:Port',
      value: `localhost:${server.port}`,
      icon: GlobeAltIcon,
      mono: true,
    },
    {
      label: 'Joueurs',
      value: server.status === 'running' ? `${playerCount}/${maxPlayers}` : '-',
      icon: UsersIcon,
    },
    {
      label: 'CPU',
      value: server.status === 'running' ? `${stats?.cpuUsage?.toFixed(1) || 0}%` : '-',
      icon: CpuChipIcon,
    },
    {
      label: 'RAM',
      value: server.status === 'running' 
        ? `${formatBytes(stats?.memoryUsage || 0)} / ${formatBytes(stats?.memoryLimit || server.memoryLimit * 1024 * 1024)}`
        : '-',
      icon: CircleStackIcon,
    },
    {
      label: 'Uptime',
      value: formatUptime(server.lastStartedAt),
      icon: ClockIcon,
    },
    {
      label: 'Propriétaire',
      value: server.user?.username || 'N/A',
      icon: ServerIcon,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {infoCards.map((card) => (
          <div
            key={card.label}
            className="bg-dark-800 rounded-xl p-4 border border-dark-700"
          >
            <div className="flex items-center text-gray-400 mb-2">
              <card.icon className="w-4 h-4 mr-1.5" />
              <span className="text-xs">{card.label}</span>
            </div>
            <p className={`text-white font-semibold ${card.mono ? 'font-mono text-sm' : ''}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      {server.status === 'running' && history.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CPU Chart */}
          <div className="bg-dark-800 rounded-xl p-5 border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-4">Utilisation CPU</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cpu"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                    name="CPU"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Memory Chart */}
          <div className="bg-dark-800 rounded-xl p-5 border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-4">Utilisation RAM</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="memory"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    name="RAM"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Server Info */}
      <div className="bg-dark-800 rounded-xl p-5 border border-dark-700">
        <h3 className="text-lg font-semibold text-white mb-4">Informations du serveur</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-400">Type de jeu</p>
            <p className="text-white capitalize">{server.gameType}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Port principal</p>
            <p className="text-white font-mono">{server.port}</p>
          </div>
          {server.queryPort && (
            <div>
              <p className="text-sm text-gray-400">Port Query</p>
              <p className="text-white font-mono">{server.queryPort}</p>
            </div>
          )}
          {server.rconPort && (
            <div>
              <p className="text-sm text-gray-400">Port RCON</p>
              <p className="text-white font-mono">{server.rconPort}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-400">Limite CPU</p>
            <p className="text-white">{server.cpuLimit} cœurs</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Limite RAM</p>
            <p className="text-white">{server.memoryLimit} MB</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Créé le</p>
            <p className="text-white">{new Date(server.createdAt).toLocaleDateString('fr-FR')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
