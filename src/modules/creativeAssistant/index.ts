import { AppState } from '../types/index.js';

export interface CreativeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    projectInfo?: string;
    openFiles?: string[];
    framework?: string;
  };
}

export interface CreativeAssistantState {
  messages: CreativeMessage[];
  isLoading: boolean;
  apiKeyConfigured: boolean;
}

export class CreativeAssistantManager {
  private state: AppState;
  private electronAPI: any;
  private creativeState: CreativeAssistantState;
  private isUIReady = false;
  private currentStreamingMessage: CreativeMessage | null = null;
  private currentStreamSessionId: string | null = null;
  private streamingMessageElement: HTMLElement | null = null;

  constructor(state: AppState) {
    this.state = state;
    this.electronAPI = (window as any).electronAPI;
    this.creativeState = {
      messages: [],
      isLoading: false,
      apiKeyConfigured: false
    };
    this.setupStreamingListeners();
  }

  initialize(): void {
    console.log('🔧 CreativeAssistantManager initialize called');
    
    this.exposeGlobally();
    this.setupInitialUI();
    this.checkAPIKey();
    this.isUIReady = true;
    
    console.log('✅ CreativeAssistantManager initialization complete');
  }

  private setupStreamingListeners(): void {
    if (this.electronAPI) {
      this.electronAPI.onAIStreamStart((data: { sessionId: string }) => {
        if (this.currentStreamSessionId === data.sessionId) {
          this.handleStreamStart(data.sessionId);
        }
      });

      this.electronAPI.onAIStreamToken((data: { sessionId: string; token: string; type: string }) => {
        if (this.currentStreamSessionId === data.sessionId) {
          this.handleStreamToken(data.token);
        }
      });

      this.electronAPI.onAIStreamEnd((data: { sessionId: string }) => {
        if (this.currentStreamSessionId === data.sessionId) {
          this.handleStreamEnd();
        }
      });

      this.electronAPI.onAIStreamError((data: { error: string }) => {
        this.handleStreamError(data.error);
      });
    }
  }

  private setupInitialUI(): void {
    const creativeContent = document.getElementById('creative-assistant-content');
    if (!creativeContent) {
      console.log('❌ creative-assistant-content not found');
      return;
    }

    console.log('🔧 Setting up creative assistant UI...');
    
    creativeContent.innerHTML = `
      <div class="creative-container">
        <!-- Header with distinct styling -->
        <div class="creative-header">
          <div class="creative-header-content">
            <div class="creative-title">
              <span class="creative-icon">🎨</span>
              <span class="creative-text">Creative Assistant</span>
            </div>
            <div class="creative-subtitle">Ideas, design help, and brainstorming</div>
          </div>
        </div>

        <!-- API Key Setup (shared with main chat) -->
        <div id="creative-api-key-setup" class="creative-api-key-setup" style="display: none;">
          <div class="api-key-content">
            <div class="api-key-icon">🎨</div>
            <h3>Connect Creative Assistant</h3>
            <p>Enter your Anthropic API key to start brainstorming</p>
            <div class="api-key-form">
              <div class="input-group">
                <input type="password" id="creative-api-key-input" placeholder="sk-ant-api03-..." />
                <button id="creative-api-key-submit" class="primary-btn">
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
        
        <!-- Main Creative Interface -->
        <div id="creative-main" class="creative-main" style="display: none;">
          <!-- Context Bar showing project info -->
          <div id="creative-context-bar" class="creative-context-bar">
            <div class="creative-context-info">
              <span class="context-icon">📋</span>
              <span class="context-text" id="creative-current-context">Loading project context...</span>
            </div>
          </div>

          <!-- Messages -->
          <div id="creative-messages" class="creative-messages">
            <div class="creative-messages-container" id="creative-messages-container"></div>
          </div>

          <!-- Send to Main Chat Button -->
          <div class="creative-actions">
            <button id="send-to-main-chat" class="send-to-main-btn" title="Send conversation summary to main coding chat">
              <span class="action-icon">📤</span>
              <span class="action-text">Send to Main Chat</span>
            </button>
          </div>

          <!-- Input Area with distinct styling -->
          <div class="creative-input-area">
            <div class="creative-input-container">
              <div class="creative-input-wrapper">
                <div class="creative-textarea-container">
                  <textarea 
                    id="creative-chat-input" 
                    placeholder="Let's brainstorm ideas, explore concepts, or discuss design patterns..."
                    rows="2"
                    maxlength="50000"
                  ></textarea>
                  <div class="creative-input-footer">
                    <span class="char-count" id="creative-char-count">0 / 50,000</span>
                    <div class="creative-input-actions">
                      <button id="creative-send-message" class="creative-send-btn" title="Send message">
                        <span class="send-icon">✨</span>
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
    this.injectCreativeStyles();
    this.updateContextDisplay();
  }

  private injectCreativeStyles(): void {
    const existingStyle = document.getElementById('creative-assistant-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement('style');
    style.id = 'creative-assistant-styles';
    style.textContent = `
      /* Creative Assistant Specific Styles */
      .creative-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: linear-gradient(135deg, #1a1d29 0%, #2d1b69 100%);
        color: #e2e8f0;
      }

      .creative-header {
        background: linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%);
        border-bottom: 2px solid #8b5cf6;
        padding: 16px;
        flex-shrink: 0;
      }

      .creative-header-content {
        text-align: center;
      }

      .creative-title {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 18px;
        font-weight: 700;
        color: #ffffff;
        margin-bottom: 4px;
      }

      .creative-icon {
        font-size: 20px;
      }

      .creative-subtitle {
        font-size: 12px;
        color: #c4b5fd;
        font-style: italic;
      }

      .creative-context-bar {
        background: rgba(139, 92, 246, 0.1);
        border-bottom: 1px solid rgba(139, 92, 246, 0.3);
        padding: 8px 12px;
        flex-shrink: 0;
      }

      .creative-context-info {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #c4b5fd;
      }

      .creative-main {
        display: flex;
        flex-direction: column;
        height: 100%;
        flex: 1;
      }

      .creative-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        min-height: 0;
      }

      .creative-messages-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .creative-message {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .creative-message.user {
        align-items: flex-end;
      }

      .creative-message.assistant {
        align-items: flex-start;
      }

      .creative-message-content {
        max-width: 85%;
        padding: 12px 16px;
        border-radius: 18px;
        font-size: 14px;
        line-height: 1.5;
        word-wrap: break-word;
      }

      .creative-message.user .creative-message-content {
        background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
        color: white;
        border-bottom-right-radius: 6px;
      }

      .creative-message.assistant .creative-message-content {
        background: rgba(139, 92, 246, 0.15);
        border: 1px solid rgba(139, 92, 246, 0.3);
        color: #e2e8f0;
        border-bottom-left-radius: 6px;
      }

      .creative-message-meta {
        font-size: 11px;
        color: #94a3b8;
        padding: 0 16px;
      }

      .creative-actions {
        padding: 12px 16px;
        border-top: 1px solid rgba(139, 92, 246, 0.3);
        background: rgba(139, 92, 246, 0.05);
        flex-shrink: 0;
      }

      .send-to-main-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 10px 16px;
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        border: none;
        border-radius: 8px;
        color: white;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .send-to-main-btn:hover {
        background: linear-gradient(135deg, #047857 0%, #065f46 100%);
        transform: translateY(-1px);
      }

      .send-to-main-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .creative-input-area {
        border-top: 1px solid rgba(139, 92, 246, 0.3);
        background: rgba(139, 92, 246, 0.05);
        padding: 12px;
        flex-shrink: 0;
      }

      .creative-input-container {
        background: rgba(139, 92, 246, 0.1);
        border: 1px solid rgba(139, 92, 246, 0.3);
        border-radius: 12px;
        overflow: hidden;
      }

      .creative-input-wrapper {
        padding: 4px;
      }

      .creative-textarea-container {
        position: relative;
      }

      #creative-chat-input {
        width: 100%;
        background: transparent;
        border: none;
        outline: none;
        resize: none;
        padding: 12px 16px;
        font-size: 14px;
        line-height: 1.5;
        color: #e2e8f0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      #creative-chat-input::placeholder {
        color: #94a3b8;
      }

      .creative-input-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 16px;
        border-top: 1px solid rgba(139, 92, 246, 0.2);
        background: rgba(139, 92, 246, 0.05);
      }

      .creative-input-actions {
        display: flex;
        gap: 8px;
      }

      .creative-send-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
        border: none;
        border-radius: 8px;
        color: white;
        cursor: pointer;
        transition: all 0.2s;
      }

      .creative-send-btn:hover {
        background: linear-gradient(135deg, #7c3aed 0%, #9333ea 100%);
        transform: scale(1.05);
      }

      .creative-send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .creative-api-key-setup {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100%;
        padding: 32px;
        text-align: center;
      }

      .creative-typing-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: rgba(139, 92, 246, 0.15);
        border: 1px solid rgba(139, 92, 246, 0.3);
        border-radius: 18px;
        border-bottom-left-radius: 6px;
        max-width: 85%;
        align-self: flex-start;
      }

      .creative-typing-dots {
        display: flex;
        gap: 4px;
      }

      .creative-typing-dot {
        width: 6px;
        height: 6px;
        background: #8b5cf6;
        border-radius: 50%;
        animation: creative-typing-bounce 1.4s infinite;
      }

      .creative-typing-dot:nth-child(2) {
        animation-delay: 0.2s;
      }

      .creative-typing-dot:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes creative-typing-bounce {
        0%, 80%, 100% {
          transform: scale(0);
          opacity: 0.5;
        }
        40% {
          transform: scale(1);
          opacity: 1;
        }
      }

      /* Scrollbar styling for creative assistant */
      .creative-messages::-webkit-scrollbar {
        width: 6px;
      }

      .creative-messages::-webkit-scrollbar-track {
        background: transparent;
      }

      .creative-messages::-webkit-scrollbar-thumb {
        background: rgba(139, 92, 246, 0.3);
        border-radius: 3px;
      }

      .creative-messages::-webkit-scrollbar-thumb:hover {
        background: rgba(139, 92, 246, 0.5);
      }
    `;
    
    document.head.appendChild(style);
  }

  private setupEventListeners(): void {
    // API Key setup
    const apiKeyInput = document.getElementById('creative-api-key-input') as HTMLInputElement;
    const apiKeySubmit = document.getElementById('creative-api-key-submit') as HTMLButtonElement;

    if (apiKeyInput && apiKeySubmit) {
      apiKeySubmit.addEventListener('click', () => this.setupAPIKey());
      apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.setupAPIKey();
      });
    }

    // Chat input
    const chatInput = document.getElementById('creative-chat-input') as HTMLTextAreaElement;
    const sendButton = document.getElementById('creative-send-message') as HTMLButtonElement;
    const sendToMainBtn = document.getElementById('send-to-main-chat') as HTMLButtonElement;

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

    if (sendToMainBtn) {
      sendToMainBtn.addEventListener('click', () => this.sendToMainChat());
    }
  }

  private async setupAPIKey(): Promise<void> {
    const input = document.getElementById('creative-api-key-input') as HTMLInputElement;
    const button = document.getElementById('creative-api-key-submit') as HTMLButtonElement;
    
    if (!input || !button) return;

    const apiKey = input.value.trim();
    if (!apiKey) return;

    button.disabled = true;
    button.innerHTML = '<span class="btn-text">Connecting...</span>';

    try {
      const testResult = await window.electronAPI.callAnthropicAPI(
        [{ role: 'user', content: 'Hello' }],
        'You are a creative assistant. Respond with just "Ready to brainstorm!" to confirm the connection.'
      );

      if (testResult && (typeof testResult === 'string' || testResult.content)) {
        this.creativeState.apiKeyConfigured = true;
        this.showCreativeInterface();
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
    // Check if main chat has API key configured
    const mainChatManager = (window as any).chatManager;
    if (mainChatManager && mainChatManager.getChatState().apiKeyConfigured) {
      this.creativeState.apiKeyConfigured = true;
      this.showCreativeInterface();
      this.addWelcomeMessage();
    } else {
      this.showAPIKeySetup();
    }
  }

  private showAPIKeySetup(): void {
    const apiKeySetup = document.getElementById('creative-api-key-setup');
    const creativeMain = document.getElementById('creative-main');
    
    if (apiKeySetup) apiKeySetup.style.display = 'flex';
    if (creativeMain) creativeMain.style.display = 'none';
  }

  private showCreativeInterface(): void {
    const apiKeySetup = document.getElementById('creative-api-key-setup');
    const creativeMain = document.getElementById('creative-main');
    
    if (apiKeySetup) apiKeySetup.style.display = 'none';
    if (creativeMain) creativeMain.style.display = 'flex';
    
    this.updateContextDisplay();
  }

  private addWelcomeMessage(): void {
    const welcomeMessage: CreativeMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `🎨 **Welcome to your Creative Assistant!**

I'm here to help you brainstorm, explore ideas, and think through design challenges. I focus on:

• **Conceptual thinking** - Breaking down complex problems
• **Design patterns** - Architecture and structure ideas  
• **User experience** - Flow and interaction concepts
• **Creative brainstorming** - Generating new approaches
• **Explaining concepts** - Making complex topics clear

I have context about your current project and can help you think through ideas before turning them into code. What would you like to explore?`,
      timestamp: new Date(),
      metadata: {
        projectInfo: this.getProjectInfo(),
        openFiles: this.getOpenFiles(),
        framework: this.getFrameworkInfo()
      }
    };

    this.creativeState.messages = [welcomeMessage];
    this.renderMessages();
  }

  private getProjectInfo(): string {
    const projectPath = this.state.currentWorkingDirectory;
    const projectName = projectPath.split('/').pop() || 'Unknown Project';
    return `${projectName} (${projectPath})`;
  }

  private getOpenFiles(): string[] {
    return Array.from(this.state.openTabs.keys());
  }

  private getFrameworkInfo(): string {
    // Simple framework detection based on file extensions and names
    const openFiles = this.getOpenFiles();
    const allFiles = openFiles.join(' ').toLowerCase();
    
    if (allFiles.includes('.tsx') || allFiles.includes('.jsx')) {
      return 'React';
    } else if (allFiles.includes('.vue')) {
      return 'Vue.js';
    } else if (allFiles.includes('.svelte')) {
      return 'Svelte';
    } else if (allFiles.includes('.ts') || allFiles.includes('.js')) {
      return 'JavaScript/TypeScript';
    } else {
      return 'General Development';
    }
  }

  private updateContextDisplay(): void {
    const contextElement = document.getElementById('creative-current-context');
    if (contextElement) {
      const projectInfo = this.getProjectInfo();
      const framework = this.getFrameworkInfo();
      const openFilesCount = this.getOpenFiles().length;
      
      contextElement.textContent = `${projectInfo} • ${framework} • ${openFilesCount} files open`;
    }
  }

  private async sendMessage(): Promise<void> {
    const input = document.getElementById('creative-chat-input') as HTMLTextAreaElement;
    if (!input || !input.value.trim() || this.creativeState.isLoading) return;

    const content = input.value.trim();
    input.value = '';
    input.style.height = 'auto';
    this.updateCharCount(input);

    // Add user message
    const userMessage: CreativeMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
      metadata: {
        projectInfo: this.getProjectInfo(),
        openFiles: this.getOpenFiles(),
        framework: this.getFrameworkInfo()
      }
    };

    this.creativeState.messages.push(userMessage);
    this.renderMessages();

    // Show typing indicator and prepare for streaming
    this.creativeState.isLoading = true;
    this.showTypingIndicator();

    try {
      // Prepare messages for API
      const apiMessages = this.creativeState.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Generate session ID for this stream
      this.currentStreamSessionId = Date.now().toString();

      // Use streaming API
      await window.electronAPI.callAnthropicAPIStream(
        apiMessages,
        this.getCreativeSystemPrompt()
      );

    } catch (error) {
      console.error('Failed to start streaming:', error);
      this.handleStreamError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private getCreativeSystemPrompt(): string {
    const projectInfo = this.getProjectInfo();
    const framework = this.getFrameworkInfo();
    const openFiles = this.getOpenFiles();

    return `You are a Creative Assistant for software development. Your role is to help with ideation, brainstorming, design thinking, and conceptual explanations.

**Project Context:**
- Project: ${projectInfo}
- Framework: ${framework}
- Open files: ${openFiles.length > 0 ? openFiles.join(', ') : 'None'}

**Your Focus:**
- Generate creative ideas and solutions
- Explain concepts clearly and intuitively
- Help with architectural and design decisions
- Brainstorm user experience flows
- Suggest different approaches to problems
- Break down complex topics into understandable parts

**Important Guidelines:**
- Focus on IDEAS, CONCEPTS, and DESIGN rather than specific code implementation
- Only provide code if explicitly asked
- Think creatively and suggest multiple approaches
- Explain the "why" behind recommendations
- Keep responses conversational and inspiring
- Help the user think through problems rather than just solving them

Remember: You're the creative thinking partner, not the code generator. Help them brainstorm and conceptualize before they move to implementation.`;
  }

  private showTypingIndicator(): void {
    const container = document.getElementById('creative-messages-container');
    if (!container) return;

    const indicator = document.createElement('div');
    indicator.id = 'creative-typing-indicator';
    indicator.className = 'creative-typing-indicator';
    indicator.innerHTML = `
      <span style="color: #8b5cf6;">✨ thinking...</span>
      <div class="creative-typing-dots">
        <div class="creative-typing-dot"></div>
        <div class="creative-typing-dot"></div>
        <div class="creative-typing-dot"></div>
      </div>
    `;

    container.appendChild(indicator);
    this.scrollToBottom();
  }

  private hideTypingIndicator(): void {
    const indicator = document.getElementById('creative-typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  private handleStreamStart(sessionId: string): void {
    this.hideTypingIndicator();
    
    this.currentStreamingMessage = {
      id: sessionId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };

    this.creativeState.messages.push(this.currentStreamingMessage);
    this.createStreamingMessageElement();
  }

  private createStreamingMessageElement(): void {
    const container = document.getElementById('creative-messages-container');
    if (!container || !this.currentStreamingMessage) return;

    this.streamingMessageElement = document.createElement('div');
    this.streamingMessageElement.className = 'creative-message assistant streaming';
    
    this.streamingMessageElement.innerHTML = `
      <div class="creative-message-content">
        <div class="streaming-content"></div>
      </div>
      <div class="creative-message-meta">
        ${this.currentStreamingMessage.timestamp.toLocaleTimeString()}
      </div>
    `;

    container.appendChild(this.streamingMessageElement);
    this.scrollToBottom();
  }

  private handleStreamToken(token: string): void {
    if (!this.currentStreamingMessage || !this.streamingMessageElement) return;

    this.currentStreamingMessage.content += token;
    
    const contentElement = this.streamingMessageElement.querySelector('.streaming-content');
    if (contentElement) {
      contentElement.innerHTML = this.formatCreativeContent(this.currentStreamingMessage.content);
    }

    this.scrollToBottom();
  }

  private handleStreamEnd(): void {
    this.streamingMessageElement?.classList.remove('streaming');
    
    this.currentStreamingMessage = null;
    this.currentStreamSessionId = null;
    this.streamingMessageElement = null;
    this.creativeState.isLoading = false;

    this.renderMessages();
  }

  private handleStreamError(error: string): void {
    this.hideTypingIndicator();
    this.creativeState.isLoading = false;
    
    console.error('Creative Assistant streaming error:', error);
    
    const errorMessage: CreativeMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `I apologize, but I encountered an error: ${error}. Please try again.`,
      timestamp: new Date()
    };

    this.creativeState.messages.push(errorMessage);
    this.renderMessages();
  }

  private renderMessages(): void {
    const container = document.getElementById('creative-messages-container');
    if (!container) return;

    container.innerHTML = '';

    this.creativeState.messages.forEach(message => {
      const messageElement = document.createElement('div');
      messageElement.className = `creative-message ${message.role}`;
      
      messageElement.innerHTML = `
        <div class="creative-message-content">
          ${this.formatCreativeContent(message.content)}
        </div>
        <div class="creative-message-meta">
          ${message.timestamp.toLocaleTimeString()}
        </div>
      `;

      container.appendChild(messageElement);
    });

    this.scrollToBottom();
  }

  private formatCreativeContent(content: string): string {
    // Enhanced formatting for creative content
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background: rgba(139, 92, 246, 0.2); padding: 2px 4px; border-radius: 3px;">$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^(.*)$/, '<p>$1</p>');
  }

  private scrollToBottom(): void {
    const messagesContainer = document.querySelector('.creative-messages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  private autoResizeTextarea(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    const maxHeight = 120;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = newHeight + 'px';
  }

  private updateCharCount(textarea: HTMLTextAreaElement): void {
    const charCount = document.getElementById('creative-char-count');
    if (charCount) {
      const count = textarea.value.length;
      charCount.textContent = `${count.toLocaleString()} / 50,000`;
    }
  }

  private async sendToMainChat(): Promise<void> {
    const mainChatManager = (window as any).chatManager;
    if (!mainChatManager) {
      alert('Main chat is not available. Please open the main AI chat first.');
      return;
    }

    if (this.creativeState.messages.length === 0) {
      alert('No conversation to send. Start a creative discussion first.');
      return;
    }

    // Generate a summary of the creative conversation
    const summary = this.generateConversationSummary();
    
    // Get the main chat input and populate it
    const mainChatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (mainChatInput) {
      // Show main chat if it's hidden
      if (!this.state.aiChatVisible) {
        (window as any).layoutManager?.showAIChat();
      }

      // Wait a moment for the chat to be visible
      setTimeout(() => {
        if (mainChatInput) {
          mainChatInput.value = summary;
          mainChatInput.focus();
          
          // Trigger input event to resize and update char count
          const event = new Event('input', { bubbles: true });
          mainChatInput.dispatchEvent(event);
          
          // Show a confirmation
          this.showSendConfirmation();
        }
      }, 100);
    }
  }

  private generateConversationSummary(): string {
    const userMessages = this.creativeState.messages.filter(msg => msg.role === 'user');
    const assistantMessages = this.creativeState.messages.filter(msg => msg.role === 'assistant');
    
    const projectInfo = this.getProjectInfo();
    const framework = this.getFrameworkInfo();
    
    let summary = `**Creative Discussion Summary** (from Creative Assistant)\n\n`;
    summary += `**Project Context:** ${projectInfo} (${framework})\n\n`;
    
    if (userMessages.length > 0) {
      summary += `**Key Topics Discussed:**\n`;
      userMessages.forEach((msg, index) => {
        summary += `${index + 1}. ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}\n`;
      });
      summary += `\n`;
    }
    
    if (assistantMessages.length > 1) { // More than just welcome message
      const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
      summary += `**Latest Insights:**\n${lastAssistantMessage.content.substring(0, 500)}${lastAssistantMessage.content.length > 500 ? '...' : ''}\n\n`;
    }
    
    summary += `**Request:** Please help me implement the ideas discussed above. I'd like you to focus on the code implementation now.`;
    
    return summary;
  }

  private showSendConfirmation(): void {
    const button = document.getElementById('send-to-main-chat') as HTMLButtonElement;
    if (button) {
      const originalContent = button.innerHTML;
      button.innerHTML = '<span class="action-icon">✅</span><span class="action-text">Sent!</span>';
      button.disabled = true;
      
      setTimeout(() => {
        button.innerHTML = originalContent;
        button.disabled = false;
      }, 2000);
    }
  }

  clearChat(): void {
    this.creativeState.messages = [];
    this.renderMessages();
    this.addWelcomeMessage();
  }

  exposeGlobally(): void {
    (window as any).creativeAssistantManager = this;
  }

  dispose(): void {
    delete (window as any).creativeAssistantManager;
  }

  // Public API methods
  getState(): CreativeAssistantState {
    return { ...this.creativeState };
  }

  isReady(): boolean {
    const creativeContent = document.getElementById('creative-assistant-content');
    const hasProperStructure = creativeContent?.querySelector('.creative-container');
    return this.isUIReady && !!hasProperStructure;
  }
}
