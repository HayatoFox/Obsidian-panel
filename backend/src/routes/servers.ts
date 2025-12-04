import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, requireOwnerOrAdmin } from '../middleware/auth';
import { ServerService } from '../services/server';

const router = Router();
const prisma = new PrismaClient();
const serverService = new ServerService();

// Get all servers (admin) or user's servers
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const where = req.user?.role === 'admin' ? {} : { userId: req.user!.id };
    const servers = await prisma.server.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Sync status with Docker
    const serversWithStatus = await Promise.all(
      servers.map(async (server) => {
        const status = await serverService.syncServerStatus(server.id);
        return { ...server, status };
      })
    );

    res.json(serversWithStatus);
  } catch (error) {
    console.error('Error fetching servers:', error);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Get single server
router.get('/:id', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const server = await prisma.server.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: { id: true, username: true, email: true }
        }
      }
    });

    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    // Sync status with Docker
    const status = await serverService.syncServerStatus(server.id);
    res.json({ ...server, status });
  } catch (error) {
    console.error('Error fetching server:', error);
    res.status(500).json({ error: 'Failed to fetch server' });
  }
});

// Create server
router.post(
  '/',
  [
    body('name').isLength({ min: 1, max: 64 }).trim(),
    body('gameType').notEmpty(),
    body('port').isInt({ min: 1024, max: 65535 }),
    body('memoryLimit').optional().isInt({ min: 512, max: 32768 }),
    body('cpuLimit').optional().isFloat({ min: 0.5, max: 16 }),
    body('gameConfig').optional().isObject()
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, gameType, port, memoryLimit, cpuLimit, gameConfig } = req.body;

    try {
      // Check if port is already in use
      const existingServer = await prisma.server.findFirst({
        where: {
          OR: [
            { port },
            { queryPort: port },
            { rconPort: port }
          ]
        }
      });

      if (existingServer) {
        res.status(400).json({ error: 'Port is already in use' });
        return;
      }

      const server = await serverService.createServer({
        name,
        gameType,
        userId: req.user!.id,
        port,
        memoryLimit,
        cpuLimit,
        gameConfig
      });

      res.status(201).json(server);
    } catch (error: any) {
      console.error('Error creating server:', error);
      res.status(500).json({ error: error.message || 'Failed to create server' });
    }
  }
);

// Start server
router.post('/:id/start', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await serverService.startServer(req.params.id);
    res.json({ message: 'Server starting' });
  } catch (error: any) {
    console.error('Error starting server:', error);
    res.status(500).json({ error: error.message || 'Failed to start server' });
  }
});

// Stop server
router.post('/:id/stop', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await serverService.stopServer(req.params.id);
    res.json({ message: 'Server stopped' });
  } catch (error: any) {
    console.error('Error stopping server:', error);
    res.status(500).json({ error: error.message || 'Failed to stop server' });
  }
});

// Restart server
router.post('/:id/restart', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await serverService.restartServer(req.params.id);
    res.json({ message: 'Server restarted' });
  } catch (error: any) {
    console.error('Error restarting server:', error);
    res.status(500).json({ error: error.message || 'Failed to restart server' });
  }
});

// Delete server
router.delete('/:id', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await serverService.deleteServer(req.params.id);
    res.json({ message: 'Server deleted' });
  } catch (error: any) {
    console.error('Error deleting server:', error);
    res.status(500).json({ error: error.message || 'Failed to delete server' });
  }
});

// Get server stats
router.get('/:id/stats', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await serverService.getServerStats(req.params.id);
    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching server stats:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch stats' });
  }
});

// Get server logs
router.get('/:id/logs', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tail = parseInt(req.query.tail as string) || 100;
    const logs = await serverService.getServerLogs(req.params.id, tail);
    res.json({ logs });
  } catch (error: any) {
    console.error('Error fetching server logs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch logs' });
  }
});

// Send command to server
router.post(
  '/:id/command',
  requireOwnerOrAdmin(),
  [body('command').notEmpty()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      await serverService.sendCommand(req.params.id, req.body.command);
      res.json({ message: 'Command sent' });
    } catch (error: any) {
      console.error('Error sending command:', error);
      res.status(500).json({ error: error.message || 'Failed to send command' });
    }
  }
);

// Update server settings
router.patch(
  '/:id',
  requireOwnerOrAdmin(),
  [
    body('name').optional().isLength({ min: 1, max: 64 }).trim(),
    body('memoryLimit').optional().isInt({ min: 512, max: 32768 }),
    body('cpuLimit').optional().isFloat({ min: 0.5, max: 16 }),
    body('gameConfig').optional().isObject()
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, memoryLimit, cpuLimit, gameConfig } = req.body;

    try {
      const updateData: any = {};
      if (name) updateData.name = name;
      if (memoryLimit) updateData.memoryLimit = memoryLimit;
      if (cpuLimit) updateData.cpuLimit = cpuLimit;
      if (gameConfig) updateData.gameConfig = JSON.stringify(gameConfig);

      const server = await prisma.server.update({
        where: { id: req.params.id },
        data: updateData
      });

      res.json(server);
    } catch (error: any) {
      console.error('Error updating server:', error);
      res.status(500).json({ error: error.message || 'Failed to update server' });
    }
  }
);

export { router as serverRouter };
