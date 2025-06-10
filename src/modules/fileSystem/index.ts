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

  // Helper method to collect expanded folder states
  private collectExpandedStates(items: FileItem[]): Map<string, boolean> {
    const expandedStates = new Map<string, boolean>();
    
    const collectStates = (fileItems: FileItem[]) => {
      fileItems.forEach(item => {
        if (item.type === 'directory') {
          expandedStates.set(item.path, item.isExpanded || false);
          if (item.children && item.children.length > 0) {
            collectStates(item.children);
          }
        }
      });
    };
    
    collectStates(items);
    return expandedStates;
  }

  // Helper method to restore expanded folder states
  private async restoreExpandedStates(items: FileItem[], expandedStates: Map<string, boolean>): Promise<void> {
    for (const item of items) {
      if (item.type === 'directory') {
        const wasExpanded = expandedStates.get(item.path);
        if (wasExpanded) {
          // Load children for this directory
          try {
            const children = await this.electronAPI.getDirectoryContents(item.path);
            item.children = this.processFileItems(children || []);
            item.isExpanded = true;
            
            // Recursively restore states for children
            if (item.children && item.children.length > 0) {
              await this.restoreExpandedStates(item.children, expandedStates);
            }
          } catch (error) {
            console.warn('Could not restore expanded state for:', item.path, error);
          }
        }
      }
    }
  }

  async refreshFileTree(): Promise<void> {
    try {
      // Collect current expanded states before refreshing
      const expandedStates = this.collectExpandedStates(this.fileTree);
      console.log('🔧 Preserving expanded states for', expandedStates.size, 'folders');
      
      // Clear current tree and reload root
      this.fileTree = [];
      const rootFiles = await this.loadFileSystem();
      
      // Restore expanded states
      await this.restoreExpandedStates(this.fileTree, expandedStates);
      
      // Dispatch event to trigger re-render
      const event = new CustomEvent('file-tree-updated', { detail: this.fileTree });
      document.dispatchEvent(event);
      
      console.log('✅ File tree refreshed with preserved states');
    } catch (error) {
      console.error('❌ Error refreshing file tree:', error);
      
      // Fallback - just reload without state preservation
      this.fileTree = [];
      const files = await this.loadFileSystem();
      const event = new CustomEvent('file-tree-updated', { detail: files });
      document.dispatchEvent(event);
    }
  }

  // New methods for file/folder operations
  async createFile(parentPath: string, fileName: string): Promise<boolean> {
    try {
      if (!this.electronAPI) {
        console.error('ElectronAPI not available');
        return false;
      }

      // Normalize path separators and construct file path
      const normalizedParentPath = parentPath.replace(/\\/g, '/');
      const filePath = normalizedParentPath.endsWith('/') ? 
        normalizedParentPath + fileName : 
        normalizedParentPath + '/' + fileName;

      console.log('🔧 Creating file:', filePath);

      const result = await this.electronAPI.createFile(filePath);
      if (result.success) {
        console.log('✅ File created successfully:', filePath);
        
        // Ensure parent directory is expanded before refreshing
        await this.ensureParentExpanded(normalizedParentPath);
        
        // Refresh the file tree while preserving states
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

      // Normalize path separators and construct folder path
      const normalizedParentPath = parentPath.replace(/\\/g, '/');
      const folderPath = normalizedParentPath.endsWith('/') ? 
        normalizedParentPath + folderName : 
        normalizedParentPath + '/' + folderName;

      console.log('🔧 Creating folder:', folderPath);

      const result = await this.electronAPI.createFolder(folderPath);
      if (result.success) {
        console.log('✅ Folder created successfully:', folderPath);
        
        // Ensure parent directory is expanded before refreshing
        await this.ensureParentExpanded(normalizedParentPath);
        
        // Refresh the file tree while preserving states
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
        console.log('✅ Item deleted successfully:', itemPath);
        
        // Refresh the file tree while preserving states
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
        console.log('✅ Item renamed successfully:', oldPath, '->', newPath);
        
        // Refresh the file tree while preserving states
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

  // Helper method to ensure a parent directory is expanded
  private async ensureParentExpanded(parentPath: string): Promise<void> {
    const findAndExpandParent = (items: FileItem[], targetPath: string): FileItem | null => {
      for (const item of items) {
        if (item.path === targetPath && item.type === 'directory') {
          return item;
        }
        if (item.children && item.children.length > 0) {
          const found = findAndExpandParent(item.children, targetPath);
          if (found) return found;
        }
      }
      return null;
    };

    const parentItem = findAndExpandParent(this.fileTree, parentPath);
    if (parentItem && !parentItem.isExpanded) {
      console.log('🔧 Ensuring parent directory is expanded:', parentPath);
      await this.toggleDirectory(parentItem);
    }
  }

  // Optional: Add loading state management
  private showLoadingState(): void {
    const fileTreeContainer = document.getElementById('file-tree');
    if (fileTreeContainer) {
      fileTreeContainer.style.opacity = '0.7';
      fileTreeContainer.style.pointerEvents = 'none';
    }
  }

  private hideLoadingState(): void {
    const fileTreeContainer = document.getElementById('file-tree');
    if (fileTreeContainer) {
      fileTreeContainer.style.opacity = '1';
      fileTreeContainer.style.pointerEvents = 'auto';
    }
  }

  async copyExternalFile(sourcePath: string, targetDir: string, fileName?: string): Promise<boolean> {
    try {
      if (!this.electronAPI) {
        console.error('ElectronAPI not available');
        return false;
      }

      console.log('🔧 Copying external file:', sourcePath, 'to:', targetDir);

      const result = await this.electronAPI.copyExternalFile(sourcePath, targetDir, fileName);
      if (result.success) {
        console.log('✅ External file copied successfully:', result.targetPath);
        
        // Ensure target directory is expanded before refreshing
        await this.ensureParentExpanded(targetDir);
        
        // Refresh the file tree while preserving states
        await this.refreshFileTree();
        return true;
      } else {
        console.error('Failed to copy external file:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error copying external file:', error);
      return false;
    }
  }

  async saveDroppedFile(targetDir: string, fileName: string, fileData: string, isBase64: boolean = false): Promise<boolean> {
    try {
      if (!this.electronAPI) {
        console.error('ElectronAPI not available');
        return false;
      }

      console.log('🔧 Saving dropped file:', fileName, 'to:', targetDir);

      const result = await this.electronAPI.saveDroppedFile(targetDir, fileName, fileData, isBase64);
      if (result.success) {
        console.log('✅ Dropped file saved successfully:', result.targetPath);
        
        // Ensure target directory is expanded before refreshing
        await this.ensureParentExpanded(targetDir);
        
        // Refresh the file tree while preserving states
        await this.refreshFileTree();
        return true;
      } else {
        console.error('Failed to save dropped file:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error saving dropped file:', error);
      return false;
    }
  }
}
