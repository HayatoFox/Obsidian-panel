import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../stores/authStore'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().token
    
    // Get the API URL and extract the base (remove /api suffix if present)
    const rawUrl = import.meta.env.VITE_API_URL || ''
    let baseUrl: string
    
    if (rawUrl) {
      // Remove /api or /api/ suffix to get the base URL for Socket.IO
      baseUrl = rawUrl.replace(/\/api\/?$/, '')
    } else {
      // If no URL configured, use current origin
      baseUrl = window.location.origin
    }
    
    console.log('Creating socket connection to:', baseUrl)
    console.log('Token available:', !!token)
    
    socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })
    
    socket.on('connect', () => {
      console.log('Socket connected successfully, id:', socket?.id)
    })
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message)
    })
    
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
    })
  }
  
  // Ensure socket is connected
  if (!socket.connected) {
    socket.connect()
  }
  
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function reconnectSocket() {
  disconnectSocket()
  return getSocket()
}
