import { AppState } from '../types';

export class LayoutManager {
  private state: AppState;

  constructor(state: AppState) {
    this.state = state;
  }

  createLayout(): void {
    const root = document.getElementById('root');
    if (!root) return;

    root.className = 'w-full h-full flex flex-row bg-gray-900 text-gray-300';
    root.innerHTML = this.getLayoutHTML();
    
    this.setupResizeHandlers();
  }

  private getLayoutHTML(): string {
    return `
      <!-- Sidebar -->
      <div class="w-64 bg-gray-800 border-r border-gray-700 flex flex-col sidebar">
        <!-- Sidebar Header -->
        <div class="px-3 py-2 bg-gray-700 border-b border-gray-600 text-xs font-semibold uppercase text-gray-300">
          Explorer
        </div>
        
        <!-- File Tree -->
        <div class="flex-1 py-1 overflow-y-auto overflow-x-hidden scrollbar-thin" id="file-tree">
        </div>
      </div>

      <!-- Resize Handle -->
      <div class="w-1 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors resize-handle"></div>

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col">
        <!-- Tab Bar -->
        <div class="h-9 bg-gray-700 border-b border-gray-600 flex items-center px-2 tab-bar">
        </div>

        <!-- Editor Area -->
        <div class="flex-1 bg-gray-900 editor-area">
          <div id="editor-container" class="w-full h-full"></div>
        </div>

        <!-- Terminal Container -->
        <div class="terminal-container hidden bg-gray-800 border-t border-gray-600" style="height: 200px;">
          <!-- Terminal Resize Handle -->
          <div class="h-1 bg-gray-700 hover:bg-blue-500 cursor-row-resize transition-colors terminal-resize-handle"></div>
          
          <!-- Terminal Tabs -->
          <div class="h-8 bg-gray-800 border-b border-gray-600 flex items-center terminal-tabs">
          </div>
          
          <!-- Terminal Output -->
          <div class="flex-1 p-3 overflow-y-auto font-mono text-sm scrollbar-thin terminal-output" style="height: calc(100% - 36px);">
          </div>
        </div>
      </div>

      <!-- AI Chat Panel -->
      <div class="ai-chat-container w-80 bg-gray-800 border-l border-gray-700 hidden">
        <div class="flex flex-col h-full">
          <!-- AI Chat Header -->
          <div class="px-3 py-2 bg-gray-700 border-b border-gray-600 flex justify-between items-center">
            <div class="flex items-center gap-2 text-sm font-semibold text-gray-300">
              <span class="text-base">🤖</span>
              AI Assistant
            </div>
            <div class="flex gap-1">
              <button class="px-2 py-1 text-xs border border-gray-600 rounded hover:bg-gray-600 transition-colors" onclick="clearAIChat()">
                Clear
              </button>
              <button class="px-2 py-1 text-xs border border-gray-600 rounded hover:bg-gray-600 transition-colors" onclick="toggleAIChat()">
                ×
              </button>
            </div>
          </div>
          
          <!-- AI Chat Content -->
          <div class="flex-1 flex flex-col" id="ai-chat-content">
          </div>
        </div>
      </div>

      <!-- Status Bar -->
      <div class="fixed bottom-0 left-0 right-0 h-6 bg-blue-600 text-white text-xs flex items-center px-3 status-bar z-50">
        Ready
      </div>
    `;
  }

  private setupResizeHandlers(): void {
    this.setupSidebarResize();
    this.setupAIChatResize();
  }

  private setupSidebarResize(): void {
    const resizeHandle = document.querySelector('.resize-handle') as HTMLElement;
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    let isResizing = false;

    if (resizeHandle && sidebar) {
      resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      });
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !sidebar) return;
      
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 600) {
        sidebar.style.width = `${newWidth}px`;
      }
    };

    const handleMouseUp = () => {
      isResizing = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }

  private setupAIChatResize(): void {
    const aiChatContainer = document.querySelector('.ai-chat-container') as HTMLElement;
    let isResizing = false;

    if (aiChatContainer) {
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'w-1 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors absolute left-0 top-0 h-full';
      aiChatContainer.style.position = 'relative';
      aiChatContainer.appendChild(resizeHandle);

      resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      });
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !aiChatContainer) return;
      
      const containerRect = aiChatContainer.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      
      if (newWidth >= 300 && newWidth <= 600) {
        aiChatContainer.style.width = `${newWidth}px`;
      }
    };

    const handleMouseUp = () => {
      isResizing = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }

  showAIChat(): void {
    const aiChatContainer = document.querySelector('.ai-chat-container') as HTMLElement;
    if (aiChatContainer) {
      aiChatContainer.classList.remove('hidden');
      aiChatContainer.classList.add('flex');
    }
  }

  hideAIChat(): void {
    const aiChatContainer = document.querySelector('.ai-chat-container') as HTMLElement;
    if (aiChatContainer) {
      aiChatContainer.classList.add('hidden');
      aiChatContainer.classList.remove('flex');
    }
  }

  toggleAIChat(): void {
    const aiChatContainer = document.querySelector('.ai-chat-container') as HTMLElement;
    if (aiChatContainer) {
      if (aiChatContainer.classList.contains('hidden')) {
        this.showAIChat();
      } else {
        this.hideAIChat();
      }
    }
  }

  showTerminal(): void {
    const terminalContainer = document.querySelector('.terminal-container') as HTMLElement;
    if (terminalContainer) {
      terminalContainer.classList.remove('hidden');
      terminalContainer.classList.add('flex', 'flex-col');
      this.state.terminalVisible = true;
    }
  }

  hideTerminal(): void {
    const terminalContainer = document.querySelector('.terminal-container') as HTMLElement;
    if (terminalContainer) {
      terminalContainer.classList.add('hidden');
      terminalContainer.classList.remove('flex', 'flex-col');
      this.state.terminalVisible = false;
    }
  }

  toggleTerminal(): void {
    if (this.state.terminalVisible) {
      this.hideTerminal();
    } else {
      this.showTerminal();
    }
  }
}
