import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'

interface GameTemplate {
  id: string
  name: string
  displayName: string
  category: string
  description: string
  defaultPort: number
  defaultMemory: number
  defaultCpu: number
  configSchema: string
}

export default function CreateServer() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<GameTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  
  const [selectedTemplate, setSelectedTemplate] = useState<GameTemplate | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    port: 25565,
    memoryLimit: 2048,
    cpuLimit: 2,
    gameConfig: {} as Record<string, any>,
  })

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/game-templates')
      setTemplates(response.data)
      
      // If no templates, try to seed them
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

  const handleTemplateSelect = (template: GameTemplate) => {
    setSelectedTemplate(template)
    setFormData({
      ...formData,
      port: template.defaultPort,
      memoryLimit: template.defaultMemory,
      cpuLimit: template.defaultCpu,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplate) {
      toast.error('Please select a game type')
      return
    }

    setCreating(true)
    try {
      const response = await api.post('/servers', {
        name: formData.name,
        gameType: selectedTemplate.name,
        port: formData.port,
        memoryLimit: formData.memoryLimit,
        cpuLimit: formData.cpuLimit,
        gameConfig: formData.gameConfig,
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
          {config.options.map((opt: string) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )
    }

    if (config.type === 'boolean') {
      return (
        <select
          value={String(value)}
          onChange={(e) =>
            setFormData({
              ...formData,
              gameConfig: { ...formData.gameConfig, [key]: e.target.value === 'true' },
            })
          }
          className="input"
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
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
              gameConfig: { ...formData.gameConfig, [key]: parseInt(e.target.value) },
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

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Create New Server</h1>
        <p className="text-gray-400 mb-8">Select a game and configure your server</p>

        <form onSubmit={handleSubmit}>
          {/* Game Selection */}
          <div className="card mb-6">
            <h2 className="text-xl font-semibold text-gray-200 mb-4">1. Select Game</h2>
            
            {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
              <div key={category} className="mb-6">
                <h3 className="text-sm font-medium text-gray-400 uppercase mb-3">
                  {category === 'minecraft' ? 'Minecraft' : 'Steam Games'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {categoryTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleTemplateSelect(template)}
                      className={`p-4 rounded-lg border-2 text-left transition-colors ${
                        selectedTemplate?.id === template.id
                          ? 'border-obsidian-500 bg-obsidian-600/20'
                          : 'border-dark-600 hover:border-dark-500 bg-dark-800'
                      }`}
                    >
                      <p className="font-medium text-gray-200">{template.displayName}</p>
                      <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Basic Configuration */}
          <div className="card mb-6">
            <h2 className="text-xl font-semibold text-gray-200 mb-4">2. Basic Configuration</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Server Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="My Awesome Server"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Port
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
                  Memory (MB)
                </label>
                <input
                  type="number"
                  value={formData.memoryLimit}
                  onChange={(e) => setFormData({ ...formData, memoryLimit: parseInt(e.target.value) })}
                  className="input"
                  min={512}
                  max={32768}
                  step={512}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  CPU Cores
                </label>
                <input
                  type="number"
                  value={formData.cpuLimit}
                  onChange={(e) => setFormData({ ...formData, cpuLimit: parseFloat(e.target.value) })}
                  className="input"
                  min={0.5}
                  max={16}
                  step={0.5}
                  required
                />
              </div>
            </div>
          </div>

          {/* Game Configuration */}
          {selectedTemplate && (
            <div className="card mb-6">
              <h2 className="text-xl font-semibold text-gray-200 mb-4">
                3. {selectedTemplate.displayName} Configuration
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(JSON.parse(selectedTemplate.configSchema || '{}')).map(
                  ([key, config]: [string, any]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-300 mb-2 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
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

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/servers')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !selectedTemplate}
              className="btn btn-primary"
            >
              {creating ? 'Creating...' : 'Create Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
