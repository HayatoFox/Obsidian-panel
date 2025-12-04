import { useState, useEffect } from 'react'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
  ClockIcon,
  ArrowPathIcon,
  CommandLineIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline'
import api from '../../lib/api'
import toast from 'react-hot-toast'

interface Server {
  id: string
}

interface Schedule {
  id: string
  name: string
  type: 'restart' | 'backup' | 'command'
  command?: string
  cron: string
  enabled: boolean
  lastRun: string | null
  nextRun: string
}

interface Props {
  server: Server
}

const scheduleTypeIcons: Record<string, typeof PlayIcon> = {
  restart: ArrowPathIcon,
  backup: ArchiveBoxIcon,
  command: CommandLineIcon,
}

const scheduleTypeLabels: Record<string, string> = {
  restart: 'Redémarrage',
  backup: 'Backup',
  command: 'Commande',
}

export default function SchedulesTab({ server }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'restart' as 'restart' | 'backup' | 'command',
    command: '',
    hour: '00',
    minute: '00',
    days: ['*'] as string[],
  })

  useEffect(() => {
    fetchSchedules()
  }, [server.id])

  const fetchSchedules = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/servers/${server.id}/schedules`)
      setSchedules(response.data.schedules || [])
    } catch (error) {
      // Mock data
      setSchedules([
        { id: '1', name: 'Restart quotidien', type: 'restart', cron: '0 4 * * *', enabled: true, lastRun: new Date(Date.now() - 86400000).toISOString(), nextRun: new Date(Date.now() + 43200000).toISOString() },
        { id: '2', name: 'Backup journalier', type: 'backup', cron: '0 3 * * *', enabled: true, lastRun: new Date(Date.now() - 90000000).toISOString(), nextRun: new Date(Date.now() + 36000000).toISOString() },
        { id: '3', name: 'Annonce horaire', type: 'command', command: 'say Le serveur redémarrera à 4h00!', cron: '0 * * * *', enabled: false, lastRun: null, nextRun: new Date(Date.now() + 3600000).toISOString() },
        { id: '4', name: 'Sauvegarde hebdo', type: 'backup', cron: '0 2 * * 0', enabled: true, lastRun: new Date(Date.now() - 604800000).toISOString(), nextRun: new Date(Date.now() + 259200000).toISOString() },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (schedule: Schedule) => {
    try {
      await api.patch(`/servers/${server.id}/schedules/${schedule.id}`, {
        enabled: !schedule.enabled
      })
      setSchedules(schedules.map(s => 
        s.id === schedule.id ? { ...s, enabled: !s.enabled } : s
      ))
      toast.success(`Planification ${schedule.enabled ? 'désactivée' : 'activée'}`)
    } catch (error) {
      toast.error('Erreur lors de la modification')
    }
  }

  const handleDelete = async (schedule: Schedule) => {
    if (!confirm(`Supprimer la planification "${schedule.name}" ?`)) return

    try {
      await api.delete(`/servers/${server.id}/schedules/${schedule.id}`)
      setSchedules(schedules.filter(s => s.id !== schedule.id))
      toast.success('Planification supprimée')
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule)
    const [minute, hour] = schedule.cron.split(' ')
    setFormData({
      name: schedule.name,
      type: schedule.type,
      command: schedule.command || '',
      hour,
      minute,
      days: ['*'],
    })
    setShowModal(true)
  }

  const handleCreate = () => {
    setEditingSchedule(null)
    setFormData({
      name: '',
      type: 'restart',
      command: '',
      hour: '04',
      minute: '00',
      days: ['*'],
    })
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Veuillez entrer un nom')
      return
    }

    const cron = `${formData.minute} ${formData.hour} * * *`

    try {
      if (editingSchedule) {
        await api.patch(`/servers/${server.id}/schedules/${editingSchedule.id}`, {
          name: formData.name,
          type: formData.type,
          command: formData.type === 'command' ? formData.command : undefined,
          cron,
        })
        toast.success('Planification modifiée')
      } else {
        await api.post(`/servers/${server.id}/schedules`, {
          name: formData.name,
          type: formData.type,
          command: formData.type === 'command' ? formData.command : undefined,
          cron,
        })
        toast.success('Planification créée')
      }
      setShowModal(false)
      fetchSchedules()
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const formatCron = (cron: string) => {
    const [minute, hour, dayOfMonth, _month, dayOfWeek] = cron.split(' ')
    
    let timeStr = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
    
    if (dayOfWeek === '*' && dayOfMonth === '*') {
      return `Tous les jours à ${timeStr}`
    }
    if (dayOfWeek === '0') {
      return `Chaque dimanche à ${timeStr}`
    }
    
    return `Cron: ${cron}`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {schedules.filter(s => s.enabled).length} planification{schedules.filter(s => s.enabled).length !== 1 ? 's' : ''} active{schedules.filter(s => s.enabled).length !== 1 ? 's' : ''}
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Nouvelle planification
        </button>
      </div>

      {/* Schedules List */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ClockIcon className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <p>Aucune planification configurée</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-700/50">
            {schedules.map((schedule) => {
              const Icon = scheduleTypeIcons[schedule.type] || ClockIcon
              
              return (
                <div key={schedule.id} className="flex items-center p-4 hover:bg-dark-700/30 transition-colors">
                  <div className={`p-2.5 rounded-lg mr-4 ${
                    schedule.enabled ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-500'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <span className={`font-medium ${schedule.enabled ? 'text-white' : 'text-gray-500'}`}>
                        {schedule.name}
                      </span>
                      <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                        schedule.enabled 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-gray-500/20 text-gray-500'
                      }`}>
                        {schedule.enabled ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-400 mt-1 space-x-4">
                      <span>{scheduleTypeLabels[schedule.type]}</span>
                      <span>•</span>
                      <span>{formatCron(schedule.cron)}</span>
                      {schedule.type === 'command' && schedule.command && (
                        <>
                          <span>•</span>
                          <code className="bg-dark-700 px-2 py-0.5 rounded text-xs">{schedule.command}</code>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right mr-6">
                    <div className="text-xs text-gray-500">Dernière exécution</div>
                    <div className="text-sm text-gray-400">{formatDate(schedule.lastRun)}</div>
                  </div>

                  <div className="text-right mr-6">
                    <div className="text-xs text-gray-500">Prochaine exécution</div>
                    <div className="text-sm text-gray-300">{formatDate(schedule.nextRun)}</div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggle(schedule)}
                      className={`p-2 rounded-lg transition-colors ${
                        schedule.enabled 
                          ? 'text-green-400 hover:bg-green-500/20' 
                          : 'text-gray-500 hover:bg-gray-500/20'
                      }`}
                      title={schedule.enabled ? 'Désactiver' : 'Activer'}
                    >
                      {schedule.enabled ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleEdit(schedule)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-dark-600 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(schedule)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-dark-600 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-xl p-6 w-full max-w-md border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingSchedule ? 'Modifier la planification' : 'Nouvelle planification'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Nom</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ex: Restart quotidien"
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Type d'action</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="restart">Redémarrage du serveur</option>
                  <option value="backup">Créer un backup</option>
                  <option value="command">Exécuter une commande</option>
                </select>
              </div>

              {formData.type === 'command' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Commande</label>
                  <input
                    type="text"
                    value={formData.command}
                    onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                    placeholder="ex: say Hello!"
                    className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Heure</label>
                  <select
                    value={formData.hour}
                    onChange={(e) => setFormData({ ...formData, hour: e.target.value })}
                    className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i.toString().padStart(2, '0')}>
                        {i.toString().padStart(2, '0')}h
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Minute</label>
                  <select
                    value={formData.minute}
                    onChange={(e) => setFormData({ ...formData, minute: e.target.value })}
                    className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={i} value={i.toString().padStart(2, '0')}>
                        {i.toString().padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
              >
                {editingSchedule ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
