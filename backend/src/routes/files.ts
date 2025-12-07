import { Router, Response, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, requireOwnerOrAdmin } from '../middleware/auth';
import { fileService, UploadedFile } from '../services/files';
import { logger } from '../utils/logger';

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(process.cwd(), 'temp-uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Preserve original name with timestamp prefix to avoid conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max per file
    files: 100 // Max 100 files at once
  }
});

// Helper to get server data path
async function getServerDataPath(serverId: string): Promise<string | null> {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    select: { dataPath: true }
  });
  return server?.dataPath || null;
}

// List files in directory
router.get('/', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.params.id;
    const requestedPath = (req.query.path as string) || '/';
    
    const dataPath = await getServerDataPath(serverId);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const contents = await fileService.getDirectoryContents(dataPath, requestedPath);
    res.json(contents);
  } catch (error: any) {
    logger.error('Error listing files:', error);
    res.status(500).json({ error: error.message || 'Failed to list files' });
  }
});

// Get file info
router.get('/info', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.params.id;
    const filePath = req.query.path as string;
    
    if (!filePath) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const info = await fileService.getFileInfo(dataPath, filePath);
    res.json(info);
  } catch (error: any) {
    logger.error('Error getting file info:', error);
    res.status(500).json({ error: error.message || 'Failed to get file info' });
  }
});

// Read file content
router.get('/content', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.params.id;
    const filePath = req.query.path as string;
    
    if (!filePath) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const result = await fileService.readFileContent(dataPath, filePath);
    res.json(result);
  } catch (error: any) {
    logger.error('Error reading file:', error);
    res.status(500).json({ error: error.message || 'Failed to read file' });
  }
});

// Write/save file content
router.put('/content', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.params.id;
    const { path: filePath, content, encoding } = req.body;
    
    if (!filePath) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    await fileService.writeFileContent(dataPath, filePath, content, encoding || 'utf-8');
    res.json({ success: true, message: 'File saved successfully' });
  } catch (error: any) {
    logger.error('Error writing file:', error);
    res.status(500).json({ error: error.message || 'Failed to write file' });
  }
});

// Create directory
router.post('/directory', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.params.id;
    const { path: dirPath } = req.body;
    
    if (!dirPath) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    await fileService.createDirectory(dataPath, dirPath);
    res.json({ success: true, message: 'Directory created successfully' });
  } catch (error: any) {
    logger.error('Error creating directory:', error);
    res.status(500).json({ error: error.message || 'Failed to create directory' });
  }
});

// Delete file or directory
router.delete('/', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.params.id;
    const targetPath = req.query.path as string;
    
    if (!targetPath) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    await fileService.delete(dataPath, targetPath);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting:', error);
    res.status(500).json({ error: error.message || 'Failed to delete' });
  }
});

// Rename/move file or directory
router.post('/rename', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.params.id;
    const { oldPath, newPath } = req.body;
    
    if (!oldPath || !newPath) {
      res.status(400).json({ error: 'Both oldPath and newPath are required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    await fileService.rename(dataPath, oldPath, newPath);
    res.json({ success: true, message: 'Renamed successfully' });
  } catch (error: any) {
    logger.error('Error renaming:', error);
    res.status(500).json({ error: error.message || 'Failed to rename' });
  }
});

// Copy file or directory
router.post('/copy', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.params.id;
    const { sourcePath, destPath } = req.body;
    
    if (!sourcePath || !destPath) {
      res.status(400).json({ error: 'Both sourcePath and destPath are required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    await fileService.copy(dataPath, sourcePath, destPath);
    res.json({ success: true, message: 'Copied successfully' });
  } catch (error: any) {
    logger.error('Error copying:', error);
    res.status(500).json({ error: error.message || 'Failed to copy' });
  }
});

// Upload single file
router.post('/upload', requireOwnerOrAdmin(), upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.params.id;
    const destPath = (req.body.path as string) || '/';
    
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const dataPath = await getServerDataPath(serverId);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const uploadedFile: UploadedFile = {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      encoding: req.file.encoding,
      mimetype: req.file.mimetype,
      destination: req.file.destination,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size
    };

    const filePath = await fileService.handleUpload(dataPath, destPath, uploadedFile);
    res.json({ success: true, path: filePath, message: 'File uploaded successfully' });
  } catch (error: any) {
    logger.error('Error uploading file:', error);
    res.status(500).json({ error: error.message || 'Failed to upload file' });
  }
});

// Upload multiple files (with directory structure support)
router.post('/upload-multiple', requireOwnerOrAdmin(), upload.array('files', 100), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.params.id;
    const destPath = (req.body.path as string) || '/';
    const relativePaths = req.body.relativePaths ? JSON.parse(req.body.relativePaths) : undefined;
    
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    const dataPath = await getServerDataPath(serverId);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const files = (req.files as Express.Multer.File[]).map(f => ({
      fieldname: f.fieldname,
      originalname: f.originalname,
      encoding: f.encoding,
      mimetype: f.mimetype,
      destination: f.destination,
      filename: f.filename,
      path: f.path,
      size: f.size
    }));

    const results = await fileService.handleMultipleUpload(dataPath, destPath, files, relativePaths);
    res.json({ 
      success: true, 
      uploaded: results.length,
      message: `${results.length} files uploaded successfully` 
    });
  } catch (error: any) {
    logger.error('Error uploading files:', error);
    res.status(500).json({ error: error.message || 'Failed to upload files' });
  }
});

// Download file
router.get('/download', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.params.id;
    const filePath = req.query.path as string;
    
    if (!filePath) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const { stream, filename, size } = fileService.getDownloadStream(dataPath, filePath);
    
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', size);
    
    stream.pipe(res);
  } catch (error: any) {
    logger.error('Error downloading file:', error);
    res.status(500).json({ error: error.message || 'Failed to download file' });
  }
});

// Download directory as archive
router.get('/download-archive', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.params.id;
    const dirPath = req.query.path as string;
    
    if (!dirPath) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const { path: archivePath, filename } = await fileService.createTempArchiveForDownload(dataPath, dirPath);
    
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'application/zip');
    
    const stream = fs.createReadStream(archivePath);
    stream.pipe(res);
    
    // Clean up temp file after sending
    stream.on('end', () => {
      fs.unlink(archivePath, () => {});
    });
  } catch (error: any) {
    logger.error('Error downloading archive:', error);
    res.status(500).json({ error: error.message || 'Failed to download archive' });
  }
});

// Create archive from selected files/directories
router.post('/archive', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.params.id;
    const { paths, archiveName, format } = req.body;
    
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      res.status(400).json({ error: 'Paths array is required' });
      return;
    }

    if (!archiveName) {
      res.status(400).json({ error: 'Archive name is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const archivePath = await fileService.createArchive(dataPath, paths, archiveName, format || 'zip');
    res.json({ 
      success: true, 
      path: archivePath.replace(dataPath, ''),
      message: 'Archive created successfully' 
    });
  } catch (error: any) {
    logger.error('Error creating archive:', error);
    res.status(500).json({ error: error.message || 'Failed to create archive' });
  }
});

// Extract archive
router.post('/extract', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.params.id;
    const { archivePath, destPath } = req.body;
    
    if (!archivePath) {
      res.status(400).json({ error: 'Archive path is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    await fileService.extractArchive(dataPath, archivePath, destPath || path.dirname(archivePath));
    res.json({ success: true, message: 'Archive extracted successfully' });
  } catch (error: any) {
    logger.error('Error extracting archive:', error);
    res.status(500).json({ error: error.message || 'Failed to extract archive' });
  }
});

// Search files
router.get('/search', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.params.id;
    const query = req.query.q as string;
    const searchPath = (req.query.path as string) || '/';
    
    if (!query) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const results = await fileService.searchFiles(dataPath, searchPath, query);
    res.json({ results });
  } catch (error: any) {
    logger.error('Error searching files:', error);
    res.status(500).json({ error: error.message || 'Failed to search files' });
  }
});

// Get disk usage
router.get('/usage', requireOwnerOrAdmin(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.params.id;
    const targetPath = (req.query.path as string) || '/';
    
    const dataPath = await getServerDataPath(serverId);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const usage = await fileService.getDiskUsage(dataPath, targetPath);
    res.json(usage);
  } catch (error: any) {
    logger.error('Error getting disk usage:', error);
    res.status(500).json({ error: error.message || 'Failed to get disk usage' });
  }
});

export default router;
