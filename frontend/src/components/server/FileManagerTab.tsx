import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FolderIcon,
  DocumentIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ArchiveBoxIcon,
  FolderPlusIcon,
  TrashIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  HomeIcon,
  XMarkIcon,
  CheckIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  Cog6ToothIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';
import { AxiosProgressEvent } from 'axios';

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  extension?: string;
}

interface Server {
  id: string;
  name: string;
  gameType: string;
  status: string;
  dataPath: string;
}

interface FileManagerTabProps {
  server: Server;
}

// Helper function to format file size
const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

// Get file icon based on extension
const getFileIcon = (item: FileItem) => {
  if (item.type === 'directory') {
    return <FolderIcon className="w-5 h-5 text-yellow-500" />;
  }
  
  const ext = item.extension?.toLowerCase();
  const iconClass = "w-5 h-5";
  
  // Add color based on file type
  switch (ext) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return <DocumentIcon className={`${iconClass} text-yellow-400`} />;
    case 'json':
      return <DocumentIcon className={`${iconClass} text-green-400`} />;
    case 'yml':
    case 'yaml':
      return <DocumentIcon className={`${iconClass} text-red-400`} />;
    case 'properties':
    case 'cfg':
    case 'conf':
    case 'ini':
      return <Cog6ToothIcon className={`${iconClass} text-gray-400`} />;
    case 'jar':
      return <ArchiveBoxIcon className={`${iconClass} text-orange-500`} />;
    case 'zip':
    case 'tar':
    case 'gz':
    case 'rar':
    case '7z':
      return <ArchiveBoxIcon className={`${iconClass} text-purple-500`} />;
    case 'log':
    case 'txt':
      return <DocumentIcon className={`${iconClass} text-gray-400`} />;
    case 'sh':
    case 'bat':
    case 'cmd':
      return <DocumentIcon className={`${iconClass} text-green-500`} />;
    default:
      return <DocumentIcon className={`${iconClass} text-blue-400`} />;
  }
};

export function FileManagerTab({ server }: FileManagerTabProps) {
  const serverId = server.id;
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [moveDestination, setMoveDestination] = useState('');
  const [archiveName, setArchiveName] = useState('');
  const [archiveFormat, setArchiveFormat] = useState<'zip' | 'tar' | 'tar.gz'>('zip');
  const [editorContent, setEditorContent] = useState('');
  const [editorFile, setEditorFile] = useState<FileItem | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Fetch files from server
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/files/list?serverId=${serverId}&path=${encodeURIComponent(currentPath)}`);
      setFiles(response.data.files || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors du chargement des fichiers');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [serverId, currentPath]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Navigate to path
  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSelectedFiles(new Set());
  };

  // Navigate into folder
  const openFolder = (item: FileItem) => {
    if (item.type === 'directory') {
      const newPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
      navigateTo(newPath);
    }
  };

  // Navigate up one level
  const goUp = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    navigateTo(parts.length === 0 ? '/' : '/' + parts.join('/'));
  };

  // Get breadcrumb parts
  const getBreadcrumbs = () => {
    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Racine', path: '/' }];
    let currentBreadcrumbPath = '';
    
    for (const part of parts) {
      currentBreadcrumbPath += '/' + part;
      breadcrumbs.push({ name: part, path: currentBreadcrumbPath });
    }
    
    return breadcrumbs;
  };

  // Toggle file selection
  const toggleSelection = (fileName: string, event: React.MouseEvent) => {
    const newSelection = new Set(selectedFiles);
    
    if (event.ctrlKey || event.metaKey) {
      if (newSelection.has(fileName)) {
        newSelection.delete(fileName);
      } else {
        newSelection.add(fileName);
      }
    } else if (event.shiftKey && selectedFiles.size > 0) {
      const fileNames = files.map(f => f.name);
      const lastSelected = Array.from(selectedFiles).pop()!;
      const lastIndex = fileNames.indexOf(lastSelected);
      const currentIndex = fileNames.indexOf(fileName);
      const [start, end] = lastIndex < currentIndex ? [lastIndex, currentIndex] : [currentIndex, lastIndex];
      
      for (let i = start; i <= end; i++) {
        newSelection.add(fileNames[i]);
      }
    } else {
      newSelection.clear();
      newSelection.add(fileName);
    }
    
    setSelectedFiles(newSelection);
  };

  // Handle double click
  const handleDoubleClick = (item: FileItem) => {
    if (item.type === 'directory') {
      openFolder(item);
    } else {
      // Open file in editor if it's text-editable
      const editableExtensions = ['txt', 'json', 'yml', 'yaml', 'properties', 'cfg', 'conf', 'ini', 'sh', 'bat', 'cmd', 'log', 'xml', 'html', 'css', 'js', 'ts', 'md', 'toml'];
      if (item.extension && editableExtensions.includes(item.extension.toLowerCase())) {
        openEditor(item);
      } else {
        // Download file
        downloadFile(item);
      }
    }
  };

  // File upload handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    const filesToUpload: File[] = [];
    const foldersToUpload: { path: string; file: File }[] = [];

    // Process dropped items
    const processEntry = async (entry: FileSystemEntry, path: string = ''): Promise<void> => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        return new Promise((resolve) => {
          fileEntry.file((file) => {
            if (path) {
              foldersToUpload.push({ path: path, file });
            } else {
              filesToUpload.push(file);
            }
            resolve();
          });
        });
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const dirReader = dirEntry.createReader();
        
        return new Promise((resolve) => {
          dirReader.readEntries(async (entries) => {
            const newPath = path ? `${path}/${entry.name}` : entry.name;
            await Promise.all(entries.map((e) => processEntry(e, newPath)));
            resolve();
          });
        });
      }
    };

    // Process all items
    const promises: Promise<void>[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry) {
        promises.push(processEntry(entry));
      }
    }

    await Promise.all(promises);

    // Upload files
    if (filesToUpload.length > 0) {
      await uploadFiles(filesToUpload);
    }

    // Upload folder contents
    if (foldersToUpload.length > 0) {
      await uploadFolderContents(foldersToUpload);
    }
  };

  const uploadFiles = async (filesToUpload: File[]) => {
    setUploading(true);
    const progress: { [key: string]: number } = {};
    
    try {
      for (const file of filesToUpload) {
        progress[file.name] = 0;
        setUploadProgress({ ...progress });
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('serverId', serverId);
        formData.append('path', currentPath);

        await api.post('/files/upload', formData, {
          timeout: 600000, // 10 minutes timeout for large files
          onUploadProgress: (progressEvent: AxiosProgressEvent) => {
            if (progressEvent.total) {
              progress[file.name] = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress({ ...progress });
            }
          },
        });

        progress[file.name] = 100;
        setUploadProgress({ ...progress });
      }

      toast.success(`${filesToUpload.length} fichier(s) uploadé(s) avec succès`);
      fetchFiles();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  };

  const uploadFolderContents = async (items: { path: string; file: File }[]) => {
    setUploading(true);
    const progress: { [key: string]: number } = {};
    
    try {
      // Create necessary folders first
      const folders = new Set<string>();
      items.forEach(item => {
        const parts = item.path.split('/');
        let folderPath = '';
        for (let i = 0; i < parts.length; i++) {
          folderPath = folderPath ? `${folderPath}/${parts[i]}` : parts[i];
          folders.add(folderPath);
        }
      });

      // Create folders
      for (const folder of Array.from(folders).sort()) {
        const folderFullPath = currentPath === '/' ? `/${folder}` : `${currentPath}/${folder}`;
        try {
          await api.post('/files/folder', {
            serverId,
            path: folderFullPath,
          });
        } catch {
          // Folder might already exist
        }
      }

      // Upload files
      for (const item of items) {
        const fileName = item.file.name;
        progress[`${item.path}/${fileName}`] = 0;
        setUploadProgress({ ...progress });
        
        const uploadPath = currentPath === '/' ? `/${item.path}` : `${currentPath}/${item.path}`;
        
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('serverId', serverId);
        formData.append('path', uploadPath);

        await api.post('/files/upload', formData, {
          timeout: 600000, // 10 minutes timeout for large files
          onUploadProgress: (progressEvent: AxiosProgressEvent) => {
            if (progressEvent.total) {
              progress[`${item.path}/${fileName}`] = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress({ ...progress });
            }
          },
        });
      }

      toast.success(`Dossier uploadé avec succès (${items.length} fichiers)`);
      fetchFiles();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'upload du dossier');
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFiles(Array.from(files));
    }
    e.target.value = '';
  };

  // Download file
  const downloadFile = async (item: FileItem) => {
    try {
      const filePath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
      const response = await api.get(`/files/download?serverId=${serverId}&path=${encodeURIComponent(filePath)}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', item.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors du téléchargement');
    }
  };

  // Download selected files
  const downloadSelected = async () => {
    const selectedItems = files.filter(f => selectedFiles.has(f.name));
    
    if (selectedItems.length === 1 && selectedItems[0].type === 'file') {
      downloadFile(selectedItems[0]);
    } else {
      // Create archive and download
      setArchiveName('download');
      setShowArchiveModal(true);
    }
  };

  // Create new folder
  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      const folderPath = currentPath === '/' ? `/${newFolderName}` : `${currentPath}/${newFolderName}`;
      await api.post('/files/folder', {
        serverId,
        path: folderPath,
      });
      
      toast.success('Dossier créé avec succès');
      setShowNewFolderModal(false);
      setNewFolderName('');
      fetchFiles();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la création du dossier');
    }
  };

  // Rename file/folder
  const renameFile = async () => {
    if (!renameValue.trim() || !renameTarget) return;
    
    try {
      const oldPath = currentPath === '/' ? `/${renameTarget.name}` : `${currentPath}/${renameTarget.name}`;
      await api.post('/files/rename', {
        serverId,
        oldPath,
        newName: renameValue,
      });
      
      toast.success('Renommé avec succès');
      setShowRenameModal(false);
      setRenameValue('');
      setRenameTarget(null);
      fetchFiles();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors du renommage');
    }
  };

  // Delete files
  const deleteSelected = async () => {
    if (selectedFiles.size === 0) return;
    
    const confirmMessage = selectedFiles.size === 1 
      ? `Supprimer "${Array.from(selectedFiles)[0]}" ?`
      : `Supprimer ${selectedFiles.size} éléments ?`;
    
    if (!confirm(confirmMessage)) return;

    try {
      for (const fileName of selectedFiles) {
        const filePath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;
        await api.delete(`/files/delete?serverId=${serverId}&path=${encodeURIComponent(filePath)}`);
      }
      
      toast.success(`${selectedFiles.size} élément(s) supprimé(s)`);
      setSelectedFiles(new Set());
      fetchFiles();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  // Move files
  const moveSelected = async () => {
    if (!moveDestination.trim() || selectedFiles.size === 0) return;
    
    try {
      for (const fileName of selectedFiles) {
        const sourcePath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;
        await api.post('/files/move', {
          serverId,
          sourcePath,
          destinationPath: moveDestination,
        });
      }
      
      toast.success(`${selectedFiles.size} élément(s) déplacé(s)`);
      setShowMoveModal(false);
      setMoveDestination('');
      setSelectedFiles(new Set());
      fetchFiles();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors du déplacement');
    }
  };

  // Copy files
  const copySelected = async () => {
    if (selectedFiles.size === 0) return;
    
    try {
      for (const fileName of selectedFiles) {
        const sourcePath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;
        const destPath = currentPath === '/' ? `/${fileName}_copy` : `${currentPath}/${fileName}_copy`;
        await api.post('/files/copy', {
          serverId,
          sourcePath,
          destinationPath: destPath,
        });
      }
      
      toast.success(`${selectedFiles.size} élément(s) copié(s)`);
      setSelectedFiles(new Set());
      fetchFiles();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la copie');
    }
  };

  // Create archive
  const createArchive = async () => {
    if (!archiveName.trim() || selectedFiles.size === 0) return;
    
    try {
      const paths = Array.from(selectedFiles).map(fileName => 
        currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`
      );
      
      const response = await api.post('/files/archive', {
        serverId,
        paths,
        archiveName: archiveName + '.' + archiveFormat,
        format: archiveFormat,
        destinationPath: currentPath,
      }, {
        responseType: 'blob',
      });

      // Download the archive
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', archiveName + '.' + archiveFormat);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Archive créée et téléchargée');
      setShowArchiveModal(false);
      setArchiveName('');
      fetchFiles();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la création de l\'archive');
    }
  };

  // Extract archive
  const extractArchive = async (item: FileItem) => {
    try {
      const archivePath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
      await api.post('/files/extract', {
        serverId,
        archivePath,
        destinationPath: currentPath,
      });
      
      toast.success('Archive extraite avec succès');
      fetchFiles();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'extraction');
    }
  };

  // Open file editor
  const openEditor = async (item: FileItem) => {
    setEditorFile(item);
    setEditorLoading(true);
    setShowEditorModal(true);
    
    try {
      const filePath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
      const response = await api.get(`/files/read?serverId=${serverId}&path=${encodeURIComponent(filePath)}`);
      setEditorContent(response.data.content || '');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la lecture du fichier');
      setShowEditorModal(false);
    } finally {
      setEditorLoading(false);
    }
  };

  // Save file from editor
  const saveEditorContent = async () => {
    if (!editorFile) return;
    
    try {
      const filePath = currentPath === '/' ? `/${editorFile.name}` : `${currentPath}/${editorFile.name}`;
      await api.post('/files/write', {
        serverId,
        path: filePath,
        content: editorContent,
      });
      
      toast.success('Fichier sauvegardé');
      setShowEditorModal(false);
      setEditorFile(null);
      setEditorContent('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    }
  };

  // Filter files by search
  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort files (folders first, then alphabetically)
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  // Check if selected file is an archive
  const selectedIsArchive = () => {
    if (selectedFiles.size !== 1) return false;
    const selectedName = Array.from(selectedFiles)[0];
    const item = files.find(f => f.name === selectedName);
    if (!item || item.type !== 'file') return false;
    return ['zip', 'tar', 'gz'].includes(item.extension?.toLowerCase() || '');
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 bg-gray-800 border-b border-gray-700">
        {/* Navigation */}
        <button
          onClick={goUp}
          disabled={currentPath === '/'}
          className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Remonter"
        >
          <ArrowRightIcon className="w-5 h-5 rotate-180" />
        </button>
        
        <button
          onClick={() => navigateTo('/')}
          className="p-2 rounded hover:bg-gray-700"
          title="Racine"
        >
          <HomeIcon className="w-5 h-5" />
        </button>
        
        <button
          onClick={fetchFiles}
          className="p-2 rounded hover:bg-gray-700"
          title="Actualiser"
        >
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <div className="h-6 w-px bg-gray-600 mx-2" />

        {/* Actions */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-sm"
        >
          <ArrowUpTrayIcon className="w-4 h-4" />
          <span>Upload</span>
        </button>
        
        <button
          onClick={() => folderInputRef.current?.click()}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-sm"
        >
          <FolderIcon className="w-4 h-4" />
          <span>Upload Dossier</span>
        </button>
        
        <button
          onClick={() => setShowNewFolderModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-sm"
        >
          <FolderPlusIcon className="w-4 h-4" />
          <span>Nouveau dossier</span>
        </button>

        <div className="h-6 w-px bg-gray-600 mx-2" />

        {/* Selection actions */}
        <button
          onClick={downloadSelected}
          disabled={selectedFiles.size === 0}
          className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Télécharger"
        >
          <ArrowDownTrayIcon className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => {
            if (selectedFiles.size === 1) {
              const item = files.find(f => f.name === Array.from(selectedFiles)[0]);
              if (item) {
                setRenameTarget(item);
                setRenameValue(item.name);
                setShowRenameModal(true);
              }
            }
          }}
          disabled={selectedFiles.size !== 1}
          className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Renommer"
        >
          <PencilIcon className="w-5 h-5" />
        </button>
        
        <button
          onClick={copySelected}
          disabled={selectedFiles.size === 0}
          className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Dupliquer"
        >
          <DocumentDuplicateIcon className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => setShowMoveModal(true)}
          disabled={selectedFiles.size === 0}
          className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Déplacer"
        >
          <ArrowRightIcon className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => {
            setArchiveName('archive');
            setShowArchiveModal(true);
          }}
          disabled={selectedFiles.size === 0}
          className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Archiver"
        >
          <ArchiveBoxIcon className="w-5 h-5" />
        </button>
        
        {selectedIsArchive() && (
          <button
            onClick={() => {
              const selectedName = Array.from(selectedFiles)[0];
              const item = files.find(f => f.name === selectedName);
              if (item) extractArchive(item);
            }}
            className="p-2 rounded hover:bg-gray-700"
            title="Extraire l'archive"
          >
            <ArchiveBoxIcon className="w-5 h-5 text-purple-400" />
          </button>
        )}
        
        <button
          onClick={deleteSelected}
          disabled={selectedFiles.size === 0}
          className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-red-400"
          title="Supprimer"
        >
          <TrashIcon className="w-5 h-5" />
        </button>

        {/* Search */}
        <div className="flex-1" />
        <div className="relative">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            className="bg-gray-700 border border-gray-600 rounded pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 px-4 py-2 bg-gray-800/50 text-sm">
        {getBreadcrumbs().map((crumb, index, arr) => (
          <span key={crumb.path} className="flex items-center">
            <button
              onClick={() => navigateTo(crumb.path)}
              className="hover:text-blue-400 hover:underline"
            >
              {crumb.name}
            </button>
            {index < arr.length - 1 && (
              <ChevronRightIcon className="w-4 h-4 mx-1 text-gray-500" />
            )}
          </span>
        ))}
      </div>

      {/* File list / Drop zone */}
      <div
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex-1 overflow-auto relative ${isDragging ? 'bg-blue-900/20' : ''}`}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-900/50 border-2 border-dashed border-blue-400 z-10">
            <div className="text-center">
              <CloudArrowUpIcon className="w-16 h-16 mx-auto text-blue-400" />
              <p className="mt-2 text-lg text-blue-300">Déposez vos fichiers ici</p>
            </div>
          </div>
        )}

        {/* Upload progress */}
        {uploading && Object.keys(uploadProgress).length > 0 && (
          <div className="p-4 bg-gray-800 border-b border-gray-700">
            <p className="text-sm text-gray-400 mb-2">Upload en cours...</p>
            {Object.entries(uploadProgress).map(([name, progress]) => (
              <div key={name} className="mb-2">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span className="truncate max-w-xs">{name}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-500" />
          </div>
        ) : sortedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FolderIcon className="w-16 h-16 mb-4" />
            <p>Dossier vide</p>
            <p className="text-sm mt-2">Glissez-déposez des fichiers ou utilisez le bouton Upload</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-800 sticky top-0">
              <tr className="text-left text-gray-400 text-sm">
                <th className="px-4 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={selectedFiles.size === sortedFiles.length && sortedFiles.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFiles(new Set(sortedFiles.map(f => f.name)));
                      } else {
                        setSelectedFiles(new Set());
                      }
                    }}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                </th>
                <th className="px-4 py-2">Nom</th>
                <th className="px-4 py-2 w-32">Taille</th>
                <th className="px-4 py-2 w-48">Modifié</th>
                <th className="px-4 py-2 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.map((item) => (
                <tr
                  key={item.name}
                  className={`border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer ${
                    selectedFiles.has(item.name) ? 'bg-blue-900/30' : ''
                  }`}
                  onClick={(e) => toggleSelection(item.name, e)}
                  onDoubleClick={() => handleDoubleClick(item)}
                >
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(item.name)}
                      onChange={() => {}}
                      className="rounded bg-gray-700 border-gray-600"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {getFileIcon(item)}
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-sm">
                    {item.type === 'file' ? formatSize(item.size) : '-'}
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-sm">
                    {formatDate(item.modified)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      {item.type === 'file' && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const editableExtensions = ['txt', 'json', 'yml', 'yaml', 'properties', 'cfg', 'conf', 'ini', 'sh', 'bat', 'cmd', 'log', 'xml', 'html', 'css', 'js', 'ts', 'md', 'toml'];
                              if (item.extension && editableExtensions.includes(item.extension.toLowerCase())) {
                                openEditor(item);
                              }
                            }}
                            className="p-1 rounded hover:bg-gray-700"
                            title="Voir/Éditer"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadFile(item);
                            }}
                            className="p-1 rounded hover:bg-gray-700"
                            title="Télécharger"
                          >
                            <ArrowDownTrayIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Selection info */}
      {selectedFiles.size > 0 && (
        <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-sm text-gray-400">
          {selectedFiles.size} élément(s) sélectionné(s)
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore - webkitdirectory is not in the type definitions
        webkitdirectory=""
        multiple
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            // Process folder upload
            const items: { path: string; file: File }[] = [];
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const relativePath = file.webkitRelativePath;
              const pathParts = relativePath.split('/');
              pathParts.pop(); // Remove filename
              const folderPath = pathParts.join('/');
              items.push({ path: folderPath, file });
            }
            uploadFolderContents(items);
          }
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* New folder modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Nouveau dossier</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nom du dossier"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && createFolder()}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                }}
                className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={createFolder}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {showRenameModal && renameTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Renommer</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Nouveau nom"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && renameFile()}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setRenameValue('');
                  setRenameTarget(null);
                }}
                className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={renameFile}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
              >
                Renommer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Déplacer vers</h3>
            <input
              type="text"
              value={moveDestination}
              onChange={(e) => setMoveDestination(e.target.value)}
              placeholder="Chemin de destination (ex: /plugins)"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && moveSelected()}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setMoveDestination('');
                }}
                className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={moveSelected}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
              >
                Déplacer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Créer une archive</h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Nom de l'archive</label>
              <input
                type="text"
                value={archiveName}
                onChange={(e) => setArchiveName(e.target.value)}
                placeholder="Nom de l'archive"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Format</label>
              <select
                value={archiveFormat}
                onChange={(e) => setArchiveFormat(e.target.value as 'zip' | 'tar' | 'tar.gz')}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="zip">ZIP</option>
                <option value="tar">TAR</option>
                <option value="tar.gz">TAR.GZ</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowArchiveModal(false);
                  setArchiveName('');
                }}
                className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={createArchive}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor modal */}
      {showEditorModal && editorFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg w-[90vw] h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <div className="flex items-center gap-2">
                {getFileIcon(editorFile)}
                <span className="font-semibold">{editorFile.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveEditorContent}
                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-sm"
                >
                  <CheckIcon className="w-4 h-4" />
                  Sauvegarder
                </button>
                <button
                  onClick={() => {
                    setShowEditorModal(false);
                    setEditorFile(null);
                    setEditorContent('');
                  }}
                  className="p-1.5 rounded hover:bg-gray-700"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {editorLoading ? (
                <div className="flex items-center justify-center h-full">
                  <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-500" />
                </div>
              ) : (
                <textarea
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  className="w-full h-full bg-gray-900 text-gray-100 font-mono text-sm p-4 resize-none focus:outline-none"
                  spellCheck={false}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileManagerTab;
