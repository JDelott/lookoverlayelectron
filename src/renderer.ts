console.log('🚀 RENDERER SCRIPT STARTING - THIS SHOULD SHOW UP FIRST');

// Add this right after the console.log
(window as any).testMessage = 'Renderer loaded successfully!';

console.log('🚀 Renderer script starting...');

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
      aiChatVisible: false,
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
      console.log('🔧 Initializing renderer app...');
      console.log('🔧 Initial state:', this.state);
      
      // Load and inject Tailwind CSS
      await this.loadTailwindCSS();
      console.log('✅ Tailwind CSS loaded');
      
      // Expose layout manager globally FIRST
      this.layoutManager.exposeGlobally();
      console.log('✅ Layout manager exposed globally');
      
      // Create the main layout
      this.layoutManager.createLayout();
      console.log('✅ Layout created');
      
      // Check if we should show project selector
      if (this.state.showProjectSelector) {
        console.log('🔧 Project selector should be visible');
        return; // Don't initialize other modules yet
      }
      
      // Initialize modules if not showing project selector
      await this.initializeModules();
      
      console.log('🎉 Renderer initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize renderer:', error);
    }
  }

  async initializeModules(): Promise<void> {
    try {
      console.log('🔧 Initializing editor manager...');
      await this.editorManager.initialize();
      console.log('✅ Editor manager initialized');
      
      console.log('🔧 Initializing terminal manager...');
      this.terminalManager.initialize();
      console.log('✅ Terminal manager initialized');
      
      console.log('🔧 Loading file system...');
      await this.loadFileSystem();
      console.log('✅ File system loaded');
      
      // Setup global event listeners
      this.setupGlobalEventListeners();
      console.log('✅ Global event listeners set up');
      
      // Setup global functions for HTML onclick handlers
      this.setupGlobalFunctions();
      console.log('✅ Global functions set up');
      
      console.log('🎉 All modules initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize modules:', error);
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
        this.layoutManager.toggleTerminal();
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
    // Clean setup - no redundant global functions since layoutManager handles everything
    (window as any).app = this;
  }
}

console.log('🚀 Renderer script loaded, initializing app...');

// Initialize the application
const app = new RendererApp();

// Expose app globally for layout manager callbacks
(window as any).app = app;

if (document.readyState === 'loading') {
  console.log('📄 Document loading, waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM ready, initializing app...');
    app.initialize();
  });
} else {
  console.log('📄 DOM already ready, initializing app immediately...');
  app.initialize();
}

export default app;
