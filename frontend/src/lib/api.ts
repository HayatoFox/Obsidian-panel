import axios from 'axios'

const rawBase = import.meta.env.VITE_API_URL || '/api'
const baseURL = rawBase.endsWith('/api') ? rawBase : `${rawBase.replace(/\/$/, '')}/api`

const api = axios.create({
  baseURL,
})

// Request interceptor to set Content-Type appropriately
api.interceptors.request.use((config) => {
  // Don't set Content-Type for FormData - let the browser set it with boundary
  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json'
  }
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('auth-storage')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
