import { AppState } from '../types';

interface PanelSizes {
  sidebarWidth: number;
  terminalHeight: number;
  aiChatWidth: number;
}

export class LayoutManager {
  private state: AppState;
  private panelSizes: PanelSizes;
  private terminalCollapsed = false;
  private isInitialized = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(state: AppState) {
    this.state = state;
    this.panelSizes = {
      sidebarWidth: 280,
      terminalHeight: 250,
      aiChatWidth: 350
    };
  }

  createLayout(): void {
    const root = document.getElementById('root');
    if (!root) return;

    root.className = 'w-full h-screen bg-gray-900 text-gray-300 overflow-hidden p-2';
    root.innerHTML = this.getLayoutHTML();
    
    this.injectLayoutStyles();
    this.setupResizeHandlers();
    this.setupViewportObserver();
    this.isInitialized = true;
    this.updatePanelVisibility();
  }

  private injectLayoutStyles(): void {
    const existingStyle = document.getElementById('layout-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement('style');
    style.id = 'layout-styles';
    style.textContent = `
      :root {
        --viewport-inset: 8px;
        --safe-area-inset-top: max(8px, env(safe-area-inset-top));
        --safe-area-inset-right: max(8px, env(safe-area-inset-right));
        --safe-area-inset-bottom: max(8px, env(safe-area-inset-bottom));
        --safe-area-inset-left: max(8px, env(safe-area-inset-left));
        --header-height: 40px;
        --status-height: 24px;
        --sidebar-width: ${this.panelSizes.sidebarWidth}px;
        --chat-width: ${this.state.aiChatVisible ? this.panelSizes.aiChatWidth + 'px' : '0px'};
      }

      #root {
        padding: var(--safe-area-inset-top) var(--safe-area-inset-right) var(--safe-area-inset-bottom) var(--safe-area-inset-left);
        box-sizing: border-box;
      }

      .viewport-container {
        width: 100%;
        height: 100%;
        max-width: 100vw;
        max-height: 100vh;
        overflow: hidden;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        background: rgb(17 24 39);
        border: 1px solid rgb(75 85 99);
      }

      .ide-container {
        display: grid;
        grid-template-columns: 
          var(--sidebar-width) 
          4px 
          1fr 
          ${this.state.aiChatVisible ? '4px var(--chat-width)' : ''};
        grid-template-rows: var(--header-height) 1fr var(--status-height);
        grid-template-areas: 
          "header header header${this.state.aiChatVisible ? ' header header' : ''}"
          "sidebar h-sidebar main${this.state.aiChatVisible ? ' h-chat chat' : ''}"
          "status status status${this.state.aiChatVisible ? ' status status' : ''}";
        height: 100%;
        width: 100%;
        min-height: 300px;
        min-width: 600px;
        overflow: hidden;
      }
      
      .header-area { 
        grid-area: header; 
        z-index: 10;
        background: rgb(31 41 55);
        border-bottom: 1px solid rgb(75 85 99);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        min-height: var(--header-height);
      }
      
      .sidebar-area { 
        grid-area: sidebar; 
        min-width: 200px;
        max-width: 500px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: rgb(31 41 55);
        border-right: 1px solid rgb(75 85 99);
      }
      
      .sidebar-header {
        height: 32px;
        padding: 0 12px;
        background: rgb(55 65 81);
        border-bottom: 1px solid rgb(75 85 99);
        display: flex;
        align-items: center;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: rgb(209 213 219);
        flex-shrink: 0;
        position: sticky;
        top: 0;
        z-index: 2;
      }
      
      .sidebar-content {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 4px 0;
        min-height: 0;
      }
      
      .handle-sidebar { 
        grid-area: h-sidebar; 
        background: rgb(55 65 81);
        cursor: col-resize;
        transition: background-color 0.2s;
        user-select: none;
        z-index: 5;
        min-width: 4px;
        width: 4px;
      }
      .handle-sidebar:hover { 
        background: rgb(59 130 246); 
      }
      
      .main-area { 
        grid-area: main; 
        min-width: 0; 
        display: flex; 
        flex-direction: column;
        overflow: hidden;
        background: rgb(17 24 39);
        position: relative;
      }
      
      .main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
      }
      
      .tab-bar {
        height: 36px;
        background: rgb(55 65 81);
        border-bottom: 1px solid rgb(75 85 99);
        display: flex;
        align-items: center;
        padding: 0 8px;
        flex-shrink: 0;
        overflow-x: auto;
        overflow-y: hidden;
      }
      
      .editor-wrapper {
        flex: 1;
        background: rgb(17 24 39);
        min-height: 0;
        overflow: hidden;
        position: relative;
      }
      
      .terminal-section {
        display: ${this.state.terminalVisible ? 'flex' : 'none'};
        flex-direction: column;
        background: rgb(31 41 55);
        border-top: 1px solid rgb(75 85 99);
        min-height: 0;
        overflow: hidden;
        transition: height 0.2s ease-out;
        height: ${this.state.terminalVisible ? (this.terminalCollapsed ? '32px' : `${this.panelSizes.terminalHeight}px`) : '0px'};
        flex-shrink: 0;
      }
      
      .terminal-header {
        height: 32px;
        flex-shrink: 0;
        border-bottom: ${this.terminalCollapsed ? 'none' : '1px solid rgb(75 85 99)'};
        background: rgb(31 41 55);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 8px;
      }
      
      .terminal-resize-handle {
        height: 4px;
        background: rgb(55 65 81);
        cursor: row-resize;
        transition: background-color 0.2s;
        user-select: none;
        flex-shrink: 0;
        z-index: 5;
        display: ${this.terminalCollapsed ? 'none' : 'block'};
      }
      
      .terminal-resize-handle:hover {
        background: rgb(59 130 246);
      }
      
      .terminal-output {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 12px;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.4;
        background: rgb(17 24 39);
        color: rgb(229 231 235);
        display: ${this.terminalCollapsed ? 'none' : 'block'};
      }
      
      .terminal-output::-webkit-scrollbar {
        width: 8px;
      }
      
      .terminal-output::-webkit-scrollbar-track {
        background: rgb(31 41 55);
      }
      
      .terminal-output::-webkit-scrollbar-thumb {
        background: rgb(75 85 99);
        border-radius: 4px;
      }
      
      .terminal-output::-webkit-scrollbar-thumb:hover {
        background: rgb(107 114 128);
      }
      
      .handle-chat { 
        grid-area: h-chat; 
        background: rgb(55 65 81);
        cursor: col-resize;
        transition: background-color 0.2s;
        user-select: none;
        z-index: 5;
        min-width: 4px;
        width: 4px;
      }
      .handle-chat:hover { 
        background: rgb(59 130 246); 
      }
      
      .chat-area { 
        grid-area: chat; 
        min-width: 280px;
        max-width: 600px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: rgb(31 41 55);
        border-left: 1px solid rgb(75 85 99);
      }
      
      .chat-header {
        height: 40px;
        padding: 0 12px;
        background: rgb(55 65 81);
        border-bottom: 1px solid rgb(75 85 99);
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }
      
      .chat-content {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 0;
        padding: 16px;
      }
      
      .status-area { 
        grid-area: status; 
        z-index: 10;
        background: rgb(37 99 235);
        color: white;
        font-size: 11px;
        display: flex;
        align-items: center;
        padding: 0 12px;
        border-top: 1px solid rgb(75 85 99);
        min-height: var(--status-height);
      }
      
      .panel-toggle-btn {
        transition: all 0.2s ease;
        background: rgb(31 41 55);
        border: 1px solid rgb(75 85 99);
        color: rgb(209 213 219);
        cursor: pointer;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
      }
      
      .panel-toggle-btn:hover {
        background: rgb(75 85 99);
        transform: translateY(-1px);
      }
      
      .panel-toggle-btn.active {
        background: rgb(59 130 246);
        border-color: rgb(59 130 246);
        color: white;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
      }
      
      .terminal-controls {
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      
      .terminal-section:hover .terminal-controls,
      .terminal-controls:hover {
        opacity: 1;
      }
      
      .terminal-tabs {
        display: flex;
        align-items: center;
        gap: 4px;
        flex: 1;
        overflow-x: auto;
        overflow-y: hidden;
      }
      
      @media (max-width: 1200px) {
        :root {
          --sidebar-width: 250px;
        }
      }
      
      @media (max-width: 900px) {
        :root {
          --sidebar-width: 200px;
          --chat-width: 0px;
        }
      }
      
      @media (max-width: 768px) {
        :root {
          --sidebar-width: 180px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  private getLayoutHTML(): string {
    return `
      <div class="viewport-container">
        <div class="ide-container">
          <!-- Header -->
          <div class="header-area">
            <div class="flex items-center gap-2">
              <div class="text-sm font-semibold text-gray-300">LookOverlay IDE</div>
            </div>
            
            <div class="flex items-center gap-2">
              <button 
                id="terminal-toggle-btn" 
                class="panel-toggle-btn px-3 py-1 text-xs rounded ${this.state.terminalVisible ? 'active' : ''}"
                onclick="window.layoutManager?.toggleTerminal()"
              >
                Terminal
              </button>
              <button 
                id="chat-toggle-btn" 
                class="panel-toggle-btn px-3 py-1 text-xs rounded ${this.state.aiChatVisible ? 'active' : ''}"
                onclick="window.layoutManager?.toggleAIChat()"
              >
                AI Chat
              </button>
              <button 
                class="panel-toggle-btn px-3 py-1 text-xs rounded"
                onclick="window.layoutManager?.resetLayout()"
              >
                Reset
              </button>
            </div>
          </div>

          <!-- Sidebar -->
          <div class="sidebar-area">
            <div class="sidebar-header">
              Explorer
            </div>
            <div class="sidebar-content" id="file-tree">
              <!-- File tree content will be populated here -->
            </div>
          </div>

          <!-- Sidebar Handle -->
          <div class="handle-sidebar" data-panel="sidebar"></div>

          <!-- Main Content -->
          <div class="main-area">
            <div class="main-content">
              <!-- Tab Bar -->
              <div class="tab-bar">
                <!-- Tabs will be populated here -->
              </div>

              <!-- Editor -->
              <div class="editor-wrapper" id="editor-wrapper">
                <div id="editor-container" class="w-full h-full"></div>
              </div>
            </div>

            <!-- Terminal Section -->
            <div class="terminal-section">
              <!-- Terminal Header -->
              <div class="terminal-header">
                <div class="terminal-tabs">
                  <!-- Terminal tabs will be populated here -->
                </div>
                
                <div class="flex items-center gap-1 terminal-controls">
                  <button class="px-2 py-1 text-xs hover:bg-gray-600 rounded transition-colors" 
                          onclick="window.layoutManager?.toggleTerminalCollapse()" 
                          title="Collapse/Expand">
                    ${this.terminalCollapsed ? '▲' : '▼'}
                  </button>
                  <button class="px-2 py-1 text-xs hover:bg-gray-600 rounded transition-colors" 
                          onclick="window.layoutManager?.maximizeTerminal()" 
                          title="Maximize">
                    ⛶
                  </button>
                  <button class="px-2 py-1 text-xs hover:bg-gray-600 rounded transition-colors" 
                          onclick="window.layoutManager?.hideTerminal()" 
                          title="Close">
                    ×
                  </button>
                </div>
              </div>
              
              <!-- Terminal Resize Handle -->
              <div class="terminal-resize-handle" data-panel="terminal"></div>
              
              <!-- Terminal Content -->
              <div class="terminal-output">
                <!-- Terminal content will be populated here -->
              </div>
            </div>
          </div>

          ${this.state.aiChatVisible ? `
          <!-- Chat Handle -->
          <div class="handle-chat" data-panel="ai-chat"></div>

          <!-- Chat Panel -->
          <div class="chat-area">
            <div class="chat-header">
              <div class="flex items-center gap-2 text-sm font-semibold text-gray-300">
                <span>🤖</span>
                AI Assistant
              </div>
              <div class="flex gap-1">
                <button class="px-2 py-1 text-xs border border-gray-600 rounded hover:bg-gray-600 transition-colors" 
                        onclick="window.layoutManager?.clearAIChat()">
                  Clear
                </button>
                <button class="px-2 py-1 text-xs border border-gray-600 rounded hover:bg-gray-600 transition-colors" 
                        onclick="window.layoutManager?.hideAIChat()">
                  ×
                </button>
              </div>
            </div>
            
            <div class="chat-content" id="ai-chat-content">
              <div class="text-sm text-gray-400">
                AI Assistant is ready to help!
              </div>
            </div>
          </div>
          ` : ''}

          <!-- Status Bar -->
          <div class="status-area">
            Ready
          </div>
        </div>
      </div>
    `;
  }

  private setupViewportObserver(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === document.body) {
          this.handleViewportResize();
        }
      }
    });

    this.resizeObserver.observe(document.body);

    window.addEventListener('resize', () => {
      this.handleViewportResize();
    });
  }

  private handleViewportResize(): void {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const safeWidth = viewportWidth - 32;
    const safeHeight = viewportHeight - 32;

    const maxTerminalHeight = Math.floor(safeHeight * 0.6);
    const minTerminalHeight = 100;

    if (this.panelSizes.terminalHeight > maxTerminalHeight) {
      this.panelSizes.terminalHeight = maxTerminalHeight;
      this.updatePanelSizes();
    } else if (this.panelSizes.terminalHeight < minTerminalHeight && this.state.terminalVisible) {
      this.panelSizes.terminalHeight = minTerminalHeight;
      this.updatePanelSizes();
    }

    const maxSidebarWidth = Math.floor(safeWidth * 0.4);
    if (this.panelSizes.sidebarWidth > maxSidebarWidth) {
      this.panelSizes.sidebarWidth = Math.max(200, maxSidebarWidth);
      this.updatePanelSizes();
    }

    const maxChatWidth = Math.floor(safeWidth * 0.35);
    if (this.panelSizes.aiChatWidth > maxChatWidth) {
      this.panelSizes.aiChatWidth = Math.max(280, maxChatWidth);
      this.updatePanelSizes();
    }

    if (safeWidth < 800 && this.state.aiChatVisible) {
      this.state.aiChatVisible = false;
      this.updatePanelVisibility();
    }

    this.updatePanelVisibility();
  }

  private setupResizeHandlers(): void {
    this.setupResize('sidebar', (delta) => {
      const viewportWidth = window.innerWidth;
      const maxWidth = Math.floor(viewportWidth * 0.4);
      const newWidth = Math.max(200, Math.min(maxWidth, this.panelSizes.sidebarWidth + delta));
      this.panelSizes.sidebarWidth = newWidth;
      this.updatePanelSizes();
    });

    this.setupResize('terminal', (delta) => {
      if (!this.terminalCollapsed && this.state.terminalVisible) {
        const viewportHeight = window.innerHeight;
        const maxHeight = Math.floor(viewportHeight * 0.6);
        const minHeight = 100;
        
        const newHeight = Math.max(minHeight, Math.min(maxHeight, this.panelSizes.terminalHeight - delta));
        this.panelSizes.terminalHeight = newHeight;
        this.updatePanelSizes();
      }
    });

    this.setupResize('ai-chat', (delta) => {
      const viewportWidth = window.innerWidth;
      const maxWidth = Math.floor(viewportWidth * 0.35);
      const newWidth = Math.max(280, Math.min(maxWidth, this.panelSizes.aiChatWidth - delta));
      this.panelSizes.aiChatWidth = newWidth;
      this.updatePanelSizes();
    });
  }

  private setupResize(panel: string, callback: (delta: number) => void): void {
    const handle = document.querySelector(`[data-panel="${panel}"]`) as HTMLElement;
    if (!handle) return;

    let isResizing = false;
    let startPos = 0;

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      isResizing = true;
      startPos = panel === 'terminal' ? e.clientY : e.clientX;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = panel === 'terminal' ? 'row-resize' : 'col-resize';

      handle.style.background = 'rgb(59 130 246)';

      const onMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        const currentPos = panel === 'terminal' ? e.clientY : e.clientX;
        const delta = currentPos - startPos;
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (panel === 'sidebar') {
          const maxWidth = Math.floor(viewportWidth * 0.4);
          const newWidth = this.panelSizes.sidebarWidth + delta;
          if (newWidth >= 200 && newWidth <= maxWidth) {
            callback(delta);
            startPos = currentPos;
          }
        } else if (panel === 'terminal') {
          const maxHeight = Math.floor(viewportHeight * 0.6);
          const newHeight = this.panelSizes.terminalHeight - delta;
          if (newHeight >= 100 && newHeight <= maxHeight) {
            callback(delta);
            startPos = currentPos;
          }
        } else if (panel === 'ai-chat') {
          const maxWidth = Math.floor(viewportWidth * 0.35);
          const newWidth = this.panelSizes.aiChatWidth - delta;
          if (newWidth >= 280 && newWidth <= maxWidth) {
            callback(delta);
            startPos = currentPos;
          }
        }
      };

      const onMouseUp = () => {
        isResizing = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        handle.style.background = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    });
  }

  private updatePanelSizes(): void {
    const root = document.querySelector('.ide-container') as HTMLElement;
    if (root) {
      document.documentElement.style.setProperty('--sidebar-width', `${this.panelSizes.sidebarWidth}px`);
      document.documentElement.style.setProperty('--chat-width', this.state.aiChatVisible ? `${this.panelSizes.aiChatWidth}px` : '0px');
    }
    this.triggerEditorResize();
  }

  private updatePanelVisibility(): void {
    const terminalSection = document.querySelector('.terminal-section') as HTMLElement;
    if (terminalSection) {
      terminalSection.style.display = this.state.terminalVisible ? 'flex' : 'none';
      
      const height = this.state.terminalVisible ? 
        (this.terminalCollapsed ? '32px' : `${this.panelSizes.terminalHeight}px`) : '0px';
      terminalSection.style.height = height;
      
      const resizeHandle = terminalSection.querySelector('.terminal-resize-handle') as HTMLElement;
      const output = terminalSection.querySelector('.terminal-output') as HTMLElement;
      const header = terminalSection.querySelector('.terminal-header') as HTMLElement;
      
      if (resizeHandle) {
        resizeHandle.style.display = this.terminalCollapsed ? 'none' : 'block';
      }
      if (output) {
        output.style.display = this.terminalCollapsed ? 'none' : 'block';
      }
      if (header) {
        header.style.borderBottom = this.terminalCollapsed ? 'none' : '1px solid rgb(75 85 99)';
      }
    }

    if (this.needsLayoutRebuild()) {
      this.rebuildLayout();
    }

    this.updateButtonStates();
    this.updatePanelSizes();
  }

  private needsLayoutRebuild(): boolean {
    const currentChatVisible = document.querySelector('.chat-area') !== null;
    return currentChatVisible !== this.state.aiChatVisible;
  }

  private rebuildLayout(): void {
    const root = document.getElementById('root');
    if (root) {
      const terminalContent = document.querySelector('.terminal-output')?.innerHTML || '';
      
      root.innerHTML = this.getLayoutHTML();
      this.injectLayoutStyles();
      this.setupResizeHandlers();
      
      const newTerminalOutput = document.querySelector('.terminal-output');
      if (newTerminalOutput && terminalContent) {
        newTerminalOutput.innerHTML = terminalContent;
      }
      
      const event = new CustomEvent('layout-rebuilt');
      document.dispatchEvent(event);
    }
  }

  private updateTerminalSize(): void {
    const terminal = document.querySelector('.terminal-section') as HTMLElement;
    if (terminal) {
      const height = this.state.terminalVisible ? 
        (this.terminalCollapsed ? '32px' : `${this.panelSizes.terminalHeight}px`) : '0px';
      terminal.style.height = height;
      
      const resizeHandle = terminal.querySelector('.terminal-resize-handle') as HTMLElement;
      const output = terminal.querySelector('.terminal-output') as HTMLElement;
      const header = terminal.querySelector('.terminal-header') as HTMLElement;
      
      if (resizeHandle) {
        resizeHandle.style.display = this.terminalCollapsed ? 'none' : 'block';
      }
      if (output) {
        output.style.display = this.terminalCollapsed ? 'none' : 'block';
      }
      if (header) {
        header.style.borderBottom = this.terminalCollapsed ? 'none' : '1px solid rgb(75 85 99)';
      }
    }
    
    this.triggerEditorResize();
  }

  private updateButtonStates(): void {
    const terminalBtn = document.getElementById('terminal-toggle-btn');
    const chatBtn = document.getElementById('chat-toggle-btn');
    
    if (terminalBtn) {
      terminalBtn.classList.toggle('active', this.state.terminalVisible);
    }
    if (chatBtn) {
      chatBtn.classList.toggle('active', this.state.aiChatVisible);
    }
  }

  private triggerEditorResize(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.state.monacoEditor?.layout) {
          this.state.monacoEditor.layout();
        }
      });
    });
  }

  // Public API
  toggleTerminal(): void {
    this.state.terminalVisible = !this.state.terminalVisible;
    
    if (this.state.terminalVisible && this.panelSizes.terminalHeight < 100) {
      this.panelSizes.terminalHeight = 250;
    }
    
    this.updatePanelVisibility();
    console.log('Terminal toggled:', this.state.terminalVisible);
  }

  showTerminal(): void {
    this.state.terminalVisible = true;
    this.terminalCollapsed = false;
    
    if (this.panelSizes.terminalHeight < 100) {
      this.panelSizes.terminalHeight = 250;
    }
    
    this.updatePanelVisibility();
  }

  hideTerminal(): void {
    this.state.terminalVisible = false;
    this.updatePanelVisibility();
  }

  toggleAIChat(): void {
    this.state.aiChatVisible = !this.state.aiChatVisible;
    this.updatePanelVisibility();
    console.log('AI Chat toggled:', this.state.aiChatVisible);
  }

  showAIChat(): void {
    this.state.aiChatVisible = true;
    this.updatePanelVisibility();
  }

  hideAIChat(): void {
    this.state.aiChatVisible = false;
    this.updatePanelVisibility();
  }

  toggleTerminalCollapse(): void {
    if (!this.state.terminalVisible) return;
    this.terminalCollapsed = !this.terminalCollapsed;
    this.updateTerminalSize();
    
    const button = document.querySelector('[onclick*="toggleTerminalCollapse"]') as HTMLElement;
    if (button) {
      button.innerHTML = this.terminalCollapsed ? '▲' : '▼';
    }
  }

  maximizeTerminal(): void {
    if (!this.state.terminalVisible) {
      this.showTerminal();
    }
    this.terminalCollapsed = false;
    this.panelSizes.terminalHeight = Math.min(600, Math.floor(window.innerHeight * 0.5));
    this.updateTerminalSize();
  }

  resetLayout(): void {
    this.panelSizes = {
      sidebarWidth: 280,
      terminalHeight: 250,
      aiChatWidth: 350
    };
    this.terminalCollapsed = false;
    this.updatePanelVisibility();
  }

  clearAIChat(): void {
    const content = document.getElementById('ai-chat-content');
    if (content) {
      content.innerHTML = '<div class="p-4 text-sm text-gray-400">AI Assistant is ready to help!</div>';
    }
  }

  exposeGlobally(): void {
    (window as any).layoutManager = this;
  }

  dispose(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    delete (window as any).layoutManager;
  }
}
