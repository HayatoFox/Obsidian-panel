import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await login(email, password)
      toast.success('Welcome back!')
      navigate('/')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background - Effet cosmos/obsidienne (Optimized - static gradients) */}
      <div className="absolute inset-0 bg-dark-950" />
      
      {/* Grandes lueurs ambiantes - statiques pour performance */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-obsidian-600/15 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-obsidian-800/20 rounded-full blur-[100px]" />
      <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-purple-900/15 rounded-full blur-[80px]" />
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo et titre */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-6">
            {/* Multiples couches de lueur */}
            <div className="absolute inset-0 bg-obsidian-500 blur-3xl opacity-40 rounded-full scale-[3]"></div>
            <div className="absolute inset-0 bg-obsidian-400 blur-xl opacity-50 rounded-full scale-150"></div>
            <div className="absolute inset-0 bg-white blur-md opacity-10 rounded-full"></div>
            <img 
              src="/obsidian.svg" 
              alt="Obsidian" 
              className="h-20 w-20 mx-auto relative z-10 drop-shadow-[0_0_30px_rgba(139,92,246,0.6)]" 
            />
          </div>
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-300 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
              Obsidian
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-obsidian-400 to-obsidian-500 ml-2">
              Panel
            </span>
          </h1>
          <p className="text-gray-500 mt-2">Connectez-vous à votre compte</p>
        </div>

        {/* Card de login - Effet cristal */}
        <div className="relative group">
          {/* Lueur derrière la card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-obsidian-600/20 via-obsidian-500/10 to-obsidian-600/20 rounded-3xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500" />
          
          {/* Card principale */}
          <div className="relative rounded-2xl overflow-hidden">
            {/* Fond avec dégradé */}
            <div className="absolute inset-0 bg-gradient-to-br from-dark-800/80 via-dark-900/90 to-dark-950/95 backdrop-blur-2xl" />
            
            {/* Bordure avec dégradé */}
            <div className="absolute inset-0 rounded-2xl border border-white/10" />
            <div className="absolute inset-0 rounded-2xl border border-obsidian-500/10" />
            
            {/* Reflet en haut */}
            <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            
            {/* Reflet latéral */}
            <div className="absolute top-0 left-0 bottom-0 w-px bg-gradient-to-b from-white/20 via-white/5 to-transparent" />
            
            {/* Contenu */}
            <div className="relative p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                    Mot de passe
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full py-3 text-base shine-effect"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Connexion...
                    </span>
                  ) : 'Se connecter'}
                </button>
              </form>

              {/* Séparateur cristal */}
              <div className="my-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <div className="text-center">
                <p className="text-gray-500">
                  Pas encore de compte ?{' '}
                  <Link 
                    to="/register" 
                    className="text-obsidian-400 hover:text-obsidian-300 font-medium transition-all duration-300 hover:drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                  >
                    S'inscrire
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer subtil */}
        <p className="text-center text-gray-600 text-sm mt-8">
          Obsidian Panel — Game Server Management
        </p>
      </div>
    </div>
  )
}
