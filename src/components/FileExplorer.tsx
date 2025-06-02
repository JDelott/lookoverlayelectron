import React, { useState, useEffect } from 'react';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileItem[];
  isExpanded?: boolean;
}

interface FileExplorerProps {
  onFileSelect: (filePath: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onFileSelect }) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [rootPath, setRootPath] = useState<string>('');

  useEffect(() => {
    loadFileSystem();
  }, []);

  const loadFileSystem = async () => {
    try {
      // Use Electron's IPC to get file system data
      const result = await (window as any).electronAPI?.getDirectoryContents();
      if (result) {
        setFiles(result.files);
        setRootPath(result.rootPath);
      }
    } catch (error) {
      console.error('Failed to load file system:', error);
    }
  };

  const toggleDirectory = async (item: FileItem, path: FileItem[]) => {
    if (item.type !== 'directory') return;

    const updateFiles = (items: FileItem[]): FileItem[] => {
      return items.map(fileItem => {
        if (fileItem.path === item.path) {
          return {
            ...fileItem,
            isExpanded: !fileItem.isExpanded,
            children: fileItem.isExpanded ? fileItem.children : undefined
          };
        }
        if (fileItem.children) {
          return {
            ...fileItem,
            children: updateFiles(fileItem.children)
          };
        }
        return fileItem;
      });
    };

    // If expanding and no children loaded, load them
    if (!item.isExpanded && !item.children) {
      try {
        const result = await (window as any).electronAPI?.getDirectoryContents(item.path);
        if (result) {
          const updateFilesWithChildren = (items: FileItem[]): FileItem[] => {
            return items.map(fileItem => {
              if (fileItem.path === item.path) {
                return {
                  ...fileItem,
                  isExpanded: true,
                  children: result.files
                };
              }
              if (fileItem.children) {
                return {
                  ...fileItem,
                  children: updateFilesWithChildren(fileItem.children)
                };
              }
              return fileItem;
            });
          };
          setFiles(updateFilesWithChildren(files));
        }
      } catch (error) {
        console.error('Failed to load directory contents:', error);
      }
    } else {
      setFiles(updateFiles(files));
    }
  };

  const renderFileItem = (item: FileItem, depth: number = 0) => {
    const isDirectory = item.type === 'directory';
    const isExpanded = item.isExpanded || false;
    
    return (
      <div key={item.path}>
        <div
          className={`file-item ${isDirectory ? 'directory' : 'file'}`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => {
            if (isDirectory) {
              toggleDirectory(item, []);
            } else {
              onFileSelect(item.path);
            }
          }}
        >
          <span className="file-icon">
            {isDirectory ? (
              isExpanded ? '📂' : '📁'
            ) : (
              getFileIcon(item.name)
            )}
          </span>
          <span className="file-name">{item.name}</span>
        </div>
        {isDirectory && isExpanded && item.children && (
          <div className="file-children">
            {item.children.map(child => renderFileItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const getFileIcon = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js':
      case 'jsx':
        return '📄';
      case 'ts':
      case 'tsx':
        return '🔷';
      case 'css':
        return '🎨';
      case 'html':
        return '🌐';
      case 'json':
        return '📋';
      case 'md':
        return '📝';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return '🖼️';
      default:
        return '📄';
    }
  };

  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <span className="explorer-title">EXPLORER</span>
      </div>
      <div className="file-tree">
        {files.map(file => renderFileItem(file))}
      </div>
    </div>
  );
};

export default FileExplorer;
