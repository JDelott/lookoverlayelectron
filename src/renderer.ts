console.log('🚀 RENDERER SCRIPT STARTING - THIS SHOULD SHOW UP FIRST');

// Add this right after the console.log
(window as any).testMessage = 'Renderer loaded successfully!';

console.log('🚀 Renderer script starting...');

import { AppState } from './modules/types/index.js';
import { FileSystemManager } from './modules/fileSystem/index.js';
import { TabManager } from './modules/tabs/index.js';
import { MonacoEditorManager } from './modules/editor/index.js';
import { TerminalManager } from './modules/terminal/index.js';
import { LayoutManager } from './modules/layout/index.js';
import { ChatManager } from './modules/chat/index.js';
import { GitManager } from './modules/git/index.js';
import { SearchManager } from './modules/search/index.js';

class RendererApp {
  private state: AppState;
  private fileSystem: FileSystemManager;
  private tabManager: TabManager;
  private editorManager: MonacoEditorManager;
  private terminalManager: TerminalManager;
  private layoutManager: LayoutManager;
  private chatManager: ChatManager;
  private gitManager: GitManager;
  private searchManager: SearchManager;

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
    this.chatManager = new ChatManager(this.state);
    this.gitManager = new GitManager(this.state);
    this.searchManager = new SearchManager(this.state);
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
      
      console.log('🔧 Initializing chat manager...');
      this.chatManager.initialize();
      this.chatManager.exposeGlobally();
      console.log('✅ Chat manager initialized');
      
      console.log('🔧 Initializing Git manager...');
      await this.gitManager.initialize();
      this.gitManager.exposeGlobally();
      console.log('✅ Git manager initialized');
      
      console.log('🔧 Initializing Search manager...');
      this.searchManager.initialize();
      this.searchManager.exposeGlobally();
      console.log('✅ Search manager initialized');
      
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
    if (!fileTreeContainer) {
      console.error('File tree container not found');
      return;
    }

    fileTreeContainer.innerHTML = '';
    
    // Create a wrapper for the entire tree
    const treeWrapper = document.createElement('div');
    treeWrapper.className = 'file-tree-wrapper min-h-full';
    
    this.renderFileItems(files, treeWrapper, 0);
    
    fileTreeContainer.appendChild(treeWrapper);
    
    // Add right-click handler to empty space
    fileTreeContainer.addEventListener('contextmenu', (e) => {
      // Only show root context menu if clicking on empty space (not on a file item)
      const target = e.target as HTMLElement;
      if (!target.closest('.file-item')) {
        e.preventDefault();
        e.stopPropagation();
        this.showRootContextMenu(e);
      }
    });
    
    console.log('✅ File tree rendered with', files.length, 'items');
  }

  private renderFileItems(items: any[], container: HTMLElement, depth: number): void {
    items.forEach(item => {
      // Create the file/folder item
      const itemElement = this.createFileElement(item, depth);
      container.appendChild(itemElement);
      
      // If it's an expanded directory with children, render them underneath
      if (item.type === 'directory' && item.isExpanded && item.children && item.children.length > 0) {
        this.renderFileItems(item.children, container, depth + 1);
      }
    });
  }

  private createFileElement(item: any, depth: number): HTMLElement {
    const element = document.createElement('div');
    
    const isDirectory = item.type === 'directory';
    const icon = isDirectory ? '📁' : this.fileSystem.getFileIcon(item.name.split('.').pop() || '');
    
    element.className = `file-item cursor-pointer hover:bg-gray-700 px-2 py-1 text-sm text-gray-300 w-full relative`;
    element.style.paddingLeft = `${depth * 16 + 8}px`;
    element.setAttribute('data-file-path', item.path);
    element.setAttribute('data-file-type', item.type);
    element.setAttribute('data-file-name', item.name);
    
    element.innerHTML = `
      <div class="flex items-center w-full">
        ${isDirectory ? `<span class="expansion-arrow mr-1 text-gray-400 w-3">${item.isExpanded ? '▼' : '▶'}</span>` : '<span class="mr-4 w-3"></span>'}
        <span class="mr-2 flex-shrink-0">${icon}</span>
        <span class="file-name flex-1 truncate">${item.name}</span>
      </div>
    `;

    // Add click handler for normal left-click
    element.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      if (isDirectory) {
        console.log('📁 Clicking directory:', item.name);
        try {
          await this.fileSystem.toggleDirectory(item);
          // Just re-render the file tree - don't touch layout
          const updatedFiles = this.fileSystem.getFileTree();
          this.renderFileTree(updatedFiles);
        } catch (error) {
          console.error('Error toggling directory:', error);
        }
      } else {
        console.log('📄 Clicking file:', item.name);
        try {
          await this.tabManager.openFile(item.path);
        } catch (error) {
          console.error('Error opening file:', error);
        }
      }
    });

    // Add right-click context menu handler
    element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showContextMenu(e, item);
    });

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

    // Listen for file tree refresh requests
    document.addEventListener('refresh-file-tree', async () => {
      console.log('🔄 Refreshing file tree due to terminal command...');
      try {
        await this.loadFileSystem();
        console.log('✅ File tree refreshed successfully');
      } catch (error) {
        console.error('❌ Failed to refresh file tree:', error);
      }
    });

    document.addEventListener('file-tree-updated', (event: any) => {
      console.log('🔄 File tree updated, re-rendering...');
      this.renderFileTree(event.detail);
    });

    // Ctrl/Cmd + Shift + F for search
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        this.layoutManager.switchSidebarTab('search');
        
        // Focus search input
        setTimeout(() => {
          const searchInput = document.getElementById('search-input') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }, 100);
      }
    });
  }

  private setupGlobalFunctions(): void {
    // Clean setup - no redundant global functions since layoutManager handles everything
    (window as any).app = this;
  }

  private showContextMenu(event: MouseEvent, item: any): void {
    // Remove any existing context menu
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu absolute bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-1 z-50 min-w-48';
    
    const isDirectory = item.type === 'directory';
    
    const menuItems: Array<{ icon: string; text: string; action: () => void } | { type: 'separator' }> = [
      ...(isDirectory ? [
        { icon: '📄', text: 'New File', action: () => this.createNewFile(item.path) },
        { icon: '📁', text: 'New Folder', action: () => this.createNewFolder(item.path) },
        { type: 'separator' as const }
      ] : []),
      { icon: '✏️', text: 'Rename', action: () => this.renameItem(item) },
      { icon: '🗑️', text: 'Delete', action: () => this.deleteItem(item) },
      { type: 'separator' as const },
      { icon: '📋', text: 'Copy Path', action: () => this.copyPath(item.path) }
    ];

    // Add menu items to context menu
    menuItems.forEach(menuItem => {
      if ('type' in menuItem && menuItem.type === 'separator') {
        const separator = document.createElement('div');
        separator.className = 'border-t border-gray-600 my-1';
        contextMenu.appendChild(separator);
      } else {
        const actionItem = menuItem as { icon: string; text: string; action: () => void };
        const menuElement = document.createElement('div');
        menuElement.className = 'px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer flex items-center gap-2';
        menuElement.innerHTML = `
          <span class="text-sm">${actionItem.icon}</span>
          <span>${actionItem.text}</span>
        `;
        
        menuElement.addEventListener('click', () => {
          actionItem.action();
          contextMenu.remove();
        });
        
        contextMenu.appendChild(menuElement);
      }
    });

    // Position the menu
    contextMenu.style.left = `${event.pageX}px`;
    contextMenu.style.top = `${event.pageY}px`;
    
    // Add to document
    document.body.appendChild(contextMenu);

    // Close menu when clicking elsewhere
    const closeMenu = (e: MouseEvent) => {
      if (!contextMenu.contains(e.target as Node)) {
        contextMenu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 0);
  }

  private showRootContextMenu(event: MouseEvent): void {
    // Remove any existing context menu
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu absolute bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-1 z-50 min-w-48';
    
    const menuItems = [
      { icon: '📄', text: 'New File', action: () => this.createNewFile(this.state.currentWorkingDirectory) },
      { icon: '📁', text: 'New Folder', action: () => this.createNewFolder(this.state.currentWorkingDirectory) }
    ];

    menuItems.forEach(menuItem => {
      const menuElement = document.createElement('div');
      menuElement.className = 'px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer flex items-center gap-2';
      menuElement.innerHTML = `
        <span class="text-sm">${menuItem.icon}</span>
        <span>${menuItem.text}</span>
      `;
      
      menuElement.addEventListener('click', () => {
        menuItem.action();
        contextMenu.remove();
      });
      
      contextMenu.appendChild(menuElement);
    });

    // Position the menu
    contextMenu.style.left = `${event.pageX}px`;
    contextMenu.style.top = `${event.pageY}px`;
    
    // Add to document
    document.body.appendChild(contextMenu);

    // Close menu when clicking elsewhere
    const closeMenu = (e: MouseEvent) => {
      if (!contextMenu.contains(e.target as Node)) {
        contextMenu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 0);
  }

  private showCustomPrompt(title: string, placeholder: string, defaultValue: string = ''): Promise<string | null> {
    return new Promise((resolve) => {
      // Remove any existing prompt
      const existingPrompt = document.querySelector('.custom-prompt');
      if (existingPrompt) {
        existingPrompt.remove();
      }

      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'custom-prompt fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      
      // Create prompt dialog
      const promptDialog = document.createElement('div');
      promptDialog.className = 'bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-md w-full mx-4';
      
      promptDialog.innerHTML = `
        <h3 class="text-lg font-semibold text-white mb-4">${title}</h3>
        <input 
          type="text" 
          id="custom-prompt-input"
          placeholder="${placeholder}"
          value="${defaultValue}"
          class="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
        />
        <div class="flex gap-3 mt-6 justify-end">
          <button id="custom-prompt-cancel" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded">Cancel</button>
          <button id="custom-prompt-ok" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">OK</button>
        </div>
      `;
      
      overlay.appendChild(promptDialog);
      document.body.appendChild(overlay);
      
      const input = document.getElementById('custom-prompt-input') as HTMLInputElement;
      const okBtn = document.getElementById('custom-prompt-ok');
      const cancelBtn = document.getElementById('custom-prompt-cancel');
      
      // Focus and select input
      input.focus();
      input.select();
      
      const cleanup = () => {
        overlay.remove();
      };
      
      const handleOk = () => {
        const value = input.value.trim();
        cleanup();
        resolve(value || null);
      };
      
      const handleCancel = () => {
        cleanup();
        resolve(null);
      };
      
      // Event listeners
      okBtn?.addEventListener('click', handleOk);
      cancelBtn?.addEventListener('click', handleCancel);
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleOk();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        }
      });
      
      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          handleCancel();
        }
      });
    });
  }

  private async createNewFile(parentPath: string): Promise<void> {
    console.log('🔧 Creating new file in:', parentPath);
    
    const fileName = await this.showCustomPrompt('New File', 'Enter file name:', '');
    if (!fileName) return;

    try {
      // Ensure proper path construction
      const normalizedParentPath = parentPath.replace(/\\/g, '/');
      const success = await this.fileSystem.createFile(normalizedParentPath, fileName);
      
      if (success) {
        console.log('✅ File created successfully:', fileName);
        
        // Construct full file path for opening
        const filePath = normalizedParentPath.endsWith('/') ? 
          normalizedParentPath + fileName : 
          normalizedParentPath + '/' + fileName;
        
        // Wait a moment for file system to update, then open the file
        setTimeout(async () => {
          try {
            await this.tabManager.openFile(filePath);
          } catch (error) {
            console.error('Error opening new file:', error);
          }
        }, 500);
      } else {
        alert('Failed to create file');
      }
    } catch (error) {
      console.error('Error creating file:', error);
      alert('Error creating file: ' + error);
    }
  }

  private async createNewFolder(parentPath: string): Promise<void> {
    console.log('🔧 Creating new folder in:', parentPath);
    
    const folderName = await this.showCustomPrompt('New Folder', 'Enter folder name:', '');
    if (!folderName) return;

    try {
      // Ensure proper path construction
      const normalizedParentPath = parentPath.replace(/\\/g, '/');
      const success = await this.fileSystem.createFolder(normalizedParentPath, folderName);
      
      if (success) {
        console.log('✅ Folder created successfully:', folderName);
      } else {
        alert('Failed to create folder');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Error creating folder: ' + error);
    }
  }

  private async renameItem(item: any): Promise<void> {
    console.log('🔧 Renaming item:', item.name);
    
    const newName = await this.showCustomPrompt('Rename', 'Enter new name:', item.name);
    if (!newName || newName === item.name) return;

    try {
      const success = await this.fileSystem.renameItem(item.path, newName);
      if (success) {
        console.log('✅ Item renamed successfully:', item.name, '->', newName);
      } else {
        alert('Failed to rename item');
      }
    } catch (error) {
      console.error('Error renaming item:', error);
      alert('Error renaming item: ' + error);
    }
  }

  private async deleteItem(item: any): Promise<void> {
    const confirmDelete = confirm(`Are you sure you want to delete "${item.name}"?`);
    if (!confirmDelete) return;

    try {
      const success = await this.fileSystem.deleteItem(item.path);
      if (success) {
        console.log('✅ Item deleted successfully:', item.name);
      } else {
        alert('Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Error deleting item: ' + error);
    }
  }

  private copyPath(path: string): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(path).then(() => {
        console.log('✅ Path copied to clipboard:', path);
      }).catch(err => {
        console.error('Failed to copy path:', err);
        this.fallbackCopyPath(path);
      });
    } else {
      this.fallbackCopyPath(path);
    }
  }

  private fallbackCopyPath(path: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = path;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      console.log('✅ Path copied to clipboard (fallback):', path);
    } catch (err) {
      console.error('Failed to copy path (fallback):', err);
    }
    document.body.removeChild(textArea);
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
