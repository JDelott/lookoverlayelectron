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

  constructor(state: AppState) {
    this.state = state;
    this.electronAPI = (window as any).electronAPI;
    this.chatState = {
      messages: [],
      isLoading: false,
      apiKeyConfigured: false
    };
    this.setupStreamingListeners();
    this.setupSpeechListeners(); // Add this
  }

  initialize(): void {
    console.log('🔧 ChatManager initialize called');
    
    // Always expose globally first
    this.exposeGlobally();
    
    this.setupInitialUI();
    this.checkAPIKey();
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
            <!-- Input Container -->
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

    // Set up event listeners and styles
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
        position: relative;
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

      /* Clean textarea styling */
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

      /* Input Footer with all buttons */
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

      /* All action buttons styled consistently */
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

      /* Responsive */
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

      /* Streaming message effects */
      .message.streaming {
        animation: streamingGlow 2s ease-in-out infinite;
      }

      @keyframes streamingGlow {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.85; }
      }

      /* Typing cursor effect */
      .typing-cursor::after {
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

      /* Enhanced typing indicator for streaming */
      .typing-indicator.streaming {
        background: linear-gradient(90deg, #374151, #4b5563, #374151);
        background-size: 200% 100%;
        animation: shimmer 2s ease-in-out infinite;
        border-radius: 0.5rem;
        padding: 0.75rem 1rem;
      }

      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }

      /* Streaming content container */
      .streaming-content {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      /* Streaming code blocks */
      .streaming-code {
        border: 2px solid #3b82f6 !important;
        box-shadow: 0 0 10px rgba(59, 130, 246, 0.2) !important;
      }

      .streaming-code-text {
        position: relative;
      }

      /* Enhanced typing cursor for code */
      .streaming-code-text.typing-cursor::after {
        content: '▊';
        color: #60a5fa;
        animation: blink 1s infinite;
        margin-left: 1px;
        font-weight: normal;
      }

      /* Multiple text containers in streaming */
      .streaming-content .message-text {
        margin: 0;
      }

      .streaming-content .message-text:not(:last-child) {
        margin-bottom: 0.5rem;
      }

      /* Microphone button special states */
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

      /* Speech feedback */
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

      /* Speech notifications */
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

    // Show typing indicator and prepare for streaming
    this.chatState.isLoading = true;
    this.showTypingIndicator();

    try {
      // Prepare messages for API
      const apiMessages = this.chatState.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Use streaming API
      await window.electronAPI.callAnthropicAPIStream(
        apiMessages,
        this.getSystemPrompt()
      );

      // Note: Response handling is now done via streaming events
      
    } catch (error) {
      console.error('Failed to start streaming:', error);
      this.handleStreamError(error instanceof Error ? error.message : 'Unknown error');
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
    
    // Create the message element with proper structure
    this.createStreamingMessageElement();
  }

  private createStreamingMessageElement(): void {
    if (!this.currentStreamingMessage) return;

    const container = document.getElementById('messages-container');
    if (!container) return;

    // Create the message element
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

    // Create a flexible content container that can hold both text and code blocks
    const streamingContent = document.createElement('div');
    streamingContent.className = 'streaming-content';

    // Initial text container
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text typing-cursor';
    streamingContent.appendChild(textDiv);

    contentDiv.appendChild(header);
    contentDiv.appendChild(streamingContent);

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);

    // Add to container
    container.appendChild(messageDiv);

    // Store references
    this.streamingMessageElement = messageDiv;
    this.streamingContentContainer = streamingContent;
    this.currentCodeBlock = null;
    this.isInCodeBlock = false;
    this.codeBlockBuffer = '';

    // Scroll to bottom
    this.scrollToBottom();
  }

  private handleStreamToken(token: string): void {
    if (!this.currentStreamingMessage || !this.streamingContentContainer) return;

    // Add token to message content
    this.currentStreamingMessage.content += token;
    
    // Process the token for progressive rendering
    this.processStreamingToken(token);
  }

  private processStreamingToken(token: string): void {
    if (!this.streamingContentContainer) return;

    // Check for code block markers
    if (token.includes('```')) {
      this.handleCodeBlockTransition(token);
    } else {
      // Regular content processing
      if (this.isInCodeBlock) {
        this.appendToCodeBlock(token);
      } else {
        this.appendToTextContent(token);
      }
    }

    // Scroll to bottom
    this.scrollToBottom();
  }

  private handleCodeBlockTransition(token: string): void {
    const parts = token.split('```');
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (i > 0) {
        // We hit a ``` marker
        if (!this.isInCodeBlock) {
          // Starting a code block
          this.startCodeBlock(part);
        } else {
          // Ending a code block
          this.endCodeBlock();
          if (part) {
            this.appendToTextContent(part);
          }
        }
      } else {
        // Content before ``` marker
        if (part) {
          if (this.isInCodeBlock) {
            this.appendToCodeBlock(part);
          } else {
            this.appendToTextContent(part);
          }
        }
      }
    }
  }

  private startCodeBlock(languageAndCode: string): void {
    if (!this.streamingContentContainer) return;

    this.isInCodeBlock = true;
    
    // Extract language from first line
    const lines = languageAndCode.split('\n');
    const language = lines[0].trim() || 'text';
    const initialCode = lines.slice(1).join('\n');

    // Create code block structure
    const codeBlock = document.createElement('div');
    codeBlock.className = 'code-block streaming-code';

    // Header
    const header = document.createElement('div');
    header.className = 'code-header';

    const langSpan = document.createElement('span');
    langSpan.className = 'code-language';
    langSpan.textContent = language.toUpperCase();

    const actions = document.createElement('div');
    actions.className = 'code-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-action';

    const insertBtn = document.createElement('button');
    insertBtn.className = 'code-action';

    actions.appendChild(copyBtn);
    actions.appendChild(insertBtn);

    header.appendChild(langSpan);
    header.appendChild(actions);

    // Content
    const content = document.createElement('div');
    content.className = 'code-content';

    const pre = document.createElement('pre');
    const codeElement = document.createElement('code');
    codeElement.className = 'streaming-code-text';
    
    pre.appendChild(codeElement);
    content.appendChild(pre);

    codeBlock.appendChild(header);
    codeBlock.appendChild(content);

    // Add to streaming container
    this.streamingContentContainer.appendChild(codeBlock);
    this.currentCodeBlock = codeElement;

    // Add initial code if any
    if (initialCode) {
      this.appendToCodeBlock(initialCode);
    }

    // Remove typing cursor from text element
    const textElement = this.streamingContentContainer.querySelector('.message-text');
    textElement?.classList.remove('typing-cursor');
  }

  private appendToCodeBlock(text: string): void {
    if (!this.currentCodeBlock) return;

    this.codeBlockBuffer += text;
    this.currentCodeBlock.textContent = this.codeBlockBuffer;
    
    // Add typing cursor to code block
    this.currentCodeBlock.classList.add('typing-cursor');
  }

  private endCodeBlock(): void {
    if (!this.currentCodeBlock) return;

    this.isInCodeBlock = false;
    this.currentCodeBlock.classList.remove('typing-cursor');
    
    // Set up copy and insert functionality
    const codeBlock = this.currentCodeBlock.closest('.code-block');
    if (codeBlock) {
      const copyBtn = codeBlock.querySelector('.code-action');
      const insertBtn = codeBlock.querySelectorAll('.code-action')[1];
      
      if (copyBtn) {
        copyBtn.addEventListener('click', () => this.copyCodeToClipboard(this.codeBlockBuffer));
      }
      if (insertBtn) {
        insertBtn.addEventListener('click', () => this.insertCodeIntoEditor(this.codeBlockBuffer));
      }
      
      codeBlock.classList.remove('streaming-code');
    }

    this.currentCodeBlock = null;
    this.codeBlockBuffer = '';

    // Create new text container for content after code block
    this.createNewTextContainer();
  }

  private appendToTextContent(text: string): void {
    if (!this.streamingContentContainer) return;

    // Find the last text container
    let textContainer = this.streamingContentContainer.querySelector('.message-text:last-of-type') as HTMLElement;
    
    if (!textContainer) {
      this.createNewTextContainer();
      textContainer = this.streamingContentContainer.querySelector('.message-text:last-of-type') as HTMLElement;
    }

    if (textContainer) {
      // Process simple markdown for the text
      const currentText = textContainer.innerHTML.replace(/<span class="typing-cursor[^"]*"[^>]*><\/span>/g, '');
      const newText = currentText + text;
      textContainer.innerHTML = this.processSimpleMarkdown(newText);
      
      // Ensure typing cursor is present
      textContainer.classList.add('typing-cursor');
    }
  }

  private createNewTextContainer(): void {
    if (!this.streamingContentContainer) return;

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text typing-cursor';
    this.streamingContentContainer.appendChild(textDiv);
  }

  private handleStreamEnd(): void {
    // Clean up streaming state
    if (this.streamingMessageElement) {
      this.streamingMessageElement.classList.remove('streaming');
      
      // Remove all typing cursors
      const cursors = this.streamingMessageElement.querySelectorAll('.typing-cursor');
      cursors.forEach(cursor => cursor.classList.remove('typing-cursor'));
    }

    // Clean up streaming-specific classes
    if (this.streamingContentContainer) {
      const streamingCodes = this.streamingContentContainer.querySelectorAll('.streaming-code');
      streamingCodes.forEach(code => code.classList.remove('streaming-code'));
    }

    this.currentStreamingMessage = null;
    this.currentStreamSessionId = null;
    this.streamingMessageElement = null;
    this.streamingContentContainer = null;
    this.currentCodeBlock = null;
    this.isInCodeBlock = false;
    this.codeBlockBuffer = '';
    this.chatState.isLoading = false;

    // Final render to ensure everything is properly formatted
    this.renderMessages();
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
}
