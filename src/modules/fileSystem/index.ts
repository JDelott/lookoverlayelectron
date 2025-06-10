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
    const processedItems = items.map(item => ({
      ...item,
      isExpanded: false,
      children: []
    }));
    
    // Sort exactly like VS Code: folders first, then files, alphabetical within each
    return processedItems.sort((a, b) => {
      // If types are different, directories come before files
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      
      // If same type, sort alphabetically (case-insensitive)
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }

  private sortFileItems(items: FileItem[]): FileItem[] {
    return items.sort((a, b) => {
      // Special files that should appear at the top
      const specialFiles = [
        'package.json',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'README.md',
        'readme.md',
        'README',
        'readme',
        '.env',
        '.env.local',
        '.env.example',
        '.gitignore',
        '.gitattributes',
        'tsconfig.json',
        'jsconfig.json',
        'next.config.js',
        'next.config.ts',
        'tailwind.config.js',
        'tailwind.config.ts',
        'postcss.config.js',
        'postcss.config.mjs',
        'eslint.config.js',
        'eslint.config.mjs',
        '.eslintrc.js',
        '.eslintrc.json',
        'prettier.config.js',
        '.prettierrc',
        'vite.config.js',
        'vite.config.ts',
        'webpack.config.js',
        'rollup.config.js'
      ];

      const aIsSpecial = specialFiles.includes(a.name.toLowerCase());
      const bIsSpecial = specialFiles.includes(b.name.toLowerCase());
      
      // Special files come first
      if (aIsSpecial && !bIsSpecial) return -1;
      if (!aIsSpecial && bIsSpecial) return 1;
      
      // If both are special, sort by the order in specialFiles array
      if (aIsSpecial && bIsSpecial) {
        const aIndex = specialFiles.indexOf(a.name.toLowerCase());
        const bIndex = specialFiles.indexOf(b.name.toLowerCase());
        return aIndex - bIndex;
      }

      // Directories come before files
      if (a.type === 'directory' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'directory') return 1;

      // Hidden files/folders (starting with .) come after visible ones within their category
      const aIsHidden = a.name.startsWith('.');
      const bIsHidden = b.name.startsWith('.');
      
      if (!aIsHidden && bIsHidden) return -1;
      if (aIsHidden && !bIsHidden) return 1;

      // Sort alphabetically (case-insensitive)
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
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
        const processedChildren = this.processFileItems(children || []);
        item.children = processedChildren;
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
