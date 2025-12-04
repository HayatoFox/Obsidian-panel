import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import {
  ServerStackIcon,
  CpuChipIcon,
  CircleStackIcon,
  SignalIcon,
  PlusIcon,
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
}

interface Stats {
  totalServers: number
  runningServers: number
  totalMemory: number
  usedMemory: number
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const [servers, setServers] = useState<Server[]>([])
  const [stats, setStats] = useState<Stats>({
    totalServers: 0,
    runningServers: 0,
    totalMemory: 0,
    usedMemory: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const response = await api.get('/servers')
      const serverData = response.data as Server[]
      setServers(serverData)

      // Calculate stats
      const running = serverData.filter((s) => s.status === 'running')
      setStats({
        totalServers: serverData.length,
        runningServers: running.length,
        totalMemory: serverData.reduce((acc, s) => acc + s.memoryLimit, 0),
        usedMemory: running.reduce((acc, s) => acc + s.memoryLimit, 0),
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      name: 'Total Servers',
      value: stats.totalServers,
      icon: ServerStackIcon,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
    },
    {
      name: 'Running',
      value: stats.runningServers,
      icon: SignalIcon,
      color: 'text-green-400',
      bg: 'bg-green-400/10',
    },
    {
      name: 'Total Memory',
      value: `${(stats.totalMemory / 1024).toFixed(1)} GB`,
      icon: CircleStackIcon,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
    },
    {
      name: 'Memory in Use',
      value: `${(stats.usedMemory / 1024).toFixed(1)} GB`,
      icon: CpuChipIcon,
      color: 'text-orange-400',
      bg: 'bg-orange-400/10',
    },
  ]

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-obsidian-500"></div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100">
          Welcome back, {user?.username}!
        </h1>
        <p className="text-gray-400 mt-2">Here's an overview of your game servers.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div key={stat.name} className="card">
            <div className="flex items-center gap-4">
              <div className={clsx('p-3 rounded-lg', stat.bg)}>
                <stat.icon className={clsx('h-6 w-6', stat.color)} />
              </div>
              <div>
                <p className="text-sm text-gray-400">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-100">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Servers */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-100">Recent Servers</h2>
          <Link to="/servers/create" className="btn btn-primary flex items-center gap-2">
            <PlusIcon className="h-5 w-5" />
            New Server
          </Link>
        </div>

        {servers.length === 0 ? (
          <div className="text-center py-12">
            <ServerStackIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No servers yet</h3>
            <p className="text-gray-500 mb-4">Create your first game server to get started.</p>
            <Link to="/servers/create" className="btn btn-primary">
              Create Server
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Game</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Port</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Memory</th>
                </tr>
              </thead>
              <tbody>
                {servers.slice(0, 5).map((server) => (
                  <tr
                    key={server.id}
                    className="border-b border-dark-700/50 hover:bg-dark-800/50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <Link
                        to={`/servers/${server.id}`}
                        className="text-gray-200 hover:text-obsidian-400 font-medium"
                      >
                        {server.name}
                      </Link>
                    </td>
                    <td className="py-4 px-4 text-gray-400 capitalize">{server.gameType}</td>
                    <td className="py-4 px-4">
                      <span className="flex items-center gap-2">
                        <span className={clsx('h-2 w-2 rounded-full', getStatusColor(server.status))} />
                        <span className="text-gray-300 capitalize">{server.status}</span>
                      </span>
                    </td>
                    <td className="py-4 px-4 text-gray-400">{server.port}</td>
                    <td className="py-4 px-4 text-gray-400">{server.memoryLimit} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {servers.length > 5 && (
          <div className="mt-4 text-center">
            <Link to="/servers" className="text-obsidian-400 hover:text-obsidian-300">
              View all servers →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
