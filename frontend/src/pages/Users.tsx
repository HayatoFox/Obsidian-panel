import { useEffect, useState } from 'react'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'

interface User {
  id: string
  email: string
  username: string
  role: 'admin' | 'user'
  createdAt: string
  _count: {
    servers: number
  }
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    role: 'user' as 'admin' | 'user',
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users')
      setUsers(response.data)
    } catch (error) {
      toast.error('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingUser) {
        const updateData: any = { ...formData }
        if (!updateData.password) delete updateData.password
        await api.patch(`/users/${editingUser.id}`, updateData)
        toast.success('User updated')
      } else {
        await api.post('/users', formData)
        toast.success('User created')
      }
      setShowModal(false)
      setEditingUser(null)
      setFormData({ email: '', username: '', password: '', role: 'user' })
      fetchUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Operation failed')
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      email: user.email,
      username: user.username,
      password: '',
      role: user.role,
    })
    setShowModal(true)
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    try {
      await api.delete(`/users/${userId}`)
      toast.success('User deleted')
      fetchUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete user')
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">Utilisateurs</h1>
          <p className="text-gray-400 mt-2">Gérer les utilisateurs du panel</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null)
            setFormData({ email: '', username: '', password: '', role: 'user' })
            setShowModal(true)
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          Ajouter un utilisateur
        </button>
      </div>

      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-700/50">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Nom d'utilisateur</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Email</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Rôle</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Serveurs</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-dark-700/30 hover:bg-dark-800/30 transition-colors group">
                <td className="py-4 px-4 text-gray-200 group-hover:text-obsidian-400 transition-colors">{user.username}</td>
                <td className="py-4 px-4 text-gray-400">{user.email}</td>
                <td className="py-4 px-4">
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                      user.role === 'admin'
                        ? 'bg-obsidian-600/20 text-obsidian-400 border-obsidian-500/30'
                        : 'bg-dark-700/50 text-gray-400 border-dark-600'
                    }`}
                  >
                    {user.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                  </span>
                </td>
                <td className="py-4 px-4 text-gray-400 font-mono">{user._count.servers}</td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-2 text-gray-400 hover:text-obsidian-400 hover:bg-dark-700/50 rounded-lg transition-all"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-dark-900/95 rounded-xl border border-dark-700/50 p-6 w-full max-w-md shadow-glow">
            <h2 className="text-xl font-semibold text-gray-200 mb-4">
              {editingUser ? 'Modifier l\'utilisateur' : 'Créer un utilisateur'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nom d'utilisateur</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mot de passe {editingUser && '(laisser vide pour conserver)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input"
                  required={!editingUser}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rôle</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                  className="input"
                >
                  <option value="user">Utilisateur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
