import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { DockerService } from './services/docker';
import { logger } from './utils/logger';

const prisma = new PrismaClient();

// Convert Minecraft color codes (§x) to ANSI escape codes for terminal display
function convertMinecraftColors(text: string): string {
  const colorMap: Record<string, string> = {
    '0': '\x1b[30m',      // Black
    '1': '\x1b[34m',      // Dark Blue
    '2': '\x1b[32m',      // Dark Green
    '3': '\x1b[36m',      // Dark Aqua
    '4': '\x1b[31m',      // Dark Red
    '5': '\x1b[35m',      // Dark Purple
    '6': '\x1b[33m',      // Gold
    '7': '\x1b[37m',      // Gray
    '8': '\x1b[90m',      // Dark Gray
    '9': '\x1b[94m',      // Blue
    'a': '\x1b[92m',      // Green
    'b': '\x1b[96m',      // Aqua
    'c': '\x1b[91m',      // Red
    'd': '\x1b[95m',      // Light Purple
    'e': '\x1b[93m',      // Yellow
    'f': '\x1b[97m',      // White
    'l': '\x1b[1m',       // Bold
    'n': '\x1b[4m',       // Underline
    'o': '\x1b[3m',       // Italic
    'r': '\x1b[0m',       // Reset
  };
  
  return text.replace(/§([0-9a-fklmnor])/gi, (_, code) => {
    return colorMap[code.toLowerCase()] || '';
  }) + '\x1b[0m'; // Reset at end
}

// Parse Docker multiplexed stream (8-byte header per frame)
// Returns null if the buffer doesn't look like a multiplexed stream
function parseDockerStream(buffer: Buffer): string {
  // Check if this looks like a multiplexed stream (first byte is stream type: 0, 1, or 2)
  // and bytes 1-3 are zeros (padding)
  const isMultiplexed = buffer.length >= 8 && 
    (buffer[0] === 0 || buffer[0] === 1 || buffer[0] === 2) &&
    buffer[1] === 0 && buffer[2] === 0 && buffer[3] === 0;

  if (!isMultiplexed) {
    // Not multiplexed, return as plain text
    return buffer.toString('utf8');
  }

  const messages: string[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    // Docker stream header: 1 byte type, 3 bytes padding, 4 bytes size (big-endian)
    if (offset + 8 > buffer.length) {
      // Incomplete header, return raw remainder
      messages.push(buffer.slice(offset).toString('utf8'));
      break;
    }

    const size = buffer.readUInt32BE(offset + 4);
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + size;

    if (payloadEnd > buffer.length) {
      // Incomplete payload, return raw remainder
      messages.push(buffer.slice(offset).toString('utf8'));
      break;
    }

    const payload = buffer.slice(payloadStart, payloadEnd).toString('utf8');
    messages.push(payload);
    offset = payloadEnd;
  }

  return messages.join('');
}

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  role?: string;
}

export function setupWebSocket(io: SocketIOServer) {
  const dockerService = DockerService.getInstance();

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
        username: string;
        role: string;
      };

      // Verify session exists
      const session = await prisma.session.findFirst({
        where: {
          token,
          userId: decoded.userId,
          expiresAt: { gt: new Date() }
        }
      });

      if (!session) {
        return next(new Error('Invalid session'));
      }

      socket.userId = decoded.userId;
      socket.username = decoded.username;
      socket.role = decoded.role;
      next();
    } catch (error) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`WebSocket connected: ${socket.username} (${socket.id})`);

    // Join user's room
    socket.join(`user:${socket.userId}`);
    if (socket.role === 'admin') {
      socket.join('admins');
    }

    // Subscribe to server console
    socket.on('server:subscribe', async (serverId: string) => {
      try {
        // Check permission
        const server = await prisma.server.findUnique({
          where: { id: serverId }
        });

        if (!server) {
          socket.emit('error', { message: 'Server not found' });
          return;
        }

        if (socket.role !== 'admin' && server.userId !== socket.userId) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        socket.join(`server:${serverId}`);
        logger.info(`${socket.username} subscribed to server ${serverId}`);

        // Start streaming logs
        if (server.containerId) {
          try {
            const container = dockerService.getContainer(server.containerId);
            
            // Check container info to see if it uses TTY
            const containerInfo = await container.inspect();
            const isTty = containerInfo.Config.Tty;
            const isRunning = containerInfo.State.Running;
            
            logger.info(`Container ${server.containerId} - TTY: ${isTty}, Running: ${isRunning}`);
            
            // First, get existing logs (history)
            const existingLogs = await container.logs({
              follow: false,
              stdout: true,
              stderr: true,
              tail: 100,
              timestamps: false
            });

            // Process existing logs
            if (existingLogs) {
              let logsText: string;
              if (Buffer.isBuffer(existingLogs)) {
                logsText = isTty ? existingLogs.toString('utf8') : parseDockerStream(existingLogs);
              } else {
                logsText = String(existingLogs);
              }
              
              const lines = logsText.split('\n').filter(line => {
                const trimmed = line.trim();
                if (!trimmed) return false;
                
                // Filter out noisy RCON connection logs
                if (trimmed.includes('RCON Listener') && trimmed.includes('started')) return false;
                if (trimmed.includes('RCON Client') && trimmed.includes('shutting down')) return false;
                if (trimmed.includes('Thread RCON Client')) return false;
                
                return true;
              });
              
              for (const line of lines) {
                socket.emit('server:log', {
                  serverId,
                  message: line,
                  timestamp: new Date().toISOString()
                });
              }
            }

            // Then, stream new logs if container is running
            if (isRunning) {
              const logStream = await container.logs({
                follow: true,
                stdout: true,
                stderr: true,
                tail: 0, // Only new logs
                timestamps: false,
                since: Math.floor(Date.now() / 1000) // Only logs from now
              });

              logStream.on('data', (chunk: Buffer) => {
                let message: string;
                
                if (isTty) {
                  message = chunk.toString('utf8');
                } else {
                  message = parseDockerStream(chunk);
                }
                
                if (message && message.trim()) {
                  const lines = message.split('\n').filter(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return false;
                    
                    // Filter out noisy RCON connection logs
                    if (trimmed.includes('RCON Listener') && trimmed.includes('started')) return false;
                    if (trimmed.includes('RCON Client') && trimmed.includes('shutting down')) return false;
                    if (trimmed.includes('Thread RCON Client')) return false;
                    // Filter RCON command responses (they're already handled separately)
                    if (trimmed.includes('Rcon connection from')) return false;
                    
                    return true;
                  });
                  
                  for (const line of lines) {
                    io.to(`server:${serverId}`).emit('server:log', {
                      serverId,
                      message: line,
                      timestamp: new Date().toISOString()
                    });
                  }
                }
              });

              logStream.on('error', (err) => {
                logger.error(`Log stream error for ${serverId}:`, err);
              });

              logStream.on('end', () => {
                logger.info(`Log stream ended for ${serverId}`);
              });

              socket.on('disconnect', () => {
                try {
                  if ('destroy' in logStream && typeof logStream.destroy === 'function') {
                    (logStream as NodeJS.ReadableStream & { destroy: () => void }).destroy();
                  }
                } catch (e) {
                  // Ignore cleanup errors
                }
              });

              socket.on('server:unsubscribe', (unsubServerId: string) => {
                if (unsubServerId === serverId) {
                  try {
                    if ('destroy' in logStream && typeof logStream.destroy === 'function') {
                      (logStream as NodeJS.ReadableStream & { destroy: () => void }).destroy();
                    }
                  } catch (e) {
                    // Ignore cleanup errors
                  }
                  socket.leave(`server:${serverId}`);
                }
              });
            }
          } catch (error) {
            logger.error('Error streaming logs:', error);
          }
        }
      } catch (error) {
        logger.error('Error subscribing to server:', error);
        socket.emit('error', { message: 'Failed to subscribe to server' });
      }
    });

    // Send command to server
    socket.on('server:command', async ({ serverId, command }: { serverId: string; command: string }) => {
      try {
        const server = await prisma.server.findUnique({
          where: { id: serverId }
        });

        if (!server) {
          socket.emit('error', { message: 'Server not found' });
          return;
        }

        if (socket.role !== 'admin' && server.userId !== socket.userId) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        if (!server.containerId || server.status !== 'running') {
          socket.emit('error', { message: 'Server is not running' });
          return;
        }

        // Execute command based on game type
        let output = '';
        if (server.gameType.includes('minecraft')) {
          try {
            output = await dockerService.execCommand(server.containerId, ['rcon-cli', command]);
            
            // Send the command output back to the client
            if (output && output.trim()) {
              const lines = output.split('\n').filter(line => line.trim());
              for (const line of lines) {
                // Convert Minecraft color codes to ANSI and format as server response
                const formattedLine = convertMinecraftColors(line.trim());
                io.to(`server:${serverId}`).emit('server:log', {
                  serverId,
                  message: `\r\n\x1b[36m[Server]\x1b[0m ${formattedLine}`,
                  timestamp: new Date().toISOString()
                });
              }
            }
          } catch (cmdError: any) {
            logger.error('RCON command error:', cmdError);
            io.to(`server:${serverId}`).emit('server:log', {
              serverId,
              message: `\x1b[31m[Error]\x1b[0m ${cmdError.message || 'Failed to execute command'}`,
              timestamp: new Date().toISOString()
            });
          }
        } else {
          // For other games, try to write to stdin
          const container = dockerService.getContainer(server.containerId);
          const exec = await container.exec({
            Cmd: ['sh', '-c', `echo "${command}"`],
            AttachStdin: true,
            AttachStdout: true,
            Tty: true
          });
          await exec.start({ hijack: true, stdin: true });
        }

        socket.emit('server:commandSent', { serverId, command });
        logger.info(`Command sent to ${serverId} by ${socket.username}: ${command}`);
      } catch (error) {
        logger.error('Error sending command:', error);
        socket.emit('error', { message: 'Failed to send command' });
      }
    });

    // Request server stats
    socket.on('server:stats', async (serverId: string) => {
      try {
        const server = await prisma.server.findUnique({
          where: { id: serverId }
        });

        if (!server || !server.containerId) {
          return;
        }

        if (socket.role !== 'admin' && server.userId !== socket.userId) {
          return;
        }

        const stats = await dockerService.getContainerStats(server.containerId);
        socket.emit('server:stats', { serverId, stats });
      } catch (error) {
        // Stats might fail if container is not running
      }
    });

    // Unsubscribe from server
    socket.on('server:unsubscribe', (serverId: string) => {
      socket.leave(`server:${serverId}`);
      logger.info(`${socket.username} unsubscribed from server ${serverId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`WebSocket disconnected: ${socket.username} (${socket.id})`);
    });
  });

  // Broadcast server status changes
  setInterval(async () => {
    try {
      const servers = await prisma.server.findMany({
        where: { status: 'running' }
      });

      for (const server of servers) {
        if (server.containerId) {
          try {
            const stats = await dockerService.getContainerStats(server.containerId);
            io.to(`server:${server.id}`).emit('server:stats', {
              serverId: server.id,
              stats
            });
          } catch (error) {
            // Container might be stopped
          }
        }
      }
    } catch (error) {
      logger.error('Error broadcasting stats:', error);
    }
  }, 5000);
}
