import { AppState } from './modules/types';
import { FileSystemManager } from './modules/fileSystem';
import { TabManager } from './modules/tabs';
import { MonacoEditorManager } from './modules/editor';
import { TerminalManager } from './modules/terminal';
import { LayoutManager } from './modules/layout';

class RendererApp {
  private state: AppState;
  private fileSystem: FileSystemManager;
  private tabManager: TabManager;
  private editorManager: MonacoEditorManager;
  private terminalManager: TerminalManager;
  private layoutManager: LayoutManager;

  constructor() {
    this.state = {
      currentFile: '',
      currentWorkingDirectory: '/Users/jacobdelott/Downloads/lookoverlayelectron-main',
      showProjectSelector: true,
      openTabs: new Map(),
      activeTabPath: '',
      terminals: new Map(),
      activeTerminalId: '',
      terminalCounter: 1,
      terminalVisible: false,
      terminalHeight: 200,
      monacoEditor: null
    };

    this.fileSystem = new FileSystemManager();
    this.tabManager = new TabManager(this.state, this.fileSystem);
    this.editorManager = new MonacoEditorManager(this.state, this.tabManager);
    this.terminalManager = new TerminalManager(this.state);
    this.layoutManager = new LayoutManager(this.state);
  }

  async initialize(): Promise<void> {
    try {
      // Load and inject Tailwind CSS
      await this.loadTailwindCSS();
      
      // Create the main layout
      this.layoutManager.createLayout();
      
      // Initialize all modules
      await this.editorManager.initialize();
      this.terminalManager.initialize();
      
      // Load initial file system
      await this.loadFileSystem();
      
      // Setup global event listeners
      this.setupGlobalEventListeners();
      
      // Setup global functions for HTML onclick handlers
      this.setupGlobalFunctions();
      
      console.log('Renderer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize renderer:', error);
    }
  }

  private async loadTailwindCSS(): Promise<void> {
    return new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './dist/styles.css';
      link.onload = () => resolve();
      document.head.appendChild(link);
    });
  }

  private async loadFileSystem(): Promise<void> {
    const files = await this.fileSystem.loadFileSystem();
    this.renderFileTree(files);
  }

  private renderFileTree(files: any[]): void {
    const fileTreeContainer = document.getElementById('file-tree');
    if (!fileTreeContainer) return;

    fileTreeContainer.innerHTML = '';
    
    files.forEach(file => {
      const fileElement = this.createFileElement(file, 0);
      fileTreeContainer.appendChild(fileElement);
    });
  }

  private createFileElement(item: any, depth: number): HTMLElement {
    const element = document.createElement('div');
    
    const isDirectory = item.type === 'directory';
    const icon = isDirectory ? '📁' : this.fileSystem.getFileIcon(item.name.split('.').pop() || '');
    
    element.className = `file-item`;
    element.style.paddingLeft = `${depth * 16 + 8}px`;
    
    element.innerHTML = `
      ${isDirectory ? '<span class="expansion-arrow">▶</span>' : '<span class="mr-2"></span>'}
      <span class="mr-2">${icon}</span>
      <span class="file-name">${item.name}</span>
    `;

    if (isDirectory) {
      element.onclick = async () => {
        await this.fileSystem.toggleDirectory(item);
        this.renderFileTree(await this.fileSystem.loadFileSystem());
      };
    } else {
      element.onclick = () => {
        this.tabManager.openFile(item.path);
      };
    }

    return element;
  }

  private setupGlobalEventListeners(): void {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + ` to toggle terminal
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        this.terminalManager.toggleTerminal();
      }
      
      // Ctrl/Cmd + Shift + P for AI chat
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        this.layoutManager.toggleAIChat();
      }
    });

    // Terminal input handling
    document.addEventListener('keydown', (e) => {
      if (e.target && (e.target as HTMLElement).closest('.terminal-output')) {
        if (e.key === 'Enter') {
          const input = (e.target as HTMLInputElement).value || '';
          this.terminalManager.executeCommand(input);
          (e.target as HTMLInputElement).value = '';
        }
      }
    });
  }

  private setupGlobalFunctions(): void {
    // Make functions available globally for HTML onclick handlers
    (window as any).toggleAIChat = () => this.layoutManager.toggleAIChat();
    (window as any).clearAIChat = () => {
      // Implementation for clearing AI chat
      console.log('Clear AI chat');
    };
    (window as any).toggleTerminal = () => this.terminalManager.toggleTerminal();
  }
}

// Initialize the application
const app = new RendererApp();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.initialize());
} else {
  app.initialize();
}

export default app;
