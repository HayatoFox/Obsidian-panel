import { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { getSocket } from '../../lib/socket'
import { TrashIcon } from '@heroicons/react/24/outline'

interface Server {
  id: string
  name: string
  status: string
}

interface Props {
  server: Server
}

export default function ConsoleTab({ server }: Props) {
  const [command, setCommand] = useState('')
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstance = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)

  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (terminalRef.current && !terminalInstance.current) {
        initTerminal()
      }
    }, 100)

    return () => {
      clearTimeout(timer)
      if (terminalInstance.current) {
        terminalInstance.current.dispose()
        terminalInstance.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (server && terminalInstance.current) {
      const socket = getSocket()
      
      // Debug: Log socket connection status
      console.log('Socket connected:', socket.connected)
      
      socket.emit('server:subscribe', server.id)
      terminalInstance.current?.writeln('\x1b[90m[System] Connexion au serveur...\x1b[0m')
      
      const handleLog = ({ message }: { message: string }) => {
        console.log('Received log:', message) // Debug
        terminalInstance.current?.writeln(message.trim())
      }
      
      const handleError = (error: { message: string }) => {
        console.error('Socket error:', error)
        terminalInstance.current?.writeln(`\x1b[31m[Erreur] ${error.message}\x1b[0m`)
      }

      socket.on('server:log', handleLog)
      socket.on('error', handleError)
      
      // Listen for connection events
      socket.on('connect', () => {
        terminalInstance.current?.writeln('\x1b[32m[System] Connecté au WebSocket\x1b[0m')
        socket.emit('server:subscribe', server.id)
      })
      
      socket.on('disconnect', () => {
        terminalInstance.current?.writeln('\x1b[33m[System] Déconnecté du WebSocket\x1b[0m')
      })

      return () => {
        socket.emit('server:unsubscribe', server.id)
        socket.off('server:log', handleLog)
        socket.off('error', handleError)
      }
    }
  }, [server, terminalInstance.current])

  const initTerminal = () => {
    if (!terminalRef.current) return

    const term = new Terminal({
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#8b5cf6',
        cursorAccent: '#0f172a',
        selectionBackground: '#6366f1',
        black: '#1e293b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f1f5f9',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#f8fafc',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      scrollback: 10000,
      convertEol: true,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(terminalRef.current)
    fit.fit()

    terminalInstance.current = term
    fitAddon.current = fit

    // Initial message
    term.writeln('\x1b[1;35m╔════════════════════════════════════════════════════════════╗\x1b[0m')
    term.writeln('\x1b[1;35m║\x1b[0m           \x1b[1;36mObsidian Panel - Server Console\x1b[0m              \x1b[1;35m║\x1b[0m')
    term.writeln('\x1b[1;35m╚════════════════════════════════════════════════════════════╝\x1b[0m')
    term.writeln('')
    
    // Fit again after content is added
    setTimeout(() => fit.fit(), 50)

    // Handle window resize
    const handleResize = () => {
      fit.fit()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }

  const handleClear = () => {
    terminalInstance.current?.clear()
  }

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault()
    if (!command.trim() || server.status !== 'running') return

    const socket = getSocket()
    socket.emit('server:command', { serverId: server.id, command: command.trim() })
    terminalInstance.current?.writeln(`\x1b[1;33m> ${command}\x1b[0m`)
    setCommand('')
  }

  return (
    <div className="space-y-4">
      {/* Console Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span
            className={`w-2 h-2 rounded-full ${
              server.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
            }`}
          />
          <span className="text-sm text-gray-400">
            {server.status === 'running' ? 'Console active' : 'Serveur arrêté'}
          </span>
        </div>
        <button
          onClick={handleClear}
          className="flex items-center px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
        >
          <TrashIcon className="w-4 h-4 mr-1.5" />
          Effacer
        </button>
      </div>

      {/* Console Output */}
      <div
        ref={terminalRef}
        className="h-[500px] bg-slate-950 rounded-lg overflow-hidden border border-dark-700"
      />

      {/* Command Input */}
      <form onSubmit={handleCommand} className="flex gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400 font-mono">
            {'>'}
          </span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={
              server.status === 'running'
                ? 'Entrez une commande...'
                : 'Le serveur doit être en ligne pour envoyer des commandes'
            }
            disabled={server.status !== 'running'}
            className="w-full pl-8 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-gray-500 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <button
          type="submit"
          disabled={server.status !== 'running' || !command.trim()}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          Envoyer
        </button>
      </form>
    </div>
  )
}
