import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { DockerService } from './services/docker';
import { logger } from './utils/logger';

const prisma = new PrismaClient();

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
            const logStream = await container.logs({
              follow: true,
              stdout: true,
              stderr: true,
              tail: 50,
              timestamps: true
            });

            logStream.on('data', (chunk: Buffer) => {
              const message = chunk.toString().replace(/^\x01\x00\x00\x00\x00\x00.{2}/, '');
              io.to(`server:${serverId}`).emit('server:log', {
                serverId,
                message,
                timestamp: new Date().toISOString()
              });
            });

            socket.on('disconnect', () => {
              if ('destroy' in logStream && typeof logStream.destroy === 'function') {
                (logStream as NodeJS.ReadableStream & { destroy: () => void }).destroy();
              }
            });

            socket.on('server:unsubscribe', (unsubServerId: string) => {
              if (unsubServerId === serverId) {
                if ('destroy' in logStream && typeof logStream.destroy === 'function') {
                  (logStream as NodeJS.ReadableStream & { destroy: () => void }).destroy();
                }
                socket.leave(`server:${serverId}`);
              }
            });
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
        if (server.gameType.includes('minecraft')) {
          await dockerService.execCommand(server.containerId, ['rcon-cli', command]);
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
