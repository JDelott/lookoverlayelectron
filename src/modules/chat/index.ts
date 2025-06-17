import { AppState } from '../types';
import { FilePicker, AttachedFile, FilePickerCallbacks } from '../filePicker/index.js';

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
  private isUIReady = false;
  private currentStreamingMessage: ChatMessage | null = null;
  private currentStreamSessionId: string | null = null;
  private streamingMessageElement: HTMLElement | null = null;
  private streamingContentContainer: HTMLElement | null = null;
  private currentCodeBlock: HTMLElement | null = null;
  private isInCodeBlock = false;
  private codeBlockBuffer = '';
  private typingSpeed = 20; // ms between characters for typing effect
  private isRecording = false;
  private recordingStartTime: number = 0;
  
  // File picker integration
  private filePicker: FilePicker | null = null;
  private attachedFiles: Map<string, AttachedFile> = new Map();

  // Scroll and progressive rendering properties
  private isScrolling = false;
  private scrollAnimationFrame: number | null = null;
  private autoScrollEnabled = true;
  private pendingTextBuffer = '';
  private bufferUpdateTimeout: number | null = null;
  private lastScrollPosition = 0;
  private renderQueue: string[] = [];
  private isRendering = false;
  private scrollUpdateScheduled = false;

  constructor(state: AppState) {
    this.state = state;
    this.electronAPI = (window as any).electronAPI;
    this.chatState = {
      messages: [],
      isLoading: false,
      apiKeyConfigured: false
    };
    this.setupStreamingListeners();
    this.setupSpeechListeners();
    this.initializeFilePicker();
  }

  private initializeFilePicker(): void {
    const callbacks: FilePickerCallbacks = {
      onFilesSelected: (files: Map<string, AttachedFile>) => {
        this.attachedFiles = new Map([...this.attachedFiles, ...files]);
        this.updateAttachedFilesDisplay();
        this.updateAttachButton();
      },
      onFileRemoved: (filePath: string) => {
        this.attachedFiles.delete(filePath);
        this.updateAttachedFilesDisplay();
        this.updateAttachButton();
      },
      onAllFilesCleared: () => {
        this.attachedFiles.clear();
        this.updateAttachedFilesDisplay();
        this.updateAttachButton();
      }
    };

    this.filePicker = new FilePicker(callbacks, {
      allowMultiple: true,
      maxFiles: 10
    });
  }

  initialize(): void {
    console.log('🔧 ChatManager initialize called');
    
    // Always expose globally first
    this.exposeGlobally();
    
    // Check if UI is already set up to avoid clearing content
    const chatContent = document.getElementById('ai-chat-content');
    const existingContainer = chatContent?.querySelector('.chat-container');
    
    if (!existingContainer) {
      // Only set up UI if it doesn't exist
      this.setupInitialUI();
      this.checkAPIKey();
    } else {
      console.log('✅ Chat UI already exists, preserving content');
      // Just ensure event listeners are attached
      this.setupEventListeners();
      this.updateContextDisplay();
    }
    
    this.isUIReady = true;
    console.log('✅ ChatManager initialization complete');
  }

  private setupInitialUI(): void {
    const chatContent = document.getElementById('ai-chat-content');
    if (!chatContent) {
      console.log('❌ ai-chat-content not found');
      return;
    }

    console.log('🔧 Setting up chat UI...');
    
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
          <!-- Attached Files Bar (shown when files are attached) -->
          <div id="attached-files-header" class="attached-files-header" style="display: none;">
            <div class="attached-files-content">
              <div class="attached-files-info">
                <span class="attached-files-icon">📎</span>
                <span class="attached-files-count" id="attached-files-count">0 files</span>
              </div>
              <div class="attached-files-list" id="attached-files-list"></div>
              <button class="clear-all-files-btn" id="clear-all-files" title="Clear all files">
                Clear all
              </button>
            </div>
          </div>

          <!-- REFACTORED: Single scrollable messages container -->
          <div id="chat-messages" class="chat-messages">
            <!-- Messages will be added directly here, no nested container -->
          </div>

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

          <!-- Input Area -->
          <div class="chat-input-area">
            <div class="input-container">
              <div class="input-wrapper">
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
                      <button id="quick-actions-toggle" class="input-action-btn" title="Quick Actions">
                        <span class="action-icon">⚡</span>
                      </button>
                      <button id="microphone-btn" class="input-action-btn" title="Voice input">
                        <span class="action-icon">🎤</span>
                      </button>
                      <button id="attach-files" class="input-action-btn" title="Attach files">
                        <span class="action-icon">📎</span>
                      </button>
                      <button id="attach-code" class="input-action-btn" title="Attach Current Code">
                        <span class="action-icon">📋</span>
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

    // Set up event listeners and styles
    this.setupEventListeners();
    this.injectChatStyles();
  }

  private injectChatStyles(): void {
    const existingStyle = document.getElementById('chat-styles');
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = 'chat-styles';
    style.textContent = `
      /* REFACTORED: Clean container hierarchy with stable layout */
      .chat-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #1a1a1a;
        color: #e4e4e7;
        position: relative;
        overflow: hidden;
      }

      .chat-main {
        height: 100%;
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
      }

      /* CRITICAL: Stable scrollable container with no layout shifts */
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 1rem;
        /* Use block layout for stability */
        display: block;
        /* Prevent layout shifts during streaming */
        contain: layout style;
      }

      /* Individual messages with stable layout */
      .message {
        display: flex;
        gap: 0.75rem;
        max-width: 100%;
        margin-bottom: 1.5rem;
        /* Prevent layout shifts */
        contain: layout;
        animation: slideIn 0.3s ease-out;
      }

      /* Disable animations during streaming to prevent jolting */
      .message.streaming {
        animation: none;
        /* Ensure stable layout during streaming */
        contain: layout style;
      }

      .streaming-content {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        /* Prevent layout shifts */
        contain: layout;
      }

      .message-text.typing-cursor {
        position: relative;
        /* Ensure stable layout */
        min-height: 1.2em;
      }

      /* Optimized typing cursor that doesn't cause layout shifts */
      .typing-cursor::after {
        content: '▊';
        color: #60a5fa;
        animation: blink 1s infinite;
        margin-left: 2px;
        font-weight: normal;
        position: absolute;
        /* Prevent the cursor from affecting layout */
        width: 0;
        overflow: visible;
      }

      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
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

      /* Rest of styles remain the same but with layout stability improvements... */
      .attached-files-header {
        background: #171717;
        border-bottom: 1px solid #2a2a2a;
        padding: 0.75rem 1rem;
        flex-shrink: 0;
      }

      .attached-files-content {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .attached-files-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #60a5fa;
        font-size: 0.875rem;
        font-weight: 500;
      }

      .attached-files-list {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        flex: 1;
      }

      .attached-file-tag {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        background: #262626;
        border: 1px solid #404040;
        border-radius: 0.375rem;
        padding: 0.375rem 0.5rem;
        font-size: 0.75rem;
        max-width: 200px;
      }

      .file-tag-icon {
        font-size: 0.875rem;
        flex-shrink: 0;
      }

      .file-tag-name {
        color: #d4d4d8;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
        truncate: ellipsis;
        overflow: hidden;
        white-space: nowrap;
        flex: 1;
        min-width: 0;
      }

      .remove-file-tag {
        background: none;
        border: none;
        color: #71717a;
        cursor: pointer;
        font-size: 0.875rem;
        padding: 0;
        margin-left: 0.25rem;
        line-height: 1;
        flex-shrink: 0;
      }

      .remove-file-tag:hover {
        color: #ef4444;
      }

      .clear-all-files-btn {
        background: transparent;
        border: 1px solid #404040;
        color: #71717a;
        padding: 0.375rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
        flex-shrink: 0;
      }

      .clear-all-files-btn:hover {
        border-color: #ef4444;
        color: #ef4444;
      }

      .input-action-btn.has-files {
        color: #10b981;
        border-color: #10b981;
        background: rgba(16, 185, 129, 0.1);
      }

      /* Input Area with stable layout */
      .chat-input-area {
        background: #1a1a1a;
        border-top: 1px solid #262626;
        flex-shrink: 0;
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
        padding: 1rem;
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

      .input-action-btn {
        background: transparent;
        border: 1px solid #404040;
        color: #71717a;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 0.375rem;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        font-size: 0.875rem;
      }

      .input-action-btn:hover {
        color: #60a5fa;
        border-color: #60a5fa;
        background: rgba(96, 165, 250, 0.1);
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

      /* Quick Actions Panel */
      .quick-actions {
        padding: 1rem;
        background: #171717;
        border-top: 1px solid #262626;
        border-bottom: 1px solid #262626;
        flex-shrink: 0;
      }

      .quick-actions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 0.5rem;
      }

      .quick-action {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.75rem 0.5rem;
        background: #262626;
        border: 1px solid #404040;
        border-radius: 0.5rem;
        color: #d4d4d8;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.8125rem;
        text-align: center;
        min-height: 44px;
      }

      .quick-action:hover {
        background: #404040;
        border-color: #60a5fa;
        transform: translateY(-1px);
      }

      .action-icon {
        font-size: 1rem;
        flex-shrink: 0;
      }

      .action-text {
        font-weight: 500;
        font-size: 0.75rem;
      }

      /* API Key Setup */
      .api-key-setup {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 1.5rem;
      }

      .api-key-content {
        text-align: center;
        max-width: 100%;
        width: 100%;
      }

      .api-key-icon {
        font-size: 2.5rem;
        margin-bottom: 1rem;
        opacity: 0.8;
      }

      .api-key-content h3 {
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0 0 0.5rem 0;
        color: #ffffff;
      }

      .api-key-content p {
        font-size: 0.8rem;
        color: #a1a1aa;
        margin: 0 0 1.5rem 0;
        line-height: 1.4;
      }

      .api-key-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .input-group {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .input-group input {
        width: 100%;
        background: #262626;
        border: 1px solid #404040;
        border-radius: 0.5rem;
        padding: 0.75rem;
        color: #e4e4e7;
        font-size: 0.8rem;
        outline: none;
        transition: all 0.2s;
        box-sizing: border-box;
      }

      .input-group input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
      }

      .primary-btn {
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 0.5rem;
        padding: 0.75rem 1rem;
        font-size: 0.8rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        width: 100%;
        box-sizing: border-box;
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
        font-size: 0.7rem;
        color: #71717a;
        flex-wrap: wrap;
      }

      .api-key-help a {
        color: #60a5fa;
        text-decoration: none;
      }

      .api-key-help a:hover {
        text-decoration: underline;
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

      .code-block.large {
        max-height: 600px;
        overflow: hidden;
      }

      .code-block.large .code-content {
        max-height: 500px;
        overflow: auto;
      }

      .code-content pre {
        white-space: pre;
        word-wrap: normal;
        overflow-wrap: normal;
      }

      .code-content .keyword { color: #c678dd; }
      .code-content .string { color: #98c379; }
      .code-content .comment { color: #5c6370; font-style: italic; }
      .code-content .number { color: #d19a66; }
      .code-content .function { color: #61afef; }
      .code-content .variable { color: #e06c75; }
      .code-content .operator { color: #56b6c2; }

      .message-text code:not(.code-block code) {
        background: #262626;
        color: #fbbf24;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
        font-size: 0.8125rem;
        border: 1px solid #404040;
      }

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

      .typing-indicator {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem;
        color: #71717a;
        font-size: 0.875rem;
        flex-shrink: 0;
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

      @media (max-width: 400px) {
        .quick-actions-grid {
          grid-template-columns: 1fr;
        }
        
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

      .streaming-content {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        /* Prevent layout shifts */
        contain: layout;
      }

      .streaming-code {
        border: 2px solid #3b82f6 !important;
        box-shadow: 0 0 10px rgba(59, 130, 246, 0.2) !important;
      }

      .streaming-code-text {
        position: relative;
      }

      .streaming-code-text.typing-cursor::after {
        content: '▊';
        color: #60a5fa;
        animation: blink 1s infinite;
        margin-left: 1px;
        font-weight: normal;
      }

      .streaming-content .message-text {
        margin: 0;
      }

      .streaming-content .message-text:not(:last-child) {
        margin-bottom: 0.5rem;
      }

      .input-action-btn.recording {
        color: #ef4444 !important;
        border-color: #ef4444 !important;
        background: rgba(239, 68, 68, 0.1) !important;
        animation: recordingPulse 1.5s ease-in-out infinite;
      }

      @keyframes recordingPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.05); }
      }

      .speech-feedback {
        padding: 0.75rem 1rem;
        background: #1f1f1f;
        border-top: 1px solid #404040;
        border-bottom: 1px solid #404040;
        animation: slideIn 0.3s ease-out;
      }

      .speech-feedback-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: #d4d4d8;
        font-size: 0.875rem;
      }

      .speech-feedback-content.recording {
        color: #f59e0b;
      }

      .speech-feedback-content.processing {
        color: #3b82f6;
      }

      .recording-animation {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #ef4444;
        animation: recordingBlink 1s ease-in-out infinite;
      }

      @keyframes recordingBlink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }

      .processing-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #404040;
        border-top: 2px solid #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .speech-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        color: white;
        font-size: 0.875rem;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      }

      .speech-notification.success {
        background: #10b981;
      }

      .speech-notification.error {
        background: #ef4444;
      }

      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }

      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }

      /* Enhanced progressive loading effects */
      .message.streaming {
        animation: none;
        contain: layout style;
      }

      .streaming-content {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        contain: layout;
      }

      /* Progressive text rendering effects */
      .message-text.typing-cursor {
        position: relative;
        min-height: 1.2em;
        /* Add subtle background for progressive effect */
        background: linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.05), transparent);
        background-size: 200% 100%;
        animation: progressiveGlow 2s ease-in-out infinite;
        border-radius: 4px;
        padding: 2px 4px;
        margin: -2px -4px;
      }

      @keyframes progressiveGlow {
        0%, 100% { background-position: -200% 0; }
        50% { background-position: 200% 0; }
      }

      /* Enhanced typing cursor with progressive effect */
      .typing-cursor::after {
        content: '▊';
        color: #60a5fa;
        animation: progressiveBlink 1s infinite, pulse 2s ease-in-out infinite;
        margin-left: 2px;
        font-weight: normal;
        position: absolute;
        width: 0;
        overflow: visible;
        text-shadow: 0 0 8px rgba(96, 165, 250, 0.5);
      }

      @keyframes progressiveBlink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }

      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      /* Progressive code block effects */
      .streaming-code {
        border: 2px solid #3b82f6 !important;
        box-shadow: 0 0 15px rgba(59, 130, 246, 0.3) !important;
        animation: codeStreamGlow 1.5s ease-in-out infinite;
      }

      @keyframes codeStreamGlow {
        0%, 100% { 
          box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
        }
        50% { 
          box-shadow: 0 0 25px rgba(59, 130, 246, 0.5);
        }
      }

      .streaming-code-text.typing-cursor::after {
        content: '▊';
        color: #60a5fa;
        animation: progressiveBlink 1s infinite;
        margin-left: 1px;
        font-weight: normal;
        text-shadow: 0 0 6px rgba(96, 165, 250, 0.7);
      }

      /* Smooth character appearance */
      .message-text {
        font-size: 0.875rem;
        line-height: 1.6;
        color: #d4d4d8;
        word-wrap: break-word;
        white-space: pre-wrap;
        /* Smooth transitions for progressive text */
        transition: all 0.1s ease-out;
      }

      /* Progressive loading container effects */
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 1rem;
        display: block;
        contain: layout style;
        /* Smooth scrolling for progressive content */
        scroll-behavior: auto;
      }

      /* Individual messages with progressive support */
      .message {
        display: flex;
        gap: 0.75rem;
        max-width: 100%;
        margin-bottom: 1.5rem;
        contain: layout;
        animation: slideIn 0.3s ease-out;
        /* Support for progressive effects */
        transition: all 0.2s ease-out;
      }

      /* Enhanced streaming message appearance */
      .message.streaming .message-content {
        background: linear-gradient(135deg, rgba(96, 165, 250, 0.02), rgba(124, 58, 237, 0.02));
        border-radius: 8px;
        padding: 8px;
        margin: -8px;
        border: 1px solid rgba(96, 165, 250, 0.1);
      }

      /* Progressive word/character effects */
      .progressive-char {
        animation: charAppear 0.3s ease-out;
      }

      @keyframes charAppear {
        from {
          opacity: 0;
          transform: translateY(10px) scale(0.8);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      /* Fix streaming message layout */
      .message.streaming {
        animation: none;
        contain: layout style;
      }

      .message.streaming .message-text {
        /* Ensure proper text flow during streaming */
        white-space: pre-wrap;
        word-wrap: break-word;
        min-height: 1.2em;
        line-height: 1.6;
      }

      .message.streaming .message-content {
        /* Ensure content container maintains proper layout */
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      /* Enhanced typing cursor for better visibility */
      .message-text.typing-cursor::after {
        content: '▊';
        color: #60a5fa;
        animation: blink 1s infinite;
        margin-left: 2px;
        font-weight: normal;
      }

      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }

      /* CRITICAL: Fix streaming message layout */
      .message.streaming {
        animation: none;
        contain: layout style;
        /* Ensure proper message structure during streaming */
        display: flex;
        gap: 0.75rem;
        max-width: 100%;
        margin-bottom: 1.5rem;
      }

      .message.streaming .message-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .message.streaming .message-text {
        font-size: 0.875rem;
        line-height: 1.6;
        color: #d4d4d8;
        word-wrap: break-word;
        white-space: pre-wrap;
        /* Ensure the text container has proper styling */
        background: rgba(124, 58, 237, 0.05);
        border-radius: 8px;
        padding: 0.75rem;
        border: 1px solid rgba(124, 58, 237, 0.1);
        min-height: 1.2em;
        position: relative;
      }

      /* Enhanced typing cursor that doesn't break layout */
      .message-text.typing-cursor::after {
        content: '▊';
        color: #60a5fa;
        animation: blink 1s infinite;
        margin-left: 2px;
        font-weight: normal;
        /* Position absolutely to prevent layout shifts */
        position: absolute;
        width: 0;
        overflow: visible;
      }

      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }

      /* Ensure message avatar stays in place during streaming */
      .message.streaming .message-avatar {
        width: 2rem;
        height: 2rem;
        border-radius: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.875rem;
        flex-shrink: 0;
        margin-top: 0.125rem;
        background: #7c3aed;
        color: white;
      }

      /* Message header styling for streaming */
      .message.streaming .message-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .message.streaming .message-role {
        font-size: 0.875rem;
        font-weight: 600;
        color: #e4e4e7;
      }

      .message.streaming .message-time {
        font-size: 0.75rem;
        color: #71717a;
      }

      /* Ensure proper container layout */
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 1rem;
        display: block;
        contain: layout style;
        /* Ensure smooth scrolling during streaming */
        scroll-behavior: auto;
      }

      /* Regular message styling for comparison */
      .message {
        display: flex;
        gap: 0.75rem;
        max-width: 100%;
        margin-bottom: 1.5rem;
        contain: layout;
        animation: slideIn 0.3s ease-out;
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

      /* Ensure completed messages maintain proper structure */
      .message:not(.streaming) .message-text {
        font-size: 0.875rem;
        line-height: 1.6;
        color: #d4d4d8;
        word-wrap: break-word;
        white-space: pre-wrap;
        /* Remove the streaming-specific background */
        background: none;
        border: none;
        padding: 0;
      }

      .message:not(.streaming) .message-content {
        flex: 1;
        min-width: 0;
      }

      /* Ensure code blocks in completed messages look correct */
      .message:not(.streaming) .code-block {
        margin: 1rem 0;
        border-radius: 0.75rem;
        background: #0d1117;
        border: 1px solid #30363d;
        overflow: hidden;
      }

      /* FIXED: Ensure streaming text stays within container borders */
      .message.streaming .message-text {
        font-size: 0.875rem;
        line-height: 1.6;
        color: #d4d4d8;
        word-wrap: break-word;
        white-space: pre-wrap;
        /* Ensure proper containment */
        background: rgba(124, 58, 237, 0.05);
        border-radius: 8px;
        padding: 0.75rem;
        border: 1px solid rgba(124, 58, 237, 0.1);
        min-height: 1.2em;
        position: relative;
        /* CRITICAL: Prevent text overflow */
        overflow-wrap: break-word;
        word-break: break-word;
        max-width: 100%;
        box-sizing: border-box;
        /* Ensure content doesn't exceed container */
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Enhanced typing cursor that doesn't break layout or overflow */
      .message-text.typing-cursor::after {
        content: '▊';
        color: #60a5fa;
        animation: blink 1s infinite;
        margin-left: 2px;
        font-weight: normal;
        /* Position absolutely within the container */
        position: absolute;
        right: 0.75rem;
        width: 0;
        overflow: visible;
        z-index: 1;
      }

      /* Ensure the message container itself has proper bounds */
      .message.streaming {
        animation: none;
        contain: layout style;
        display: flex;
        gap: 0.75rem;
        max-width: 100%;
        margin-bottom: 1.5rem;
        /* Prevent overflow */
        overflow: hidden;
      }

      .message.streaming .message-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        /* Ensure content doesn't overflow */
        max-width: 100%;
        overflow: hidden;
      }
    `;
    
    document.head.appendChild(style);
  }

  private setupEventListeners(): void {
    // Remove existing listeners first to prevent duplicates
    this.removeEventListeners();
    
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

    // Quick action buttons - fix event delegation
    const setupQuickActionListeners = () => {
      const quickActionButtons = document.querySelectorAll('.quick-action');
      quickActionButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const action = button.getAttribute('data-action');
          if (action) {
            this.handleQuickAction(action);
          }
        });
      });
    };

    // Set up listeners immediately and on mutations
    setupQuickActionListeners();
    
    // Watch for DOM changes to re-setup listeners
    const observer = new MutationObserver(() => {
      setupQuickActionListeners();
    });
    
    observer.observe(document.body, { childList: true, subtree: true });

    // Add microphone button listener
    const microphoneBtn = document.getElementById('microphone-btn') as HTMLButtonElement;
    if (microphoneBtn) {
      microphoneBtn.addEventListener('click', () => this.toggleRecording());
    }

    // File attachment handlers
    const attachFilesBtn = document.getElementById('attach-files');
    if (attachFilesBtn) {
      attachFilesBtn.addEventListener('click', () => {
        this.showFilePicker();
      });
    }

    const clearAllFilesBtn = document.getElementById('clear-all-files');
    if (clearAllFilesBtn) {
      clearAllFilesBtn.addEventListener('click', () => {
        this.clearAllAttachedFiles();
      });
    }
  }

  private removeEventListeners(): void {
    // Remove any existing listeners to prevent duplicates
    const elements = [
      'chat-input',
      'send-message', 
      'api-key-submit',
      'quick-actions-toggle',
      'attach-code',
      'attach-files',
      'clear-all-files',
      'microphone-btn'
    ];
    
    elements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        // Clone and replace to remove all listeners
        const newElement = element.cloneNode(true);
        element.parentNode?.replaceChild(newElement, element);
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
    // If API key is already configured, show chat interface
    if (this.chatState.apiKeyConfigured) {
      this.showChatInterface();
    } else {
      this.showAPIKeySetup();
    }
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

    const userContent = input.value.trim();
    let messageContent = userContent;

    // Include attached files context
    if (this.attachedFiles.size > 0) {
      let contextContent = '\n\n**Attached Files:**\n\n';
      
      this.attachedFiles.forEach((file) => {
        contextContent += `**${file.name}:**\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n\n`;
      });
      
      contextContent += `**Question:** ${userContent}`;
      messageContent = contextContent;
    }

    // Clear input
    input.value = '';
    this.autoResizeTextarea(input);
    this.updateCharCount(input);

    // Create user message (display only the user's question, not the full context)
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
      timestamp: new Date(),
      metadata: {
        filePath: this.state.currentFile,
        selectedText: this.getSelectedText(),
        projectPath: this.state.currentWorkingDirectory
      }
    };

    this.chatState.messages.push(userMessage);
    this.renderMessages();

    // Show loading state
    this.chatState.isLoading = true;
    this.showTypingIndicator();

    try {
      // Prepare messages for API (include full context for attached files)
      const apiMessages = this.chatState.messages.slice(0, -1).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      apiMessages.push({
        role: 'user',
        content: messageContent // This includes the full context with attached files
      });

      await window.electronAPI.callAnthropicAPIStream(
        apiMessages,
        this.getSystemPrompt()
      );
      
    } catch (error) {
      console.error('Failed to start streaming:', error);
      this.handleStreamError(this.getErrorMessage(error as Error));
    }
  }

  private getSelectedText(): string | undefined {
    if (this.state.monacoEditor) {
      const selection = this.state.monacoEditor.getSelection();
      if (selection && !selection.isEmpty()) {
        return this.state.monacoEditor.getModel()?.getValueInRange(selection);
      }
    }
    return undefined;
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
    const container = document.getElementById('chat-messages'); // Direct reference now
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
    
    // Only process basic markdown, don't break structure
    // Bold text
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic text
    processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Inline code (but not code blocks)
    processed = processed.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    
    // Bullet points
    processed = processed.replace(/^• (.*$)/gim, '• $1');
    
    // Convert newlines to proper line breaks
    processed = processed.replace(/\n/g, '<br>');
    
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
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
      // Set flag to indicate this is programmatic scrolling
      this.isScrolling = true;
      
      // Force immediate scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      // Clear the programmatic scrolling flag
    setTimeout(() => {
        this.isScrolling = false;
      }, 50);
    }
  }

  private smoothScrollToBottom(): void {
    if (!this.autoScrollEnabled) return;

    const messagesContainer = document.getElementById('chat-messages') as HTMLElement;
    if (!messagesContainer) return;

    // Cancel any existing scroll animation
    if (this.scrollAnimationFrame) {
      cancelAnimationFrame(this.scrollAnimationFrame);
    }

    // Set flag to indicate this is programmatic scrolling
    this.isScrolling = true;

    // Use requestAnimationFrame for smooth scrolling
    this.scrollAnimationFrame = requestAnimationFrame(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      this.scrollAnimationFrame = null;
      
      // Clear the programmatic scrolling flag
      setTimeout(() => {
        this.isScrolling = false;
      }, 50);
    });
  }

  private forceScrollToBottom(): void {
    const messagesContainer = document.getElementById('chat-messages') as HTMLElement;
    if (!messagesContainer) return;

    // Use multiple approaches to ensure scrolling works
    requestAnimationFrame(() => {
      // Set flag to indicate this is programmatic scrolling
      this.isScrolling = true;

      // Method 1: Direct scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      // Method 2: Ensure the last message is visible
      const lastMessage = messagesContainer.lastElementChild;
      if (lastMessage) {
        lastMessage.scrollIntoView({ block: 'end', behavior: 'auto' });
      }
      
      // Method 3: Double-check scroll position after a brief delay
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        this.isScrolling = false;
      }, 10);
    });
  }

  private setupScrollMonitoring(): void {
    const messagesContainer = document.getElementById('chat-messages') as HTMLElement;
    if (!messagesContainer) return;

    messagesContainer.addEventListener('scroll', () => {
      // Don't monitor scroll during active streaming - always keep auto-scroll enabled
      if (this.currentStreamingMessage) {
        this.autoScrollEnabled = true;
        return;
      }
      
      // Only check scroll position when not streaming
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;
      
      if (!this.isScrolling) {
        this.autoScrollEnabled = isAtBottom;
      }
    });
  }

  private showTypingIndicator(): void {
    const container = document.getElementById('chat-messages'); // Direct reference now
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
    if (!this.state.monacoEditor) {
      console.warn('Monaco editor not available');
      return;
    }

    // Get current file content and cursor position
    const currentContent = this.state.monacoEditor.getValue();
    const selection = this.state.monacoEditor.getSelection();
    const cursorPosition = this.state.monacoEditor.getPosition();

    // Show insertion preview dialog
    this.showInsertionPreview(code, currentContent, selection, cursorPosition);
  }

  private showInsertionPreview(code: string, currentContent: string, selection: any, cursorPosition: any): void {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'insertion-preview-overlay';
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'insertion-preview-modal';
    
    modal.innerHTML = `
      <div class="insertion-preview-header">
        <h3>Code Insertion Preview</h3>
        <button class="close-btn" onclick="this.closest('.insertion-preview-overlay').remove()">✕</button>
      </div>
      
      <div class="insertion-preview-tabs">
        <button class="tab-btn active" data-tab="smart">Smart Insert</button>
        <button class="tab-btn" data-tab="replace">Replace Selection</button>
        <button class="tab-btn" data-tab="append">Append to File</button>
      </div>
      
      <div class="insertion-preview-content">
        <div class="preview-section">
          <div class="preview-label">Preview:</div>
          <div class="diff-container" id="diff-container"></div>
        </div>
        
        <div class="insertion-options">
          <label class="option">
            <input type="checkbox" id="format-on-insert" checked>
            Format code after insertion
          </label>
          <label class="option">
            <input type="checkbox" id="add-imports" checked>
            Auto-add missing imports
          </label>
        </div>
      </div>
      
      <div class="insertion-preview-actions">
        <button class="btn-secondary" onclick="this.closest('.insertion-preview-overlay').remove()">Cancel</button>
        <button class="btn-primary" id="confirm-insert">Insert Code</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Add styles for the modal
    this.injectInsertionPreviewStyles();

    // Store data for tab switching
    (modal as any)._insertionData = { code, currentContent, selection, cursorPosition };

    // Setup tab switching with proper data
    this.setupPreviewTabs(modal);
    
    // Initialize with smart insert preview
    this.updateInsertionPreview('smart', code, currentContent, selection, cursorPosition);

    // Setup confirm button
    const confirmBtn = modal.querySelector('#confirm-insert') as HTMLButtonElement;
    confirmBtn.onclick = () => {
      const activeTab = modal.querySelector('.tab-btn.active')?.getAttribute('data-tab') || 'smart';
      const formatOnInsert = (modal.querySelector('#format-on-insert') as HTMLInputElement).checked;
      const addImports = (modal.querySelector('#add-imports') as HTMLInputElement).checked;
      
      this.performInsertion(activeTab, code, selection, cursorPosition, { formatOnInsert, addImports });
      overlay.remove();
    };

    // Add keyboard shortcuts
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        confirmBtn.click();
      }
    });

    // Focus the modal for keyboard navigation
    modal.tabIndex = -1;
    modal.focus();
  }

  private setupPreviewTabs(modal: HTMLElement): void {
    const tabs = modal.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Remove active class from all tabs
        tabs.forEach(t => t.classList.remove('active'));
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Get stored data
        const data = (modal as any)._insertionData;
        if (!data) return;

        // Update preview based on selected tab with real data
        const tabType = tab.getAttribute('data-tab') || 'smart';
        this.updateInsertionPreview(tabType, data.code, data.currentContent, data.selection, data.cursorPosition);
        
        // Update button text based on mode
        this.updateInsertButtonText(modal, tabType);
      });
    });
  }

  private updateInsertButtonText(modal: HTMLElement, mode: string): void {
    const insertBtn = modal.querySelector('#confirm-insert') as HTMLButtonElement;
    if (!insertBtn) return;

    const buttonText = {
      'smart': 'Smart Insert',
      'replace': 'Replace Selection',
      'append': 'Append to File'
    };

    insertBtn.textContent = buttonText[mode as keyof typeof buttonText] || 'Insert Code';
  }

  private updateInsertionPreview(mode: string, code: string, currentContent: string, selection: any, cursorPosition: any): void {
    const diffContainer = document.getElementById('diff-container');
    if (!diffContainer) return;

    // Show loading state
    diffContainer.innerHTML = '<div class="diff-loading">Generating preview...</div>';

    // Small delay to show loading state
    setTimeout(() => {
    const lines = currentContent.split('\n');
    const newCodeLines = code.split('\n');
    
    let previewHTML = '';
    
    if (mode === 'smart') {
      const insertionPoint = this.findSmartInsertionPoint(code, currentContent, cursorPosition);
      previewHTML = this.generateSmartInsertionPreview(lines, newCodeLines, insertionPoint);
    } else if (mode === 'replace') {
        // Check if there's actually a selection
        if (this.hasValidSelection(selection)) {
      previewHTML = this.generateReplacementPreview(lines, newCodeLines, selection);
        } else {
          previewHTML = this.generateNoSelectionMessage();
        }
    } else if (mode === 'append') {
      previewHTML = this.generateAppendPreview(lines, newCodeLines);
    }
    
    diffContainer.innerHTML = previewHTML;
    }, 100);
  }

  private hasValidSelection(selection: any): boolean {
    if (!selection) return false;
    
    // Check if there's actually text selected
    return selection.startLineNumber !== selection.endLineNumber || 
           selection.startColumn !== selection.endColumn;
  }

  private generateNoSelectionMessage(): string {
    return `
      <div class="no-selection-message">
        <div class="warning-icon">⚠️</div>
        <div class="warning-text">
          <strong>No text selected</strong><br>
          Please select text in the editor to use Replace Selection mode.
        </div>
      </div>
    `;
  }

  private findSmartInsertionPoint(code: string, currentContent: string, cursorPosition: any): { line: number; column: number; reason: string } {
    const lines = currentContent.split('\n');
    const currentLine = (cursorPosition?.lineNumber || 1) - 1; // Convert to 0-based
    
    // More sophisticated heuristics for smart insertion
    if (code.includes('import ') || code.includes('require(')) {
      // Find the last import statement or beginning of file
      let insertLine = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith('import') && !line.startsWith('//') && !line.startsWith('/*') && !line.includes('require(')) {
          insertLine = i;
          break;
        }
        if (line.startsWith('import') || line.includes('require(')) {
          insertLine = i + 1;
        }
      }
      return { line: insertLine, column: 0, reason: 'Import statements should be grouped at the top' };
    }
    
    // Check for React component patterns
    if (code.includes('export default') || code.includes('export const') || code.includes('export function')) {
      // Insert at the end of the file for exports
      return { line: lines.length, column: 0, reason: 'Export statements should be at the end' };
    }
    
    if (code.includes('function ') || code.includes('const ') || code.includes('let ') || code.includes('var ')) {
      // Insert at current cursor position with proper spacing
      let insertLine = currentLine;
      
      // Try to find a good spot near the cursor
      while (insertLine > 0 && lines[insertLine - 1].trim() === '') {
        insertLine--;
      }
      
      return { line: insertLine, column: 0, reason: 'Function/variable declaration near cursor position' };
    }
    
    if (code.includes('class ')) {
      // Insert classes with proper spacing
      return { line: currentLine, column: 0, reason: 'Class declaration at cursor position' };
    }
    
    // Default: insert at cursor with smart spacing
    let insertLine = currentLine;
    
    // Don't insert in the middle of a block
    const currentLineText = lines[currentLine]?.trim() || '';
    if (currentLineText && !currentLineText.endsWith('{') && !currentLineText.endsWith(';')) {
      // Find next appropriate line
      while (insertLine < lines.length && lines[insertLine].trim() !== '') {
        insertLine++;
      }
    }
    
    return { line: insertLine, column: 0, reason: 'Insert at cursor position with smart spacing' };
  }

  private generateSmartInsertionPreview(lines: string[], newCodeLines: string[], insertionPoint: { line: number; column: number; reason: string }): string {
    let preview = '';
    const contextLines = 4;
    
    const startLine = Math.max(0, insertionPoint.line - contextLines);
    const endLine = Math.min(lines.length, insertionPoint.line + contextLines + newCodeLines.length + 2);
    
    // Add reason header
    preview += `<div class="preview-reason">${insertionPoint.reason}</div>`;
    
    for (let i = startLine; i < endLine; i++) {
      if (i === insertionPoint.line) {
        // Add empty line before insertion if needed
        if (i > 0 && lines[i - 1].trim() !== '') {
          preview += `<div class="diff-line added empty-line" data-line="+">""</div>`;
        }
        
        // Show insertion point
        newCodeLines.forEach((codeLine, idx) => {
          const lineNumber = `+${insertionPoint.line + idx + 1}`;
          preview += `<div class="diff-line added" data-line="${lineNumber}">${this.escapeHtml(codeLine)}</div>`;
        });
        
        // Add empty line after insertion if needed
        if (i < lines.length && lines[i].trim() !== '') {
          preview += `<div class="diff-line added empty-line" data-line="+">""</div>`;
        }
      }
      
      if (i < lines.length) {
        const className = 'context';
        preview += `<div class="diff-line ${className}" data-line="${i + 1}">${this.escapeHtml(lines[i])}</div>`;
  }
}

    return preview;
  }

  private generateReplacementPreview(lines: string[], newCodeLines: string[], selection: any): string {
    let preview = '';
    const startLine = selection.startLineNumber - 1; // Convert to 0-based
    const endLine = selection.endLineNumber - 1;
    const startColumn = selection.startColumn - 1;
    const endColumn = selection.endColumn - 1;
    const contextLines = 3;
    
    const previewStart = Math.max(0, startLine - contextLines);
    const previewEnd = Math.min(lines.length, endLine + contextLines + 1);
    
    // Add replacement info header
    preview += `<div class="preview-reason">Replacing ${endLine - startLine + 1} line(s) of selected text</div>`;
    
    for (let i = previewStart; i < previewEnd; i++) {
      if (i >= startLine && i <= endLine) {
        // Handle partial line selection
        let lineContent = lines[i];
        
        if (i === startLine && i === endLine) {
          // Single line selection
          const before = lineContent.substring(0, startColumn);
          const selected = lineContent.substring(startColumn, endColumn);
          const after = lineContent.substring(endColumn);
          
          if (before) {
            preview += `<div class="diff-line context" data-line="${i + 1}">${this.escapeHtml(before)}<span class="selection-highlight">${this.escapeHtml(selected)}</span>${this.escapeHtml(after)}</div>`;
          }
          
          // Show removed content
          preview += `<div class="diff-line removed" data-line="-${i + 1}">${this.escapeHtml(selected)}</div>`;
          
          // Show new content
          newCodeLines.forEach((codeLine, idx) => {
            preview += `<div class="diff-line added" data-line="+${i + idx + 1}">${this.escapeHtml(codeLine)}</div>`;
          });
          
        } else if (i === startLine) {
          // First line of multi-line selection
          const before = lineContent.substring(0, startColumn);
          const selected = lineContent.substring(startColumn);
          
          if (before) {
            preview += `<div class="diff-line context" data-line="${i + 1}">${this.escapeHtml(before)}<span class="selection-highlight">${this.escapeHtml(selected)}</span></div>`;
          }
          preview += `<div class="diff-line removed" data-line="-${i + 1}">${this.escapeHtml(selected)}</div>`;
          
          // Show new content (only once)
          newCodeLines.forEach((codeLine, idx) => {
            preview += `<div class="diff-line added" data-line="+${i + idx + 1}">${this.escapeHtml(codeLine)}</div>`;
          });
          
        } else if (i === endLine) {
          // Last line of multi-line selection
          const selected = lineContent.substring(0, endColumn);
          const after = lineContent.substring(endColumn);
          
          preview += `<div class="diff-line removed" data-line="-${i + 1}">${this.escapeHtml(selected)}</div>`;
          
          if (after) {
            preview += `<div class="diff-line context" data-line="${i + 1}"><span class="selection-highlight">${this.escapeHtml(selected)}</span>${this.escapeHtml(after)}</div>`;
          }
          
        } else {
          // Full line in the middle of selection
          preview += `<div class="diff-line removed" data-line="-${i + 1}">${this.escapeHtml(lineContent)}</div>`;
        }
      } else {
        // Context lines
        preview += `<div class="diff-line context" data-line="${i + 1}">${this.escapeHtml(lines[i])}</div>`;
      }
    }
    
    return preview;
  }

  private performInsertion(mode: string, code: string, selection: any, cursorPosition: any, options: { formatOnInsert: boolean; addImports: boolean }): void {
    if (!this.state.monacoEditor) return;

    let insertOperation;
    
    try {
      switch (mode) {
        case 'smart':
          const insertionPoint = this.findSmartInsertionPoint(code, this.state.monacoEditor.getValue(), cursorPosition);
          insertOperation = {
            range: {
              startLineNumber: insertionPoint.line + 1,
              startColumn: 1,
              endLineNumber: insertionPoint.line + 1,
              endColumn: 1
            },
            text: (insertionPoint.line > 0 ? '\n' : '') + code + '\n'
          };
          break;
          
        case 'replace':
          if (!this.hasValidSelection(selection)) {
            this.showError('No text selected. Please select text to replace.');
            return;
          }
          
          insertOperation = {
            range: {
              startLineNumber: selection.startLineNumber,
              startColumn: selection.startColumn,
              endLineNumber: selection.endLineNumber,
              endColumn: selection.endColumn
            },
            text: code
          };
          break;
          
        case 'append':
          const model = this.state.monacoEditor.getModel();
          if (!model) return;
          
          const lineCount = model.getLineCount();
          const lastLineContent = model.getLineContent(lineCount);
          const needsNewline = lastLineContent.trim() !== '';
          
          insertOperation = {
            range: {
              startLineNumber: lineCount,
              startColumn: model.getLineMaxColumn(lineCount),
              endLineNumber: lineCount,
              endColumn: model.getLineMaxColumn(lineCount)
            },
            text: (needsNewline ? '\n\n' : '\n') + code
          };
          break;
          
        default:
          return;
      }

      // Perform the insertion
      this.state.monacoEditor.executeEdits('ai-assistant', [insertOperation]);

      // Format if requested
      if (options.formatOnInsert) {
        setTimeout(() => {
          this.state.monacoEditor?.getAction('editor.action.formatDocument')?.run();
        }, 100);
      }

      // Focus the editor and position cursor
      this.state.monacoEditor.focus();
      
      // Position cursor at the end of inserted content
      if (mode === 'replace' || mode === 'smart') {
        const insertedLines = code.split('\n');
        const newPosition = {
          lineNumber: (insertOperation.range.startLineNumber) + insertedLines.length - 1,
          column: insertedLines[insertedLines.length - 1].length + 1
        };
        this.state.monacoEditor.setPosition(newPosition);
      }

      // Show success indicator
      this.showInsertionSuccess(mode);
      
    } catch (error) {
      console.error('Insertion failed:', error);
      this.showError('Failed to insert code. Please try again.');
    }
  }

  private showError(message: string): void {
    const indicator = document.createElement('div');
    indicator.textContent = `❌ ${message}`;
    indicator.style.cssText = `
      position: fixed; top: 20px; right: 20px; background: #ef4444;
      color: white; padding: 12px 16px; border-radius: 6px; z-index: 10001;
      font-size: 0.875rem; font-weight: 500;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      animation: slideInRight 0.3s ease-out;
      max-width: 300px;
    `;
    
    document.body.appendChild(indicator);
    
    setTimeout(() => {
      indicator.style.animation = 'slideInRight 0.3s ease-out reverse';
      setTimeout(() => indicator.remove(), 300);
    }, 4000);
  }

  private injectInsertionPreviewStyles(): void {
    if (document.getElementById('insertion-preview-styles')) return;

    const style = document.createElement('style');
    style.id = 'insertion-preview-styles';
    style.textContent = `
      .insertion-preview-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease-out;
      }

      .insertion-preview-modal {
        background: #1a1a1a;
        border: 1px solid #404040;
        border-radius: 12px;
        width: 90%;
        max-width: 900px;
        max-height: 80%;
        display: flex;
        flex-direction: column;
        animation: slideIn 0.3s ease-out;
        outline: none;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideIn {
        from { transform: translateY(-30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .insertion-preview-header {
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #404040;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .insertion-preview-header h3 {
        margin: 0;
        color: #e4e4e7;
        font-size: 1.1rem;
        font-weight: 600;
      }

      .close-btn {
        background: none;
        border: none;
        color: #71717a;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 0.25rem;
        transition: all 0.2s;
      }

      .close-btn:hover {
        background: #374151;
        color: #e4e4e7;
      }

      .insertion-preview-tabs {
        display: flex;
        border-bottom: 1px solid #404040;
        background: #171717;
      }

      .tab-btn {
        background: none;
        border: none;
        padding: 0.75rem 1rem;
        color: #71717a;
        cursor: pointer;
        font-size: 0.875rem;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
        position: relative;
      }

      .tab-btn:hover {
        color: #d4d4d8;
        background: #262626;
      }

      .tab-btn.active {
        color: #60a5fa;
        border-bottom-color: #60a5fa;
        background: #1a1a1a;
      }

      .insertion-preview-content {
        flex: 1;
        padding: 1.5rem;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .preview-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .preview-label {
        font-size: 0.875rem;
        font-weight: 600;
        color: #d4d4d8;
        margin-bottom: 0.5rem;
      }

      .diff-container {
        flex: 1;
        background: #0d1117;
        border: 1px solid #30363d;
        border-radius: 6px;
        overflow: auto;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
        font-size: 0.8125rem;
        line-height: 1.5;
      }

      .preview-reason {
        padding: 0.75rem 1rem;
        background: #1f2937;
        border-bottom: 1px solid #30363d;
        color: #60a5fa;
        font-size: 0.8125rem;
        font-weight: 500;
      }

      .diff-loading {
        padding: 2rem;
        text-align: center;
        color: #71717a;
        font-style: italic;
      }

      .diff-line {
        padding: 0.25rem 2.5rem 0.25rem 0.75rem;
        position: relative;
        white-space: pre;
        min-height: 1.2em;
      }

      .diff-line::before {
        content: attr(data-line);
        position: absolute;
        left: 0.25rem;
        width: 1.5rem;
        color: #6e7681;
        font-size: 0.75rem;
        text-align: right;
      }

      .diff-line.added {
        background: rgba(46, 160, 67, 0.15);
        color: #aff5b4;
      }

      .diff-line.added::before {
        color: #46a669;
      }

      .diff-line.removed {
        background: rgba(248, 81, 73, 0.15);
        color: #ffdcd7;
      }

      .diff-line.removed::before {
        color: #f85149;
      }

      .diff-line.context {
        color: #e6edf3;
      }

      .diff-line.empty-line {
        font-style: italic;
        opacity: 0.6;
      }

      .selection-highlight {
        background: rgba(255, 255, 0, 0.2);
        border-radius: 2px;
        padding: 0 2px;
      }

      .no-selection-message {
        padding: 2rem;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        color: #71717a;
      }

      .warning-icon {
        font-size: 2rem;
      }

      .warning-text {
        font-size: 0.875rem;
        line-height: 1.5;
      }

      .insertion-options {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem;
        background: #171717;
        border-radius: 6px;
        border: 1px solid #374151;
      }

      .option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #d4d4d8;
        font-size: 0.875rem;
        cursor: pointer;
        transition: color 0.2s;
      }

      .option:hover {
        color: #e4e4e7;
      }

      .option input[type="checkbox"] {
        width: 1rem;
        height: 1rem;
        accent-color: #60a5fa;
      }

      .insertion-preview-actions {
        padding: 1rem 1.5rem;
        border-top: 1px solid #404040;
        display: flex;
        gap: 0.75rem;
        justify-content: space-between;
        align-items: center;
      }

      .keyboard-hint {
        color: #71717a;
        font-size: 0.75rem;
      }

      .btn-secondary, .btn-primary {
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
        min-width: 100px;
      }

      .btn-secondary {
        background: #374151;
        color: #d4d4d8;
      }

      .btn-secondary:hover {
        background: #4b5563;
      }

      .btn-primary {
        background: #60a5fa;
        color: #1a1a1a;
      }

      .btn-primary:hover {
        background: #3b82f6;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(96, 165, 250, 0.3);
      }

      .btn-primary:active {
        transform: translateY(0);
      }
    `;
    
    document.head.appendChild(style);
  }

  private showInsertionSuccess(mode: string): void {
    const indicator = document.createElement('div');
    indicator.textContent = `✅ Code inserted using ${mode} mode`;
    indicator.style.cssText = `
      position: fixed; top: 20px; right: 20px; background: #10b981;
      color: white; padding: 12px 16px; border-radius: 6px; z-index: 10001;
      font-size: 0.875rem; font-weight: 500;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      animation: slideInRight 0.3s ease-out;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(indicator);
    
    setTimeout(() => {
      indicator.style.animation = 'slideInRight 0.3s ease-out reverse';
      setTimeout(() => {
        indicator.remove();
        style.remove();
      }, 300);
    }, 3000);
  }

  clearChat(): void {
    console.log('🔧 ChatManager clearChat called');
    
    // Clear the state
    this.chatState.messages = [];
    
    // Clear the UI
    const container = document.getElementById('messages-container');
    if (container) {
      container.innerHTML = '';
      console.log('✅ Messages container cleared');
    } else {
      console.log('❌ Messages container not found');
    }
    
    // Add welcome message back
    this.addWelcomeMessage();
    
    console.log('✅ Chat cleared successfully');
  }

  exposeGlobally(): void {
    (window as any).chatManager = this;
    console.log('✅ ChatManager exposed globally');
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

  // Add method to get current state
  getState(): ChatState {
    return { ...this.chatState };
  }

  // Add method to restore state
  setState(state: ChatState): void {
    this.chatState = { ...state };
  }

  // Add a method to check if chat is properly set up
  isReady(): boolean {
    const chatContent = document.getElementById('ai-chat-content');
    const hasProperStructure = chatContent?.querySelector('.chat-container');
    return this.isUIReady && !!hasProperStructure;
  }

  // Expose the chat state so layout manager can check it
  getChatState(): ChatState {
    return this.chatState;
  }

  private setupStreamingListeners(): void {
    if (!window.electronAPI) return;

    // Set up streaming event listeners
    window.electronAPI.onAIStreamStart?.((data: { sessionId: string }) => {
      console.log('🚀 Stream started:', data.sessionId);
      this.handleStreamStart(data.sessionId);
    });

    window.electronAPI.onAIStreamToken?.((data: { sessionId: string; token: string; type: string }) => {
      if (data.sessionId === this.currentStreamSessionId) {
        this.handleStreamToken(data.token);
      }
    });

    window.electronAPI.onAIStreamEnd?.((data: { sessionId: string }) => {
      if (data.sessionId === this.currentStreamSessionId) {
        console.log('✅ Stream completed:', data.sessionId);
        this.handleStreamEnd();
      }
    });

    window.electronAPI.onAIStreamError?.((data: { error: string }) => {
      console.error('❌ Stream error:', data.error);
      this.handleStreamError(data.error);
    });
  }

  private handleStreamStart(sessionId: string): void {
    // Hide typing indicator
    this.hideTypingIndicator();
    
    // FORCE enable auto-scroll and disable any scroll monitoring during streaming
    this.autoScrollEnabled = true;
    this.isScrolling = false;
    
    console.log('🚀 Stream started - FORCING auto-scroll enabled');
    
    // Create streaming message
    this.currentStreamSessionId = sessionId;
    this.currentStreamingMessage = {
      id: sessionId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };

    // Add empty message to state
    this.chatState.messages.push(this.currentStreamingMessage);
    
    // Create the message element
    this.createStreamingMessageElement();
    
    // Immediately scroll to the new message
    this.forceScrollToBottomImmediate();
  }

  private createStreamingMessageElement(): void {
    if (!this.currentStreamingMessage) return;

    const container = document.getElementById('chat-messages');
    if (!container) return;

    // Create the message element with proper structure
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant streaming';
    messageDiv.setAttribute('data-message-id', this.currentStreamingMessage.id);
    
    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';

    // Content container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Header
    const header = document.createElement('div');
    header.className = 'message-header';

    const role = document.createElement('span');
    role.className = 'message-role';
    role.textContent = 'Claude';

    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = this.currentStreamingMessage.timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    header.appendChild(role);
    header.appendChild(time);

    // FIXED: Create proper message text container (not streaming-content)
    const messageText = document.createElement('div');
    messageText.className = 'message-text typing-cursor';
    messageText.textContent = ''; // Start empty

    contentDiv.appendChild(header);
    contentDiv.appendChild(messageText); // Add text directly to content

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);

    // Add to container
    container.appendChild(messageDiv);

    // Store references - use the messageText as the streaming container
    this.streamingMessageElement = messageDiv;
    this.streamingContentContainer = messageText; // This is now the text container itself
    this.currentCodeBlock = null;
    this.isInCodeBlock = false;
    this.codeBlockBuffer = '';

    // Force scroll to the new message
    this.forceScrollToBottomImmediate();
  }

  private handleStreamToken(token: string): void {
    if (!this.currentStreamingMessage || !this.streamingContentContainer) return;

    // Add token to message content
    this.currentStreamingMessage.content += token;
    
    // Directly append text without complex queuing - this is faster and more reliable
    this.appendTokenDirectly(token);
    
    // CRITICAL: Force scroll to bottom immediately after each token
    this.forceScrollToBottomImmediate();
  }

  // Fix the appendTokenDirectly method to work with the simpler structure:
  private appendTokenDirectly(token: string): void {
    if (!this.streamingContentContainer) return;

    // The streamingContentContainer is now the message-text div itself
    const currentText = this.streamingContentContainer.textContent || '';
    this.streamingContentContainer.textContent = currentText + token;
    
    // Ensure typing cursor is visible
    this.streamingContentContainer.classList.add('typing-cursor');
  }

  // Add this immediate scroll method that's more aggressive:
  private forceScrollToBottomImmediate(): void {
    const messagesContainer = document.getElementById('chat-messages') as HTMLElement;
    if (!messagesContainer) return;

    // Multiple aggressive scroll approaches to ensure it works
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Also use scrollIntoView on the last element with proper type checking
    const lastElement = messagesContainer.lastElementChild;
    if (lastElement && lastElement instanceof HTMLElement) {
      lastElement.scrollIntoView({ block: 'end', behavior: 'auto' });
    }
    
    // Force another scroll after a tiny delay to handle any layout changes
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 1);
  }

  private handleStreamEnd(): void {
    console.log('✅ Stream ended - cleaning up');
    
    // Clean up streaming state
    if (this.streamingMessageElement) {
      this.streamingMessageElement.classList.remove('streaming');
      
      // Remove typing cursor
      if (this.streamingContentContainer) {
        this.streamingContentContainer.classList.remove('typing-cursor');
        
        // FIXED: Instead of replacing innerHTML, process markdown while preserving structure
        const finalText = this.streamingContentContainer.textContent || '';
        if (finalText) {
          // Check if the content has code blocks or complex markdown
          if (finalText.includes('```') || finalText.includes('**') || finalText.includes('*')) {
            // For complex content, rebuild the message properly
            this.rebuildMessageWithMarkdown(finalText);
          } else {
            // For simple text, just apply basic formatting
            this.streamingContentContainer.innerHTML = this.processSimpleMarkdown(finalText);
          }
        }
      }
    }

    // Reset streaming state
    this.currentStreamingMessage = null;
    this.currentStreamSessionId = null;
    this.streamingMessageElement = null;
    this.streamingContentContainer = null;
    this.currentCodeBlock = null;
    this.isInCodeBlock = false;
    this.codeBlockBuffer = '';
    this.chatState.isLoading = false;

    // Re-enable normal scroll monitoring
    this.autoScrollEnabled = true;
    
    // Final scroll to bottom
    setTimeout(() => {
      this.forceScrollToBottom();
    }, 100);
    
    console.log('✅ Stream cleanup complete');
  }

  private handleStreamError(error: string): void {
    console.error('Stream error:', error);
    
    // Remove the partial streaming message element if it exists
    if (this.streamingMessageElement) {
      this.streamingMessageElement.remove();
    }
    
    // Remove streaming message from state
    if (this.chatState.messages.length > 0) {
      const lastMessage = this.chatState.messages[this.chatState.messages.length - 1];
      if (lastMessage.role === 'assistant' && lastMessage.id === this.currentStreamSessionId) {
        this.chatState.messages.pop();
      }
    }
    
    // Clean up streaming state
    this.currentStreamingMessage = null;
    this.currentStreamSessionId = null;
    this.streamingMessageElement = null;
    this.streamingContentContainer = null;
    this.currentCodeBlock = null;
    this.isInCodeBlock = false;
    this.codeBlockBuffer = '';
    this.chatState.isLoading = false;
    
    // Add error message and render
    const errorMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `❌ **Error**: ${this.getErrorMessage(new Error(error))}

**Suggestions:**
• Try asking a more specific question
• Check your internet connection
• Ensure your API key is valid`,
      timestamp: new Date()
    };

    this.chatState.messages.push(errorMessage);
    this.hideTypingIndicator();
    this.renderMessages();
  }

  private generateAppendPreview(lines: string[], newCodeLines: string[]): string {
    let preview = '';
    const contextLines = 5;
    const startLine = Math.max(0, lines.length - contextLines);
    
    // Add append info header
    preview += `<div class="preview-reason">Appending ${newCodeLines.length} line(s) to end of file</div>`;
    
    // Show last few lines of current content
    for (let i = startLine; i < lines.length; i++) {
      preview += `<div class="diff-line context" data-line="${i + 1}">${this.escapeHtml(lines[i])}</div>`;
    }
    
    // Add separator if file doesn't end with empty line
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
      preview += `<div class="diff-line added empty-line" data-line="+">""</div>`;
    }
    
    // Show new code being appended
    newCodeLines.forEach((codeLine, idx) => {
      preview += `<div class="diff-line added" data-line="+${lines.length + idx + 1}">${this.escapeHtml(codeLine)}</div>`;
    });
    
    return preview;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private setupSpeechListeners(): void {
    if (!this.electronAPI.onRecordingStateChanged) return;

    this.electronAPI.onRecordingStateChanged((data: { isRecording: boolean; error?: string }) => {
      this.isRecording = data.isRecording;
      this.updateMicrophoneButton();
      
      if (data.error) {
        this.showSpeechError(data.error);
      }
    });
  }

  private async toggleRecording(): Promise<void> {
    if (this.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    try {
      this.recordingStartTime = Date.now();
      const result = await this.electronAPI.startRecording();
      
      if (!result.success) {
        this.showSpeechError(result.error || 'Failed to start recording');
        return;
      }
      
      this.showRecordingFeedback();
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.showSpeechError('Failed to start recording. Make sure microphone access is granted.');
    }
  }

  private async stopRecording(): Promise<void> {
    try {
      const result = await this.electronAPI.stopRecording();
      
      if (!result.success) {
        this.showSpeechError(result.error || 'Failed to stop recording');
        return;
      }
      
      this.hideRecordingFeedback();
      this.showTranscriptionFeedback();
      
      // Start transcription
      await this.transcribeRecording();
      
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.showSpeechError('Failed to stop recording');
    }
  }

  private async transcribeRecording(): Promise<void> {
    try {
      const result = await this.electronAPI.transcribeAudio();
      
      this.hideTranscriptionFeedback();
      
      if (!result.success) {
        this.showSpeechError(result.error || 'Transcription failed');
        return;
      }
      
      if (result.text) {
        // Insert transcribed text into the input
        const input = document.getElementById('chat-input') as HTMLTextAreaElement;
        if (input) {
          const currentValue = input.value;
          const newValue = currentValue ? `${currentValue} ${result.text}` : result.text;
          input.value = newValue;
          this.autoResizeTextarea(input);
          this.updateCharCount(input);
          input.focus();
          
          // Show success feedback
          this.showSpeechSuccess('Speech converted to text!');
        }
      }
      
    } catch (error) {
      console.error('Transcription failed:', error);
      this.hideTranscriptionFeedback();
      this.showSpeechError('Transcription failed');
    }
  }

  private updateMicrophoneButton(): void {
    const micBtn = document.getElementById('microphone-btn');
    if (!micBtn) return;

    if (this.isRecording) {
      micBtn.innerHTML = '<span class="action-icon recording">🔴</span>';
      micBtn.classList.add('recording');
      micBtn.title = 'Stop recording';
    } else {
      micBtn.innerHTML = '<span class="action-icon">🎤</span>';
      micBtn.classList.remove('recording');
      micBtn.title = 'Start voice input';
    }
  }

  private showRecordingFeedback(): void {
    this.showSpeechFeedback('🎤 Recording... Click to stop', 'recording');
  }

  private hideRecordingFeedback(): void {
    this.hideSpeechFeedback();
  }

  private showTranscriptionFeedback(): void {
    this.showSpeechFeedback('🔄 Converting speech to text...', 'processing');
  }

  private hideTranscriptionFeedback(): void {
    this.hideSpeechFeedback();
  }

  private showSpeechFeedback(message: string, type: 'recording' | 'processing' = 'recording'): void {
    // Remove existing feedback
    this.hideSpeechFeedback();

    const feedback = document.createElement('div');
    feedback.className = 'speech-feedback';
    feedback.innerHTML = `
      <div class="speech-feedback-content ${type}">
        <span class="speech-message">${message}</span>
        ${type === 'recording' ? `<div class="recording-animation"></div>` : '<div class="processing-spinner"></div>'}
      </div>
    `;

    const inputArea = document.querySelector('.chat-input-area');
    if (inputArea) {
      inputArea.insertBefore(feedback, inputArea.firstChild);
    }
  }

  private hideSpeechFeedback(): void {
    const feedback = document.querySelector('.speech-feedback');
    if (feedback) {
      feedback.remove();
    }
  }

  private showSpeechError(message: string): void {
    this.showNotification(`❌ ${message}`, 'error');
  }

  private showSpeechSuccess(message: string): void {
    this.showNotification(`✅ ${message}`, 'success');
  }

  private showNotification(message: string, type: 'success' | 'error'): void {
    const notification = document.createElement('div');
    notification.className = `speech-notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // File picker methods
  private async showFilePicker(): Promise<void> {
    if (this.filePicker) {
      await this.filePicker.show();
    }
  }

  private updateAttachedFilesDisplay(): void {
    const header = document.getElementById('attached-files-header');
    const countElement = document.getElementById('attached-files-count');
    const listElement = document.getElementById('attached-files-list');
    
    if (!header || !countElement || !listElement) return;

    if (this.attachedFiles.size === 0) {
      header.style.display = 'none';
      return;
    }

    header.style.display = 'block';
    
    const count = this.attachedFiles.size;
    countElement.textContent = `${count} file${count !== 1 ? 's' : ''}`;

    listElement.innerHTML = '';
    this.attachedFiles.forEach((file, path) => {
      const fileTag = document.createElement('div');
      fileTag.className = 'attached-file-tag';
      
      const icon = this.getFileIcon(file.name.split('.').pop() || '');
      
      fileTag.innerHTML = `
        <span class="file-tag-icon">${icon}</span>
        <span class="file-tag-name">${file.name}</span>
        <button class="remove-file-tag" data-file-path="${path}" title="Remove">×</button>
      `;
      
      const removeBtn = fileTag.querySelector('.remove-file-tag') as HTMLButtonElement;
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          this.removeAttachedFile(path);
        });
      }
      
      listElement.appendChild(fileTag);
    });
  }

  private updateAttachButton(): void {
    const attachBtn = document.getElementById('attach-files');
    if (attachBtn) {
      if (this.attachedFiles.size > 0) {
        attachBtn.classList.add('has-files');
        attachBtn.title = `${this.attachedFiles.size} files attached`;
      } else {
        attachBtn.classList.remove('has-files');
        attachBtn.title = 'Attach files';
      }
    }
  }

  private removeAttachedFile(filePath: string): void {
    this.attachedFiles.delete(filePath);
    this.updateAttachedFilesDisplay();
    this.updateAttachButton();
    
    this.showNotification('File removed', 'success');
  }

  private clearAllAttachedFiles(): void {
    this.attachedFiles.clear();
    this.updateAttachedFilesDisplay();
    this.updateAttachButton();
    
    this.showNotification('All files cleared', 'success');
  }

  private getFileIcon(extension: string): string {
    const iconMap: { [key: string]: string } = {
      'js': '🟨', 'ts': '🔵', 'jsx': '⚛️', 'tsx': '⚛️',
      'html': '🌐', 'css': '🎨', 'scss': '🎨', 'sass': '🎨',
      'json': '📋', 'xml': '📄', 'md': '📝', 'txt': '📄',
      'py': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️',
      'php': '🐘', 'rb': '💎', 'go': '🐹', 'rs': '🦀',
      'sql': '🗄️', 'sh': '💻', 'yml': '⚙️', 'yaml': '⚙️'
    };
    return iconMap[extension.toLowerCase()] || '📄';
  }

  // Add this method to the ChatManager class

  public isInitialized(): boolean {
    const chatContent = document.getElementById('ai-chat-content');
    return !!(chatContent && chatContent.querySelector('.chat-container'));
  }

  // Add this new method to handle scroll scheduling


  private scheduleScrollUpdate(): void {
    if (this.scrollUpdateScheduled) return;
    
    this.scrollUpdateScheduled = true;
    
    // Use requestAnimationFrame to batch scroll updates
    requestAnimationFrame(() => {
      this.smoothScrollToBottomDuringStreaming();
      this.scrollUpdateScheduled = false;
    });
  }

  // Add this new smooth scroll method specifically for streaming
  private smoothScrollToBottomDuringStreaming(): void {
    const messagesContainer = document.getElementById('chat-messages') as HTMLElement;
    if (!messagesContainer) return;

    // Always scroll to bottom during progressive rendering for better UX
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    
    // More aggressive auto-scroll during progressive rendering
    if (distanceFromBottom <= 200) { // Increased threshold for progressive rendering
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: 'auto'
      });
    }
  }

  private handleCodeBlockTransition(text: string): void {
    const parts = text.split(/(```[\w]*)/);
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part.startsWith('```')) {
        if (!this.isInCodeBlock) {
          // Starting a code block
          this.isInCodeBlock = true;
          this.codeBlockBuffer = '';
          const language = part.replace('```', '') || 'text';
          this.createNewCodeBlock(language);
        } else {
          // Ending a code block
          this.isInCodeBlock = false;
          this.finalizeCodeBlock();
          this.createNewTextContainer();
        }
      } else if (part) {
        // Regular text content - use the direct append method instead
        if (this.isInCodeBlock) {
          this.codeBlockBuffer += part;
          this.appendToCodeBlockDirectly(part);
        } else {
          this.appendTokenDirectly(part);
        }
      }
    }
  }

  private createNewTextContainer(): void {
    if (!this.streamingContentContainer) return;

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text typing-cursor';
    this.streamingContentContainer.appendChild(textDiv);
  }

  private createNewCodeBlock(language: string): void {
    if (!this.streamingContentContainer) return;

    const codeBlock = document.createElement('div');
    codeBlock.className = 'code-block streaming-code';
    
    // Header
    const header = document.createElement('div');
    header.className = 'code-header';
    
    const langSpan = document.createElement('span');
    langSpan.className = 'code-language';
    langSpan.textContent = language;
    
    header.appendChild(langSpan);
    
    // Content
    const content = document.createElement('div');
    content.className = 'code-content';
    
    const pre = document.createElement('pre');
    const codeElement = document.createElement('code');
    codeElement.className = 'streaming-code-text typing-cursor';
    
    pre.appendChild(codeElement);
    content.appendChild(pre);
    
    codeBlock.appendChild(header);
    codeBlock.appendChild(content);
    
    this.streamingContentContainer.appendChild(codeBlock);
    this.currentCodeBlock = codeElement;
  }

  private finalizeCodeBlock(): void {
    if (this.currentCodeBlock) {
      this.currentCodeBlock.classList.remove('typing-cursor', 'streaming-code-text');
      this.currentCodeBlock.textContent = this.codeBlockBuffer;
      
      const codeBlock = this.currentCodeBlock.closest('.code-block');
      if (codeBlock) {
        codeBlock.classList.remove('streaming-code');
        
        // Add copy and insert buttons
        const header = codeBlock.querySelector('.code-header');
        if (header) {
          const actions = document.createElement('div');
          actions.className = 'code-actions';
          
          const copyBtn = document.createElement('button');
          copyBtn.className = 'code-action';
          copyBtn.innerHTML = '📋 Copy';
          copyBtn.onclick = () => this.copyCodeToClipboard(this.codeBlockBuffer);
          
          const insertBtn = document.createElement('button');
          insertBtn.className = 'code-action';
          insertBtn.innerHTML = '📥 Insert';
          insertBtn.onclick = () => this.insertCodeIntoEditor(this.codeBlockBuffer);
          
          actions.appendChild(copyBtn);
          actions.appendChild(insertBtn);
          header.appendChild(actions);
        }
      }
      
      this.currentCodeBlock = null;
      this.codeBlockBuffer = '';
    }
  }

  // Add the missing appendToCodeBlockDirectly method:
  private appendToCodeBlockDirectly(text: string): void {
    if (!this.currentCodeBlock) return;

    // Directly append text to the current code block
    this.currentCodeBlock.textContent = (this.currentCodeBlock.textContent || '') + text;
    
    // Ensure typing cursor is visible
    this.currentCodeBlock.classList.add('typing-cursor');
  }

  // Add this new method to properly rebuild messages with markdown:
  private rebuildMessageWithMarkdown(content: string): void {
    if (!this.streamingMessageElement || !this.currentStreamingMessage) return;

    // Find the message content container
    const messageContent = this.streamingMessageElement.querySelector('.message-content');
    if (!messageContent) return;

    // Keep the header, rebuild the content
    const header = messageContent.querySelector('.message-header');
    
    // Clear content but keep header
    messageContent.innerHTML = '';
    if (header) {
      messageContent.appendChild(header);
    }

    // FIXED: Process content with better markdown handling that keeps instructions separate
    if (content.includes('```')) {
      // Has code blocks - process with improved separation
      this.processMarkdownWithProperSeparation(content, messageContent as HTMLElement);
    } else {
      // Simple content - create a single text div
      const textDiv = document.createElement('div');
      textDiv.className = 'message-text';
      textDiv.innerHTML = this.processSimpleMarkdown(content);
      messageContent.appendChild(textDiv);
    }
  }

  // Add this new method to properly separate instructions from code blocks:
  private processMarkdownWithProperSeparation(content: string, container: HTMLElement): void {
    // Split content by code blocks while preserving the markers
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    parts.forEach(part => {
      if (part.startsWith('```') && part.endsWith('```')) {
        // This is a code block
        const lines = part.split('\n');
        const firstLine = lines[0].replace('```', '');
        const language = firstLine.trim() || 'text';
        const code = lines.slice(1, -1).join('\n');
        
        if (code.trim()) {
          const codeBlock = this.createCodeBlock(code, language);
          container.appendChild(codeBlock);
        }
      } else if (part.trim()) {
        // This is regular text (instructions/comments) - keep it separate
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerHTML = this.processSimpleMarkdown(part.trim());
        container.appendChild(textDiv);
      }
    });
  }

  // Add this method to ensure text stays visible during streaming:
  private ensureTextVisibility(): void {
    if (!this.streamingContentContainer) return;
    
    // Scroll the text container itself if it's getting too long
    const container = this.streamingContentContainer;
    const containerHeight = container.scrollHeight;
    const visibleHeight = container.clientHeight;
    
    // If content is taller than visible area, scroll to bottom
    if (containerHeight > visibleHeight) {
      container.scrollTop = containerHeight;
    }
  }
}
