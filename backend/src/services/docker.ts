import Docker from 'dockerode';
import { logger } from '../utils/logger';
import { Readable, Writable } from 'stream';

export interface ContainerConfig {
  name: string;
  image: string;
  ports: { container: number; host: number }[];
  env: Record<string, string>;
  volumes: { host: string; container: string }[];
  memory?: number; // MB
  cpus?: number;
  restart?: 'no' | 'always' | 'unless-stopped' | 'on-failure';
}

export interface ContainerStats {
  cpuUsage: number;
  memoryUsage: number;
  memoryLimit: number;
  networkRx: number;
  networkTx: number;
}

export class DockerService {
  private static instance: DockerService;
  private docker: Docker;

  private constructor() {
    this.docker = new Docker({
      socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock'
    });
  }

  static getInstance(): DockerService {
    if (!DockerService.instance) {
      DockerService.instance = new DockerService();
    }
    return DockerService.instance;
  }

  async getInfo(): Promise<Docker.DockerInfo> {
    return this.docker.info();
  }

  async pullImage(imageName: string, onProgress?: (event: any) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      this.docker.pull(imageName, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.docker.modem.followProgress(stream, (err: Error | null, output: any[]) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }, onProgress);
      });
    });
  }

  async createContainer(config: ContainerConfig): Promise<Docker.Container> {
    const portBindings: Docker.PortMap = {};
    const exposedPorts: Record<string, {}> = {};

    config.ports.forEach(port => {
      const containerPort = `${port.container}/tcp`;
      exposedPorts[containerPort] = {};
      portBindings[containerPort] = [{ HostPort: String(port.host) }];
    });

    const binds = config.volumes.map(v => `${v.host}:${v.container}`);
    const env = Object.entries(config.env).map(([k, v]) => `${k}=${v}`);

    const createOptions: Docker.ContainerCreateOptions = {
      name: config.name,
      Image: config.image,
      Env: env,
      ExposedPorts: exposedPorts,
      HostConfig: {
        PortBindings: portBindings,
        Binds: binds,
        Memory: config.memory ? config.memory * 1024 * 1024 : undefined,
        NanoCpus: config.cpus ? config.cpus * 1e9 : undefined,
        RestartPolicy: {
          Name: config.restart || 'unless-stopped'
        }
      },
      Tty: true,
      OpenStdin: true,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true
    };

    logger.info(`Creating container ${config.name} with image ${config.image}`);
    return this.docker.createContainer(createOptions);
  }

  async startContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.start();
    logger.info(`Container ${containerId} started`);
  }

  async stopContainer(containerId: string, timeout: number = 30): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.stop({ t: timeout });
    logger.info(`Container ${containerId} stopped`);
  }

  async restartContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.restart();
    logger.info(`Container ${containerId} restarted`);
  }

  async removeContainer(containerId: string, force: boolean = false): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.remove({ force, v: true });
    logger.info(`Container ${containerId} removed`);
  }

  async getContainerStatus(containerId: string): Promise<string> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      return info.State.Status;
    } catch (error) {
      return 'unknown';
    }
  }

  async getContainerStats(containerId: string): Promise<ContainerStats> {
    const container = this.docker.getContainer(containerId);
    const stats = await container.stats({ stream: false });
    
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuUsage = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;

    return {
      cpuUsage: Math.round(cpuUsage * 100) / 100,
      memoryUsage: stats.memory_stats.usage,
      memoryLimit: stats.memory_stats.limit,
      networkRx: stats.networks?.eth0?.rx_bytes || 0,
      networkTx: stats.networks?.eth0?.tx_bytes || 0
    };
  }

  async getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
    const container = this.docker.getContainer(containerId);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true
    });
    return logs.toString();
  }

  async execCommand(containerId: string, command: string[]): Promise<string> {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true
    });

    const stream = await exec.start({ hijack: true, stdin: false });
    
    return new Promise((resolve, reject) => {
      let output = '';
      stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });
      stream.on('end', () => resolve(output));
      stream.on('error', reject);
    });
  }

  async attachToContainer(containerId: string): Promise<NodeJS.ReadWriteStream> {
    const container = this.docker.getContainer(containerId);
    return container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true
    });
  }

  async sendToContainer(containerId: string, data: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: ['sh', '-c', `echo "${data}"`],
      AttachStdin: true,
      AttachStdout: true,
      Tty: true
    });
    await exec.start({ hijack: true, stdin: true });
  }

  getContainer(containerId: string): Docker.Container {
    return this.docker.getContainer(containerId);
  }

  async listContainers(all: boolean = true): Promise<Docker.ContainerInfo[]> {
    return this.docker.listContainers({ all });
  }

  async imageExists(imageName: string): Promise<boolean> {
    try {
      const image = this.docker.getImage(imageName);
      await image.inspect();
      return true;
    } catch {
      return false;
    }
  }
}
