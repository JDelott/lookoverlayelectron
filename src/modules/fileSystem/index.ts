import { FileItem } from '../types';

export class FileSystemManager {
  private electronAPI: any;
  private fileTree: FileItem[] = []; // Store the file tree state

  constructor() {
    this.electronAPI = (window as any).electronAPI;
  }

  async loadFileSystem(): Promise<FileItem[]> {
    try {
      if (!this.electronAPI) {
        console.error('ElectronAPI not available');
        return [];
      }
      
      // Only load root if we don't have a file tree yet
      if (this.fileTree.length === 0) {
        const result = await this.electronAPI.getDirectoryContents();
        this.fileTree = this.processFileItems(result || []);
      }
      
      return this.fileTree;
    } catch (error) {
      console.error('Failed to load file system:', error);
      return [];
    }
  }

  private processFileItems(items: any[]): FileItem[] {
    return items.map(item => ({
      ...item,
      isExpanded: false,
      children: []
    }));
  }

  async readFile(filePath: string): Promise<string> {
    try {
      if (!this.electronAPI) {
        console.error('ElectronAPI not available');
        return '';
      }
      
      const content = await this.electronAPI.readFile(filePath);
      return content || '';
    } catch (error) {
      console.error('Failed to read file:', error);
      return '';
    }
  }

  async writeFile(filePath: string, content: string): Promise<boolean> {
    try {
      if (!this.electronAPI) {
        console.error('ElectronAPI not available');
        return false;
      }
      
      await this.electronAPI.writeFile(filePath, content);
      return true;
    } catch (error) {
      console.error('Failed to write file:', error);
      return false;
    }
  }

  getFileIcon(extension: string): string {
    const iconMap: { [key: string]: string } = {
      'js': '📄',
      'ts': '🔷',
      'tsx': '🔷',
      'jsx': '📄',
      'html': '🌐',
      'css': '🎨',
      'json': '📋',
      'md': '📝',
      'py': '🐍',
      'java': '☕',
      'cpp': '⚙️',
      'c': '⚙️',
      'h': '📁',
      'php': '🐘',
      'rb': '💎',
      'go': '🐹',
      'rs': '🦀',
      'swift': '🧡',
      'kt': '🟣',
      'dart': '🎯'
    };
    
    return iconMap[extension] || '📄';
  }

  getLanguageFromExtension(extension: string): string {
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'json': 'json',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'dart': 'dart',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml',
      'ini': 'ini',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'fish': 'shell'
    };
    
    return languageMap[extension] || 'plaintext';
  }

  async toggleDirectory(item: FileItem): Promise<void> {
    if (item.type !== 'directory') return;

    try {
      if (!this.electronAPI) {
        console.error('ElectronAPI not available');
        return;
      }

      console.log('🔧 Toggling directory:', item.name, 'currently expanded:', item.isExpanded);

      if (item.isExpanded) {
        // Collapse: just hide children
        item.isExpanded = false;
        item.children = [];
        console.log('📁 Collapsed directory:', item.name);
      } else {
        // Expand: load children
        console.log('🔧 Loading children for:', item.path);
        const children = await this.electronAPI.getDirectoryContents(item.path);
        item.children = this.processFileItems(children || []);
        item.isExpanded = true;
        console.log('📁 Expanded directory:', item.name, 'with', item.children.length, 'children');
      }
    } catch (error) {
      console.error('Failed to toggle directory:', error);
    }
  }

  // Helper method to find an item in the tree by path
  private findItemByPath(items: FileItem[], path: string): FileItem | null {
    for (const item of items) {
      if (item.path === path) {
        return item;
      }
      if (item.children && item.children.length > 0) {
        const found = this.findItemByPath(item.children, path);
        if (found) return found;
      }
    }
    return null;
  }

  // Get the current file tree state
  getFileTree(): FileItem[] {
    return this.fileTree;
  }

  async refreshFileTree(): Promise<void> {
    // Clear current tree and reload
    this.fileTree = [];
    const files = await this.loadFileSystem();
    
    // Dispatch event to trigger re-render
    const event = new CustomEvent('file-tree-updated', { detail: files });
    document.dispatchEvent(event);
  }

  // New methods for file/folder operations
  async createFile(parentPath: string, fileName: string): Promise<boolean> {
    try {
      if (!this.electronAPI) {
        console.error('ElectronAPI not available');
        return false;
      }

      const filePath = parentPath.endsWith('/') ? 
        parentPath + fileName : 
        parentPath + '/' + fileName;

      const result = await this.electronAPI.createFile(filePath);
      if (result.success) {
        // Refresh the file tree
        await this.refreshFileTree();
        return true;
      } else {
        console.error('Failed to create file:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error creating file:', error);
      return false;
    }
  }

  async createFolder(parentPath: string, folderName: string): Promise<boolean> {
    try {
      if (!this.electronAPI) {
        console.error('ElectronAPI not available');
        return false;
      }

      const folderPath = parentPath.endsWith('/') ? 
        parentPath + folderName : 
        parentPath + '/' + folderName;

      const result = await this.electronAPI.createFolder(folderPath);
      if (result.success) {
        // Refresh the file tree
        await this.refreshFileTree();
        return true;
      } else {
        console.error('Failed to create folder:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      return false;
    }
  }

  async deleteItem(itemPath: string): Promise<boolean> {
    try {
      if (!this.electronAPI) {
        console.error('ElectronAPI not available');
        return false;
      }

      const result = await this.electronAPI.deleteFile(itemPath);
      if (result.success) {
        // Refresh the file tree
        await this.refreshFileTree();
        return true;
      } else {
        console.error('Failed to delete item:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      return false;
    }
  }

  async renameItem(oldPath: string, newName: string): Promise<boolean> {
    try {
      if (!this.electronAPI) {
        console.error('ElectronAPI not available');
        return false;
      }

      const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
      const newPath = parentPath + '/' + newName;

      const result = await this.electronAPI.renameFile(oldPath, newPath);
      if (result.success) {
        // Refresh the file tree
        await this.refreshFileTree();
        return true;
      } else {
        console.error('Failed to rename item:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error renaming item:', error);
      return false;
    }
  }
}
