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

// Parse gameConfig to get javaVersion
const parseGameConfig = (gameConfig: string) => {
  try {
    return JSON.parse(gameConfig)
  } catch {
    return {}
  }
}

interface Props {
  server: Server
  onUpdate: () => void
}

// Java versions available for Minecraft
const JAVA_VERSIONS = [
  { value: '8', label: 'Java 8 (1.8 - 1.16)' },
  { value: '11', label: 'Java 11 (1.12 - 1.16)' },
  { value: '16', label: 'Java 16 (1.16 - 1.17)' },
  { value: '17', label: 'Java 17 (1.17 - 1.20)' },
  { value: '18', label: 'Java 18 (1.18+)' },
  { value: '21', label: 'Java 21 LTS (1.20.5+)' },
  { value: '25', label: 'Java 25 (Dernière)' },
]

// Server types for custom servers
const SERVER_TYPES = [
  { value: '', label: 'Auto (utilise la config de création)' },
  { value: 'CUSTOM', label: 'Custom (serveur pré-installé)' },
  { value: 'VANILLA', label: 'Vanilla' },
  { value: 'PAPER', label: 'Paper' },
  { value: 'SPIGOT', label: 'Spigot' },
  { value: 'BUKKIT', label: 'Bukkit' },
  { value: 'FORGE', label: 'Forge' },
  { value: 'NEOFORGE', label: 'NeoForge' },
  { value: 'FABRIC', label: 'Fabric' },
  { value: 'QUILT', label: 'Quilt' },
  { value: 'PURPUR', label: 'Purpur' },
]

export default function SettingsTab({ server, onUpdate }: Props) {
  const gameConfig = parseGameConfig(server.gameConfig)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: server.name,
    memoryLimit: server.memoryLimit,
    cpuLimit: server.cpuLimit,
    maxPlayers: gameConfig.maxPlayers || 20,
    motd: gameConfig.motd || 'An Obsidian Panel Server',
    pvp: gameConfig.pvp !== false,
    difficulty: gameConfig.difficulty || 'normal',
    gamemode: gameConfig.gamemode || 'survival',
    javaVersion: gameConfig.javaVersion || '17',
    serverType: gameConfig.serverType || '',
    jvmArgs: gameConfig.jvmArgs || '',
    serverJar: gameConfig.serverJar || '',
    startupCommand: gameConfig.startupCommand || '',
    skipServerInstall: gameConfig.skipServerInstall || false,
  })
  const [recreating, setRecreating] = useState(false)
  
  // Track original values that require container recreation
  const originalConfig = {
    javaVersion: gameConfig.javaVersion || '17',
    serverType: gameConfig.serverType || '',
    jvmArgs: gameConfig.jvmArgs || '',
    serverJar: gameConfig.serverJar || '',
    startupCommand: gameConfig.startupCommand || '',
    skipServerInstall: gameConfig.skipServerInstall || false,
    memoryLimit: server.memoryLimit,
    cpuLimit: server.cpuLimit,
  }

  // Check if any setting that requires container recreation has changed
  const needsRecreation = () => {
    return (
      formData.javaVersion !== originalConfig.javaVersion ||
      formData.serverType !== originalConfig.serverType ||
      formData.jvmArgs !== originalConfig.jvmArgs ||
      formData.serverJar !== originalConfig.serverJar ||
      formData.startupCommand !== originalConfig.startupCommand ||
      formData.skipServerInstall !== originalConfig.skipServerInstall ||
      formData.memoryLimit !== originalConfig.memoryLimit ||
      formData.cpuLimit !== originalConfig.cpuLimit
    )
  }

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
          javaVersion: formData.javaVersion,
          serverType: formData.serverType || undefined,
          jvmArgs: formData.jvmArgs,
          serverJar: formData.serverJar,
          startupCommand: formData.startupCommand,
          skipServerInstall: formData.skipServerInstall,
        }
      })
      toast.success('Paramètres sauvegardés')
      
      // If settings requiring container recreation changed, offer to recreate
      if (needsRecreation() && server.gameType.includes('minecraft')) {
        toast((t) => (
          <div className="flex flex-col gap-2">
            <span>Les paramètres ont changé. Recréer le conteneur pour appliquer les modifications ?</span>
            <p className="text-xs text-gray-400">
              (Java, JVM, JAR, mémoire, CPU nécessitent une recréation)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  toast.dismiss(t.id)
                  handleRecreateContainer()
                }}
                className="px-3 py-1 bg-purple-600 text-white rounded text-sm"
              >
                Recréer maintenant
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
              >
                Plus tard
              </button>
            </div>
          </div>
        ), { duration: 15000 })
      }
      
      onUpdate()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  const handleRecreateContainer = async () => {
    setRecreating(true)
    console.log('[RECREATE] Starting container recreation...')
    try {
      const response = await api.post(`/servers/${server.id}/recreate`, {}, {
        timeout: 120000 // 2 minutes timeout
      })
      console.log('[RECREATE] Response:', response.data)
      toast.success('Conteneur recréé avec succès. Vous pouvez maintenant démarrer le serveur.')
      // Force a small delay then refresh to ensure DB is updated
      await new Promise(resolve => setTimeout(resolve, 500))
      onUpdate()
    } catch (error: any) {
      console.error('[RECREATE] Error:', error)
      toast.error(error.response?.data?.error || error.message || 'Erreur lors de la recréation du conteneur')
      // Still refresh to get current status
      onUpdate()
    } finally {
      setRecreating(false)
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

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Version Java
                  </label>
                  <select
                    value={formData.javaVersion}
                    onChange={(e) => setFormData({ ...formData, javaVersion: e.target.value })}
                    className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {JAVA_VERSIONS.map((java) => (
                      <option key={java.value} value={java.value}>
                        {java.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Sélectionnez la version Java compatible avec votre version Minecraft
                  </p>
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

        {/* Startup & JVM Settings - Only for Minecraft */}
        {server.gameType.includes('minecraft') && (
          <div className="bg-dark-800 rounded-xl p-6 border border-dark-700 mb-6">
            <h3 className="text-lg font-semibold text-white mb-6">
              Configuration de démarrage & JVM
            </h3>
            
            <div className="space-y-6">
              {/* Server Type Override */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Type de serveur (override)
                </label>
                <select
                  value={formData.serverType}
                  onChange={(e) => setFormData({ ...formData, serverType: e.target.value })}
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {SERVER_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Utilisez "Custom" pour un serveur pré-installé (évite la réinstallation automatique)
                </p>
              </div>

              {/* Skip Server Install */}
              <div className="flex items-center p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                <input
                  type="checkbox"
                  id="skipServerInstall"
                  checked={formData.skipServerInstall}
                  onChange={(e) => setFormData({ ...formData, skipServerInstall: e.target.checked })}
                  className="w-4 h-4 text-purple-600 bg-dark-700 border-dark-600 rounded focus:ring-purple-500"
                />
                <div className="ml-3">
                  <label htmlFor="skipServerInstall" className="text-sm font-medium text-gray-300">
                    Passer l'installation du serveur
                  </label>
                  <p className="text-xs text-gray-500">
                    Cochez si vous avez déjà installé le serveur manuellement (utile pour serveurs custom/modpacks)
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Arguments JVM
                </label>
                <textarea
                  value={formData.jvmArgs}
                  onChange={(e) => setFormData({ ...formData, jvmArgs: e.target.value })}
                  placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200"
                  rows={3}
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Arguments JVM supplémentaires (sans -Xms/-Xmx, gérés automatiquement). Ex: -XX:+UseG1GC
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Fichier JAR du serveur
                </label>
                <input
                  type="text"
                  value={formData.serverJar}
                  onChange={(e) => setFormData({ ...formData, serverJar: e.target.value })}
                  placeholder="server.jar (laisser vide pour auto-détection)"
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Nom du fichier JAR à utiliser (ex: paper-1.20.4.jar, forge-server.jar). Laisser vide pour auto-détection.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Commande de démarrage personnalisée
                </label>
                <textarea
                  value={formData.startupCommand}
                  onChange={(e) => setFormData({ ...formData, startupCommand: e.target.value })}
                  placeholder="Laisser vide pour utiliser la commande par défaut"
                  rows={2}
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Commande complète personnalisée (écrase JAR et arguments). Laisser vide pour utiliser les paramètres ci-dessus.
                </p>
              </div>

              <div className="bg-dark-700/50 rounded-lg p-4 border border-dark-600">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Exemples d'arguments JVM courants :</h4>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li><code className="text-purple-400">-XX:+UseG1GC</code> - Utilise le garbage collector G1 (recommandé)</li>
                  <li><code className="text-purple-400">-XX:+ParallelRefProcEnabled</code> - Active le traitement parallèle des références</li>
                  <li><code className="text-purple-400">-XX:MaxGCPauseMillis=200</code> - Limite les pauses GC à 200ms</li>
                  <li><code className="text-purple-400">-XX:+UnlockExperimentalVMOptions</code> - Débloque les options expérimentales</li>
                  <li><code className="text-purple-400">-XX:+DisableExplicitGC</code> - Désactive les appels System.gc() explicites</li>
                  <li><code className="text-purple-400">-Daikars.new.flags=true</code> - Utilise les flags Aikar optimisés</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || recreating}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? 'Sauvegarde...' : recreating ? 'Recréation...' : 'Sauvegarder les modifications'}
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
