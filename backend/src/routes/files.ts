import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { fileService, UploadedFile } from '../services/files';
import { logger } from '../utils/logger';

const router = Router();
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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max per file
    files: 100
  }
});

// Helper to get server data path and validate ownership
async function getServerDataPath(serverId: string, userId: string): Promise<string | null> {
  const server = await prisma.server.findFirst({
    where: { 
      id: serverId,
      OR: [
        { userId: userId },
        { user: { role: 'admin' } }
      ]
    },
    select: { dataPath: true }
  });
  return server?.dataPath || null;
}

// List files in directory - GET /api/files/list?serverId=xxx&path=/
router.get('/list', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.query.serverId as string;
    const requestedPath = (req.query.path as string) || '/';
    
    if (!serverId) {
      res.status(400).json({ error: 'serverId is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId, req.user!.id);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found or access denied' });
      return;
    }

    const contents = await fileService.getDirectoryContents(dataPath, requestedPath);
    res.json(contents);
  } catch (error: any) {
    logger.error('Error listing files:', error);
    res.status(500).json({ error: error.message || 'Failed to list files' });
  }
});

// Read file content - GET /api/files/read?serverId=xxx&path=/file.txt
router.get('/read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.query.serverId as string;
    const filePath = req.query.path as string;
    
    if (!serverId) {
      res.status(400).json({ error: 'serverId is required' });
      return;
    }
    
    if (!filePath) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId, req.user!.id);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found or access denied' });
      return;
    }

    const result = await fileService.readFileContent(dataPath, filePath);
    res.json(result);
  } catch (error: any) {
    logger.error('Error reading file:', error);
    res.status(500).json({ error: error.message || 'Failed to read file' });
  }
});

// Write/save file content - POST /api/files/write
router.post('/write', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { serverId, path: filePath, content } = req.body;
    
    if (!serverId) {
      res.status(400).json({ error: 'serverId is required' });
      return;
    }
    
    if (!filePath) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId, req.user!.id);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found or access denied' });
      return;
    }

    await fileService.writeFileContent(dataPath, filePath, content || '', 'utf-8');
    res.json({ success: true, message: 'File saved successfully' });
  } catch (error: any) {
    logger.error('Error writing file:', error);
    res.status(500).json({ error: error.message || 'Failed to write file' });
  }
});

// Create folder - POST /api/files/folder
router.post('/folder', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { serverId, path: folderPath } = req.body;
    
    if (!serverId) {
      res.status(400).json({ error: 'serverId is required' });
      return;
    }
    
    if (!folderPath) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId, req.user!.id);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found or access denied' });
      return;
    }

    await fileService.createDirectory(dataPath, folderPath);
    res.json({ success: true, message: 'Folder created successfully' });
  } catch (error: any) {
    logger.error('Error creating folder:', error);
    res.status(500).json({ error: error.message || 'Failed to create folder' });
  }
});

// Delete file or folder - DELETE /api/files/delete?serverId=xxx&path=/file.txt
router.delete('/delete', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.query.serverId as string;
    const targetPath = req.query.path as string;
    
    if (!serverId) {
      res.status(400).json({ error: 'serverId is required' });
      return;
    }
    
    if (!targetPath) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId, req.user!.id);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found or access denied' });
      return;
    }

    await fileService.delete(dataPath, targetPath);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting:', error);
    res.status(500).json({ error: error.message || 'Failed to delete' });
  }
});

// Rename file/folder - POST /api/files/rename
router.post('/rename', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { serverId, oldPath, newName } = req.body;
    
    if (!serverId) {
      res.status(400).json({ error: 'serverId is required' });
      return;
    }
    
    if (!oldPath || !newName) {
      res.status(400).json({ error: 'oldPath and newName are required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId, req.user!.id);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found or access denied' });
      return;
    }

    // Construct new path from old path directory + new name
    const dir = path.dirname(oldPath);
    const newPath = dir === '/' ? `/${newName}` : `${dir}/${newName}`;

    await fileService.rename(dataPath, oldPath, newPath);
    res.json({ success: true, message: 'Renamed successfully' });
  } catch (error: any) {
    logger.error('Error renaming:', error);
    res.status(500).json({ error: error.message || 'Failed to rename' });
  }
});

// Move file/folder - POST /api/files/move
router.post('/move', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { serverId, sourcePath, destinationPath } = req.body;
    
    if (!serverId) {
      res.status(400).json({ error: 'serverId is required' });
      return;
    }
    
    if (!sourcePath || !destinationPath) {
      res.status(400).json({ error: 'sourcePath and destinationPath are required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId, req.user!.id);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found or access denied' });
      return;
    }

    // Move = rename to new location
    const fileName = path.basename(sourcePath);
    const newFullPath = destinationPath.endsWith('/') 
      ? `${destinationPath}${fileName}` 
      : `${destinationPath}/${fileName}`;

    await fileService.rename(dataPath, sourcePath, newFullPath);
    res.json({ success: true, message: 'Moved successfully' });
  } catch (error: any) {
    logger.error('Error moving:', error);
    res.status(500).json({ error: error.message || 'Failed to move' });
  }
});

// Copy file/folder - POST /api/files/copy
router.post('/copy', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { serverId, sourcePath, destinationPath } = req.body;
    
    if (!serverId) {
      res.status(400).json({ error: 'serverId is required' });
      return;
    }
    
    if (!sourcePath || !destinationPath) {
      res.status(400).json({ error: 'sourcePath and destinationPath are required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId, req.user!.id);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found or access denied' });
      return;
    }

    await fileService.copy(dataPath, sourcePath, destinationPath);
    res.json({ success: true, message: 'Copied successfully' });
  } catch (error: any) {
    logger.error('Error copying:', error);
    res.status(500).json({ error: error.message || 'Failed to copy' });
  }
});

// Upload file - POST /api/files/upload
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.body.serverId;
    const destPath = (req.body.path as string) || '/';
    
    if (!serverId) {
      res.status(400).json({ error: 'serverId is required' });
      return;
    }
    
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const dataPath = await getServerDataPath(serverId, req.user!.id);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found or access denied' });
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

// Download file - GET /api/files/download?serverId=xxx&path=/file.txt
router.get('/download', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverId = req.query.serverId as string;
    const filePath = req.query.path as string;
    
    if (!serverId) {
      res.status(400).json({ error: 'serverId is required' });
      return;
    }
    
    if (!filePath) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId, req.user!.id);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found or access denied' });
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

// Create archive - POST /api/files/archive
router.post('/archive', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { serverId, paths, archiveName, format, destinationPath } = req.body;
    
    if (!serverId) {
      res.status(400).json({ error: 'serverId is required' });
      return;
    }
    
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      res.status(400).json({ error: 'paths array is required' });
      return;
    }

    if (!archiveName) {
      res.status(400).json({ error: 'archiveName is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId, req.user!.id);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found or access denied' });
      return;
    }

    // Create archive and send as download
    const { path: archivePath, filename } = await fileService.createTempArchiveForDownload(
      dataPath, 
      paths,
      archiveName,
      format || 'zip'
    );
    
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'application/zip');
    
    const stream = fs.createReadStream(archivePath);
    stream.pipe(res);
    
    // Clean up temp file after sending
    stream.on('end', () => {
      fs.unlink(archivePath, () => {});
    });
  } catch (error: any) {
    logger.error('Error creating archive:', error);
    res.status(500).json({ error: error.message || 'Failed to create archive' });
  }
});

// Extract archive - POST /api/files/extract
router.post('/extract', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { serverId, archivePath, destinationPath } = req.body;
    
    if (!serverId) {
      res.status(400).json({ error: 'serverId is required' });
      return;
    }
    
    if (!archivePath) {
      res.status(400).json({ error: 'archivePath is required' });
      return;
    }

    const dataPath = await getServerDataPath(serverId, req.user!.id);
    if (!dataPath) {
      res.status(404).json({ error: 'Server not found or access denied' });
      return;
    }

    await fileService.extractArchive(dataPath, archivePath, destinationPath || path.dirname(archivePath));
    res.json({ success: true, message: 'Archive extracted successfully' });
  } catch (error: any) {
    logger.error('Error extracting archive:', error);
    res.status(500).json({ error: error.message || 'Failed to extract archive' });
  }
});

export default router;
