import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

import { logger } from './utils/logger';
import { authRouter } from './routes/auth';
import { serverRouter } from './routes/servers';
import { gameTemplateRouter } from './routes/gameTemplates';
import { userRouter } from './routes/users';
import filesRouter from './routes/files';
import { setupWebSocket } from './websocket';
import { authenticateToken } from './middleware/auth';
import { DockerService } from './services/docker';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS origins configuration
const corsOrigins = [
  process.env.FRONTEND_URL || 'http://31.39.12.93:5173',
  'https://hayslab.xyz',
  'http://hayslab.xyz',
  'https://hayslab.xyz:5173',
  'http://hayslab.xyz:5173',
  'https://www.hayslab.xyz',
  'http://www.hayslab.xyz',
  'https://panel.hayslab.xyz',
  'http://panel.hayslab.xyz',
];

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/servers', authenticateToken, serverRouter);
app.use('/api/files', authenticateToken, filesRouter);
app.use('/api/game-templates', authenticateToken, gameTemplateRouter);
app.use('/api/users', authenticateToken, userRouter);

// Docker status
app.get('/api/docker/status', authenticateToken, async (req, res) => {
  try {
    const dockerService = DockerService.getInstance();
    const info = await dockerService.getInfo();
    res.json({ connected: true, info });
  } catch (error) {
    res.status(500).json({ connected: false, error: 'Docker not available' });
  }
});

// WebSocket setup
setupWebSocket(io);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  logger.info(`🚀 Obsidian Panel API running on port ${PORT}`);
  logger.info(`📡 WebSocket server ready`);
});

export { io };
