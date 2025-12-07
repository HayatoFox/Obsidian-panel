import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://31.39.12.93:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://31.39.12.93:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
