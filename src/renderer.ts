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
import { ProblemsManager } from './modules/problems/index.js';

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
  private problemsManager: ProblemsManager;

  constructor() {
    this.state = {
      currentFile: '',
      currentWorkingDirectory: '',
      showProjectSelector: true,
      openTabs: new Map(),
      activeTabPath: '',
      terminals: new Map(),
      activeTerminalId: '',
      terminalCounter: 1,
      terminalVisible: false,
      sidebarVisible: true,
      terminalHeight: 200,
      aiChatVisible: false,
      monacoEditor: null,
      activeTerminalTab: 'terminal'
    };

    this.fileSystem = new FileSystemManager();
    this.tabManager = new TabManager(this.state, this.fileSystem);
    this.editorManager = new MonacoEditorManager(this.state, this.tabManager);
    this.problemsManager = new ProblemsManager(this.state);
    this.terminalManager = new TerminalManager(this.state, this.problemsManager);
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
      
      console.log('🔧 Initializing problems manager...');
      this.problemsManager.initialize();
      this.problemsManager.exposeGlobally();
      console.log('✅ Problems manager initialized');
      
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
        try {
          await this.fileSystem.toggleDirectory(item);
          const updatedFiles = this.fileSystem.getFileTree();
          this.renderFileTree(updatedFiles);
        } catch (error) {
          console.error('Error toggling directory:', error);
        }
      } else {
        // Check if it's a previewable file
        if (this.isPreviewableFile(item.name)) {
          this.openFilePreview(item);
        } else {
          // Open in editor for text files
          try {
            await this.tabManager.openFile(item.path);
          } catch (error) {
            console.error('Error opening file:', error);
          }
        }
      }
    });

    // Add right-click context menu handler
    element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showContextMenu(e, item);
    });

    // Add drag and drop functionality for directories
    if (isDirectory) {
      this.setupDragAndDrop(element, item);
    }

    return element;
  }

  private setupDragAndDrop(element: HTMLElement, item: any): void {
    let dragCounter = 0;

    element.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      element.classList.add('drag-over');
    });

    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    });

    element.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        element.classList.remove('drag-over');
      }
    });

    element.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragCounter = 0;
      element.classList.remove('drag-over');

      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length === 0) return;

      element.classList.add('drag-processing');
      
      for (const file of files) {
        try {
          const filePath = (file as any).path;
          if (filePath) {
            await this.fileSystem.copyExternalFile(filePath, item.path, file.name);
          } else {
            // Simple fallback
            const arrayBuffer = await file.arrayBuffer();
            const base64Data = this.arrayBufferToBase64(arrayBuffer);
            await this.fileSystem.saveDroppedFile(item.path, file.name, base64Data, true);
          }
        } catch (error) {
          console.error('Error with file:', file.name, error);
        }
      }
      
      element.classList.remove('drag-processing');
    });
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private setupGlobalEventListeners(): void {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Don't handle shortcuts if user is typing in Monaco editor
      const target = e.target as HTMLElement;
      if (target && (
        target.closest('#editor-container') || 
        target.closest('.monaco-editor') ||
        target.closest('.monaco-inputbox') ||
        target.hasAttribute('data-editor-id') ||
        target.classList.contains('monaco-list-row') ||
        target.closest('.monaco-list')
      )) {
        // Only handle shortcuts that should work in editor (like Cmd+S)
        const isEditorAllowedShortcut = 
          ((e.ctrlKey || e.metaKey) && e.key === 's') || // Save
          ((e.ctrlKey || e.metaKey) && e.key === 'w') || // Close tab
          ((e.ctrlKey || e.metaKey) && e.key === '/') || // Comment
          (e.shiftKey && e.altKey && e.key === 'F') ||   // Format
          ((e.ctrlKey || e.metaKey) && e.key === '`') || // Toggle terminal
          (e.metaKey && e.key === 'j') ||                // Toggle chat
          ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') || // Command palette
          ((e.ctrlKey || e.metaKey) && e.key === 'b') || // Toggle sidebar
          ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F'); // Search
        
        if (!isEditorAllowedShortcut) {
          return; // Let Monaco handle the event
        }
      }

      // Ctrl/Cmd + ` to toggle terminal
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        this.layoutManager.toggleTerminal();
        return;
      }
      
      // Cmd + J to open chat panel
      if (e.metaKey && e.key === 'j') {
        e.preventDefault();
        this.layoutManager.toggleAIChat();
        return;
      }
      
      // Cmd + Shift + P for Command Palette (AI chat)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        this.layoutManager.toggleAIChat();
        return;
      }

      // Cmd + B to toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        this.layoutManager.toggleSidebar();
        return;
      }

      // Cmd + S to save current file
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveCurrentFile();
        return;
      }

      // Cmd + W to close current tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        this.closeCurrentTab();
        return;
      }

      // Cmd + / to comment/uncomment line
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        this.toggleLineComment();
        return;
      }

      // Shift + Option + F to format document
      if (e.shiftKey && e.altKey && e.key === 'F') {
        e.preventDefault();
        this.formatDocument();
        return;
      }

      // Ctrl/Cmd + Shift + F for search
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
        return;
      }
    });

    // Terminal input handling - MUCH more specific selector
    document.addEventListener('keydown', (e) => {
      // Only handle if target is specifically the terminal input
      if (e.target && 
          (e.target as HTMLElement).classList.contains('terminal-input') &&
          (e.target as HTMLElement).closest('.terminal-output')) {
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

    // Global drag and drop detection
    let dragCounter = 0;
    
    document.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      document.body.classList.add('drag-active');
    });
    
    document.addEventListener('dragleave', (e) => {
      dragCounter--;
      if (dragCounter === 0) {
        document.body.classList.remove('drag-active');
      }
    });
    
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      document.body.classList.remove('drag-active');
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
        { icon: '📄', text: 'New File', action: () => this.createNewFileInline(item) },
        { icon: '📁', text: 'New Folder', action: () => this.createNewFolderInline(item) },
        { type: 'separator' as const }
      ] : []),
      { icon: '✏️', text: 'Rename', action: () => this.renameItemInline(item) },
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
      { icon: '📄', text: 'New File', action: () => this.createNewFileInlineRoot() },
      { icon: '📁', text: 'New Folder', action: () => this.createNewFolderInlineRoot() }
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

  private createNewFileInline(parentItem: any): void {
    this.createInlineInput(parentItem, 'file', '');
  }

  private createNewFolderInline(parentItem: any): void {
    this.createInlineInput(parentItem, 'folder', '');
  }

  private createNewFileInlineRoot(): void {
    this.createInlineInputRoot('file', '');
  }

  private createNewFolderInlineRoot(): void {
    this.createInlineInputRoot('folder', '');
  }

  private renameItemInline(item: any): void {
    const fileElement = document.querySelector(`[data-file-path="${item.path}"]`) as HTMLElement;
    if (!fileElement) return;

    this.createInlineInputForRename(fileElement, item);
  }

  private createInlineInput(parentItem: any, type: 'file' | 'folder', defaultName: string): void {
    // First expand the parent directory if it's not already expanded
    if (!parentItem.isExpanded) {
      this.fileSystem.toggleDirectory(parentItem).then(() => {
        const updatedFiles = this.fileSystem.getFileTree();
        this.renderFileTree(updatedFiles);
        
        // Now create the input after re-render
        setTimeout(() => {
          this.insertInlineInputAfterParent(parentItem, type, defaultName);
        }, 100);
      });
    } else {
      this.insertInlineInputAfterParent(parentItem, type, defaultName);
    }
  }

  private createInlineInputRoot(type: 'file' | 'folder', defaultName: string): void {
    const fileTreeContainer = document.getElementById('file-tree');
    if (!fileTreeContainer) return;

    this.insertInlineInputAtTop(fileTreeContainer, type, defaultName);
  }

  private insertInlineInputAfterParent(parentItem: any, type: 'file' | 'folder', defaultName: string): void {
    const parentElement = document.querySelector(`[data-file-path="${parentItem.path}"]`) as HTMLElement;
    if (!parentElement) return;

    // Find the depth of the parent
    const parentDepth = parseInt(parentElement.style.paddingLeft) / 16 - 0.5;
    const inputDepth = parentDepth + 1;

    this.insertInlineInputElement(parentElement, type, defaultName, inputDepth, parentItem.path);
  }

  private insertInlineInputAtTop(container: HTMLElement, type: 'file' | 'folder', defaultName: string): void {
    const firstChild = container.firstChild;
    this.insertInlineInputElement(firstChild as HTMLElement || container, type, defaultName, 0.5, this.state.currentWorkingDirectory, true);
  }

  private insertInlineInputElement(referenceElement: HTMLElement, type: 'file' | 'folder', defaultName: string, depth: number, parentPath: string, insertBefore: boolean = false): void {
    // Remove any existing inline input
    const existingInput = document.querySelector('.inline-file-input');
    if (existingInput) {
      existingInput.remove();
    }

    const inputElement = document.createElement('div');
    inputElement.className = 'inline-file-input file-item px-2 py-1 text-sm text-gray-300 w-full';
    inputElement.style.paddingLeft = `${depth * 16 + 8}px`;

    const icon = type === 'folder' ? '📁' : '📄';
    
    inputElement.innerHTML = `
      <div class="flex items-center w-full">
        <span class="mr-4 w-3"></span>
        <span class="mr-2 flex-shrink-0">${icon}</span>
        <input 
          type="text" 
          class="inline-input flex-1 bg-gray-900 border border-blue-500 rounded px-1 text-white text-sm focus:outline-none"
          value="${defaultName}"
          placeholder="${type === 'folder' ? 'Folder name' : 'File name'}"
        />
      </div>
    `;

    // Insert the input element
    if (insertBefore && referenceElement) {
      referenceElement.parentNode?.insertBefore(inputElement, referenceElement);
    } else if (referenceElement) {
      referenceElement.parentNode?.insertBefore(inputElement, referenceElement.nextSibling);
    }

    const input = inputElement.querySelector('.inline-input') as HTMLInputElement;
    if (input) {
      input.focus();
      input.select();

      const handleConfirm = async () => {
        const name = input.value.trim();
        if (name) {
          try {
            let success = false;
            if (type === 'folder') {
              success = await this.fileSystem.createFolder(parentPath, name);
            } else {
              success = await this.fileSystem.createFile(parentPath, name);
              
              // Auto-open the newly created file
              if (success) {
                const normalizedParentPath = parentPath.replace(/\\/g, '/');
                const filePath = normalizedParentPath.endsWith('/') ? 
                  normalizedParentPath + name : 
                  normalizedParentPath + '/' + name;
                
                setTimeout(async () => {
                  try {
                    await this.tabManager.openFile(filePath);
                  } catch (error) {
                    console.error('Error opening new file:', error);
                  }
                }, 500);
              }
            }
            
            if (!success) {
              alert(`Failed to create ${type}`);
            }
          } catch (error) {
            console.error(`Error creating ${type}:`, error);
            alert(`Error creating ${type}: ` + error);
          }
        }
        inputElement.remove();
      };

      const handleCancel = () => {
        inputElement.remove();
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleConfirm();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        }
      });

      input.addEventListener('blur', () => {
        // Small delay to allow for click events to process
        setTimeout(handleCancel, 100);
      });
    }
  }

  private createInlineInputForRename(fileElement: HTMLElement, item: any): void {
    // Remove any existing inline input
    const existingInput = document.querySelector('.inline-file-input');
    if (existingInput) {
      existingInput.remove();
    }

    const fileNameSpan = fileElement.querySelector('.file-name') as HTMLElement;
    if (!fileNameSpan) return;

    const originalName = item.name;
    
    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalName;
    input.className = 'inline-input bg-gray-900 border border-blue-500 rounded px-1 text-white text-sm focus:outline-none flex-1';
    
    // Replace the file name with the input
    const originalContent = fileNameSpan.innerHTML;
    fileNameSpan.innerHTML = '';
    fileNameSpan.appendChild(input);
    
    input.focus();
    input.select();

    const handleConfirm = async () => {
      const newName = input.value.trim();
      if (newName && newName !== originalName) {
        try {
          const success = await this.fileSystem.renameItem(item.path, newName);
          if (!success) {
            alert('Failed to rename item');
          }
        } catch (error) {
          console.error('Error renaming item:', error);
          alert('Error renaming item: ' + error);
        }
      }
      
      // Restore original content
      fileNameSpan.innerHTML = originalContent;
    };

    const handleCancel = () => {
      // Restore original content
      fileNameSpan.innerHTML = originalContent;
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(handleCancel, 100);
    });
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

  private isPreviewableFile(fileName: string): boolean {
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    const previewableExtensions = [
      // Images
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg',
      // Videos
      '.mp4', '.webm', '.ogg',
      // Audio
      '.mp3', '.wav', '.ogg', '.m4a'
    ];
    return previewableExtensions.includes(extension);
  }

  private openFilePreview(item: any): void {
    // Remove any existing preview
    const existingPreview = document.querySelector('.file-preview-modal');
    if (existingPreview) {
      existingPreview.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'file-preview-modal fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
    
    const extension = item.name.toLowerCase().substring(item.name.lastIndexOf('.'));
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(extension);
    const isVideo = ['.mp4', '.webm', '.ogg'].includes(extension);
    const isAudio = ['.mp3', '.wav', '.ogg', '.m4a'].includes(extension);

    // Create file URL
    const fileUrl = `file://${item.path}`;

    let previewContent = '';
    
    if (isImage) {
      previewContent = `
        <img src="${fileUrl}" 
             alt="${item.name}" 
             class="max-w-full max-h-full object-contain"
             style="max-width: 90vw; max-height: 90vh;" />
      `;
    } else if (isVideo) {
      previewContent = `
        <video controls 
               class="max-w-full max-h-full"
               style="max-width: 90vw; max-height: 90vh;">
          <source src="${fileUrl}" type="video/${extension.substring(1)}">
          Your browser does not support the video tag.
        </video>
      `;
    } else if (isAudio) {
      previewContent = `
        <div class="bg-gray-800 p-8 rounded-lg">
          <div class="text-white text-lg mb-4">🎵 ${item.name}</div>
          <audio controls class="w-full">
            <source src="${fileUrl}" type="audio/${extension.substring(1)}">
            Your browser does not support the audio element.
          </audio>
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="relative">
        <button class="absolute top-4 right-4 text-white text-2xl bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75 z-10"
                onclick="this.closest('.file-preview-modal').remove()">
          ×
        </button>
        ${previewContent}
      </div>
    `;

    document.body.appendChild(modal);

    // Close on click outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Close on Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  // Add the missing methods for keyboard shortcuts
  private saveCurrentFile(): void {
    if (this.state.activeTabPath && this.state.monacoEditor) {
      const content = this.state.monacoEditor.getValue();
      this.fileSystem.writeFile(this.state.activeTabPath, content)
        .then(() => {
          console.log('✅ File saved:', this.state.activeTabPath);
          // Mark tab as clean
          this.tabManager.markTabAsClean(this.state.activeTabPath);
          
          // Show brief save notification
          this.showSaveNotification();
        })
        .catch((error) => {
          console.error('❌ Failed to save file:', error);
          alert(`Failed to save file: ${error}`);
        });
    }
  }

  private closeCurrentTab(): void {
    if (this.state.activeTabPath) {
      this.tabManager.closeTab(this.state.activeTabPath);
    }
  }

  private toggleLineComment(): void {
    if (this.state.monacoEditor && window.monaco) {
      // Use Monaco's built-in comment toggle
      this.state.monacoEditor.trigger('keyboard', 'editor.action.commentLine', null);
    }
  }

  private formatDocument(): void {
    if (this.state.monacoEditor && window.monaco) {
      // Use Monaco's built-in format document
      this.state.monacoEditor.trigger('keyboard', 'editor.action.formatDocument', null);
    }
  }

  private showSaveNotification(): void {
    // Create a brief save notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 opacity-0 transition-opacity duration-200';
    notification.textContent = 'File saved';
    
    document.body.appendChild(notification);
    
    // Fade in
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);
    
    // Fade out and remove
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 200);
    }, 1500);
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
