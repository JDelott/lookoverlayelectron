import { AppState } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    codeContext?: string;
    filePath?: string;
    selectedText?: string;
    projectPath?: string;
  };
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  apiKeyConfigured: boolean;
}

export class ChatManager {
  private state: AppState;
  private electronAPI: any;
  private chatState: ChatState;

  constructor(state: AppState) {
    this.state = state;
    this.electronAPI = (window as any).electronAPI;
    this.chatState = {
      messages: [],
      isLoading: false,
      apiKeyConfigured: false
    };
  }

  initialize(): void {
    this.setupInitialUI();
    this.checkAPIKey();
  }

  private setupInitialUI(): void {
    const chatContent = document.getElementById('ai-chat-content');
    if (!chatContent) return;

    chatContent.innerHTML = `
      <div class="chat-container">
        <!-- API Key Setup -->
        <div id="api-key-setup" class="api-key-setup" style="display: none;">
          <div class="api-key-content">
            <div class="api-key-icon">🔑</div>
            <h3>Connect to Claude</h3>
            <p>Enter your Anthropic API key to start using AI assistance</p>
            <div class="api-key-form">
              <div class="input-group">
                <input type="password" id="api-key-input" placeholder="sk-ant-api03-..." />
                <button id="api-key-submit" class="primary-btn">
                  <span class="btn-text">Connect</span>
                </button>
              </div>
              <div class="api-key-help">
                <span class="help-text">Get your API key from</span>
                <a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Main Chat Interface -->
        <div id="chat-main" class="chat-main" style="display: none;">
          <!-- Context Bar -->
          <div id="context-bar" class="context-bar">
            <div class="context-info">
              <span class="context-icon">📁</span>
              <span class="context-file" id="current-context">No file selected</span>
            </div>
            <button class="context-toggle" id="include-context" title="Include file context">
              <span class="toggle-icon">🔗</span>
            </button>
          </div>

          <!-- Messages -->
          <div id="chat-messages" class="chat-messages">
            <div class="messages-container" id="messages-container"></div>
          </div>

          <!-- Input Area -->
          <div class="chat-input-area">
            <!-- Quick Actions (hidden by default) -->
            <div id="quick-actions" class="quick-actions" style="display: none;">
              <div class="quick-actions-grid">
                <button class="quick-action" data-action="explain">
                  <span class="action-icon">💡</span>
                  <span class="action-text">Explain Code</span>
                </button>
                <button class="quick-action" data-action="debug">
                  <span class="action-icon">🐛</span>
                  <span class="action-text">Find Issues</span>
                </button>
                <button class="quick-action" data-action="optimize">
                  <span class="action-icon">⚡</span>
                  <span class="action-text">Optimize</span>
                </button>
                <button class="quick-action" data-action="test">
                  <span class="action-icon">🧪</span>
                  <span class="action-text">Write Tests</span>
                </button>
                <button class="quick-action" data-action="comment">
                  <span class="action-icon">💬</span>
                  <span class="action-text">Add Comments</span>
                </button>
                <button class="quick-action" data-action="refactor">
                  <span class="action-icon">🔄</span>
                  <span class="action-text">Refactor</span>
                </button>
              </div>
            </div>

            <!-- Input Container -->
            <div class="input-container">
              <div class="input-wrapper">
                <button id="quick-actions-toggle" class="input-action-btn" title="Quick Actions">
                  <span class="action-icon">⚡</span>
                </button>
                <div class="textarea-container">
                  <textarea 
                    id="chat-input" 
                    placeholder="Ask Claude about your code..."
                    rows="1"
                    maxlength="50000"
                  ></textarea>
                  <div class="input-footer">
                    <span class="char-count" id="char-count">0 / 50,000</span>
                    <div class="input-actions">
                      <button id="attach-code" class="input-action-btn" title="Attach Current Code">
                        <span class="action-icon">📎</span>
                      </button>
                      <button id="send-message" class="send-btn" title="Send message">
                        <span class="send-icon">↗</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners();
    this.injectChatStyles();
    this.updateContextDisplay();
  }

  private injectChatStyles(): void {
    const existingStyle = document.getElementById('chat-styles');
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = 'chat-styles';
    style.textContent = `
      /* Chat Container */
      .chat-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #1a1a1a;
        color: #e4e4e7;
      }

      /* API Key Setup */
      .api-key-setup {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 2rem;
      }

      .api-key-content {
        text-align: center;
        max-width: 400px;
        width: 100%;
      }

      .api-key-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.8;
      }

      .api-key-content h3 {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0 0 0.5rem 0;
        color: #ffffff;
      }

      .api-key-content p {
        font-size: 0.875rem;
        color: #a1a1aa;
        margin: 0 0 2rem 0;
        line-height: 1.5;
      }

      .api-key-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .input-group {
        display: flex;
        gap: 0.5rem;
      }

      .input-group input {
        flex: 1;
        background: #262626;
        border: 1px solid #404040;
        border-radius: 0.5rem;
        padding: 0.75rem 1rem;
        color: #e4e4e7;
        font-size: 0.875rem;
        outline: none;
        transition: all 0.2s;
      }

      .input-group input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .primary-btn {
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 0.5rem;
        padding: 0.75rem 1.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }

      .primary-btn:hover:not(:disabled) {
        background: #2563eb;
        transform: translateY(-1px);
      }

      .primary-btn:disabled {
        background: #374151;
        cursor: not-allowed;
        transform: none;
      }

      .api-key-help {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
        font-size: 0.75rem;
        color: #71717a;
      }

      .api-key-help a {
        color: #60a5fa;
        text-decoration: none;
      }

      .api-key-help a:hover {
        text-decoration: underline;
      }

      /* Main Chat */
      .chat-main {
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      /* Context Bar */
      .context-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background: #262626;
        border-bottom: 1px solid #404040;
        font-size: 0.75rem;
      }

      .context-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #a1a1aa;
      }

      .context-icon {
        font-size: 0.875rem;
      }

      .context-file {
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
        color: #60a5fa;
      }

      .context-toggle {
        background: transparent;
        border: 1px solid #404040;
        border-radius: 0.25rem;
        padding: 0.25rem 0.5rem;
        color: #a1a1aa;
        cursor: pointer;
        transition: all 0.2s;
      }

      .context-toggle:hover {
        border-color: #60a5fa;
        color: #60a5fa;
      }

      .context-toggle.active {
        background: #1e40af;
        border-color: #3b82f6;
        color: white;
      }

      /* Messages */
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        min-height: 0;
      }

      .messages-container {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        min-height: 100%;
      }

      .message {
        display: flex;
        gap: 0.75rem;
        max-width: 100%;
        animation: slideIn 0.3s ease-out;
      }

      /* Handle messages with code differently */
      .message.has-code {
        flex-direction: column;
        gap: 0.5rem;
      }

      .message.has-code .message-main {
        display: flex;
        gap: 0.75rem;
        align-items: flex-start;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .message-avatar {
        width: 2rem;
        height: 2rem;
        border-radius: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.875rem;
        flex-shrink: 0;
        margin-top: 0.125rem;
      }

      .message.user .message-avatar {
        background: #3b82f6;
        color: white;
      }

      .message.assistant .message-avatar {
        background: #7c3aed;
        color: white;
      }

      .message-content {
        flex: 1;
        min-width: 0;
      }

      .message-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .message-role {
        font-size: 0.875rem;
        font-weight: 600;
        color: #e4e4e7;
      }

      .message-time {
        font-size: 0.75rem;
        color: #71717a;
      }

      .message-text {
        font-size: 0.875rem;
        line-height: 1.6;
        color: #d4d4d8;
        word-wrap: break-word;
        white-space: pre-wrap;
      }

      /* Enhanced Code Blocks */
      .code-block {
        margin: 1rem 0;
        border-radius: 0.75rem;
        background: #0d1117;
        border: 1px solid #30363d;
        overflow: hidden;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace;
      }

      .message.has-code .code-block {
        margin: 0.75rem 0 0 0;
        width: 100%;
      }

      .code-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background: #161b22;
        border-bottom: 1px solid #30363d;
        font-size: 0.75rem;
      }

      .code-language {
        color: #7c3aed;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-size: 0.6875rem;
      }

      .code-actions {
        display: flex;
        gap: 0.5rem;
      }

      .code-action {
        background: transparent;
        border: 1px solid #30363d;
        border-radius: 0.375rem;
        padding: 0.375rem 0.75rem;
        color: #8b949e;
        cursor: pointer;
        font-size: 0.6875rem;
        font-weight: 500;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .code-action:hover {
        border-color: #7c3aed;
        color: #a855f7;
        background: rgba(124, 58, 237, 0.1);
      }

      .code-action:active {
        transform: scale(0.95);
      }

      .code-content {
        position: relative;
        overflow-x: auto;
        overflow-y: hidden;
        max-height: 500px;
        background: #0d1117;
      }

      .code-content pre {
        margin: 0;
        padding: 1.25rem;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace;
        font-size: 0.8125rem;
        line-height: 1.6;
        color: #e6edf3;
        white-space: pre;
        min-width: max-content;
        tab-size: 2;
      }

      .code-content code {
        font-family: inherit;
        font-size: inherit;
        color: inherit;
        background: none;
        padding: 0;
        border: none;
      }

      /* Remove all syntax highlighting classes */
      .code-content .keyword,
      .code-content .string,
      .code-content .comment,
      .code-content .number,
      .code-content .function,
      .code-content .variable,
      .code-content .operator {
        color: inherit;
        font-weight: inherit;
        font-style: inherit;
      }

      /* Horizontal scroll styling for code */
      .code-content::-webkit-scrollbar {
        height: 8px;
        background: #161b22;
      }

      .code-content::-webkit-scrollbar-thumb {
        background: #30363d;
        border-radius: 4px;
      }

      .code-content::-webkit-scrollbar-thumb:hover {
        background: #484f58;
      }

      .code-content::-webkit-scrollbar-corner {
        background: #161b22;
      }

      /* Large code block handling */
      .code-block.large {
        max-height: 600px;
        overflow: hidden;
      }

      .code-block.large .code-content {
        max-height: 500px;
        overflow: auto;
      }

      /* Better code formatting */
      .code-content pre {
        white-space: pre;
        word-wrap: normal;
        overflow-wrap: normal;
      }

      /* Code syntax highlighting */
      .code-content .keyword { color: #c678dd; }
      .code-content .string { color: #98c379; }
      .code-content .comment { color: #5c6370; font-style: italic; }
      .code-content .number { color: #d19a66; }
      .code-content .function { color: #61afef; }
      .code-content .variable { color: #e06c75; }
      .code-content .operator { color: #56b6c2; }

      /* Horizontal scroll styling */
      .code-content::-webkit-scrollbar {
        height: 8px;
        background: #1a1a1a;
      }

      .code-content::-webkit-scrollbar-thumb {
        background: #404040;
        border-radius: 4px;
      }

      .code-content::-webkit-scrollbar-thumb:hover {
        background: #525252;
      }

      .code-content::-webkit-scrollbar-corner {
        background: #1a1a1a;
      }

      /* Large code block handling */
      .code-block.large {
        max-height: 600px;
        overflow: hidden;
      }

      .code-block.large .code-content {
        max-height: 500px;
        overflow: auto;
      }

      /* Inline code */
      .message-text code:not(.code-block code) {
        background: #262626;
        color: #fbbf24;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
        font-size: 0.8125rem;
        border: 1px solid #404040;
      }

      /* Code input detection */
      .message.user.code-heavy .message-text {
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
        background: #0d0d0d;
        border: 1px solid #2a2a2a;
        border-radius: 0.5rem;
        padding: 1rem;
        overflow-x: auto;
        white-space: pre;
        font-size: 0.8125rem;
        line-height: 1.5;
      }

      /* Typing indicator */
      .typing-indicator {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem;
        color: #71717a;
        font-size: 0.875rem;
      }

      .typing-dots {
        display: flex;
        gap: 0.25rem;
      }

      .typing-dot {
        width: 0.375rem;
        height: 0.375rem;
        background: #71717a;
        border-radius: 50%;
        animation: pulse 1.4s infinite;
      }

      .typing-dot:nth-child(2) { animation-delay: 0.2s; }
      .typing-dot:nth-child(3) { animation-delay: 0.4s; }

      @keyframes pulse {
        0%, 80%, 100% { 
          opacity: 0.3; 
          transform: scale(0.8); 
        }
        40% { 
          opacity: 1; 
          transform: scale(1); 
        }
      }

      /* Quick Actions */
      .quick-actions {
        padding: 1rem;
        background: #171717;
        border-top: 1px solid #262626;
        border-bottom: 1px solid #262626;
      }

      .quick-actions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 0.5rem;
      }

      .quick-action {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem;
        background: #262626;
        border: 1px solid #404040;
        border-radius: 0.5rem;
        color: #d4d4d8;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.8125rem;
      }

      .quick-action:hover {
        background: #404040;
        border-color: #60a5fa;
        transform: translateY(-1px);
      }

      .action-icon {
        font-size: 1rem;
      }

      .action-text {
        font-weight: 500;
      }

      /* Input Area */
      .chat-input-area {
        background: #1a1a1a;
        border-top: 1px solid #262626;
      }

      .input-container {
        padding: 1rem;
      }

      .input-wrapper {
        background: #262626;
        border: 1px solid #404040;
        border-radius: 0.75rem;
        transition: all 0.2s;
        overflow: hidden;
      }

      .input-wrapper:focus-within {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .textarea-container {
        position: relative;
      }

      .chat-input-area textarea {
        width: 100%;
        background: transparent;
        border: none;
        outline: none;
        resize: none;
        padding: 1rem 3rem 1rem 1rem;
        color: #e4e4e7;
        font-size: 0.875rem;
        line-height: 1.5;
        font-family: inherit;
        min-height: 2.5rem;
        max-height: 150px;
      }

      .chat-input-area textarea::placeholder {
        color: #71717a;
      }

      .input-action-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        border: none;
        color: #71717a;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 0.25rem;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .input-action-btn:hover {
        color: #60a5fa;
        background: #262626;
      }

      #quick-actions-toggle {
        left: 0.5rem;
      }

      .input-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 1rem;
        background: #1f1f1f;
        border-top: 1px solid #404040;
      }

      .char-count {
        font-size: 0.75rem;
        color: #71717a;
      }

      .char-count.warning {
        color: #f59e0b;
      }

      .char-count.error {
        color: #ef4444;
      }

      .input-actions {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }

      .send-btn {
        background: #3b82f6;
        border: none;
        border-radius: 0.375rem;
        width: 2rem;
        height: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        color: white;
      }

      .send-btn:hover:not(:disabled) {
        background: #2563eb;
        transform: scale(1.05);
      }

      .send-btn:disabled {
        background: #374151;
        cursor: not-allowed;
        transform: none;
      }

      .send-icon {
        font-size: 1rem;
        font-weight: bold;
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
        .quick-actions-grid {
          grid-template-columns: 1fr;
        }
        
        .input-container {
          padding: 0.75rem;
        }
      }
    `;

    document.head.appendChild(style);
  }

  private setupEventListeners(): void {
    // API Key setup
    const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
    const apiKeySubmit = document.getElementById('api-key-submit') as HTMLButtonElement;

    if (apiKeyInput && apiKeySubmit) {
      apiKeySubmit.addEventListener('click', () => this.setupAPIKey());
      apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.setupAPIKey();
      });
    }

    // Chat input
    const chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
    const sendButton = document.getElementById('send-message') as HTMLButtonElement;
    const quickActionsToggle = document.getElementById('quick-actions-toggle') as HTMLButtonElement;
    const attachCodeBtn = document.getElementById('attach-code') as HTMLButtonElement;
    const contextToggle = document.getElementById('include-context') as HTMLButtonElement;

    if (chatInput && sendButton) {
      sendButton.addEventListener('click', () => this.sendMessage());
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Auto-resize textarea
      chatInput.addEventListener('input', () => {
        this.autoResizeTextarea(chatInput);
        this.updateCharCount(chatInput);
      });
    }

    if (quickActionsToggle) {
      quickActionsToggle.addEventListener('click', () => this.toggleQuickActions());
    }

    if (attachCodeBtn) {
      attachCodeBtn.addEventListener('click', () => this.attachCurrentCode());
    }

    if (contextToggle) {
      contextToggle.addEventListener('click', () => this.toggleContext());
    }

    // Quick action buttons
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const quickAction = target.closest('.quick-action') as HTMLElement;
      if (quickAction) {
        const action = quickAction.getAttribute('data-action');
        if (action) {
          this.handleQuickAction(action);
        }
      }
    });
  }

  private autoResizeTextarea(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 150);
    textarea.style.height = newHeight + 'px';
  }

  private updateCharCount(textarea: HTMLTextAreaElement): void {
    const charCount = document.getElementById('char-count');
    if (!charCount) return;

    const length = textarea.value.length;
    const maxLength = 50000;
    
    charCount.textContent = `${length.toLocaleString()} / ${maxLength.toLocaleString()}`;
    
    charCount.className = 'char-count';
    if (length > maxLength * 0.9) {
      charCount.classList.add('error');
    } else if (length > maxLength * 0.8) {
      charCount.classList.add('warning');
    }
  }

  private updateContextDisplay(): void {
    const contextFile = document.getElementById('current-context');
    if (!contextFile) return;

    if (this.state.currentFile) {
      const fileName = this.state.currentFile.split('/').pop() || this.state.currentFile;
      contextFile.textContent = fileName;
    } else {
      contextFile.textContent = 'No file selected';
    }
  }

  private async setupAPIKey(): Promise<void> {
    const input = document.getElementById('api-key-input') as HTMLInputElement;
    const button = document.getElementById('api-key-submit') as HTMLButtonElement;
    
    if (!input || !button) return;

    const apiKey = input.value.trim();
    if (!apiKey) return;

    button.disabled = true;
    button.innerHTML = '<span class="btn-text">Connecting...</span>';

    try {
      const testResult = await window.electronAPI.callAnthropicAPI(
        [{ role: 'user', content: 'Hello' }],
        'You are a helpful assistant. Respond with just "OK" to confirm the connection.'
      );

      if (testResult && (typeof testResult === 'string' || testResult.content)) {
        this.chatState.apiKeyConfigured = true;
        this.showChatInterface();
        this.addWelcomeMessage();
      } else {
        throw new Error('Invalid response from API');
      }
    } catch (error) {
      console.error('API key validation failed:', error);
      alert('Invalid API key. Please check your Anthropic API key.');
    } finally {
      button.disabled = false;
      button.innerHTML = '<span class="btn-text">Connect</span>';
    }
  }

  private checkAPIKey(): void {
    // For now, always show API key setup
    this.showAPIKeySetup();
  }

  private showAPIKeySetup(): void {
    const apiKeySetup = document.getElementById('api-key-setup');
    const chatMain = document.getElementById('chat-main');
    
    if (apiKeySetup) apiKeySetup.style.display = 'flex';
    if (chatMain) chatMain.style.display = 'none';
  }

  private showChatInterface(): void {
    const apiKeySetup = document.getElementById('api-key-setup');
    const chatMain = document.getElementById('chat-main');
    
    if (apiKeySetup) apiKeySetup.style.display = 'none';
    if (chatMain) chatMain.style.display = 'flex';
    
    this.updateContextDisplay();
  }

  private addWelcomeMessage(): void {
    const welcomeMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `Hello! I'm Claude, your AI coding assistant. I can help you with:

• **Code Analysis** - Understand and review your code
• **Code Generation** - Create components, functions, and files
• **Debugging** - Find and fix issues in your code
• **Refactoring** - Improve code structure and performance
• **Documentation** - Generate comments and documentation

I have access to your current file context and can provide tailored assistance. What would you like to work on?`,
      timestamp: new Date()
    };

    this.chatState.messages = [welcomeMessage];
    this.renderMessages();
  }

  private async sendMessage(): Promise<void> {
    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (!input || !input.value.trim() || this.chatState.isLoading) return;

    const content = input.value.trim();
    input.value = '';
    input.style.height = 'auto';
    this.updateCharCount(input);

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
      metadata: {
        filePath: this.state.currentFile,
        projectPath: this.state.currentWorkingDirectory
      }
    };

    this.chatState.messages.push(userMessage);
    this.renderMessages();

    // Show typing indicator
    this.chatState.isLoading = true;
    this.showTypingIndicator();

    try {
      // Prepare messages for API
      const apiMessages = this.chatState.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await window.electronAPI.callAnthropicAPI(
        apiMessages,
        this.getSystemPrompt()
      );

      // Debug logging (can remove later)
      this.logResponseDetails(response);

      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: typeof response === 'string' ? response : response.content || JSON.stringify(response),
        timestamp: new Date()
      };

      this.chatState.messages.push(assistantMessage);
      
    } catch (error) {
      console.error('Failed to get AI response:', error);
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ **Error**: ${this.getErrorMessage(error as Error)}

**Suggestions:**
• Try asking a more specific question
• Check your internet connection
• Ensure your API key is valid`,
        timestamp: new Date()
      };

      this.chatState.messages.push(errorMessage);
    } finally {
      this.chatState.isLoading = false;
      this.hideTypingIndicator();
      this.renderMessages();
    }
  }

  private getErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('ended response early') || message.includes('incomplete')) {
      return 'Response was cut off by the AI provider. Try asking a shorter question.';
    } else if (message.includes('rate limit')) {
      return 'Rate limit reached. Please wait a moment before sending another message.';
    } else if (message.includes('timeout')) {
      return 'Request timed out. Please check your connection and try again.';
    } else if (message.includes('invalid api key')) {
      return 'Invalid API key. Please check your Anthropic API key.';
    } else {
      return `Failed to get response: ${error.message}`;
    }
  }

  private updateTypingIndicator(message: string): void {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
      indicator.innerHTML = `
        <span>${message}</span>
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      `;
    }
  }

  private getSystemPrompt(): string {
    const contextInfo = this.state.currentFile ? `

**Current Context:**
- File: ${this.state.currentFile}
- Project: ${this.state.currentWorkingDirectory}` : '';

    return `You are Claude, an expert AI coding assistant integrated into a developer's IDE. You excel at:

1. **Code Analysis & Review** - Understand, explain, and critique code
2. **Code Generation** - Create high-quality, production-ready code
3. **Debugging & Problem Solving** - Identify and fix issues efficiently
4. **Architecture & Best Practices** - Suggest improvements and patterns
5. **Documentation** - Generate clear, helpful documentation

**Guidelines:**
- Provide concise, actionable responses
- Use markdown formatting for code blocks with proper language syntax highlighting
- When generating code, make it complete and ready to use
- Explain your reasoning when making suggestions
- Ask clarifying questions when requirements are unclear${contextInfo}

Be helpful, accurate, and focus on practical solutions that improve the developer's workflow.`;
  }

  private detectCodeContent(content: string): boolean {
    // Detect if content is primarily code
    const codeIndicators = [
      /```[\s\S]*```/g, // Code blocks
      /^\s*(?:function|class|const|let|var|if|for|while|import|export)/m, // JS/TS keywords
      /^\s*(?:def|class|import|from|if|for|while)/m, // Python keywords
      /^\s*(?:public|private|protected|static|void|int|string)/m, // Java/C# keywords
      /{\s*[\s\S]*}/g, // Curly braces
      /^\s*\/\/|^\s*\/\*|^\s*\*/m, // Comments
      /^\s*#include|^\s*using namespace/m, // C/C++
      /^\s*<\?php|^\s*\$[a-zA-Z]/m, // PHP
    ];

    const lines = content.split('\n');
    const codeLines = lines.filter(line => {
      return codeIndicators.some(pattern => pattern.test(line)) ||
             line.includes('{') || line.includes('}') ||
             line.includes(';') || line.includes('()') ||
             /^\s*[\w\d_]+\s*[=:]\s*/.test(line);
    });

    return codeLines.length > lines.length * 0.3; // 30% threshold
  }

  private renderMessages(): void {
    const container = document.getElementById('messages-container');
    if (!container) return;

    container.innerHTML = '';

    this.chatState.messages.forEach(message => {
      const hasCodeBlocks = /```[\s\S]*?```/.test(message.content);
      const isCodeHeavy = this.detectCodeContent(message.content);
      
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${message.role}`;
      
      if (hasCodeBlocks) {
        messageDiv.classList.add('has-code');
      }
      
      if (isCodeHeavy && message.role === 'user') {
        messageDiv.classList.add('code-heavy');
      }

      if (hasCodeBlocks) {
        // Handle messages with code blocks differently
        const mainDiv = document.createElement('div');
        mainDiv.className = 'message-main';
        
        // Avatar
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = message.role === 'user' ? '👤' : '🤖';
        
        // Content container
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Header
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const role = document.createElement('span');
        role.className = 'message-role';
        role.textContent = message.role === 'user' ? 'You' : 'Claude';
        
        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = message.timestamp.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        header.appendChild(role);
        header.appendChild(time);
        contentDiv.appendChild(header);
        
        mainDiv.appendChild(avatar);
        mainDiv.appendChild(contentDiv);
        messageDiv.appendChild(mainDiv);
        
        // Process content with code blocks
        const processedContent = this.processMarkdownWithCodeBlocks(message.content);
        messageDiv.appendChild(processedContent);
      } else {
        // Standard message layout
        // Avatar
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = message.role === 'user' ? '👤' : '🤖';
        
        // Content container
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Header
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const role = document.createElement('span');
        role.className = 'message-role';
        role.textContent = message.role === 'user' ? 'You' : 'Claude';
        
        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = message.timestamp.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        header.appendChild(role);
        header.appendChild(time);
        
        // Message text
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        
        if (isCodeHeavy && message.role === 'user') {
          textDiv.textContent = message.content;
        } else {
          textDiv.innerHTML = this.processSimpleMarkdown(message.content);
        }
        
        contentDiv.appendChild(header);
        contentDiv.appendChild(textDiv);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
      }
      
      container.appendChild(messageDiv);
    });

    // Scroll to bottom
    this.scrollToBottom();
  }

  private processMarkdownWithCodeBlocks(content: string): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    parts.forEach((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        // This is a code block
        const lines = part.split('\n');
        const firstLine = lines[0].replace('```', '');
        const language = firstLine.trim() || 'text';
        const code = lines.slice(1, -1).join('\n');
        
        const codeBlock = this.createCodeBlock(code, language);
        fragment.appendChild(codeBlock);
      } else if (part.trim()) {
        // This is regular text
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerHTML = this.processSimpleMarkdown(part);
        fragment.appendChild(textDiv);
      }
    });
    
    return fragment;
  }

  private createCodeBlock(code: string, language: string): HTMLElement {
    const codeBlock = document.createElement('div');
    const isLarge = code.split('\n').length > 20 || code.length > 1000;
    
    codeBlock.className = `code-block ${isLarge ? 'large' : ''}`;
    
    // Header
    const header = document.createElement('div');
    header.className = 'code-header';
    
    const langSpan = document.createElement('span');
    langSpan.className = 'code-language';
    langSpan.textContent = language;
    
    const actions = document.createElement('div');
    actions.className = 'code-actions';
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-action';
    copyBtn.innerHTML = '📋 Copy';
    copyBtn.onclick = () => this.copyCodeToClipboard(code);
    
    const insertBtn = document.createElement('button');
    insertBtn.className = 'code-action';
    insertBtn.innerHTML = '📥 Insert';
    insertBtn.onclick = () => this.insertCodeIntoEditor(code);
    
    actions.appendChild(copyBtn);
    actions.appendChild(insertBtn);
    
    header.appendChild(langSpan);
    header.appendChild(actions);
    
    // Content
    const content = document.createElement('div');
    content.className = 'code-content';
    
    const pre = document.createElement('pre');
    const codeElement = document.createElement('code');
    
    // Don't apply syntax highlighting - just show clean code
    codeElement.textContent = code;
    
    pre.appendChild(codeElement);
    content.appendChild(pre);
    
    codeBlock.appendChild(header);
    codeBlock.appendChild(content);
    
    return codeBlock;
  }

  private processSimpleMarkdown(content: string): string {
    let processed = content;
    
    // Bold text
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic text
    processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Inline code
    processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bullet points
    processed = processed.replace(/^• (.*$)/gim, '• $1');
    
    return processed;
  }

  private async copyCodeToClipboard(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      
      // Show brief success feedback
      const button = event?.target as HTMLElement;
      if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = '✅ Copied!';
        button.style.color = '#10b981';
        setTimeout(() => {
          button.innerHTML = originalText;
          button.style.color = '';
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy code:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  private scrollToBottom(): void {
    const messagesContainer = document.querySelector('.chat-messages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  private showTypingIndicator(): void {
    const container = document.getElementById('messages-container');
    if (!container) return;

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = `
      <span>Claude is thinking</span>
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;

    container.appendChild(indicator);
    this.scrollToBottom();
  }

  private hideTypingIndicator(): void {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  private toggleQuickActions(): void {
    const quickActions = document.getElementById('quick-actions');
    if (!quickActions) return;

    const isVisible = quickActions.style.display !== 'none';
    quickActions.style.display = isVisible ? 'none' : 'block';
  }

  private toggleContext(): void {
    const toggle = document.getElementById('include-context');
    if (!toggle) return;
    
    toggle.classList.toggle('active');
  }

  private attachCurrentCode(): void {
    if (this.state.monacoEditor && this.state.currentFile) {
      const code = this.state.monacoEditor.getValue();
      const input = document.getElementById('chat-input') as HTMLTextAreaElement;
      if (input && code) {
        const fileName = this.state.currentFile.split('/').pop();
        const extension = fileName?.split('.').pop() || '';
        input.value = `Here's my current code in ${fileName}:\n\n\`\`\`${extension}\n${code}\n\`\`\`\n\n`;
        this.autoResizeTextarea(input);
        this.updateCharCount(input);
        input.focus();
      }
    }
  }

  private handleQuickAction(action: string): void {
    const actionMap: { [key: string]: string } = {
      'explain': 'Please explain this code and what it does.',
      'debug': 'Please review this code for potential bugs, issues, or improvements.',
      'optimize': 'Please suggest optimizations to make this code more efficient.',
      'comment': 'Please add appropriate comments and documentation to this code.',
      'test': 'Please create comprehensive unit tests for this code.',
      'refactor': 'Please refactor this code to improve readability, maintainability, and follow best practices.'
    };

    const message = actionMap[action];
    if (message) {
      const input = document.getElementById('chat-input') as HTMLTextAreaElement;
      if (input) {
        input.value = message;
        this.autoResizeTextarea(input);
        this.updateCharCount(input);
        input.focus();
        this.toggleQuickActions(); // Hide quick actions after selection
      }
    }
  }

  insertCodeIntoEditor(code: string): void {
    if (this.state.monacoEditor) {
      const selection = this.state.monacoEditor.getSelection();
      const id = { major: 1, minor: 1 };
      const op = {
        identifier: id,
        range: selection,
        text: code,
        forceMoveMarkers: true
      };
      this.state.monacoEditor.executeEdits('ai-assistant', [op]);
      this.state.monacoEditor.focus();
    }
  }

  clearChat(): void {
    this.chatState.messages = [];
    this.renderMessages();
    this.addWelcomeMessage();
  }

  exposeGlobally(): void {
    (window as any).chatManager = this;
  }

  dispose(): void {
    delete (window as any).chatManager;
  }

  // Add this method to help debug what responses look like
  private logResponseDetails(response: any): void {
    console.log('=== RESPONSE DEBUG ===');
    console.log('Response type:', typeof response);
    console.log('Response keys:', Object.keys(response || {}));
    
    const content = typeof response === 'string' ? response : response.content;
    console.log('Content length:', content?.length || 0);
    console.log('Content preview:', content?.substring(0, 100));
    console.log('Content ending:', content?.slice(-100));
    console.log('=== END DEBUG ===');
  }
}
