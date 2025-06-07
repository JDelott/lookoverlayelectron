import { AppState } from '../types';

interface PanelSizes {
  sidebarWidth: number;
  terminalHeight: number;
  aiChatWidth: number;
}

interface LayoutConstraints {
  sidebar: { min: number; max: number };
  terminal: { min: number; max: number };
  aiChat: { min: number; max: number };
  editor: { min: number };
}

export class LayoutManager {
  private state: AppState;
  private panelSizes: PanelSizes;
  private constraints: LayoutConstraints;
  private resizeObserver: ResizeObserver | null = null;

  constructor(state: AppState) {
    this.state = state;
    this.panelSizes = {
      sidebarWidth: 280,
      terminalHeight: 200,
      aiChatWidth: 350
    };
    this.constraints = {
      sidebar: { min: 200, max: 600 },
      terminal: { min: 120, max: 500 },
      aiChat: { min: 300, max: 600 },
      editor: { min: 300 }
    };
  }

  createLayout(): void {
    const root = document.getElementById('root');
    if (!root) return;

    root.className = 'w-full h-full flex flex-col bg-gray-900 text-gray-300 overflow-hidden';
    root.innerHTML = this.getLayoutHTML();
    
    this.setupResizeHandlers();
    this.setupViewportObserver();
    this.updateLayout();
  }

  private getLayoutHTML(): string {
    return `
      <!-- Main Layout Container -->
      <div class="flex-1 flex flex-row min-h-0 layout-container">
        <!-- Sidebar Panel -->
        <div class="sidebar-panel bg-gray-800 border-r border-gray-700 flex flex-col" style="width: ${this.panelSizes.sidebarWidth}px; min-width: ${this.constraints.sidebar.min}px;">
          <!-- Sidebar Header -->
          <div class="px-3 py-2 bg-gray-700 border-b border-gray-600 text-xs font-semibold uppercase text-gray-300 flex-shrink-0">
            Explorer
          </div>
          
          <!-- File Tree -->
          <div class="flex-1 py-1 overflow-y-auto overflow-x-hidden scrollbar-thin min-h-0" id="file-tree">
          </div>
        </div>

        <!-- Sidebar Resize Handle -->
        <div class="sidebar-resize-handle w-1 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors flex-shrink-0" data-panel="sidebar"></div>

        <!-- Main Content Panel -->
        <div class="flex-1 flex flex-col min-w-0 main-content-panel">
          <!-- Tab Bar -->
          <div class="h-9 bg-gray-700 border-b border-gray-600 flex items-center px-2 tab-bar flex-shrink-0">
          </div>

          <!-- Editor and Terminal Container -->
          <div class="flex-1 flex flex-col min-h-0 editor-terminal-container">
            <!-- Editor Area -->
            <div class="editor-area bg-gray-900 flex-shrink-0" style="height: ${this.getEditorHeight()}px;">
              <div id="editor-container" class="w-full h-full"></div>
            </div>

            <!-- Terminal Resize Handle -->
            <div class="terminal-resize-handle h-1 bg-gray-700 hover:bg-blue-500 cursor-row-resize transition-colors flex-shrink-0 ${this.state.terminalVisible ? '' : 'hidden'}" data-panel="terminal"></div>
            
            <!-- Terminal Container -->
            <div class="terminal-container bg-gray-800 border-t border-gray-600 flex flex-col ${this.state.terminalVisible ? '' : 'hidden'}" style="height: ${this.state.terminalVisible ? this.panelSizes.terminalHeight : 0}px;">
              <!-- Terminal Tabs -->
              <div class="h-8 bg-gray-800 border-b border-gray-600 flex items-center terminal-tabs flex-shrink-0">
              </div>
              
              <!-- Terminal Output -->
              <div class="flex-1 p-3 overflow-y-auto font-mono text-sm scrollbar-thin terminal-output min-h-0">
              </div>
            </div>
          </div>
        </div>
        <!-- AI Chat Resize Handle -->
        <div class="ai-chat-resize-handle w-1 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors flex-shrink-0 ${this.state.aiChatVisible ? '' : 'hidden'}" data-panel="ai-chat"></div>

        <!-- AI Chat Panel -->
        <div class="ai-chat-panel bg-gray-800 border-l border-gray-700 flex flex-col ${this.state.aiChatVisible ? '' : 'hidden'}" style="width: ${this.state.aiChatVisible ? this.panelSizes.aiChatWidth : 0}px;">
          <!-- AI Chat Header -->
          <div class="px-3 py-2 bg-gray-700 border-b border-gray-600 flex justify-between items-center flex-shrink-0">
            <div class="flex items-center gap-2 text-sm font-semibold text-gray-300">
              <span class="text-base">🤖</span>
              AI Assistant
            </div>
            <div class="flex gap-1">
              <button class="px-2 py-1 text-xs border border-gray-600 rounded hover:bg-gray-600 transition-colors" onclick="window.layoutManager?.clearAIChat()">
                Clear
              </button>
              <button class="px-2 py-1 text-xs border border-gray-600 rounded hover:bg-gray-600 transition-colors" onclick="window.layoutManager?.toggleAIChat()">
                ×
              </button>
            </div>
          </div>
          
          <!-- AI Chat Content -->
          <div class="flex-1 flex flex-col min-h-0" id="ai-chat-content">
          </div>
        </div>
      </div>

      <!-- Status Bar -->
      <div class="h-6 bg-blue-600 text-white text-xs flex items-center px-3 status-bar flex-shrink-0 z-50">
        Ready
      </div>
    `;
  }

  private setupResizeHandlers(): void {
    this.setupPanelResize('sidebar', (delta) => this.resizeSidebar(delta));
    this.setupPanelResize('terminal', (delta) => this.resizeTerminal(delta));
    this.setupPanelResize('ai-chat', (delta) => this.resizeAIChat(delta));
  }

  private setupPanelResize(panelType: string, resizeCallback: (delta: number) => void): void {
    const handle = document.querySelector(`[data-panel="${panelType}"]`) as HTMLElement;
    if (!handle) return;

    let isResizing = false;
    let startPos = 0;
    let startSize = 0;

    const startResize = (e: MouseEvent) => {
      isResizing = true;
      startPos = panelType === 'terminal' ? e.clientY : e.clientX;
      startSize = this.getCurrentPanelSize(panelType);
      
      document.body.style.cursor = panelType === 'terminal' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
      
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', endResize);
      e.preventDefault();
    };

    const handleResize = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const currentPos = panelType === 'terminal' ? e.clientY : e.clientX;
      const delta = currentPos - startPos;
      
      resizeCallback(delta);
    };

    const endResize = () => {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', endResize);
    };

    handle.addEventListener('mousedown', startResize);
  }

  private getCurrentPanelSize(panelType: string): number {
    switch (panelType) {
      case 'sidebar': return this.panelSizes.sidebarWidth;
      case 'terminal': return this.panelSizes.terminalHeight;
      case 'ai-chat': return this.panelSizes.aiChatWidth;
      default: return 0;
    }
  }

  private resizeSidebar(delta: number): void {
    const newWidth = Math.max(
      this.constraints.sidebar.min,
      Math.min(this.constraints.sidebar.max, this.panelSizes.sidebarWidth + delta)
    );
    
    if (this.isValidLayout({ ...this.panelSizes, sidebarWidth: newWidth })) {
      this.panelSizes.sidebarWidth = newWidth;
      this.updateLayout();
    }
  }

  private resizeTerminal(delta: number): void {
    const newHeight = Math.max(
      this.constraints.terminal.min,
      Math.min(this.constraints.terminal.max, this.panelSizes.terminalHeight - delta)
    );
    
    if (this.isValidLayout({ ...this.panelSizes, terminalHeight: newHeight })) {
      this.panelSizes.terminalHeight = newHeight;
      this.state.terminalHeight = newHeight;
      this.updateLayout();
    }
  }

  private resizeAIChat(delta: number): void {
    const newWidth = Math.max(
      this.constraints.aiChat.min,
      Math.min(this.constraints.aiChat.max, this.panelSizes.aiChatWidth - delta)
    );
    
    if (this.isValidLayout({ ...this.panelSizes, aiChatWidth: newWidth })) {
      this.panelSizes.aiChatWidth = newWidth;
      this.updateLayout();
    }
  }

  private isValidLayout(sizes: PanelSizes): boolean {
    const viewport = this.getViewportSize();
    const totalWidth = sizes.sidebarWidth + (this.state.aiChatVisible ? sizes.aiChatWidth : 0) + 
                     this.constraints.editor.min + 4; // 4px for resize handles
    
    return totalWidth <= viewport.width;
  }

  private getViewportSize(): { width: number; height: number } {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  private getEditorHeight(): number {
    const viewport = this.getViewportSize();
    const statusBarHeight = 24; // 6 (status bar) + 36 (tab bar) + some padding
    const tabBarHeight = 36;
    const terminalHeight = this.state.terminalVisible ? this.panelSizes.terminalHeight + 4 : 0; // +4 for resize handle
    
    return viewport.height - statusBarHeight - tabBarHeight - terminalHeight;
  }

  private updateLayout(): void {
    this.updateSidebarSize();
    this.updateTerminalSize();
    this.updateAIChatSize();
    this.updateEditorSize();
  }

  private updateSidebarSize(): void {
    const sidebar = document.querySelector('.sidebar-panel') as HTMLElement;
    if (sidebar) {
      sidebar.style.width = `${this.panelSizes.sidebarWidth}px`;
    }
  }

  private updateTerminalSize(): void {
    const terminal = document.querySelector('.terminal-container') as HTMLElement;
    const handle = document.querySelector('.terminal-resize-handle') as HTMLElement;
    
    if (terminal && handle) {
      if (this.state.terminalVisible) {
        terminal.style.height = `${this.panelSizes.terminalHeight}px`;
        terminal.classList.remove('hidden');
        handle.classList.remove('hidden');
      } else {
        terminal.style.height = '0px';
        terminal.classList.add('hidden');
        handle.classList.add('hidden');
      }
    }
  }

  private updateAIChatSize(): void {
    const aiChat = document.querySelector('.ai-chat-panel') as HTMLElement;
    const handle = document.querySelector('.ai-chat-resize-handle') as HTMLElement;
    
    if (aiChat && handle) {
      if (this.state.aiChatVisible) {
        aiChat.style.width = `${this.panelSizes.aiChatWidth}px`;
        aiChat.classList.remove('hidden');
        handle.classList.remove('hidden');
      } else {
        aiChat.style.width = '0px';
        aiChat.classList.add('hidden');
        handle.classList.add('hidden');
      }
    }
  }

  private updateEditorSize(): void {
    const editor = document.querySelector('.editor-area') as HTMLElement;
    if (editor) {
      editor.style.height = `${this.getEditorHeight()}px`;
    }
    
    // Trigger Monaco editor resize
    if (this.state.monacoEditor && this.state.monacoEditor.layout) {
      setTimeout(() => this.state.monacoEditor.layout(), 0);
    }
  }

  private setupViewportObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.handleViewportResize();
    });
    
    this.resizeObserver.observe(document.body);
    window.addEventListener('resize', () => this.handleViewportResize());
  }

  private handleViewportResize(): void {
    // Ensure panels don't exceed viewport constraints
    const viewport = this.getViewportSize();
    let needsUpdate = false;

    // Adjust sidebar if too wide
    if (this.panelSizes.sidebarWidth > viewport.width * 0.4) {
      this.panelSizes.sidebarWidth = Math.max(this.constraints.sidebar.min, viewport.width * 0.3);
      needsUpdate = true;
    }

    // Adjust AI chat if too wide
    if (this.panelSizes.aiChatWidth > viewport.width * 0.4) {
      this.panelSizes.aiChatWidth = Math.max(this.constraints.aiChat.min, viewport.width * 0.3);
      needsUpdate = true;
    }

    // Adjust terminal if too tall
    if (this.panelSizes.terminalHeight > viewport.height * 0.6) {
      this.panelSizes.terminalHeight = Math.max(this.constraints.terminal.min, viewport.height * 0.3);
      this.state.terminalHeight = this.panelSizes.terminalHeight;
      needsUpdate = true;
    }

    if (needsUpdate) {
      this.updateLayout();
    } else {
      // Just update editor size for viewport changes
      this.updateEditorSize();
    }
  }

  // Public methods for panel management
  showAIChat(): void {
    this.state.aiChatVisible = true;
    this.updateLayout();
  }

  hideAIChat(): void {
    this.state.aiChatVisible = false;
    this.updateLayout();
  }

  toggleAIChat(): void {
    if (this.state.aiChatVisible) {
      this.hideAIChat();
    } else {
      this.showAIChat();
    }
  }

  showTerminal(): void {
    this.state.terminalVisible = true;
    this.updateLayout();
  }

  hideTerminal(): void {
    this.state.terminalVisible = false;
    this.updateLayout();
  }

  toggleTerminal(): void {
    if (this.state.terminalVisible) {
      this.hideTerminal();
    } else {
      this.showTerminal();
    }
  }

  clearAIChat(): void {
    const aiChatContent = document.getElementById('ai-chat-content');
    if (aiChatContent) {
      aiChatContent.innerHTML = '';
    }
  }

  // Expose instance for global access
  exposeGlobally(): void {
    (window as any).layoutManager = this;
  }

  dispose(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    window.removeEventListener('resize', this.handleViewportResize);
    delete (window as any).layoutManager;
  }
}
