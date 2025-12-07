import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import archiver from 'archiver';
import extract from 'extract-zip';
import * as tar from 'tar';
import { logger } from '../utils/logger';

const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);
const rmdir = promisify(fs.rm);
const rename = promisify(fs.rename);
const copyFile = promisify(fs.copyFile);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

export interface FileInfo {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  permissions?: string;
}

export interface DirectoryContents {
  path: string;
  files: FileInfo[];
  totalSize: number;
  totalItems: number;
}

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number;
}

class FileService {
  private static instance: FileService;

  private constructor() {}

  static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

  // Sanitize path to prevent directory traversal
  private sanitizePath(basePath: string, requestedPath: string): string {
    // Remove any ../ or ./ from the path
    const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(basePath, normalizedPath);
    
    // Ensure the resulting path is within the base path
    if (!fullPath.startsWith(basePath)) {
      throw new Error('Invalid path: Access denied');
    }
    
    return fullPath;
  }

  // Get directory contents
  async getDirectoryContents(basePath: string, requestedPath: string = '/'): Promise<DirectoryContents> {
    const fullPath = this.sanitizePath(basePath, requestedPath);
    
    // Ensure directory exists
    if (!fs.existsSync(fullPath)) {
      // Create it if it doesn't exist
      await mkdir(fullPath, { recursive: true });
    }

    const entries = await readdir(fullPath, { withFileTypes: true });
    const files: FileInfo[] = [];
    let totalSize = 0;

    for (const entry of entries) {
      try {
        const entryPath = path.join(fullPath, entry.name);
        const stats = await stat(entryPath);
        
        const fileInfo: FileInfo = {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime.toISOString(),
        };

        files.push(fileInfo);
        if (!entry.isDirectory()) {
          totalSize += stats.size;
        }
      } catch (error) {
        // Skip files we can't access
        logger.warn(`Cannot access file: ${entry.name}`);
      }
    }

    return {
      path: requestedPath,
      files,
      totalSize,
      totalItems: files.length,
    };
  }

  // Get file info
  async getFileInfo(basePath: string, filePath: string): Promise<FileInfo> {
    const fullPath = this.sanitizePath(basePath, filePath);
    const stats = await stat(fullPath);
    
    return {
      name: path.basename(fullPath),
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      modified: stats.mtime.toISOString(),
    };
  }

  // Read file content
  async readFileContent(basePath: string, filePath: string, maxSize: number = 10 * 1024 * 1024): Promise<{ content: string; encoding: string; size: number }> {
    const fullPath = this.sanitizePath(basePath, filePath);
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      throw new Error('Cannot read directory as file');
    }
    
    if (stats.size > maxSize) {
      throw new Error(`File too large (${stats.size} bytes). Maximum size is ${maxSize} bytes.`);
    }

    const content = await readFile(fullPath);
    
    // Detect if binary file
    const isBinary = this.isBinaryFile(content);
    
    if (isBinary) {
      return {
        content: content.toString('base64'),
        encoding: 'base64',
        size: stats.size,
      };
    }

    return {
      content: content.toString('utf-8'),
      encoding: 'utf-8',
      size: stats.size,
    };
  }

  // Write file content
  async writeFileContent(basePath: string, filePath: string, content: string, encoding: 'utf-8' | 'base64' = 'utf-8'): Promise<void> {
    const fullPath = this.sanitizePath(basePath, filePath);
    
    // Ensure parent directory exists
    const dir = path.dirname(fullPath);
    await mkdir(dir, { recursive: true });

    if (encoding === 'base64') {
      await writeFile(fullPath, Buffer.from(content, 'base64'));
    } else {
      await writeFile(fullPath, content, 'utf-8');
    }

    logger.info(`File written: ${fullPath}`);
  }

  // Create directory
  async createDirectory(basePath: string, dirPath: string): Promise<void> {
    const fullPath = this.sanitizePath(basePath, dirPath);
    await mkdir(fullPath, { recursive: true });
    logger.info(`Directory created: ${fullPath}`);
  }

  // Delete file or directory
  async delete(basePath: string, targetPath: string): Promise<void> {
    const fullPath = this.sanitizePath(basePath, targetPath);
    
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      await rmdir(fullPath, { recursive: true });
    } else {
      await unlink(fullPath);
    }

    logger.info(`Deleted: ${fullPath}`);
  }

  // Rename/move file or directory
  async rename(basePath: string, oldPath: string, newPath: string): Promise<void> {
    const fullOldPath = this.sanitizePath(basePath, oldPath);
    const fullNewPath = this.sanitizePath(basePath, newPath);
    
    // Ensure parent directory exists
    const dir = path.dirname(fullNewPath);
    await mkdir(dir, { recursive: true });
    
    await rename(fullOldPath, fullNewPath);
    logger.info(`Renamed: ${fullOldPath} -> ${fullNewPath}`);
  }

  // Copy file or directory
  async copy(basePath: string, sourcePath: string, destPath: string): Promise<void> {
    const fullSourcePath = this.sanitizePath(basePath, sourcePath);
    const fullDestPath = this.sanitizePath(basePath, destPath);
    
    const stats = await stat(fullSourcePath);
    
    if (stats.isDirectory()) {
      await this.copyDirectory(fullSourcePath, fullDestPath);
    } else {
      // Ensure parent directory exists
      const dir = path.dirname(fullDestPath);
      await mkdir(dir, { recursive: true });
      await copyFile(fullSourcePath, fullDestPath);
    }

    logger.info(`Copied: ${fullSourcePath} -> ${fullDestPath}`);
  }

  // Copy directory recursively
  private async copyDirectory(source: string, dest: string): Promise<void> {
    await mkdir(dest, { recursive: true });
    const entries = await readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
  }

  // Handle file upload (move from temp to destination)
  async handleUpload(basePath: string, destPath: string, uploadedFile: UploadedFile): Promise<string> {
    // Handle encoding issues with filename
    let fileName = uploadedFile.originalname;
    try {
      // Try to decode if it's latin1 encoded UTF-8
      fileName = Buffer.from(uploadedFile.originalname, 'latin1').toString('utf8');
    } catch {
      // Keep original if decoding fails
    }
    
    const destFullPath = this.sanitizePath(basePath, path.join(destPath, fileName));
    
    // Ensure parent directory exists
    const dir = path.dirname(destFullPath);
    await mkdir(dir, { recursive: true });
    
    // Move file from temp location
    try {
      await rename(uploadedFile.path, destFullPath);
    } catch (renameError: any) {
      // If rename fails (cross-device), try copy + delete
      if (renameError.code === 'EXDEV') {
        await copyFile(uploadedFile.path, destFullPath);
        await unlink(uploadedFile.path);
      } else {
        throw renameError;
      }
    }
    
    logger.info(`File uploaded: ${destFullPath}`);
    return destFullPath;
  }

  // Handle multiple file upload (including directory structure)
  async handleMultipleUpload(basePath: string, destPath: string, files: UploadedFile[], relativePaths?: string[]): Promise<string[]> {
    const results: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = relativePaths?.[i] || file.originalname;
      const destFullPath = this.sanitizePath(basePath, path.join(destPath, relativePath));
      
      // Ensure parent directory exists
      const dir = path.dirname(destFullPath);
      await mkdir(dir, { recursive: true });
      
      // Move file from temp location
      await rename(file.path, destFullPath);
      results.push(destFullPath);
    }
    
    logger.info(`Multiple files uploaded: ${results.length} files`);
    return results;
  }

  // Create archive from files/directories
  async createArchive(
    basePath: string,
    sourcePaths: string[],
    archiveName: string,
    format: 'zip' | 'tar' = 'zip'
  ): Promise<string> {
    const archivePath = this.sanitizePath(basePath, archiveName);
    
    // Ensure parent directory exists
    const dir = path.dirname(archivePath);
    await mkdir(dir, { recursive: true });
    
    const output = createWriteStream(archivePath);
    const archive = archiver(format, {
      zlib: { level: 9 } // Maximum compression
    });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        logger.info(`Archive created: ${archivePath} (${archive.pointer()} bytes)`);
        resolve(archivePath);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      for (const sourcePath of sourcePaths) {
        const fullSourcePath = this.sanitizePath(basePath, sourcePath);
        const stats = fs.statSync(fullSourcePath);
        
        if (stats.isDirectory()) {
          archive.directory(fullSourcePath, path.basename(fullSourcePath));
        } else {
          archive.file(fullSourcePath, { name: path.basename(fullSourcePath) });
        }
      }

      archive.finalize();
    });
  }

  // Extract archive
  async extractArchive(basePath: string, archivePath: string, destPath: string): Promise<void> {
    const fullArchivePath = this.sanitizePath(basePath, archivePath);
    const fullDestPath = this.sanitizePath(basePath, destPath);
    
    // Ensure destination directory exists
    await mkdir(fullDestPath, { recursive: true });
    
    // Determine archive type by extension
    const ext = path.extname(fullArchivePath).toLowerCase();
    const basename = path.basename(fullArchivePath).toLowerCase();
    
    if (ext === '.zip') {
      await extract(fullArchivePath, { dir: fullDestPath });
    } else if (ext === '.tar' || ext === '.tgz' || basename.endsWith('.tar.gz')) {
      await tar.x({
        file: fullArchivePath,
        cwd: fullDestPath,
      });
    } else {
      throw new Error('Unsupported archive format. Supported: .zip, .tar, .tar.gz, .tgz');
    }

    logger.info(`Archive extracted: ${fullArchivePath} -> ${fullDestPath}`);
  }

  // Get download stream for a file
  getDownloadStream(basePath: string, filePath: string): { stream: fs.ReadStream; filename: string; size: number } {
    const fullPath = this.sanitizePath(basePath, filePath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found');
    }
    
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      throw new Error('Cannot download directory directly. Please archive it first.');
    }

    return {
      stream: createReadStream(fullPath),
      filename: path.basename(fullPath),
      size: stats.size,
    };
  }

  // Create temporary archive for download (supports single path or array of paths)
  async createTempArchiveForDownload(
    basePath: string, 
    paths: string | string[],
    archiveName?: string,
    format: 'zip' | 'tar' | 'tar.gz' = 'zip'
  ): Promise<{ path: string; filename: string }> {
    const pathsArray = Array.isArray(paths) ? paths : [paths];
    const tempDir = path.join(basePath, '.temp');
    
    await mkdir(tempDir, { recursive: true });
    
    // Determine filename
    let filename: string;
    if (archiveName) {
      filename = archiveName.includes('.') ? archiveName : `${archiveName}.${format === 'tar.gz' ? 'tar.gz' : format}`;
    } else if (pathsArray.length === 1) {
      const baseName = path.basename(pathsArray[0]);
      filename = `${baseName}.${format === 'tar.gz' ? 'tar.gz' : format}`;
    } else {
      filename = `archive.${format === 'tar.gz' ? 'tar.gz' : format}`;
    }
    
    const archivePath = path.join(tempDir, `${Date.now()}-${filename}`);
    
    const output = createWriteStream(archivePath);
    const archive = archiver(format === 'tar.gz' ? 'tar' : format, { 
      zlib: { level: 6 },
      gzip: format === 'tar.gz'
    });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        resolve({ path: archivePath, filename });
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      
      for (const p of pathsArray) {
        const fullPath = this.sanitizePath(basePath, p);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          archive.directory(fullPath, path.basename(p));
        } else {
          archive.file(fullPath, { name: path.basename(p) });
        }
      }
      
      archive.finalize();
    });
  }

  // Search files by name
  async searchFiles(basePath: string, searchPath: string, query: string, maxResults: number = 100): Promise<FileInfo[]> {
    const fullPath = this.sanitizePath(basePath, searchPath);
    const results: FileInfo[] = [];
    const lowerQuery = query.toLowerCase();

    const search = async (currentPath: string, depth: number = 0): Promise<void> => {
      if (depth > 10 || results.length >= maxResults) return;

      try {
        const entries = await readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (results.length >= maxResults) break;
          
          const entryPath = path.join(currentPath, entry.name);
          
          if (entry.name.toLowerCase().includes(lowerQuery)) {
            const stats = await stat(entryPath);
            results.push({
              name: path.relative(fullPath, entryPath),
              type: entry.isDirectory() ? 'directory' : 'file',
              size: stats.size,
              modified: stats.mtime.toISOString(),
            });
          }

          if (entry.isDirectory()) {
            await search(entryPath, depth + 1);
          }
        }
      } catch (error) {
        // Skip directories we can't access
      }
    };

    await search(fullPath);
    return results;
  }

  // Get disk usage for a path
  async getDiskUsage(basePath: string, targetPath: string = '/'): Promise<{ used: number; files: number; directories: number }> {
    const fullPath = this.sanitizePath(basePath, targetPath);
    
    let used = 0;
    let files = 0;
    let directories = 0;

    const calculateSize = async (currentPath: string): Promise<void> => {
      try {
        const entries = await readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const entryPath = path.join(currentPath, entry.name);
          
          if (entry.isDirectory()) {
            directories++;
            await calculateSize(entryPath);
          } else {
            const stats = await stat(entryPath);
            used += stats.size;
            files++;
          }
        }
      } catch (error) {
        // Skip directories we can't access
      }
    };

    await calculateSize(fullPath);
    
    return { used, files, directories };
  }

  // Check if content is binary
  private isBinaryFile(buffer: Buffer): boolean {
    // Check first 8000 bytes for null characters (common in binary files)
    const checkLength = Math.min(buffer.length, 8000);
    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }
    return false;
  }

  // Clean up temp files older than 1 hour
  async cleanupTempFiles(basePath: string): Promise<number> {
    const tempDir = path.join(basePath, '.temp');
    
    if (!fs.existsSync(tempDir)) {
      return 0;
    }

    const entries = await readdir(tempDir);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let deleted = 0;

    for (const entry of entries) {
      const entryPath = path.join(tempDir, entry);
      const stats = await stat(entryPath);
      
      if (stats.mtime.getTime() < oneHourAgo) {
        await unlink(entryPath);
        deleted++;
      }
    }

    return deleted;
  }
}

export const fileService = FileService.getInstance();
export default FileService;
