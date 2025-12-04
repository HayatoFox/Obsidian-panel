import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';

// Types
export type MinecraftLoader = 'vanilla' | 'paper' | 'fabric' | 'forge' | 'neoforge';

export interface MinecraftVersion {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  releaseTime: string;
}

export interface LoaderVersion {
  loader: MinecraftLoader;
  minecraftVersion: string;
  loaderVersion?: string;
  build?: number;
  downloadUrl?: string;
  fileName?: string;
}

interface VanillaVersionManifest {
  latest: { release: string; snapshot: string };
  versions: Array<{
    id: string;
    type: string;
    url: string;
    releaseTime: string;
  }>;
}

interface VanillaVersionDetails {
  downloads: {
    server: { url: string; sha1: string; size: number };
  };
}

interface ForgePromotions {
  promos: Record<string, string>;
}

interface PaperProject {
  versions: string[];
}

interface PaperBuilds {
  builds: Array<{
    build: number;
    channel: string;
    downloads: {
      application: { name: string; sha256: string };
    };
  }>;
}

interface FabricLoaderVersion {
  loader: { version: string; stable: boolean };
  intermediary: { version: string };
  launcherMeta: { version: number };
}

interface NeoForgeVersion {
  version: string;
}

// Cache directory
const CACHE_DIR = process.env.MINECRAFT_CACHE_DIR || path.join(process.cwd(), 'minecraft-cache');
const VERSION_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// In-memory cache
const versionCache: Map<string, { data: any; timestamp: number }> = new Map();

class MinecraftVersionService {
  private static instance: MinecraftVersionService;

  private constructor() {
    // Ensure cache directory exists
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    // Create subdirs for each loader
    ['vanilla', 'paper', 'fabric', 'forge', 'neoforge'].forEach(loader => {
      const loaderDir = path.join(CACHE_DIR, loader);
      if (!fs.existsSync(loaderDir)) {
        fs.mkdirSync(loaderDir, { recursive: true });
      }
    });
  }

  static getInstance(): MinecraftVersionService {
    if (!MinecraftVersionService.instance) {
      MinecraftVersionService.instance = new MinecraftVersionService();
    }
    return MinecraftVersionService.instance;
  }

  private isCacheValid(key: string): boolean {
    const cached = versionCache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < VERSION_CACHE_TTL;
  }

  private getFromCache<T>(key: string): T | null {
    if (this.isCacheValid(key)) {
      return versionCache.get(key)!.data as T;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    versionCache.set(key, { data, timestamp: Date.now() });
  }

  // ==================== LOADERS INFO ====================

  getAvailableLoaders(): { id: MinecraftLoader; name: string; description: string; icon: string }[] {
    return [
      { 
        id: 'vanilla', 
        name: 'Vanilla', 
        description: 'Serveur Minecraft officiel sans mods',
        icon: '🎮'
      },
      { 
        id: 'paper', 
        name: 'Paper', 
        description: 'Fork performant de Spigot avec optimisations et support plugins',
        icon: '📄'
      },
      { 
        id: 'fabric', 
        name: 'Fabric', 
        description: 'Loader de mods moderne et léger',
        icon: '🧵'
      },
      { 
        id: 'forge', 
        name: 'Forge', 
        description: 'Loader de mods classique avec large écosystème',
        icon: '🔨'
      },
      { 
        id: 'neoforge', 
        name: 'NeoForge', 
        description: 'Fork moderne de Forge (MC 1.20.1+)',
        icon: '⚡'
      }
    ];
  }

  // ==================== VANILLA ====================

  async getVanillaVersions(type: 'release' | 'all' = 'release'): Promise<MinecraftVersion[]> {
    const cacheKey = `vanilla-versions-${type}`;
    const cached = this.getFromCache<MinecraftVersion[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get<VanillaVersionManifest>(
        'https://launchermeta.mojang.com/mc/game/version_manifest.json'
      );

      let versions = response.data.versions.map(v => ({
        id: v.id,
        type: v.type as MinecraftVersion['type'],
        releaseTime: v.releaseTime
      }));

      if (type === 'release') {
        versions = versions.filter(v => v.type === 'release');
      }

      this.setCache(cacheKey, versions);
      return versions;
    } catch (error) {
      logger.error('Failed to fetch Vanilla versions:', error);
      throw new Error('Failed to fetch Vanilla versions');
    }
  }

  async getVanillaDownloadUrl(version: string): Promise<string> {
    try {
      const manifest = await axios.get<VanillaVersionManifest>(
        'https://launchermeta.mojang.com/mc/game/version_manifest.json'
      );

      const versionInfo = manifest.data.versions.find(v => v.id === version);
      if (!versionInfo) {
        throw new Error(`Vanilla version ${version} not found`);
      }

      const versionDetails = await axios.get<VanillaVersionDetails>(versionInfo.url);
      return versionDetails.data.downloads.server.url;
    } catch (error) {
      logger.error(`Failed to get Vanilla download URL for ${version}:`, error);
      throw error;
    }
  }

  // ==================== PAPER ====================

  async getPaperVersions(): Promise<MinecraftVersion[]> {
    const cacheKey = 'paper-versions';
    const cached = this.getFromCache<MinecraftVersion[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get<PaperProject>(
        'https://api.papermc.io/v2/projects/paper'
      );

      const versions: MinecraftVersion[] = response.data.versions
        .reverse()
        .map(v => ({
          id: v,
          type: 'release' as const,
          releaseTime: ''
        }));

      this.setCache(cacheKey, versions);
      return versions;
    } catch (error) {
      logger.error('Failed to fetch Paper versions:', error);
      throw new Error('Failed to fetch Paper versions');
    }
  }

  async getPaperBuilds(mcVersion: string): Promise<{ build: number; channel: string }[]> {
    const cacheKey = `paper-builds-${mcVersion}`;
    const cached = this.getFromCache<{ build: number; channel: string }[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get<PaperBuilds>(
        `https://api.papermc.io/v2/projects/paper/versions/${mcVersion}/builds`
      );

      const builds = response.data.builds.map(b => ({
        build: b.build,
        channel: b.channel
      })).reverse();

      this.setCache(cacheKey, builds);
      return builds;
    } catch (error) {
      logger.error(`Failed to fetch Paper builds for ${mcVersion}:`, error);
      throw new Error(`Failed to fetch Paper builds for ${mcVersion}`);
    }
  }

  async getPaperDownloadUrl(mcVersion: string, build?: number): Promise<{ url: string; fileName: string }> {
    try {
      const builds = await this.getPaperBuilds(mcVersion);
      const targetBuild = build || builds[0]?.build;

      if (!targetBuild) {
        throw new Error(`No builds available for Paper ${mcVersion}`);
      }

      const buildsResponse = await axios.get<PaperBuilds>(
        `https://api.papermc.io/v2/projects/paper/versions/${mcVersion}/builds`
      );

      const buildInfo = buildsResponse.data.builds.find(b => b.build === targetBuild);
      if (!buildInfo) {
        throw new Error(`Build ${targetBuild} not found for Paper ${mcVersion}`);
      }

      const fileName = buildInfo.downloads.application.name;
      const url = `https://api.papermc.io/v2/projects/paper/versions/${mcVersion}/builds/${targetBuild}/downloads/${fileName}`;

      return { url, fileName };
    } catch (error) {
      logger.error(`Failed to get Paper download URL for ${mcVersion}:`, error);
      throw error;
    }
  }

  // ==================== FABRIC ====================

  async getFabricVersions(): Promise<MinecraftVersion[]> {
    const cacheKey = 'fabric-versions';
    const cached = this.getFromCache<MinecraftVersion[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get<Array<{ version: string; stable: boolean }>>(
        'https://meta.fabricmc.net/v2/versions/game'
      );

      const versions: MinecraftVersion[] = response.data
        .filter(v => v.stable)
        .map(v => ({
          id: v.version,
          type: 'release' as const,
          releaseTime: ''
        }));

      this.setCache(cacheKey, versions);
      return versions;
    } catch (error) {
      logger.error('Failed to fetch Fabric versions:', error);
      throw new Error('Failed to fetch Fabric versions');
    }
  }

  async getFabricLoaderVersions(mcVersion: string): Promise<string[]> {
    const cacheKey = `fabric-loader-${mcVersion}`;
    const cached = this.getFromCache<string[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get<FabricLoaderVersion[]>(
        `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`
      );

      const loaderVersions = response.data
        .filter(v => v.loader.stable)
        .map(v => v.loader.version);

      this.setCache(cacheKey, loaderVersions);
      return loaderVersions;
    } catch (error) {
      logger.error(`Failed to fetch Fabric loader versions for ${mcVersion}:`, error);
      throw new Error(`Failed to fetch Fabric loader versions for ${mcVersion}`);
    }
  }

  async getFabricDownloadUrl(mcVersion: string, loaderVersion?: string): Promise<{ url: string; fileName: string }> {
    try {
      let loader = loaderVersion;
      if (!loader) {
        const loaders = await this.getFabricLoaderVersions(mcVersion);
        loader = loaders[0];
      }

      if (!loader) {
        throw new Error(`No Fabric loader available for ${mcVersion}`);
      }

      // Get latest installer version
      const installerResponse = await axios.get<Array<{ version: string; stable: boolean }>>(
        'https://meta.fabricmc.net/v2/versions/installer'
      );
      const installer = installerResponse.data.find(v => v.stable)?.version || installerResponse.data[0].version;

      const fileName = `fabric-server-mc.${mcVersion}-loader.${loader}-launcher.${installer}.jar`;
      const url = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loader}/${installer}/server/jar`;

      return { url, fileName };
    } catch (error) {
      logger.error(`Failed to get Fabric download URL for ${mcVersion}:`, error);
      throw error;
    }
  }

  // ==================== FORGE ====================

  async getForgeVersions(): Promise<MinecraftVersion[]> {
    const cacheKey = 'forge-versions';
    const cached = this.getFromCache<MinecraftVersion[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get<ForgePromotions>(
        'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'
      );

      // Extract unique MC versions from promos (format: "1.20.4-recommended", "1.20.4-latest")
      const mcVersions = new Set<string>();
      Object.keys(response.data.promos).forEach(key => {
        const match = key.match(/^(\d+\.\d+(?:\.\d+)?)-/);
        if (match) {
          mcVersions.add(match[1]);
        }
      });

      const versions: MinecraftVersion[] = Array.from(mcVersions)
        .sort((a, b) => {
          const partsA = a.split('.').map(Number);
          const partsB = b.split('.').map(Number);
          for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const diff = (partsB[i] || 0) - (partsA[i] || 0);
            if (diff !== 0) return diff;
          }
          return 0;
        })
        .map(v => ({
          id: v,
          type: 'release' as const,
          releaseTime: ''
        }));

      this.setCache(cacheKey, versions);
      return versions;
    } catch (error) {
      logger.error('Failed to fetch Forge versions:', error);
      throw new Error('Failed to fetch Forge versions');
    }
  }

  async getForgeLoaderVersion(mcVersion: string): Promise<{ recommended?: string; latest?: string }> {
    try {
      const response = await axios.get<ForgePromotions>(
        'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'
      );

      return {
        recommended: response.data.promos[`${mcVersion}-recommended`],
        latest: response.data.promos[`${mcVersion}-latest`]
      };
    } catch (error) {
      logger.error(`Failed to fetch Forge loader versions for ${mcVersion}:`, error);
      throw error;
    }
  }

  async getForgeDownloadUrl(mcVersion: string, forgeVersion?: string): Promise<{ url: string; fileName: string }> {
    try {
      let version = forgeVersion;
      if (!version) {
        const versions = await this.getForgeLoaderVersion(mcVersion);
        version = versions.recommended || versions.latest;
      }

      if (!version) {
        throw new Error(`No Forge version available for ${mcVersion}`);
      }

      const fileName = `forge-${mcVersion}-${version}-installer.jar`;
      const url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVersion}-${version}/forge-${mcVersion}-${version}-installer.jar`;

      return { url, fileName };
    } catch (error) {
      logger.error(`Failed to get Forge download URL for ${mcVersion}:`, error);
      throw error;
    }
  }

  // ==================== NEOFORGE ====================

  async getNeoForgeVersions(): Promise<MinecraftVersion[]> {
    const cacheKey = 'neoforge-versions';
    const cached = this.getFromCache<MinecraftVersion[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get<{ versions: string[] }>(
        'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge'
      );

      // Extract unique MC versions from NeoForge versions
      // NeoForge versions format: 20.4.xxx (which maps to MC 1.20.4)
      const mcVersions = new Map<string, string>();
      
      response.data.versions.forEach(v => {
        // NeoForge 20.x = MC 1.20.x, 21.x = MC 1.21.x, etc.
        const match = v.match(/^(\d+)\.(\d+)/);
        if (match) {
          const major = parseInt(match[1]);
          const minor = parseInt(match[2]);
          const mcVersion = `1.${major}.${minor}`;
          if (!mcVersions.has(mcVersion)) {
            mcVersions.set(mcVersion, v);
          }
        }
      });

      const versions: MinecraftVersion[] = Array.from(mcVersions.keys())
        .sort((a, b) => {
          const partsA = a.split('.').map(Number);
          const partsB = b.split('.').map(Number);
          for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const diff = (partsB[i] || 0) - (partsA[i] || 0);
            if (diff !== 0) return diff;
          }
          return 0;
        })
        .map(v => ({
          id: v,
          type: 'release' as const,
          releaseTime: ''
        }));

      this.setCache(cacheKey, versions);
      return versions;
    } catch (error) {
      logger.error('Failed to fetch NeoForge versions:', error);
      throw new Error('Failed to fetch NeoForge versions');
    }
  }

  async getNeoForgeLoaderVersions(mcVersion: string): Promise<string[]> {
    const cacheKey = `neoforge-loader-${mcVersion}`;
    const cached = this.getFromCache<string[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get<{ versions: string[] }>(
        'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge'
      );

      // MC 1.20.4 -> NeoForge 20.4.xxx
      const match = mcVersion.match(/^1\.(\d+)\.(\d+)/);
      if (!match) {
        throw new Error(`Invalid MC version format: ${mcVersion}`);
      }

      const prefix = `${match[1]}.${match[2]}`;
      const loaderVersions = response.data.versions
        .filter(v => v.startsWith(prefix))
        .reverse();

      this.setCache(cacheKey, loaderVersions);
      return loaderVersions;
    } catch (error) {
      logger.error(`Failed to fetch NeoForge loader versions for ${mcVersion}:`, error);
      throw new Error(`Failed to fetch NeoForge loader versions for ${mcVersion}`);
    }
  }

  async getNeoForgeDownloadUrl(mcVersion: string, neoforgeVersion?: string): Promise<{ url: string; fileName: string }> {
    try {
      let version = neoforgeVersion;
      if (!version) {
        const versions = await this.getNeoForgeLoaderVersions(mcVersion);
        version = versions[0];
      }

      if (!version) {
        throw new Error(`No NeoForge version available for ${mcVersion}`);
      }

      const fileName = `neoforge-${version}-installer.jar`;
      const url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version}/neoforge-${version}-installer.jar`;

      return { url, fileName };
    } catch (error) {
      logger.error(`Failed to get NeoForge download URL for ${mcVersion}:`, error);
      throw error;
    }
  }

  // ==================== UNIFIED API ====================

  async getVersionsForLoader(loader: MinecraftLoader): Promise<MinecraftVersion[]> {
    switch (loader) {
      case 'vanilla':
        return this.getVanillaVersions();
      case 'paper':
        return this.getPaperVersions();
      case 'fabric':
        return this.getFabricVersions();
      case 'forge':
        return this.getForgeVersions();
      case 'neoforge':
        return this.getNeoForgeVersions();
      default:
        throw new Error(`Unknown loader: ${loader}`);
    }
  }

  async getLoaderVersions(loader: MinecraftLoader, mcVersion: string): Promise<string[] | { build: number; channel: string }[]> {
    switch (loader) {
      case 'vanilla':
        return []; // No loader versions for vanilla
      case 'paper':
        return this.getPaperBuilds(mcVersion);
      case 'fabric':
        return this.getFabricLoaderVersions(mcVersion);
      case 'forge':
        const forgeVersions = await this.getForgeLoaderVersion(mcVersion);
        return [forgeVersions.recommended, forgeVersions.latest].filter(Boolean) as string[];
      case 'neoforge':
        return this.getNeoForgeLoaderVersions(mcVersion);
      default:
        throw new Error(`Unknown loader: ${loader}`);
    }
  }

  // ==================== DOWNLOAD & CACHE ====================

  getJarPath(loader: MinecraftLoader, mcVersion: string, loaderVersion?: string | number): string {
    const loaderDir = path.join(CACHE_DIR, loader);
    let fileName: string;

    switch (loader) {
      case 'vanilla':
        fileName = `server-${mcVersion}.jar`;
        break;
      case 'paper':
        fileName = `paper-${mcVersion}-${loaderVersion || 'latest'}.jar`;
        break;
      case 'fabric':
        fileName = `fabric-server-${mcVersion}-${loaderVersion || 'latest'}.jar`;
        break;
      case 'forge':
        fileName = `forge-${mcVersion}-${loaderVersion || 'latest'}-installer.jar`;
        break;
      case 'neoforge':
        fileName = `neoforge-${loaderVersion || mcVersion}-installer.jar`;
        break;
      default:
        throw new Error(`Unknown loader: ${loader}`);
    }

    return path.join(loaderDir, fileName);
  }

  isJarCached(loader: MinecraftLoader, mcVersion: string, loaderVersion?: string | number): boolean {
    const jarPath = this.getJarPath(loader, mcVersion, loaderVersion);
    return fs.existsSync(jarPath);
  }

  getCachedJars(): { loader: MinecraftLoader; mcVersion: string; loaderVersion?: string; path: string; size: number }[] {
    const cached: { loader: MinecraftLoader; mcVersion: string; loaderVersion?: string; path: string; size: number }[] = [];

    const loaders: MinecraftLoader[] = ['vanilla', 'paper', 'fabric', 'forge', 'neoforge'];
    
    loaders.forEach(loader => {
      const loaderDir = path.join(CACHE_DIR, loader);
      if (fs.existsSync(loaderDir)) {
        const files = fs.readdirSync(loaderDir);
        files.forEach(file => {
          if (file.endsWith('.jar')) {
            const filePath = path.join(loaderDir, file);
            const stats = fs.statSync(filePath);
            
            // Parse version info from filename
            let mcVersion = '';
            let loaderVersion: string | undefined;

            if (loader === 'vanilla') {
              const match = file.match(/server-(.+)\.jar/);
              mcVersion = match?.[1] || '';
            } else if (loader === 'paper') {
              const match = file.match(/paper-(.+?)-(.+)\.jar/);
              mcVersion = match?.[1] || '';
              loaderVersion = match?.[2];
            } else if (loader === 'fabric') {
              const match = file.match(/fabric-server-(.+?)-(.+)\.jar/);
              mcVersion = match?.[1] || '';
              loaderVersion = match?.[2];
            } else if (loader === 'forge') {
              const match = file.match(/forge-(.+?)-(.+)-installer\.jar/);
              mcVersion = match?.[1] || '';
              loaderVersion = match?.[2];
            } else if (loader === 'neoforge') {
              const match = file.match(/neoforge-(.+)-installer\.jar/);
              loaderVersion = match?.[1];
              // Convert NeoForge version to MC version
              const nfMatch = loaderVersion?.match(/^(\d+)\.(\d+)/);
              mcVersion = nfMatch ? `1.${nfMatch[1]}.${nfMatch[2]}` : '';
            }

            cached.push({
              loader,
              mcVersion,
              loaderVersion,
              path: filePath,
              size: stats.size
            });
          }
        });
      }
    });

    return cached;
  }

  async downloadJar(
    loader: MinecraftLoader,
    mcVersion: string,
    loaderVersion?: string | number,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    let downloadInfo: { url: string; fileName: string };

    switch (loader) {
      case 'vanilla':
        const vanillaUrl = await this.getVanillaDownloadUrl(mcVersion);
        downloadInfo = { url: vanillaUrl, fileName: `server-${mcVersion}.jar` };
        break;
      case 'paper':
        downloadInfo = await this.getPaperDownloadUrl(mcVersion, loaderVersion as number);
        break;
      case 'fabric':
        downloadInfo = await this.getFabricDownloadUrl(mcVersion, loaderVersion as string);
        break;
      case 'forge':
        downloadInfo = await this.getForgeDownloadUrl(mcVersion, loaderVersion as string);
        break;
      case 'neoforge':
        downloadInfo = await this.getNeoForgeDownloadUrl(mcVersion, loaderVersion as string);
        break;
      default:
        throw new Error(`Unknown loader: ${loader}`);
    }

    const loaderDir = path.join(CACHE_DIR, loader);
    const targetPath = path.join(loaderDir, downloadInfo.fileName);

    // Check if already downloaded
    if (fs.existsSync(targetPath)) {
      logger.info(`JAR already cached: ${targetPath}`);
      return targetPath;
    }

    logger.info(`Downloading ${loader} ${mcVersion} from ${downloadInfo.url}`);

    try {
      const response = await axios({
        method: 'GET',
        url: downloadInfo.url,
        responseType: 'stream',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            onProgress(percent);
          }
        }
      });

      const writer = createWriteStream(targetPath);
      await pipeline(response.data, writer);

      logger.info(`Successfully downloaded: ${targetPath}`);
      return targetPath;
    } catch (error) {
      // Clean up partial download
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      logger.error(`Failed to download ${loader} ${mcVersion}:`, error);
      throw error;
    }
  }

  async deleteJar(loader: MinecraftLoader, mcVersion: string, loaderVersion?: string | number): Promise<void> {
    const jarPath = this.getJarPath(loader, mcVersion, loaderVersion);
    if (fs.existsSync(jarPath)) {
      fs.unlinkSync(jarPath);
      logger.info(`Deleted cached JAR: ${jarPath}`);
    }
  }

  getCacheDir(): string {
    return CACHE_DIR;
  }

  getCacheSize(): { total: number; byLoader: Record<MinecraftLoader, number> } {
    const loaders: MinecraftLoader[] = ['vanilla', 'paper', 'fabric', 'forge', 'neoforge'];
    const byLoader: Record<string, number> = {};
    let total = 0;

    loaders.forEach(loader => {
      const loaderDir = path.join(CACHE_DIR, loader);
      let loaderSize = 0;

      if (fs.existsSync(loaderDir)) {
        const files = fs.readdirSync(loaderDir);
        files.forEach(file => {
          const filePath = path.join(loaderDir, file);
          const stats = fs.statSync(filePath);
          loaderSize += stats.size;
        });
      }

      byLoader[loader] = loaderSize;
      total += loaderSize;
    });

    return { total, byLoader: byLoader as Record<MinecraftLoader, number> };
  }

  clearCache(loader?: MinecraftLoader): void {
    if (loader) {
      const loaderDir = path.join(CACHE_DIR, loader);
      if (fs.existsSync(loaderDir)) {
        const files = fs.readdirSync(loaderDir);
        files.forEach(file => {
          fs.unlinkSync(path.join(loaderDir, file));
        });
        logger.info(`Cleared cache for ${loader}`);
      }
    } else {
      const loaders: MinecraftLoader[] = ['vanilla', 'paper', 'fabric', 'forge', 'neoforge'];
      loaders.forEach(l => this.clearCache(l));
      logger.info('Cleared all Minecraft cache');
    }
  }
}

export const minecraftService = MinecraftVersionService.getInstance();
export default MinecraftVersionService;
