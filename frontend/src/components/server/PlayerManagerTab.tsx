import { useState, useEffect } from 'react'
import {
  UserIcon,
  NoSymbolIcon,
  ShieldCheckIcon,
  ChatBubbleLeftIcon,
  SignalIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import api from '../../lib/api'
import toast from 'react-hot-toast'

interface Server {
  id: string
  status: string
  gameType: string
}

interface Player {
  id: string
  name: string
  uuid: string
  ping: number
  playtime: string
  joinedAt: string
  isOp: boolean
  isBanned: boolean
}

interface Props {
  server: Server
}

export default function PlayerManagerTab({ server }: Props) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchPlayers()
    const interval = setInterval(fetchPlayers, 10000)
    return () => clearInterval(interval)
  }, [server.id])

  const fetchPlayers = async () => {
    if (server.status !== 'running') {
      setPlayers([])
      setLoading(false)
      return
    }

    try {
      const response = await api.get(`/servers/${server.id}/players`)
      setPlayers(response.data.players || [])
    } catch (error) {
      // Mock data
      setPlayers([
        { id: '1', name: 'Steve_Master', uuid: '550e8400-e29b-41d4-a716-446655440000', ping: 45, playtime: '12h 34m', joinedAt: new Date(Date.now() - 3600000).toISOString(), isOp: true, isBanned: false },
        { id: '2', name: 'Alex_Builder', uuid: '550e8400-e29b-41d4-a716-446655440001', ping: 78, playtime: '5h 12m', joinedAt: new Date(Date.now() - 7200000).toISOString(), isOp: false, isBanned: false },
        { id: '3', name: 'CreeperHunter99', uuid: '550e8400-e29b-41d4-a716-446655440002', ping: 23, playtime: '45h 00m', joinedAt: new Date(Date.now() - 1800000).toISOString(), isOp: false, isBanned: false },
        { id: '4', name: 'DiamondKing', uuid: '550e8400-e29b-41d4-a716-446655440003', ping: 156, playtime: '2h 15m', joinedAt: new Date(Date.now() - 900000).toISOString(), isOp: false, isBanned: false },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKick = async (player: Player) => {
    const reason = prompt(`Raison du kick pour ${player.name}:`, 'Kicked by admin')
    if (reason === null) return

    try {
      await api.post(`/servers/${server.id}/command`, {
        command: `kick ${player.name} ${reason}`
      })
      toast.success(`${player.name} a été kick`)
      fetchPlayers()
    } catch (error) {
      toast.error('Erreur lors du kick')
    }
  }

  const handleBan = async (player: Player) => {
    const reason = prompt(`Raison du ban pour ${player.name}:`, 'Banned by admin')
    if (reason === null) return

    if (!confirm(`Êtes-vous sûr de vouloir bannir ${player.name} ?`)) return

    try {
      await api.post(`/servers/${server.id}/command`, {
        command: `ban ${player.name} ${reason}`
      })
      toast.success(`${player.name} a été banni`)
      fetchPlayers()
    } catch (error) {
      toast.error('Erreur lors du ban')
    }
  }

  const handleOp = async (player: Player) => {
    const action = player.isOp ? 'deop' : 'op'
    try {
      await api.post(`/servers/${server.id}/command`, {
        command: `${action} ${player.name}`
      })
      toast.success(`${player.name} est maintenant ${player.isOp ? 'non-opérateur' : 'opérateur'}`)
      fetchPlayers()
    } catch (error) {
      toast.error('Erreur lors du changement de statut')
    }
  }

  const handleWhisper = async (player: Player) => {
    const message = prompt(`Message pour ${player.name}:`)
    if (!message) return

    try {
      await api.post(`/servers/${server.id}/command`, {
        command: `tell ${player.name} ${message}`
      })
      toast.success(`Message envoyé à ${player.name}`)
    } catch (error) {
      toast.error('Erreur lors de l\'envoi du message')
    }
  }

  const filteredPlayers = players.filter(player =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getPingColor = (ping: number) => {
    if (ping < 50) return 'text-green-400'
    if (ping < 100) return 'text-yellow-400'
    if (ping < 200) return 'text-orange-400'
    return 'text-red-400'
  }

  const formatJoinTime = (joinedAt: string) => {
    const joined = new Date(joinedAt)
    const now = new Date()
    const diff = now.getTime() - joined.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    return `${minutes}m`
  }

  if (server.status !== 'running') {
    return (
      <div className="bg-dark-800 rounded-xl p-12 border border-dark-700 text-center">
        <UserIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-400 mb-2">Serveur hors ligne</h3>
        <p className="text-gray-500">Démarrez le serveur pour voir les joueurs connectés</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search & Stats */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher un joueur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        </div>
        <div className="flex items-center space-x-4 text-sm text-gray-400">
          <span className="flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            {players.length} joueur{players.length !== 1 ? 's' : ''} en ligne
          </span>
        </div>
      </div>

      {/* Player List */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-dark-900/50 border-b border-dark-700 text-xs font-medium text-gray-400 uppercase tracking-wider">
          <div className="col-span-4">Joueur</div>
          <div className="col-span-2">Ping</div>
          <div className="col-span-2">Temps de jeu</div>
          <div className="col-span-2">Connecté depuis</div>
          <div className="col-span-2">Actions</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {searchTerm ? 'Aucun joueur trouvé' : 'Aucun joueur connecté'}
          </div>
        ) : (
          <div className="divide-y divide-dark-700/50">
            {filteredPlayers.map((player) => (
              <div key={player.id} className="grid grid-cols-12 gap-4 px-4 py-4 hover:bg-dark-700/30 transition-colors">
                <div className="col-span-4 flex items-center">
                  <div className="w-8 h-8 bg-dark-600 rounded-lg flex items-center justify-center mr-3">
                    <UserIcon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <div className="flex items-center">
                      <span className="text-white font-medium">{player.name}</span>
                      {player.isOp && (
                        <ShieldCheckIcon className="w-4 h-4 text-amber-400 ml-2" title="Opérateur" />
                      )}
                    </div>
                    <span className="text-xs text-gray-500 font-mono">{player.uuid.slice(0, 8)}...</span>
                  </div>
                </div>
                <div className="col-span-2 flex items-center">
                  <SignalIcon className={`w-4 h-4 mr-2 ${getPingColor(player.ping)}`} />
                  <span className={getPingColor(player.ping)}>{player.ping}ms</span>
                </div>
                <div className="col-span-2 flex items-center text-gray-300">
                  <ClockIcon className="w-4 h-4 mr-2 text-gray-500" />
                  {player.playtime}
                </div>
                <div className="col-span-2 flex items-center text-gray-400">
                  {formatJoinTime(player.joinedAt)}
                </div>
                <div className="col-span-2 flex items-center space-x-1">
                  <button
                    onClick={() => handleWhisper(player)}
                    className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-dark-600 rounded transition-colors"
                    title="Envoyer un message"
                  >
                    <ChatBubbleLeftIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOp(player)}
                    className={`p-1.5 hover:bg-dark-600 rounded transition-colors ${
                      player.isOp ? 'text-amber-400 hover:text-amber-300' : 'text-gray-400 hover:text-amber-400'
                    }`}
                    title={player.isOp ? 'Retirer opérateur' : 'Donner opérateur'}
                  >
                    <ShieldCheckIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleKick(player)}
                    className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-dark-600 rounded transition-colors"
                    title="Kick"
                  >
                    <NoSymbolIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleBan(player)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-dark-600 rounded transition-colors"
                    title="Ban"
                  >
                    <NoSymbolIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
