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

    // If showProjectSelector is true, show project selector instead of main layout
    if (this.state.showProjectSelector) {
      this.createProjectSelector();
      return;
    }

    // Preserve the current AI chat state before rebuilding
    const wasAIChatVisible = this.state.aiChatVisible;

    root.className = 'w-full h-screen bg-gray-900 text-gray-300 overflow-hidden p-2';
    root.innerHTML = this.getLayoutHTML();
    
    this.injectLayoutStyles();
    this.setupResizeHandlers();
    this.setupViewportObserver();
    this.isInitialized = true;
    
    // Restore AI chat state and apply the correct CSS class
    this.state.aiChatVisible = wasAIChatVisible;
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
        --chat-width: ${this.panelSizes.aiChatWidth}px;
      }

      /* Header Button Styles */
      .header-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        background: linear-gradient(135deg, rgb(45 55 72) 0%, rgb(55 65 81) 100%);
        border: 1px solid rgb(75 85 99);
        color: rgb(226 232 240);
        cursor: pointer;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(8px);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        overflow: hidden;
      }

      .header-btn:hover {
        background: linear-gradient(135deg, rgb(55 65 81) 0%, rgb(75 85 99) 100%);
        border-color: rgb(96 165 250);
        color: rgb(248 250 252);
        transform: translateY(-2px) scale(1.02);
        box-shadow: 0 4px 20px rgba(59, 130, 246, 0.25), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2);
      }

      .header-btn:active {
        transform: translateY(0) scale(0.98);
      }

      .header-btn.active {
        background: linear-gradient(135deg, rgb(59 130 246) 0%, rgb(37 99 235) 100%);
        border-color: rgb(59 130 246);
        color: white;
        box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4), 0 2px 8px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -1px 0 rgba(0, 0, 0, 0.1);
        transform: translateY(-1px);
      }

      /* Terminal Control Button Styles */
      .terminal-control-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 4px 8px;
        background: transparent;
        border: 1px solid rgb(75 85 99);
        color: rgb(156 163 175);
        cursor: pointer;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.2s;
        min-width: 24px;
        height: 24px;
      }

      .terminal-control-btn:hover {
        background: rgb(55 65 81);
        border-color: rgb(96 165 250);
        color: rgb(226 232 240);
      }

      /* Chat Control Button Styles */
      .chat-control-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 4px 8px;
        background: transparent;
        border: 1px solid rgb(75 85 99);
        color: rgb(156 163 175);
        cursor: pointer;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.2s;
      }

      .chat-control-btn:hover {
        background: rgb(55 65 81);
        border-color: rgb(96 165 250);
        color: rgb(226 232 240);
      }

      /* Project Selector Styles */
      .project-selector-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      }

      .project-selector-modal {
        background-color: #252526;
        border-radius: 8px;
        width: 600px;
        max-width: 90vw;
        max-height: 80vh;
        overflow: hidden;
        border: 1px solid #3c3c3c;
      }

      .project-selector-header {
        background-color: #2d2d30;
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #3c3c3c;
      }

      .project-selector-header h2 {
        margin: 0;
        color: #cccccc;
        font-size: 18px;
        font-weight: 600;
      }

      .close-button {
        background: transparent;
        border: none;
        color: #cccccc;
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
      }

      .close-button:hover {
        color: #ffffff;
      }

      .project-selector-content {
        padding: 20px;
      }

      .project-actions {
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
      }

      .project-action-btn {
        flex: 1;
        padding: 12px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background-color 0.2s;
      }

      .project-action-btn.primary {
        background-color: #0e639c;
        color: white;
      }

      .project-action-btn.primary:hover {
        background-color: #1177bb;
      }

      .project-action-btn.secondary {
        background-color: #3c3c3c;
        color: #cccccc;
        border: 1px solid #555;
      }

      .project-action-btn.secondary:hover {
        background-color: #4c4c4c;
      }

      .recent-projects h3 {
        margin: 0 0 16px 0;
        color: #cccccc;
        font-size: 16px;
        font-weight: 600;
      }

      .project-list {
        max-height: 300px;
        overflow-y: auto;
      }

      .project-item {
        background-color: #1e1e1e;
        border: 1px solid #3c3c3c;
        border-radius: 6px;
        padding: 16px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .project-item:hover {
        background-color: #2d2d30;
        border-color: #0e639c;
      }

      .project-name {
        font-size: 16px;
        font-weight: 600;
        color: #ffffff;
        margin-bottom: 4px;
      }

      .project-path {
        font-size: 13px;
        color: #569cd6;
        margin-bottom: 4px;
        font-family: 'Consolas', monospace;
      }

      .project-last-opened {
        font-size: 12px;
        color: #888;
      }

      .loading,
      .no-recent-projects {
        text-align: center;
        color: #888;
        padding: 20px;
      }

      .no-recent-projects p {
        margin: 0;
      }

      /* Main Layout Styles - FLEXBOX APPROACH */
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
        display: flex;
        flex-direction: column;
      }

      .ide-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        min-height: 300px;
        min-width: 600px;
        overflow: hidden;
      }
      
      .header-area { 
        height: var(--header-height);
        background: rgb(31 41 55);
        border-bottom: 1px solid rgb(75 85 99);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        flex-shrink: 0;
        z-index: 10;
      }

      .content-area {
        flex: 1;
        display: flex;
        min-height: 0;
        overflow: hidden;
      }
      
      .sidebar-area { 
        width: var(--sidebar-width);
        min-width: 200px;
        max-width: 500px;
        display: flex;
        flex-direction: column;
        background: rgb(31 41 55);
        border-right: 1px solid rgb(75 85 99);
        flex-shrink: 0;
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
      }
      
      .sidebar-content {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 4px 8px;
        min-height: 0;
      }
      
      .handle-sidebar { 
        width: 4px;
        background: rgb(55 65 81);
        cursor: col-resize;
        transition: background-color 0.2s;
        user-select: none;
        flex-shrink: 0;
      }
      .handle-sidebar:hover { 
        background: rgb(59 130 246); 
      }
      
      .main-area { 
        flex: 1;
        display: flex; 
        flex-direction: column;
        overflow: hidden;
        background: rgb(17 24 39);
        min-width: 0;
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
        height: ${this.state.terminalVisible ? (this.terminalCollapsed ? '32px' : `${this.panelSizes.terminalHeight}px`) : '0px'};
        flex-shrink: 0;
        overflow: hidden;
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
      
      .terminal-tabs {
        display: flex;
        align-items: center;
        gap: 4px;
        flex: 1;
      }
      
      .terminal-output {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.4;
        background: #1e1e1e;
        color: #cccccc;
        display: ${this.terminalCollapsed ? 'none' : 'flex'};
        flex-direction: column;
      }

      .terminal-content {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
      }

      .terminal-scroll-content {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 8px 12px;
        min-height: 0;
      }

      .terminal-output-text {
        margin: 0;
        padding: 0;
        white-space: pre-wrap;
        word-wrap: break-word;
        font-family: inherit;
        font-size: inherit;
        line-height: inherit;
        color: inherit;
      }

      .terminal-input-section {
        border-top: 1px solid #333333;
        background: #1e1e1e;
        padding: 8px 12px;
        flex-shrink: 0;
      }

      .terminal-input-line {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .terminal-current-prompt {
        flex-shrink: 0;
        font-family: inherit;
        white-space: pre;
      }

      .terminal-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #cccccc;
        font-family: inherit;
        font-size: inherit;
        line-height: inherit;
        padding: 0;
        margin: 0;
      }

      .terminal-input::placeholder {
        color: #666666;
      }

      /* Terminal Tab Styles */
      .terminal-tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        color: #cccccc;
        transition: all 0.2s;
      }

      .terminal-tab:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .terminal-tab.active {
        background: rgba(59, 130, 246, 0.2);
        border-color: rgba(59, 130, 246, 0.4);
        color: #ffffff;
      }

      .terminal-tab-icon {
        font-size: 10px;
      }

      .terminal-tab-name {
        font-weight: 500;
      }

      .terminal-tab-close {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 2px;
        font-size: 12px;
        opacity: 0.7;
        transition: all 0.2s;
      }

      .terminal-tab-close:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.1);
      }

      .terminal-new-tab {
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.3);
        color: #60a5fa;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.2s;
      }

      .terminal-new-tab:hover {
        background: rgba(59, 130, 246, 0.2);
        border-color: rgba(59, 130, 246, 0.4);
      }

      /* ANSI Color Classes */
      .terminal-output-text .bold { font-weight: bold; }
      .terminal-output-text .dim { opacity: 0.7; }
      .terminal-output-text .black { color: #000000; }
      .terminal-output-text .red { color: #cd3131; }
      .terminal-output-text .green { color: #00bc00; }
      .terminal-output-text .yellow { color: #e5e510; }
      .terminal-output-text .blue { color: #2472c8; }
      .terminal-output-text .magenta { color: #bc05bc; }
      .terminal-output-text .cyan { color: #0598bc; }
      .terminal-output-text .white { color: #e5e5e5; }
      .terminal-output-text .bold.red { color: #f14c4c; }
      .terminal-output-text .bold.green { color: #23d18b; }
      .terminal-output-text .bold.yellow { color: #f5f543; }
      .terminal-output-text .bold.blue { color: #3b8eea; }
      .terminal-output-text .bold.magenta { color: #d670d6; }
      .terminal-output-text .bold.cyan { color: #29b8db; }
      .terminal-output-text .bold.white { color: #ffffff; }

      /* Chat Panel Styles - Class-based visibility */
      .handle-chat { 
        width: 4px;
        background: rgb(55 65 81);
        cursor: col-resize;
        transition: background-color 0.2s ease;
        user-select: none;
        flex-shrink: 0;
        display: none;
      }

      /* Show chat handle when chat is visible */
      .ide-container.chat-visible .handle-chat {
        display: block;
      }

      .handle-chat:hover { 
        background: rgb(59 130 246); 
      }
      
      .chat-area { 
        width: 0px;
        min-width: 0px;
        max-width: 600px;
        overflow: hidden;
        display: none;
        flex-direction: column;
        background: rgb(31 41 55);
        border-left: 1px solid rgb(75 85 99);
        flex-shrink: 0;
        transition: width 0.3s ease, min-width 0.3s ease;
      }

      /* Show chat area when chat is visible */
      .ide-container.chat-visible .chat-area {
        display: flex;
        width: var(--chat-width);
        min-width: 280px;
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
        overflow-y: auto;
        overflow-x: hidden;
        padding: 12px;
        min-height: 0;
      }

      .status-area { 
        height: var(--status-height);
        background: rgb(55 65 81);
        border-top: 1px solid rgb(75 85 99);
        display: flex;
        align-items: center;
        padding: 0 12px;
        font-size: 12px;
        color: rgb(209 213 219);
        flex-shrink: 0;
      }

      /* File Tree Styles */
      .file-tree-wrapper {
        display: flex;
        flex-direction: column;
        width: 100%;
      }

      .file-item {
        display: block;
        width: 100%;
        border-radius: 4px;
        margin-bottom: 1px;
        transition: background-color 0.15s;
      }

      .file-item:hover {
        background-color: rgba(55, 65, 81, 0.6);
      }

      .expansion-arrow {
        font-size: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 12px;
        height: 12px;
        user-select: none;
      }

      .file-name {
        font-size: 13px;
        line-height: 1.2;
      }

      /* Scrollbar */
      .chat-messages::-webkit-scrollbar {
        width: 6px;
      }

      .chat-messages::-webkit-scrollbar-track {
        background: transparent;
      }

      .chat-messages::-webkit-scrollbar-thumb {
        background: #404040;
        border-radius: 3px;
      }

      .chat-messages::-webkit-scrollbar-thumb:hover {
        background: #525252;
      }

      /* Responsive */
      @media (max-width: 400px) {
        .input-container {
          padding: 0.75rem;
        }
        
        .api-key-setup {
          padding: 1rem;
        }
        
        .api-key-content h3 {
          font-size: 1.1rem;
        }
        
        .api-key-content p {
          font-size: 0.75rem;
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
            <div class="flex items-center">
              <span class="text-lg font-bold text-gray-200">Satellite Ai</span>
            </div>
            
            <div class="flex items-center gap-3">
              <button 
                id="terminal-toggle-btn"
                onclick="window.layoutManager?.toggleTerminal()"
                style="position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: linear-gradient(135deg, rgb(45 55 72) 0%, rgb(55 65 81) 100%); border: 1px solid rgb(75 85 99); color: rgb(226 232 240); cursor: pointer; border-radius: 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); backdrop-filter: blur(8px); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.1); overflow: hidden;"
              >
                Terminal 💻
              </button>
              <button 
                id="chat-toggle-btn"
                onclick="window.layoutManager?.toggleAIChat()"
                style="position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: linear-gradient(135deg, rgb(45 55 72) 0%, rgb(55 65 81) 100%); border: 1px solid rgb(75 85 99); color: rgb(226 232 240); cursor: pointer; border-radius: 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); backdrop-filter: blur(8px); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.1); overflow: hidden;"
              >
                AI Chat 🤖
              </button>
              <button 
                onclick="window.layoutManager?.resetLayout()"
                style="position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: linear-gradient(135deg, rgb(45 55 72) 0%, rgb(55 65 81) 100%); border: 1px solid rgb(75 85 99); color: rgb(226 232 240); cursor: pointer; border-radius: 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); backdrop-filter: blur(8px); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.1); overflow: hidden;"
              >
                Reset 🔄
              </button>
            </div>
          </div>

          <!-- Content Area (Sidebar + Main + Chat) -->
          <div class="content-area">
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
                <div class="terminal-header">
                  <div class="terminal-tabs">
                    <!-- Terminal tabs will be populated here -->
                  </div>
                  
                  <div class="flex items-center gap-1 terminal-controls">
                    <button class="terminal-control-btn" 
                            onclick="window.layoutManager?.toggleTerminalCollapse()" 
                            title="Collapse/Expand">
                      ${this.terminalCollapsed ? '▲' : '▼'}
                    </button>
                    <button class="terminal-control-btn" 
                            onclick="window.layoutManager?.maximizeTerminal()" 
                            title="Maximize">
                      ⛶
                    </button>
                    <button class="terminal-control-btn" 
                            onclick="window.layoutManager?.hideTerminal()" 
                            title="Close">
                      ×
                    </button>
                  </div>
                </div>
                
                <!-- Terminal Content -->
                <div class="terminal-output">
                  <!-- Terminal content will be populated here -->
                </div>
              </div>
            </div>

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
                  <button class="chat-control-btn" 
                          onclick="window.layoutManager?.clearAIChat()">
                    Clear
                  </button>
                  <button class="chat-control-btn" 
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
          </div>

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
      document.documentElement.style.setProperty('--chat-width', `${this.panelSizes.aiChatWidth}px`);
    }
    this.triggerEditorResize();
  }

  public updatePanelVisibility(): void {
    if (!this.isInitialized) return;

    // Use simple class-based approach
    const ideContainer = document.querySelector('.ide-container') as HTMLElement;
    if (!ideContainer) return;

    if (this.state.aiChatVisible) {
      ideContainer.classList.add('chat-visible');
      ideContainer.classList.remove('chat-hidden');
      
      // Ensure chat manager is ready when panel opens
      this.initializeChatWhenReady();
    } else {
      ideContainer.classList.add('chat-hidden');
      ideContainer.classList.remove('chat-visible');
    }

    // Update CSS custom properties for sizing
    const root = document.documentElement;
    root.style.setProperty('--sidebar-width', `${this.panelSizes.sidebarWidth}px`);
    root.style.setProperty('--chat-width', `${this.panelSizes.aiChatWidth}px`);

    this.updateButtonStates();
    this.triggerEditorResize();
  }

  private initializeChatWhenReady(): void {
    // More reliable approach using multiple checks
    let attempts = 0;
    const maxAttempts = 10;
    
    const checkAndInit = () => {
      attempts++;
      const chatContent = document.getElementById('ai-chat-content');
      const chatManager = (window as any).chatManager;
      
      if (!chatContent || !chatManager) {
        if (attempts < maxAttempts) {
          setTimeout(checkAndInit, 100);
        }
        return;
      }

      // Always reinitialize to ensure fresh state
      console.log('🔧 Initializing chat manager for panel open...');
      chatManager.initialize();
    };
    
    // Start checking immediately
    setTimeout(checkAndInit, 50);
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
      if (this.state.terminalVisible) {
        terminalBtn.classList.add('active');
        terminalBtn.style.background = 'linear-gradient(135deg, rgb(59 130 246) 0%, rgb(37 99 235) 100%)';
        terminalBtn.style.borderColor = 'rgb(59 130 246)';
        terminalBtn.style.color = 'white';
      } else {
        terminalBtn.classList.remove('active');
        terminalBtn.style.background = 'linear-gradient(135deg, rgb(45 55 72) 0%, rgb(55 65 81) 100%)';
        terminalBtn.style.borderColor = 'rgb(75 85 99)';
        terminalBtn.style.color = 'rgb(226 232 240)';
      }
    }
    
    if (chatBtn) {
      if (this.state.aiChatVisible) {
        chatBtn.classList.add('active');
        chatBtn.style.background = 'linear-gradient(135deg, rgb(59 130 246) 0%, rgb(37 99 235) 100%)';
        chatBtn.style.borderColor = 'rgb(59 130 246)';
        chatBtn.style.color = 'white';
      } else {
        chatBtn.classList.remove('active');
        chatBtn.style.background = 'linear-gradient(135deg, rgb(45 55 72) 0%, rgb(55 65 81) 100%)';
        chatBtn.style.borderColor = 'rgb(75 85 99)';
        chatBtn.style.color = 'rgb(226 232 240)';
      }
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
    
    this.injectLayoutStyles(); // Re-inject styles with new state
    console.log('Terminal toggled:', this.state.terminalVisible);
  }

  showTerminal(): void {
    this.state.terminalVisible = true;
    this.terminalCollapsed = false;
    
    if (this.panelSizes.terminalHeight < 100) {
      this.panelSizes.terminalHeight = 250;
    }
    
    // Rebuild the layout to apply the new CSS
    this.rebuildLayout();
  }

  hideTerminal(): void {
    this.state.terminalVisible = false;
    // Rebuild the layout to apply the new CSS
    this.rebuildLayout();
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
    
    // Update the button content
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
    // Rebuild the layout to apply the new CSS
    this.rebuildLayout();
  }

  clearAIChat(): void {
    const chatManager = (window as any).chatManager;
    if (chatManager) {
      console.log('🔧 Clearing chat via layout manager');
      chatManager.clearChat();
    } else {
      console.error('❌ ChatManager not available for clearing');
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

  private createProjectSelector(): void {
    const root = document.getElementById('root');
    if (!root) return;

    // Inject styles first
    this.injectLayoutStyles();

    root.innerHTML = `
      <div class="project-selector-overlay">
        <div class="project-selector-modal">
          <div class="project-selector-header">
            <h2>Select Project</h2>
            <button class="close-button" onclick="window.layoutManager?.hideProjectSelector()">✕</button>
          </div>
          
          <div class="project-selector-content">
            <div class="project-actions">
              <button 
                class="project-action-btn primary"
                onclick="window.layoutManager?.browseForProject()"
              >
                📁 Browse for Project
              </button>
              <button 
                class="project-action-btn secondary"
                onclick="window.layoutManager?.useCurrentDirectory()"
              >
                📂 Use Current Directory
              </button>
            </div>

            <div id="recent-projects-section">
              <div class="loading">Loading recent projects...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.loadRecentProjects();
  }

  private async loadRecentProjects(): Promise<void> {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI) return;

      const projects = await electronAPI.getRecentProjects();
      const section = document.getElementById('recent-projects-section');
      if (!section) return;

      if (projects.length > 0) {
        section.innerHTML = `
          <div class="recent-projects">
            <h3>Recent Projects</h3>
            <div class="project-list">
              ${projects.map((project: any, index: number) => `
                <div class="project-item" onclick="window.layoutManager?.selectProject('${project.path}')">
                  <div class="project-info">
                    <div class="project-name">${project.name}</div>
                    <div class="project-path">${project.path}</div>
                    <div class="project-last-opened">
                      Last opened: ${new Date(project.lastOpened).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        section.innerHTML = `
          <div class="no-recent-projects">
            <p>No recent projects found. Use the buttons above to select a project.</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading recent projects:', error);
      const section = document.getElementById('recent-projects-section');
      if (section) {
        section.innerHTML = `
          <div class="no-recent-projects">
            <p>No recent projects found. Use the buttons above to select a project.</p>
          </div>
        `;
      }
    }
  }

  async browseForProject(): Promise<void> {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI) return;

      const selectedPath = await electronAPI.selectProjectDirectory();
      if (selectedPath) {
        await this.selectProject(selectedPath);
      }
    } catch (error) {
      console.error('Error browsing for project:', error);
    }
  }

  async useCurrentDirectory(): Promise<void> {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI) return;

      const currentDir = await electronAPI.getCurrentDirectory();
      if (currentDir) {
        await this.selectProject(currentDir);
      }
    } catch (error) {
      console.error('Error getting current directory:', error);
    }
  }

  async selectProject(projectPath: string): Promise<void> {
    try {
      console.log('🔧 selectProject called with:', projectPath);
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI) {
        console.error('❌ ElectronAPI not available');
        return;
      }

      // Set the current directory
      const result = await electronAPI.setCurrentDirectory(projectPath);
      if (result.success) {
        // Save to recent projects
        await electronAPI.saveRecentProject(projectPath);
        
        // Update state
        this.state.currentWorkingDirectory = projectPath;
        this.state.showProjectSelector = false;
        
        console.log('🔧 Creating main layout...');
        // Create the main layout
        this.createLayout();
        
        // Check if app is available
        const app = (window as any).app;
        console.log('🔧 Window.app available:', !!app);
        
        if (app) {
          console.log('🔧 Triggering full app initialization after project selection...');
          try {
            await app.initializeModules();
            console.log('✅ Modules initialized successfully');
          } catch (error) {
            console.error('❌ Error initializing modules:', error);
          }
        } else {
          console.error('❌ App not found on window object');
        }
        
        console.log('Project selected:', projectPath);
      } else {
        console.error('Failed to set project directory:', result.error);
        alert('Failed to set project directory: ' + result.error);
      }
    } catch (error) {
      console.error('Error selecting project:', error);
      alert('Error selecting project: ' + error);
    }
  }

  hideProjectSelector(): void {
    this.state.showProjectSelector = false;
    this.createLayout();
  }

  showProjectSelector(): void {
    this.state.showProjectSelector = true;
    this.createProjectSelector();
  }
}
