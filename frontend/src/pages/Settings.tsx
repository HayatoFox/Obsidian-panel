import { useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'
import toast from 'react-hot-toast'

export default function Settings() {
  const { user } = useAuthStore()
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (passwords.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      })
      toast.success('Password changed successfully')
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Paramètres</h1>
        <p className="text-gray-400 mb-8">Gérer les paramètres de votre compte</p>

        {/* Profile Info */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold text-gray-200 mb-4">Profil</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-dark-700/30">
              <label className="text-sm font-medium text-gray-400">Nom d'utilisateur</label>
              <p className="text-gray-200">{user?.username}</p>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-dark-700/30">
              <label className="text-sm font-medium text-gray-400">Email</label>
              <p className="text-gray-200">{user?.email}</p>
            </div>
            <div className="flex items-center justify-between py-3">
              <label className="text-sm font-medium text-gray-400">Rôle</label>
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                  user?.role === 'admin'
                    ? 'bg-obsidian-600/20 text-obsidian-400 border-obsidian-500/30'
                    : 'bg-dark-700/50 text-gray-400 border-dark-600'
                }`}
              >
                {user?.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
              </span>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-200 mb-4">Changer le mot de passe</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mot de passe actuel
              </label>
              <input
                type="password"
                value={passwords.currentPassword}
                onChange={(e) =>
                  setPasswords({ ...passwords, currentPassword: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={passwords.newPassword}
                onChange={(e) =>
                  setPasswords({ ...passwords, newPassword: e.target.value })
                }
                className="input"
                minLength={8}
                required
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 8 caractères</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirmer le nouveau mot de passe
              </label>
              <input
                type="password"
                value={passwords.confirmPassword}
                onChange={(e) =>
                  setPasswords({ ...passwords, confirmPassword: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Modification...' : 'Changer le mot de passe'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
