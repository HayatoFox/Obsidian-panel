import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../stores/authStore'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().token
    
    // Determine the API URL - use current origin if not specified
    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
    
    console.log('Creating socket connection to:', apiUrl)
    console.log('Token available:', !!token)
    
    socket = io(apiUrl, {
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
