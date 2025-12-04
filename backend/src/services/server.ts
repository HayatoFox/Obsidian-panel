import { PrismaClient, Server, GameTemplate } from '@prisma/client';
import { DockerService, ContainerConfig } from './docker';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

export interface CreateServerOptions {
  name: string;
  gameType: string;
  userId: string;
  port: number;
  memoryLimit?: number;
  cpuLimit?: number;
  gameConfig?: Record<string, any>;
}

export class ServerService {
  private dockerService: DockerService;
  private serversDir: string;

  constructor() {
    this.dockerService = DockerService.getInstance();
    this.serversDir = process.env.SERVERS_DIR || '/var/lib/obsidian-panel/servers';
  }

  async createServer(options: CreateServerOptions): Promise<Server> {
    const template = await prisma.gameTemplate.findUnique({
      where: { name: options.gameType }
    });

    if (!template) {
      throw new Error(`Game template '${options.gameType}' not found`);
    }

    const containerName = `obsidian-${options.gameType}-${uuidv4().slice(0, 8)}`;
    const dataPath = path.join(this.serversDir, containerName);

    // Create data directory
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
    }

    // Check if image exists, pull if not
    if (!(await this.dockerService.imageExists(template.dockerImage))) {
      logger.info(`Pulling image ${template.dockerImage}...`);
      await this.dockerService.pullImage(template.dockerImage);
    }

    // Parse environment template
    const envTemplate = JSON.parse(template.envTemplate);
    const gameConfig = options.gameConfig || {};
    
    const env: Record<string, string> = {
      ...envTemplate,
      ...this.buildEnvFromConfig(template, gameConfig, options)
    };

    // Create container config
    const containerConfig: ContainerConfig = {
      name: containerName,
      image: template.dockerImage,
      ports: [
        { container: template.defaultPort, host: options.port },
        ...(template.defaultQueryPort ? [{ container: template.defaultQueryPort, host: options.port + 1 }] : []),
        ...(template.defaultRconPort ? [{ container: template.defaultRconPort, host: options.port + 2 }] : [])
      ],
      env,
      volumes: [
        { host: dataPath, container: '/data' }
      ],
      memory: options.memoryLimit || template.defaultMemory,
      cpus: options.cpuLimit || template.defaultCpu,
      restart: 'unless-stopped'
    };

    // Create Docker container
    const container = await this.dockerService.createContainer(containerConfig);

    // Save to database
    const server = await prisma.server.create({
      data: {
        name: options.name,
        gameType: options.gameType,
        containerId: container.id,
        containerName,
        status: 'stopped',
        port: options.port,
        queryPort: template.defaultQueryPort ? options.port + 1 : null,
        rconPort: template.defaultRconPort ? options.port + 2 : null,
        memoryLimit: options.memoryLimit || template.defaultMemory,
        cpuLimit: options.cpuLimit || template.defaultCpu,
        gameConfig: JSON.stringify(gameConfig),
        dataPath,
        userId: options.userId
      }
    });

    logger.info(`Server ${server.name} created with container ${containerName}`);
    return server;
  }

  private buildEnvFromConfig(
    template: GameTemplate, 
    gameConfig: Record<string, any>,
    options: CreateServerOptions
  ): Record<string, string> {
    const env: Record<string, string> = {};
    
    // Common environment variables
    env['EULA'] = 'TRUE';
    env['SERVER_PORT'] = String(options.port);
    
    if (options.memoryLimit) {
      env['MEMORY'] = `${options.memoryLimit}M`;
      env['MAX_MEMORY'] = `${options.memoryLimit}M`;
    }

    // Game-specific configurations
    if (template.name.includes('minecraft')) {
      env['TYPE'] = gameConfig.serverType || 'VANILLA';
      env['VERSION'] = gameConfig.version || 'LATEST';
      env['DIFFICULTY'] = gameConfig.difficulty || 'normal';
      env['MODE'] = gameConfig.gamemode || 'survival';
      env['MOTD'] = gameConfig.motd || 'An Obsidian Panel Minecraft Server';
      env['MAX_PLAYERS'] = String(gameConfig.maxPlayers || 20);
      env['ONLINE_MODE'] = String(gameConfig.onlineMode !== false);
      env['PVP'] = String(gameConfig.pvp !== false);
      env['ALLOW_NETHER'] = String(gameConfig.allowNether !== false);
      env['SPAWN_ANIMALS'] = String(gameConfig.spawnAnimals !== false);
      env['SPAWN_MONSTERS'] = String(gameConfig.spawnMonsters !== false);
      env['SPAWN_NPCS'] = String(gameConfig.spawnNpcs !== false);
    }

    // SteamCMD games
    if (template.category === 'steamcmd') {
      env['STEAMCMD_APPID'] = gameConfig.appId || '';
      env['STEAMCMD_VALIDATE'] = 'true';
    }

    return env;
  }

  async startServer(serverId: string): Promise<void> {
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server || !server.containerId) {
      throw new Error('Server not found');
    }

    await prisma.server.update({
      where: { id: serverId },
      data: { status: 'starting' }
    });

    try {
      await this.dockerService.startContainer(server.containerId);
      await prisma.server.update({
        where: { id: serverId },
        data: { 
          status: 'running',
          lastStartedAt: new Date()
        }
      });
    } catch (error) {
      await prisma.server.update({
        where: { id: serverId },
        data: { status: 'error' }
      });
      throw error;
    }
  }

  async stopServer(serverId: string): Promise<void> {
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server || !server.containerId) {
      throw new Error('Server not found');
    }

    await prisma.server.update({
      where: { id: serverId },
      data: { status: 'stopping' }
    });

    try {
      await this.dockerService.stopContainer(server.containerId);
      await prisma.server.update({
        where: { id: serverId },
        data: { status: 'stopped' }
      });
    } catch (error) {
      await prisma.server.update({
        where: { id: serverId },
        data: { status: 'error' }
      });
      throw error;
    }
  }

  async restartServer(serverId: string): Promise<void> {
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server || !server.containerId) {
      throw new Error('Server not found');
    }

    await this.dockerService.restartContainer(server.containerId);
  }

  async deleteServer(serverId: string): Promise<void> {
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new Error('Server not found');
    }

    if (server.containerId) {
      try {
        await this.dockerService.stopContainer(server.containerId);
      } catch (e) {
        // Container might already be stopped
      }
      await this.dockerService.removeContainer(server.containerId, true);
    }

    // Remove data directory
    if (fs.existsSync(server.dataPath)) {
      fs.rmSync(server.dataPath, { recursive: true, force: true });
    }

    await prisma.server.delete({ where: { id: serverId } });
    logger.info(`Server ${server.name} deleted`);
  }

  async getServerStats(serverId: string) {
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server || !server.containerId) {
      throw new Error('Server not found');
    }

    return this.dockerService.getContainerStats(server.containerId);
  }

  async getServerLogs(serverId: string, tail: number = 100): Promise<string> {
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server || !server.containerId) {
      throw new Error('Server not found');
    }

    return this.dockerService.getContainerLogs(server.containerId, tail);
  }

  async sendCommand(serverId: string, command: string): Promise<void> {
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server || !server.containerId) {
      throw new Error('Server not found');
    }

    const container = this.dockerService.getContainer(server.containerId);
    
    // For Minecraft servers, use rcon-cli
    if (server.gameType.includes('minecraft')) {
      await this.dockerService.execCommand(server.containerId, ['rcon-cli', command]);
    } else {
      // For other games, write to stdin
      await this.dockerService.execCommand(server.containerId, ['sh', '-c', `echo "${command}"`]);
    }
  }

  async syncServerStatus(serverId: string): Promise<string> {
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server || !server.containerId) {
      return 'unknown';
    }

    const dockerStatus = await this.dockerService.getContainerStatus(server.containerId);
    const panelStatus = this.mapDockerStatus(dockerStatus);

    if (server.status !== panelStatus) {
      await prisma.server.update({
        where: { id: serverId },
        data: { status: panelStatus }
      });
    }

    return panelStatus;
  }

  private mapDockerStatus(dockerStatus: string): string {
    switch (dockerStatus) {
      case 'running':
        return 'running';
      case 'exited':
      case 'dead':
        return 'stopped';
      case 'created':
      case 'restarting':
        return 'starting';
      case 'paused':
        return 'stopped';
      default:
        return 'unknown';
    }
  }
}
