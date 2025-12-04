import { useState } from 'react'
import { ExclamationTriangleIcon, TrashIcon } from '@heroicons/react/24/outline'
import api from '../../lib/api'
import toast from 'react-hot-toast'

interface Server {
  id: string
  name: string
  gameType: string
  port: number
  queryPort: number | null
  rconPort: number | null
  memoryLimit: number
  cpuLimit: number
  diskLimit: number
  gameConfig: string
}

interface Props {
  server: Server
  onUpdate: () => void
}

export default function SettingsTab({ server, onUpdate }: Props) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: server.name,
    memoryLimit: server.memoryLimit,
    cpuLimit: server.cpuLimit,
    maxPlayers: 20,
    motd: 'An Obsidian Panel Server',
    pvp: true,
    difficulty: 'normal',
    gamemode: 'survival',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await api.patch(`/servers/${server.id}`, {
        name: formData.name,
        memoryLimit: formData.memoryLimit,
        cpuLimit: formData.cpuLimit,
        gameConfig: {
          maxPlayers: formData.maxPlayers,
          motd: formData.motd,
          pvp: formData.pvp,
          difficulty: formData.difficulty,
          gamemode: formData.gamemode,
        }
      })
      toast.success('Paramètres sauvegardés')
      onUpdate()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement "${server.name}" ? Cette action est irréversible.`)) {
      return
    }

    try {
      await api.delete(`/servers/${server.id}`)
      toast.success('Serveur supprimé')
      window.location.href = '/servers'
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression')
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit}>
        {/* General Settings */}
        <div className="bg-dark-800 rounded-xl p-6 border border-dark-700 mb-6">
          <h3 className="text-lg font-semibold text-white mb-6">Paramètres généraux</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nom du serveur
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Port
              </label>
              <input
                type="number"
                value={server.port}
                disabled
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-gray-400 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">Le port ne peut pas être modifié</p>
            </div>
          </div>
        </div>

        {/* Resource Limits */}
        <div className="bg-dark-800 rounded-xl p-6 border border-dark-700 mb-6">
          <h3 className="text-lg font-semibold text-white mb-6">Limites de ressources</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mémoire RAM (MB)
              </label>
              <input
                type="number"
                value={formData.memoryLimit}
                onChange={(e) => setFormData({ ...formData, memoryLimit: parseInt(e.target.value) })}
                min={512}
                max={32768}
                step={256}
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">Min: 512 MB, Max: 32768 MB</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Limite CPU (cœurs)
              </label>
              <input
                type="number"
                value={formData.cpuLimit}
                onChange={(e) => setFormData({ ...formData, cpuLimit: parseFloat(e.target.value) })}
                min={0.5}
                max={16}
                step={0.5}
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">Min: 0.5, Max: 16</p>
            </div>
          </div>
        </div>

        {/* Game Settings */}
        <div className="bg-dark-800 rounded-xl p-6 border border-dark-700 mb-6">
          <h3 className="text-lg font-semibold text-white mb-6">
            Paramètres de jeu
            <span className="ml-2 text-sm font-normal text-gray-400 capitalize">({server.gameType})</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Joueurs maximum
              </label>
              <input
                type="number"
                value={formData.maxPlayers}
                onChange={(e) => setFormData({ ...formData, maxPlayers: parseInt(e.target.value) })}
                min={1}
                max={100}
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                MOTD (Message of the Day)
              </label>
              <input
                type="text"
                value={formData.motd}
                onChange={(e) => setFormData({ ...formData, motd: e.target.value })}
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {server.gameType.includes('minecraft') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Difficulté
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="peaceful">Paisible</option>
                    <option value="easy">Facile</option>
                    <option value="normal">Normal</option>
                    <option value="hard">Difficile</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Mode de jeu
                  </label>
                  <select
                    value={formData.gamemode}
                    onChange={(e) => setFormData({ ...formData, gamemode: e.target.value })}
                    className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="survival">Survie</option>
                    <option value="creative">Créatif</option>
                    <option value="adventure">Aventure</option>
                    <option value="spectator">Spectateur</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="pvp"
                    checked={formData.pvp}
                    onChange={(e) => setFormData({ ...formData, pvp: e.target.checked })}
                    className="w-4 h-4 text-purple-600 bg-dark-700 border-dark-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="pvp" className="ml-2 text-sm text-gray-300">
                    Activer le PvP
                  </label>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
          </button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="bg-red-900/20 rounded-xl p-6 border border-red-800">
        <h3 className="text-lg font-semibold text-red-400 mb-2 flex items-center">
          <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
          Zone de danger
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          Ces actions sont irréversibles. Procédez avec prudence.
        </p>
        <button
          onClick={handleDelete}
          className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
        >
          <TrashIcon className="w-4 h-4 mr-2" />
          Supprimer le serveur
        </button>
      </div>
    </div>
  )
}
