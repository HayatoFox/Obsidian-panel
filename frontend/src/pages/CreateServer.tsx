import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import {
  CubeIcon,
  ServerIcon,
  CpuChipIcon,
  CircleStackIcon,
  GlobeAltIcon,
  CommandLineIcon,
  Cog6ToothIcon,
  PlusIcon,
  TrashIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  SignalIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface PortRange {
  port: number
  rcon?: number
  query?: number
  steam?: number
}

interface PortConfig {
  portRanges: PortRange[]
  protocol: string
  rconProtocol?: string
  note?: string
}

interface GameTemplate {
  id: string
  name: string
  displayName: string
  category: string
  description: string
  dockerImage: string
  defaultPort: number
  defaultQueryPort: number | null
  defaultRconPort: number | null
  defaultMemory: number
  defaultCpu: number
  defaultDisk: number
  startupCommand: string
  configSchema: string
  envTemplate: string
  portConfig?: string
}

interface EnvVariable {
  key: string
  value: string
}

interface UsedPort {
  port: number
  serverId: string
  serverName: string
}

type Step = 1 | 2 | 3 | 4

export default function CreateServer() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<GameTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  const [selectedTemplate, setSelectedTemplate] = useState<GameTemplate | null>(null)
  const [selectedPortSlot, setSelectedPortSlot] = useState<PortRange | null>(null)
  const [usedPorts, setUsedPorts] = useState<UsedPort[]>([])
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    // Ports
    port: 25565,
    queryPort: 25565,
    rconPort: 25575,
    // Resources
    memoryLimit: 2048,
    cpuLimit: 2,
    diskLimit: 10240,
    // Startup
    startupCommand: '',
    dockerImage: '',
    // Game config
    gameConfig: {} as Record<string, any>,
  })
  
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([])

  useEffect(() => {
    fetchTemplates()
    fetchUsedPorts()
  }, [])

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/game-templates')
      setTemplates(response.data)
      
      if (response.data.length === 0) {
        try {
          await api.post('/game-templates/seed')
          const seededResponse = await api.get('/game-templates')
          setTemplates(seededResponse.data)
        } catch (e) {
          // Seeding requires admin, ignore
        }
      }
    } catch (error) {
      toast.error('Failed to fetch game templates')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsedPorts = async () => {
    try {
      const response = await api.get('/servers')
      const servers = response.data
      const ports: UsedPort[] = []
      servers.forEach((server: any) => {
        if (server.port) {
          ports.push({ port: server.port, serverId: server.id, serverName: server.name })
        }
        if (server.queryPort && server.queryPort !== server.port) {
          ports.push({ port: server.queryPort, serverId: server.id, serverName: server.name })
        }
        if (server.rconPort && server.rconPort !== server.port) {
          ports.push({ port: server.rconPort, serverId: server.id, serverName: server.name })
        }
      })
      setUsedPorts(ports)
    } catch (error) {
      console.error('Failed to fetch used ports:', error)
    }
  }

  const isPortUsed = (port: number): UsedPort | undefined => {
    return usedPorts.find(p => p.port === port)
  }

  const isSlotAvailable = (slot: PortRange): boolean => {
    const portsToCheck = [slot.port]
    if (slot.query) portsToCheck.push(slot.query)
    if (slot.rcon) portsToCheck.push(slot.rcon)
    if (slot.steam) portsToCheck.push(slot.steam)
    return !portsToCheck.some(p => isPortUsed(p))
  }

  const getPortConfig = (template: GameTemplate): PortConfig | null => {
    if (!template.portConfig) return null
    try {
      return JSON.parse(template.portConfig)
    } catch {
      return null
    }
  }

  const handleTemplateSelect = (template: GameTemplate) => {
    setSelectedTemplate(template)
    setSelectedPortSlot(null)
    
    // Parse env template
    const envTemplate = JSON.parse(template.envTemplate || '{}')
    const envVars: EnvVariable[] = Object.entries(envTemplate).map(([key, value]) => ({
      key,
      value: String(value)
    }))
    setEnvVariables(envVars)
    
    // Get port config and set first available slot
    const portConfig = getPortConfig(template)
    if (portConfig && portConfig.portRanges.length > 0) {
      const firstAvailable = portConfig.portRanges.find(slot => isSlotAvailable(slot))
      if (firstAvailable) {
        setSelectedPortSlot(firstAvailable)
        setFormData(prev => ({
          ...prev,
          port: firstAvailable.port,
          queryPort: firstAvailable.query || firstAvailable.port,
          rconPort: firstAvailable.rcon || template.defaultRconPort || firstAvailable.port + 10,
          memoryLimit: template.defaultMemory,
          cpuLimit: template.defaultCpu,
          diskLimit: template.defaultDisk || 10240,
          startupCommand: template.startupCommand || '',
          dockerImage: template.dockerImage,
          gameConfig: {},
        }))
      } else {
        // All slots used
        setFormData(prev => ({
          ...prev,
          port: template.defaultPort,
          queryPort: template.defaultQueryPort || template.defaultPort,
          rconPort: template.defaultRconPort || template.defaultPort + 10,
          memoryLimit: template.defaultMemory,
          cpuLimit: template.defaultCpu,
          diskLimit: template.defaultDisk || 10240,
          startupCommand: template.startupCommand || '',
          dockerImage: template.dockerImage,
          gameConfig: {},
        }))
      }
    } else {
      // No port config, use defaults
      setFormData(prev => ({
        ...prev,
        port: template.defaultPort,
        queryPort: template.defaultQueryPort || template.defaultPort,
        rconPort: template.defaultRconPort || template.defaultPort + 10,
        memoryLimit: template.defaultMemory,
        cpuLimit: template.defaultCpu,
        diskLimit: template.defaultDisk || 10240,
        startupCommand: template.startupCommand || '',
        dockerImage: template.dockerImage,
        gameConfig: {},
      }))
    }
    
    // Move to next step
    setCurrentStep(2)
  }

  const handlePortSlotSelect = (slot: PortRange) => {
    if (!isSlotAvailable(slot)) return
    setSelectedPortSlot(slot)
    setFormData(prev => ({
      ...prev,
      port: slot.port,
      queryPort: slot.query || slot.port,
      rconPort: slot.rcon || prev.rconPort,
    }))
  }

  const addEnvVariable = () => {
    setEnvVariables([...envVariables, { key: '', value: '' }])
  }

  const removeEnvVariable = (index: number) => {
    setEnvVariables(envVariables.filter((_, i) => i !== index))
  }

  const updateEnvVariable = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envVariables]
    updated[index][field] = value
    setEnvVariables(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplate) {
      toast.error('Please select a game type')
      return
    }

    if (!formData.name.trim()) {
      toast.error('Please enter a server name')
      setCurrentStep(2)
      return
    }

    setCreating(true)
    try {
      // Convert env variables to object
      const envObject: Record<string, string> = {}
      envVariables.forEach(env => {
        if (env.key.trim()) {
          envObject[env.key] = env.value
        }
      })

      const response = await api.post('/servers', {
        name: formData.name,
        description: formData.description,
        gameType: selectedTemplate.name,
        port: formData.port,
        queryPort: formData.queryPort,
        rconPort: formData.rconPort,
        memoryLimit: formData.memoryLimit,
        cpuLimit: formData.cpuLimit,
        diskLimit: formData.diskLimit,
        startupCommand: formData.startupCommand || selectedTemplate.startupCommand,
        dockerImage: formData.dockerImage || selectedTemplate.dockerImage,
        gameConfig: formData.gameConfig,
        environment: envObject,
      })
      toast.success('Server created successfully!')
      navigate(`/servers/${response.data.id}`)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create server')
    } finally {
      setCreating(false)
    }
  }

  const renderConfigField = (key: string, config: any) => {
    const value = formData.gameConfig[key] ?? config.default

    if (config.type === 'select') {
      const options = config.options.map((opt: any) => 
        typeof opt === 'object' ? opt : { value: opt, label: opt }
      )
      return (
        <select
          value={value}
          onChange={(e) =>
            setFormData({
              ...formData,
              gameConfig: { ...formData.gameConfig, [key]: e.target.value },
            })
          }
          className="input"
        >
          {options.map((opt: { value: string; label: string }) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )
    }

    if (config.type === 'boolean') {
      return (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setFormData({
                ...formData,
                gameConfig: { ...formData.gameConfig, [key]: true },
              })
            }
            className={clsx(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              value === true
                ? 'bg-green-600 text-white'
                : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
            )}
          >
            Oui
          </button>
          <button
            type="button"
            onClick={() =>
              setFormData({
                ...formData,
                gameConfig: { ...formData.gameConfig, [key]: false },
              })
            }
            className={clsx(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              value === false
                ? 'bg-red-600 text-white'
                : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
            )}
          >
            Non
          </button>
        </div>
      )
    }

    if (config.type === 'number') {
      return (
        <input
          type="number"
          value={value}
          min={config.min}
          max={config.max}
          onChange={(e) =>
            setFormData({
              ...formData,
              gameConfig: { ...formData.gameConfig, [key]: parseFloat(e.target.value) },
            })
          }
          className="input"
        />
      )
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) =>
          setFormData({
            ...formData,
            gameConfig: { ...formData.gameConfig, [key]: e.target.value },
          })
        }
        className="input"
        placeholder={config.default}
      />
    )
  }

  // Mapping des noms de templates vers les fichiers d'images (avec extensions)
  const getGameImage = (name: string): string => {
    const imageMap: Record<string, string> = {
      'minecraft-java': '/images/games/minecraft.png',
      'gmod': '/images/games/gmod.webp',
      'cs2': '/images/games/cs2.webp',
      'csgo': '/images/games/cs2.webp',
      'valheim': '/images/games/valheim.webp',
      'palworld': '/images/games/palworld.webp',
      'core-keeper': '/images/games/corekeeper.PNG',
      'terraria': '/images/games/terraria.PNG',
      'vintage-story': '/images/games/vintage story.webp',
      'stardew-valley': '/images/games/stardew-valley.webp',
      'hytale': '/images/games/hytale.webp',
      'abiotic-factor': '/images/games/abiotic-factor.PNG',
      'rust': '/images/games/rust.webp',
      'ark': '/images/games/ark.PNG',
    }
    return imageMap[name] || '/images/games/default.svg'
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'minecraft': return { icon: '⛏️', label: 'Minecraft' }
      case 'steamcmd': return { icon: '🎮', label: 'Jeux Steam (SteamCMD)' }
      case 'other': return { icon: '🎯', label: 'Autres jeux' }
      default: return { icon: '🎮', label: category }
    }
  }

  const formatBytes = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
    return `${mb} MB`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-obsidian-500"></div>
      </div>
    )
  }

  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = []
    }
    acc[template.category].push(template)
    return acc
  }, {} as Record<string, GameTemplate[]>)

  // Sort categories
  const sortedCategories = ['minecraft', 'steamcmd', 'other'].filter(cat => groupedTemplates[cat])

  const formatPortSlot = (slot: PortRange, template: GameTemplate) => {
    const parts = [`Port: ${slot.port}`]
    if (slot.query && slot.query !== slot.port) parts.push(`Query: ${slot.query}`)
    if (slot.rcon) parts.push(`RCON: ${slot.rcon}`)
    if (slot.steam) parts.push(`Steam: ${slot.steam}`)
    
    // Special case for Valheim (3 consecutive ports)
    if (template.name === 'valheim' && slot.steam) {
      return `Ports ${slot.port}-${slot.steam}`
    }
    
    return parts.join(' | ')
  }

  const steps = [
    { id: 1, name: 'Type de jeu', icon: CubeIcon },
    { id: 2, name: 'Configuration', icon: Cog6ToothIcon },
    { id: 3, name: 'Ressources', icon: CpuChipIcon },
    { id: 4, name: 'Finalisation', icon: CheckCircleIcon },
  ]

  const canProceed = (step: Step): boolean => {
    switch (step) {
      case 1:
        return selectedTemplate !== null
      case 2:
        return formData.name.trim().length > 0
      case 3:
        return true
      case 4:
        return true
      default:
        return false
    }
  }

  return (
    <div className="p-8 pb-24">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-100">Créer un serveur</h1>
          <p className="text-gray-400 mt-2">Configurez votre nouveau serveur de jeu</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <button
                  onClick={() => step.id <= currentStep && setCurrentStep(step.id as Step)}
                  disabled={step.id > currentStep}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                    step.id === currentStep
                      ? 'bg-obsidian-600 text-white'
                      : step.id < currentStep
                      ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                      : 'bg-dark-700 text-gray-500 cursor-not-allowed'
                  )}
                >
                  <step.icon className="h-5 w-5" />
                  <span className="hidden sm:inline">{step.name}</span>
                  <span className="sm:hidden">{step.id}</span>
                </button>
                {index < steps.length - 1 && (
                  <div
                    className={clsx(
                      'flex-1 h-0.5 mx-2',
                      step.id < currentStep ? 'bg-green-600' : 'bg-dark-700'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Game Selection */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {sortedCategories.map((category) => {
                const categoryTemplates = groupedTemplates[category] || []
                if (categoryTemplates.length === 0) return null
                const { icon, label } = getCategoryLabel(category)
                return (
                  <div key={category} className="card">
                    <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                      <span>{icon}</span> {label}
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {categoryTemplates.map((template) => {
                        const portConfig = getPortConfig(template)
                        const availableSlots = portConfig?.portRanges?.filter(slot => isSlotAvailable(slot)).length ?? 0
                        const totalSlots = portConfig?.portRanges?.length ?? 0
                        const hasPortConfig = !!(portConfig && portConfig.portRanges && portConfig.portRanges.length > 0)
                        const isDisabled = hasPortConfig && availableSlots === 0
                        
                        return (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => handleTemplateSelect(template)}
                            disabled={!!isDisabled}
                            className={clsx(
                              'group relative overflow-hidden rounded-xl border-2 text-left transition-all flex flex-col',
                              isDisabled
                                ? 'border-dark-700 bg-dark-900 opacity-50 cursor-not-allowed'
                                : selectedTemplate?.id === template.id
                                ? 'border-obsidian-500 shadow-lg shadow-obsidian-500/30 scale-[1.02]'
                                : 'border-dark-600 hover:border-obsidian-500/50 hover:scale-[1.02]'
                            )}
                          >
                            {/* Image de fond bannière verticale ratio 3:2 */}
                            <div className="relative w-full overflow-hidden bg-dark-900" style={{ aspectRatio: '2/3' }}>
                              <img
                                src={getGameImage(template.name)}
                                alt={template.displayName}
                                className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-110"
                                onError={(e) => {
                                  // Fallback si l'image n'existe pas
                                  (e.target as HTMLImageElement).src = '/images/games/default.svg'
                                }}
                              />
                              {/* Overlay gradient */}
                              <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/60 to-transparent" />
                              
                              {/* Badge sélectionné */}
                              {selectedTemplate?.id === template.id && (
                                <div className="absolute top-2 right-2 px-2 py-1 bg-obsidian-600 rounded-lg text-xs font-medium text-white">
                                  ✓ Sélectionné
                                </div>
                              )}
                            </div>
                            
                            {/* Contenu */}
                            <div className="p-4 bg-dark-800">
                              <p className="font-semibold text-gray-200 text-lg">{template.displayName}</p>
                              <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                                {template.description}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-3">
                                  {hasPortConfig ? (
                                    <span className={clsx(
                                      'px-2 py-0.5 rounded text-xs flex items-center gap-1',
                                      availableSlots === 0 
                                        ? 'bg-red-900/50 text-red-400'
                                        : availableSlots <= 2
                                        ? 'bg-yellow-900/50 text-yellow-400'
                                        : 'bg-green-900/50 text-green-400'
                                    )}>
                                      <SignalIcon className="h-3 w-3" />
                                      {availableSlots}/{totalSlots} slots
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-obsidian-900/50 text-obsidian-400 rounded text-xs flex items-center gap-1">
                                      <SignalIcon className="h-3 w-3" />
                                      Port {template.defaultPort}
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 bg-dark-700 rounded text-xs text-gray-400">
                                    {formatBytes(template.defaultMemory)}
                                  </span>
                                </div>
                              </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Step 2: Basic Configuration */}
          {currentStep === 2 && selectedTemplate && (
            <div className="space-y-6">
              {/* Server Info */}
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                  <ServerIcon className="h-5 w-5" />
                  Informations du serveur
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nom du serveur *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input"
                      placeholder="Mon super serveur"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description (optionnel)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="input min-h-[80px]"
                      placeholder="Description de votre serveur..."
                    />
                  </div>
                </div>
              </div>

              {/* Ports Configuration - Slot Selection */}
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                  <GlobeAltIcon className="h-5 w-5" />
                  Sélection du slot de ports
                </h2>
                
                {(() => {
                  const portConfig = getPortConfig(selectedTemplate)
                  
                  if (!portConfig) {
                    // No port config - show manual inputs
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Port du jeu *
                          </label>
                          <input
                            type="number"
                            value={formData.port}
                            onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                            className="input"
                            min={1024}
                            max={65535}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Port Query
                          </label>
                          <input
                            type="number"
                            value={formData.queryPort}
                            onChange={(e) => setFormData({ ...formData, queryPort: parseInt(e.target.value) })}
                            className="input"
                            min={1024}
                            max={65535}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Port RCON
                          </label>
                          <input
                            type="number"
                            value={formData.rconPort}
                            onChange={(e) => setFormData({ ...formData, rconPort: parseInt(e.target.value) })}
                            className="input"
                            min={1024}
                            max={65535}
                          />
                        </div>
                      </div>
                    )
                  }
                  
                  return (
                    <>
                      <p className="text-gray-400 text-sm mb-4">
                        Choisissez un slot de ports disponible pour votre serveur {selectedTemplate.displayName}
                      </p>
                      
                      {portConfig.note && (
                        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800 rounded-lg flex items-start gap-2">
                          <InformationCircleIcon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-blue-300">{portConfig.note}</span>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {portConfig.portRanges.map((slot, index) => {
                          const available = isSlotAvailable(slot)
                          const usedBy = isPortUsed(slot.port)
                          const isSelected = selectedPortSlot?.port === slot.port
                          
                          return (
                            <button
                              key={index}
                              type="button"
                              onClick={() => handlePortSlotSelect(slot)}
                              disabled={!available}
                              className={clsx(
                                'p-4 rounded-xl border-2 text-left transition-all',
                                !available
                                  ? 'border-dark-700 bg-dark-900/50 cursor-not-allowed'
                                  : isSelected
                                  ? 'border-obsidian-500 bg-obsidian-600/20 shadow-lg shadow-obsidian-500/20'
                                  : 'border-dark-600 hover:border-obsidian-500/50 bg-dark-800'
                              )}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className={clsx(
                                  'text-lg font-bold',
                                  !available ? 'text-gray-600' : isSelected ? 'text-obsidian-400' : 'text-gray-200'
                                )}>
                                  Slot #{index + 1}
                                </span>
                                {available ? (
                                  <span className="px-2 py-0.5 bg-green-900/50 text-green-400 rounded text-xs">
                                    Disponible
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-red-900/50 text-red-400 rounded text-xs">
                                    Occupé
                                  </span>
                                )}
                              </div>
                              
                              <div className={clsx(
                                'text-sm font-mono',
                                !available ? 'text-gray-600' : 'text-gray-400'
                              )}>
                                {formatPortSlot(slot, selectedTemplate)}
                              </div>
                              
                              {!available && usedBy && (
                                <div className="mt-2 flex items-center gap-1 text-xs text-red-400">
                                  <ExclamationTriangleIcon className="h-3 w-3" />
                                  Utilisé par: {usedBy.serverName}
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                      
                      {/* Selected slot summary */}
                      {selectedPortSlot && (
                        <div className="mt-4 p-4 bg-obsidian-900/30 border border-obsidian-700 rounded-lg">
                          <h4 className="text-sm font-medium text-obsidian-400 mb-2">Ports sélectionnés</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-400">Port principal:</span>
                              <span className="ml-2 text-white font-mono">{selectedPortSlot.port}</span>
                            </div>
                            {selectedPortSlot.query && selectedPortSlot.query !== selectedPortSlot.port && (
                              <div>
                                <span className="text-gray-400">Query:</span>
                                <span className="ml-2 text-white font-mono">{selectedPortSlot.query}</span>
                              </div>
                            )}
                            {selectedPortSlot.rcon && (
                              <div>
                                <span className="text-gray-400">RCON:</span>
                                <span className="ml-2 text-white font-mono">{selectedPortSlot.rcon}</span>
                              </div>
                            )}
                            {selectedPortSlot.steam && (
                              <div>
                                <span className="text-gray-400">Steam:</span>
                                <span className="ml-2 text-white font-mono">{selectedPortSlot.steam}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Game Specific Config */}
              {selectedTemplate.configSchema && selectedTemplate.configSchema !== '{}' && (
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                    <Cog6ToothIcon className="h-5 w-5" />
                    Configuration {selectedTemplate.displayName}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(JSON.parse(selectedTemplate.configSchema)).map(
                      ([key, config]: [string, any]) => (
                        <div key={key}>
                          <label className="block text-sm font-medium text-gray-300 mb-2 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                          </label>
                          {renderConfigField(key, config)}
                          {config.description && (
                            <p className="text-xs text-gray-500 mt-1">{config.description}</p>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Resources */}
          {currentStep === 3 && selectedTemplate && (
            <div className="space-y-6">
              {/* Resource Allocation */}
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                  <CpuChipIcon className="h-5 w-5" />
                  Allocation des ressources
                </h2>

                <div className="space-y-8">
                  {/* Memory */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-300">
                        Mémoire RAM
                      </label>
                      <span className="text-lg font-bold text-obsidian-400">
                        {formatBytes(formData.memoryLimit)}
                      </span>
                    </div>
                    <input
                      type="range"
                      value={formData.memoryLimit}
                      onChange={(e) => setFormData({ ...formData, memoryLimit: parseInt(e.target.value) })}
                      className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-obsidian-500"
                      min={512}
                      max={32768}
                      step={512}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>512 MB</span>
                      <span>32 GB</span>
                    </div>
                  </div>

                  {/* CPU */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-300">
                        CPU (Cœurs)
                      </label>
                      <span className="text-lg font-bold text-obsidian-400">
                        {formData.cpuLimit} {formData.cpuLimit > 1 ? 'cœurs' : 'cœur'}
                      </span>
                    </div>
                    <input
                      type="range"
                      value={formData.cpuLimit}
                      onChange={(e) => setFormData({ ...formData, cpuLimit: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-obsidian-500"
                      min={0.5}
                      max={16}
                      step={0.5}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0.5</span>
                      <span>16</span>
                    </div>
                  </div>

                  {/* Disk */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-300">
                        Espace disque
                      </label>
                      <span className="text-lg font-bold text-obsidian-400">
                        {formatBytes(formData.diskLimit)}
                      </span>
                    </div>
                    <input
                      type="range"
                      value={formData.diskLimit}
                      onChange={(e) => setFormData({ ...formData, diskLimit: parseInt(e.target.value) })}
                      className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-obsidian-500"
                      min={1024}
                      max={102400}
                      step={1024}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1 GB</span>
                      <span>100 GB</span>
                    </div>
                  </div>
                </div>

                {/* Resource Summary */}
                <div className="mt-6 p-4 bg-dark-800 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Résumé des ressources</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <CircleStackIcon className="h-6 w-6 mx-auto text-blue-400 mb-1" />
                      <p className="text-lg font-bold text-gray-200">{formatBytes(formData.memoryLimit)}</p>
                      <p className="text-xs text-gray-500">RAM</p>
                    </div>
                    <div>
                      <CpuChipIcon className="h-6 w-6 mx-auto text-green-400 mb-1" />
                      <p className="text-lg font-bold text-gray-200">{formData.cpuLimit}</p>
                      <p className="text-xs text-gray-500">CPU</p>
                    </div>
                    <div>
                      <ServerIcon className="h-6 w-6 mx-auto text-purple-400 mb-1" />
                      <p className="text-lg font-bold text-gray-200">{formatBytes(formData.diskLimit)}</p>
                      <p className="text-xs text-gray-500">Disque</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Environment Variables */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                    <CommandLineIcon className="h-5 w-5" />
                    Variables d'environnement
                  </h2>
                  <button
                    type="button"
                    onClick={addEnvVariable}
                    className="btn btn-secondary text-sm"
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Ajouter
                  </button>
                </div>

                {envVariables.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucune variable d'environnement configurée</p>
                ) : (
                  <div className="space-y-3">
                    {envVariables.map((env, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <input
                          type="text"
                          value={env.key}
                          onChange={(e) => updateEnvVariable(index, 'key', e.target.value)}
                          className="input flex-1"
                          placeholder="VARIABLE_NAME"
                        />
                        <span className="text-gray-500">=</span>
                        <input
                          type="text"
                          value={env.value}
                          onChange={(e) => updateEnvVariable(index, 'value', e.target.value)}
                          className="input flex-1"
                          placeholder="value"
                        />
                        <button
                          type="button"
                          onClick={() => removeEnvVariable(index)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Advanced Options */}
              <div className="card">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                    <Cog6ToothIcon className="h-5 w-5" />
                    Options avancées
                  </h2>
                  {showAdvanced ? (
                    <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Image Docker
                      </label>
                      <input
                        type="text"
                        value={formData.dockerImage}
                        onChange={(e) => setFormData({ ...formData, dockerImage: e.target.value })}
                        className="input font-mono text-sm"
                        placeholder={selectedTemplate.dockerImage}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Laisser vide pour utiliser l'image par défaut
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Commande de démarrage
                      </label>
                      <input
                        type="text"
                        value={formData.startupCommand}
                        onChange={(e) => setFormData({ ...formData, startupCommand: e.target.value })}
                        className="input font-mono text-sm"
                        placeholder={selectedTemplate.startupCommand || 'Commande par défaut'}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Commande personnalisée pour démarrer le serveur
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && selectedTemplate && (
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-400" />
                  Récapitulatif
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Server Info */}
                  <div className="p-4 bg-dark-800 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Serveur</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Nom</span>
                        <span className="text-gray-200 font-medium">{formData.name || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Jeu</span>
                        <span className="text-gray-200 font-medium flex items-center gap-2">
                          <img 
                            src={getGameImage(selectedTemplate.name)} 
                            alt={selectedTemplate.displayName}
                            className="h-6 w-10 object-cover rounded"
                          />
                          {selectedTemplate.displayName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ports */}
                  <div className="p-4 bg-dark-800 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Ports</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Port jeu</span>
                        <span className="text-gray-200 font-mono">{formData.port}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Port Query</span>
                        <span className="text-gray-200 font-mono">{formData.queryPort}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Port RCON</span>
                        <span className="text-gray-200 font-mono">{formData.rconPort}</span>
                      </div>
                    </div>
                  </div>

                  {/* Resources */}
                  <div className="p-4 bg-dark-800 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Ressources</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">RAM</span>
                        <span className="text-gray-200 font-medium">{formatBytes(formData.memoryLimit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">CPU</span>
                        <span className="text-gray-200 font-medium">{formData.cpuLimit} cœurs</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Disque</span>
                        <span className="text-gray-200 font-medium">{formatBytes(formData.diskLimit)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Environment */}
                  <div className="p-4 bg-dark-800 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Variables d'environnement</h3>
                    {envVariables.filter(e => e.key).length === 0 ? (
                      <p className="text-gray-500 text-sm">Aucune</p>
                    ) : (
                      <div className="space-y-1 font-mono text-sm">
                        {envVariables.filter(e => e.key).map((env, i) => (
                          <div key={i} className="text-gray-300">
                            {env.key}=<span className="text-obsidian-400">{env.value || '""'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Game Config Summary */}
                {Object.keys(formData.gameConfig).length > 0 && (
                  <div className="mt-4 p-4 bg-dark-800 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Configuration du jeu</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.entries(formData.gameConfig).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="text-gray-200">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Info box */}
                <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800 rounded-lg flex items-start gap-3">
                  <InformationCircleIcon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-200">
                    <p className="font-medium">Prêt à créer</p>
                    <p className="text-blue-300 mt-1">
                      Votre serveur sera créé avec les paramètres ci-dessus. Vous pourrez modifier la configuration ultérieurement.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="fixed bottom-0 left-64 right-0 bg-dark-900/95 backdrop-blur border-t border-dark-700 p-4 z-10">
            <div className="max-w-5xl mx-auto flex justify-between items-center">
              <button
                type="button"
                onClick={() => currentStep > 1 ? setCurrentStep((currentStep - 1) as Step) : navigate('/servers')}
                className="btn btn-secondary"
              >
                {currentStep > 1 ? 'Précédent' : 'Annuler'}
              </button>

              <div className="flex gap-3">
                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((currentStep + 1) as Step)}
                    disabled={!canProceed(currentStep)}
                    className="btn btn-primary"
                  >
                    Suivant
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={creating || !selectedTemplate || !formData.name.trim()}
                    className="btn btn-primary"
                  >
                    {creating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                        Création en cours...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-5 w-5 mr-2" />
                        Créer le serveur
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
