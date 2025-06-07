import { FileItem } from '../types';

export class FileSystemManager {
  private ipcRenderer: any;

  constructor() {
    this.ipcRenderer = (window as any).electronAPI || (window as any).require?.('electron').ipcRenderer;
  }

  async loadFileSystem(): Promise<FileItem[]> {
    try {
      const result = await this.ipcRenderer.invoke('get-file-tree');
      return result;
    } catch (error) {
      console.error('Failed to load file system:', error);
      return [];
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      const content = await this.ipcRenderer.invoke('read-file', filePath);
      return content;
    } catch (error) {
      console.error('Failed to read file:', error);
      return '';
    }
  }

  async writeFile(filePath: string, content: string): Promise<boolean> {
    try {
      await this.ipcRenderer.invoke('write-file', filePath, content);
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
      if (item.isExpanded) {
        item.isExpanded = false;
        item.children = [];
      } else {
        const children = await this.ipcRenderer.invoke('get-directory-contents', item.path);
        item.children = children;
        item.isExpanded = true;
      }
    } catch (error) {
      console.error('Failed to toggle directory:', error);
    }
  }
}
