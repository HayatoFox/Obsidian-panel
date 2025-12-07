import { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { getSocket } from '../../lib/socket'
import { TrashIcon, CpuChipIcon, CircleStackIcon, ClockIcon, UsersIcon } from '@heroicons/react/24/outline'
import api from '../../lib/api'

interface Server {
  id: string
  name: string
  status: string
  memoryLimit: number
  cpuLimit?: number
  diskLimit?: number
}

interface ServerStats {
  cpuUsage: number
  memoryUsage: number
  memoryLimit: number
  diskUsage?: number
  networkRx?: number
  networkTx?: number
}

interface Props {
  server: Server
  visible?: boolean
}

export default function ConsoleTab({ server, visible = true }: Props) {
  const [command, setCommand] = useState('')
  const [stats, setStats] = useState<ServerStats | null>(null)
  const [playerCount, setPlayerCount] = useState(0)
  const [uptime, setUptime] = useState(0)
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstance = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)
  const initialized = useRef(false)
  const subscribed = useRef(false)
  const statsSubscribed = useRef(false)

  // Parse player count from log messages
  const parsePlayerCount = (message: string) => {
    // Match patterns like "There are X of a max of Y players online"
    // or "X/Y players online" or player join/leave messages
    const match = message.match(/There are (\d+) of/i) || 
                  message.match(/(\d+)\/\d+ players/i)
    if (match) {
      setPlayerCount(parseInt(match[1]))
    }
    // Player joined
    if (message.includes('joined the game') || message.includes('logged in with')) {
      setPlayerCount(prev => prev + 1)
    }
    // Player left
    if (message.includes('left the game') || message.includes('lost connection')) {
      setPlayerCount(prev => Math.max(0, prev - 1))
    }
  }

  useEffect(() => {
    // Initialize immediately if DOM is ready
    if (terminalRef.current && !initialized.current) {
      initialized.current = true
      initTerminal()
    }

    return () => {
      if (terminalInstance.current) {
        terminalInstance.current.dispose()
        terminalInstance.current = null
        initialized.current = false
      }
    }
  }, [])

  // Refit terminal when becoming visible (was hidden with display:none)
  useEffect(() => {
    if (visible && fitAddon.current && terminalInstance.current) {
      // Small delay to ensure the DOM has updated
      requestAnimationFrame(() => {
        fitAddon.current?.fit()
      })
    }
  }, [visible])

  // Subscribe to stats updates
  useEffect(() => {
    if (!server || statsSubscribed.current) return
    
    const socket = getSocket()
    
    const handleStats = ({ serverId, stats: serverStats }: { serverId: string; stats: ServerStats }) => {
      if (serverId !== server.id) return
      setStats(serverStats)
    }
    
    statsSubscribed.current = true
    socket.emit('server:subscribe:stats', server.id)
    socket.on('server:stats', handleStats)
    
    // Initial fetch
    if (server.status === 'running') {
      api.get(`/servers/${server.id}/stats`).then(res => setStats(res.data)).catch(() => {})
    }
    
    return () => {
      statsSubscribed.current = false
      socket.emit('server:unsubscribe:stats', server.id)
      socket.off('server:stats', handleStats)
    }
  }, [server?.id, server?.status])

  // Uptime counter
  useEffect(() => {
    if (server?.status !== 'running') {
      setUptime(0)
      return
    }
    
    const interval = setInterval(() => {
      setUptime(prev => prev + 1)
    }, 1000)
    
    return () => clearInterval(interval)
  }, [server?.status])

  // Subscribe to server logs - only once
  useEffect(() => {
    if (!server || subscribed.current) return
    
    const socket = getSocket()
    
    const handleLog = ({ message, serverId }: { message: string; serverId: string }) => {
      // Only handle logs for this server
      if (serverId !== server.id) return
      // Don't trim - preserve intentional newlines at start for command responses
      terminalInstance.current?.writeln(message.trimEnd())
      // Parse player count from logs
      parsePlayerCount(message)
    }
    
    const handleError = (error: { message: string }) => {
      terminalInstance.current?.writeln(`\x1b[31m[Erreur] ${error.message}\x1b[0m`)
    }

    const handleConnect = () => {
      terminalInstance.current?.writeln('\x1b[32m[System] Connecté au WebSocket\x1b[0m')
      // Re-subscribe on reconnect
      socket.emit('server:subscribe', server.id)
    }
    
    const handleDisconnect = () => {
      terminalInstance.current?.writeln('\x1b[33m[System] Déconnecté du WebSocket\x1b[0m')
    }

    // Mark as subscribed before adding listeners
    subscribed.current = true
    
    // Subscribe to server logs
    socket.emit('server:subscribe', server.id)
    
    socket.on('server:log', handleLog)
    socket.on('error', handleError)
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    
    terminalInstance.current?.writeln('\x1b[90m[System] Connexion au serveur...\x1b[0m')

    return () => {
      subscribed.current = false
      socket.emit('server:unsubscribe', server.id)
      socket.off('server:log', handleLog)
      socket.off('error', handleError)
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
    }
  }, [server?.id])

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

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Format uptime
  const formatUptime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h}h ${m}m ${s}s`
  }

  // Calculate percentages
  const cpuPercent = stats?.cpuUsage ?? 0
  const memoryUsed = stats?.memoryUsage ?? 0
  const memoryMax = stats?.memoryLimit ?? (server.memoryLimit * 1024 * 1024)
  const diskUsed = stats?.diskUsage ?? 0
  const diskMax = (server.diskLimit ?? 10240) * 1024 * 1024 // Default 10GB

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex items-center gap-6 px-4 py-3 bg-dark-800/80 border border-dark-700 rounded-lg">
        {/* Players */}
        <div className="flex items-center gap-2">
          <UsersIcon className="w-5 h-5 text-green-400" />
          <span className="text-white font-medium">{playerCount} Players online</span>
        </div>

        <div className="h-6 w-px bg-dark-600" />

        {/* Uptime */}
        <div className="flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-blue-400" />
          <span className="text-gray-300">{formatUptime(uptime)}</span>
        </div>

        <div className="h-6 w-px bg-dark-600" />

        {/* CPU */}
        <div className="flex items-center gap-2">
          <CpuChipIcon className="w-5 h-5 text-yellow-400" />
          <span className="text-gray-300">{cpuPercent.toFixed(2)}%</span>
          <span className="text-gray-500">/ {((server.cpuLimit ?? 2) * 100).toFixed(0)}%</span>
        </div>

        <div className="h-6 w-px bg-dark-600" />

        {/* Memory */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <span className="text-gray-300">{formatBytes(memoryUsed)}</span>
          <span className="text-gray-500">/ {formatBytes(memoryMax)}</span>
        </div>

        <div className="h-6 w-px bg-dark-600" />

        {/* Disk */}
        <div className="flex items-center gap-2">
          <CircleStackIcon className="w-5 h-5 text-cyan-400" />
          <span className="text-gray-300">{formatBytes(diskUsed)}</span>
          <span className="text-gray-500">/ {formatBytes(diskMax)}</span>
        </div>

        <div className="flex-1" />

        {/* Container ID */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-mono">
            {server.id.slice(0, 8)}
          </span>
        </div>
      </div>

      {/* Console Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span
            className={`w-2 h-2 rounded-full ${
              server.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
            }`}
          />
          <span className="text-sm text-gray-400">
            {server.status === 'running' ? 'Connected' : 'Serveur arrêté'}
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
        className="h-[500px] rounded-lg overflow-hidden border border-dark-700"
        style={{ backgroundColor: '#0f172a' }}
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
