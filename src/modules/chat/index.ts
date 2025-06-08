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
        <div id="api-key-setup" class="api-key-setup" style="display: none;">
          <h3>Setup AI Assistant</h3>
          <p>Enter your Anthropic API key to get started:</p>
          <div class="api-key-input-container">
            <input type="password" id="api-key-input" placeholder="sk-ant-api03-..." />
            <button id="api-key-submit">Connect</button>
          </div>
          <p class="api-key-note">
            Get your API key from <a href="https://console.anthropic.com/" target="_blank">Anthropic Console</a>
          </p>
        </div>
        
        <div id="chat-main" class="chat-main" style="display: none;">
          <div id="chat-messages" class="chat-messages"></div>
          <div id="chat-input-section" class="chat-input-section">
            <div class="input-wrapper">
              <div class="quick-actions" id="quick-actions" style="display: none;">
                <div class="quick-actions-header">
                  <span>Quick Actions</span>
                  <button id="close-quick-actions">✕</button>
                </div>
                <div class="quick-actions-grid">
                  <button class="quick-action-btn" data-action="explain">Explain Code</button>
                  <button class="quick-action-btn" data-action="debug">Find Bugs</button>
                  <button class="quick-action-btn" data-action="optimize">Optimize</button>
                  <button class="quick-action-btn" data-action="comment">Add Comments</button>
                  <button class="quick-action-btn" data-action="test">Write Tests</button>
                  <button class="quick-action-btn" data-action="refactor">Refactor</button>
                </div>
              </div>
              
              <div class="chat-input-controls">
                <textarea 
                  id="chat-input" 
                  placeholder="Ask about your code, paste code snippets, or request new functionality..."
                  rows="1"
                ></textarea>
                <div class="input-buttons">
                  <button id="quick-actions-toggle" title="Quick Actions">⚡</button>
                  <button id="send-message" title="Send message">📤</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners();
    this.injectChatStyles();
  }

  private injectChatStyles(): void {
    const existingStyle = document.getElementById('chat-styles');
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = 'chat-styles';
    style.textContent = `
      .chat-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      }

      /* API Key Setup */
      .api-key-setup {
        padding: 20px;
        text-align: center;
        color: #cccccc;
      }

      .api-key-setup h3 {
        margin: 0 0 12px 0;
        color: #ffffff;
        font-size: 16px;
      }

      .api-key-setup p {
        margin: 0 0 16px 0;
        font-size: 14px;
        line-height: 1.4;
      }

      .api-key-input-container {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }

      .api-key-input-container input {
        flex: 1;
        background-color: #1e1e1e;
        border: 1px solid #3c3c3c;
        color: #cccccc;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 13px;
        outline: none;
      }

      .api-key-input-container input:focus {
        border-color: #0e639c;
      }

      .api-key-input-container button {
        background-color: #0e639c;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
      }

      .api-key-input-container button:hover:not(:disabled) {
        background-color: #1177bb;
      }

      .api-key-input-container button:disabled {
        background-color: #666;
        cursor: not-allowed;
      }

      .api-key-note {
        font-size: 12px;
        color: #888;
        margin: 0;
      }

      .api-key-note a {
        color: #569cd6;
        text-decoration: none;
      }

      .api-key-note a:hover {
        text-decoration: underline;
      }

      /* Main Chat */
      .chat-main {
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-height: 0;
      }

      .message {
        border-radius: 8px;
        padding: 12px;
        max-width: 90%;
        word-wrap: break-word;
      }

      .message.user {
        background-color: #0e639c;
        color: white;
        align-self: flex-end;
        margin-left: auto;
      }

      .message.assistant {
        background-color: #2d2d30;
        color: #d4d4d4;
        border: 1px solid #3c3c3c;
        align-self: flex-start;
        margin-right: auto;
      }

      .message-content {
        font-size: 13px;
        line-height: 1.5;
        white-space: pre-wrap;
      }

      .message-time {
        font-size: 11px;
        opacity: 0.7;
        margin-top: 6px;
      }

      .typing-indicator {
        background-color: #2d2d30;
        border: 1px solid #3c3c3c;
        border-radius: 8px;
        padding: 12px;
        color: #888;
        font-size: 12px;
        align-self: flex-start;
        margin-right: auto;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .typing-dots {
        display: flex;
        gap: 2px;
      }

      .typing-dots span {
        width: 4px;
        height: 4px;
        background-color: #888;
        border-radius: 50%;
        animation: typing 1.4s infinite;
      }

      .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
      .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

      @keyframes typing {
        0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
        40% { opacity: 1; transform: scale(1); }
      }

      /* Code blocks in messages */
      .message-content code {
        background-color: rgba(0, 0, 0, 0.3);
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 12px;
      }

      .message-content pre {
        background-color: rgba(0, 0, 0, 0.3);
        padding: 8px;
        border-radius: 4px;
        overflow-x: auto;
        margin: 8px 0;
      }

      .message-content pre code {
        background: none;
        padding: 0;
      }

      /* Input Section */
      .chat-input-section {
        border-top: 1px solid #3c3c3c;
        background-color: #2d2d30;
        padding: 12px;
      }

      .input-wrapper {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .quick-actions {
        background-color: #1e1e1e;
        border: 1px solid #3c3c3c;
        border-radius: 6px;
        padding: 8px;
      }

      .quick-actions-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-size: 12px;
        font-weight: 600;
        color: #cccccc;
      }

      .quick-actions-header button {
        background: transparent;
        border: none;
        color: #888;
        cursor: pointer;
        font-size: 14px;
      }

      .quick-actions-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }

      .quick-action-btn {
        background-color: #3c3c3c;
        color: #cccccc;
        border: 1px solid #555;
        padding: 6px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        text-align: left;
        transition: background-color 0.2s;
      }

      .quick-action-btn:hover:not(:disabled) {
        background-color: #4c4c4c;
      }

      .quick-action-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .chat-input-controls {
        display: flex;
        align-items: flex-end;
        gap: 8px;
      }

      .chat-input-controls textarea {
        flex: 1;
        background-color: #1e1e1e;
        border: 1px solid #3c3c3c;
        color: #d4d4d4;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        font-family: 'Consolas', 'Monaco', monospace;
        resize: none;
        min-height: 36px;
        max-height: 120px;
        line-height: 1.4;
        outline: none;
      }

      .chat-input-controls textarea:focus {
        border-color: #0e639c;
      }

      .input-buttons {
        display: flex;
        gap: 4px;
      }

      .input-buttons button {
        background-color: #3c3c3c;
        color: #cccccc;
        border: 1px solid #555;
        padding: 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
      }

      .input-buttons button:hover:not(:disabled) {
        background-color: #4c4c4c;
      }

      .input-buttons button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .input-buttons button#send-message {
        background-color: #0e639c;
      }

      .input-buttons button#send-message:hover:not(:disabled) {
        background-color: #1177bb;
      }

      /* Scrollbar */
      .chat-messages::-webkit-scrollbar {
        width: 6px;
      }

      .chat-messages::-webkit-scrollbar-track {
        background: transparent;
      }

      .chat-messages::-webkit-scrollbar-thumb {
        background: #424242;
        border-radius: 3px;
      }

      .chat-messages::-webkit-scrollbar-thumb:hover {
        background: #555;
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
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
      });
    }

    if (quickActionsToggle) {
      quickActionsToggle.addEventListener('click', () => this.toggleQuickActions());
    }

    // Quick actions
    const closeQuickActions = document.getElementById('close-quick-actions');
    if (closeQuickActions) {
      closeQuickActions.addEventListener('click', () => this.hideQuickActions());
    }

    // Quick action buttons
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('quick-action-btn')) {
        const action = target.getAttribute('data-action');
        if (action) {
          this.handleQuickAction(action);
        }
      }
    });
  }

  private async setupAPIKey(): Promise<void> {
    const input = document.getElementById('api-key-input') as HTMLInputElement;
    const button = document.getElementById('api-key-submit') as HTMLButtonElement;
    
    if (!input || !button) return;

    const apiKey = input.value.trim();
    if (!apiKey) return;

    button.disabled = true;
    button.textContent = 'Connecting...';

    try {
      // Test the API key with a simple call
      const testResult = await this.electronAPI.callAnthropicAPI(
        [{ role: 'user', content: 'Hello' }],
        'You are a helpful assistant. Respond with just "OK" to confirm the connection.'
      );

      // Check if we got a valid response
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
      button.textContent = 'Connect';
    }
  }

  private checkAPIKey(): void {
    // For now, always show API key setup
    // In a real app, you'd check if an API key is already stored
    this.showAPIKeySetup();
  }

  private showAPIKeySetup(): void {
    const apiKeySetup = document.getElementById('api-key-setup');
    const chatMain = document.getElementById('chat-main');
    
    if (apiKeySetup) apiKeySetup.style.display = 'block';
    if (chatMain) chatMain.style.display = 'none';
  }

  private showChatInterface(): void {
    const apiKeySetup = document.getElementById('api-key-setup');
    const chatMain = document.getElementById('chat-main');
    
    if (apiKeySetup) apiKeySetup.style.display = 'none';
    if (chatMain) chatMain.style.display = 'flex';
  }

  private addWelcomeMessage(): void {
    const welcomeMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `Hello! I'm your AI coding assistant. I can help you with:

• **Code Analysis** - Explain and review your code
• **Code Generation** - Create new components, functions, or files  
• **Debugging** - Find and fix issues
• **Refactoring** - Improve code quality
• **Documentation** - Generate comments and docs

Feel free to ask questions about your code or request new functionality!`,
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
      // Convert messages to the format expected by the API
      const apiMessages = this.chatState.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await this.electronAPI.callAnthropicAPI(
        apiMessages,
        this.getSystemPrompt()
      );

      // Add assistant response - extract content from the response object
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
        content: `❌ Error: Failed to get response from AI. ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };

      this.chatState.messages.push(errorMessage);
    } finally {
      this.chatState.isLoading = false;
      this.hideTypingIndicator();
      this.renderMessages();
    }
  }

  private getSystemPrompt(): string {
    return `You are an expert coding assistant helping a developer with their IDE. You can:

1. Analyze, explain, and review code
2. Generate new code, components, and functions
3. Help with debugging and optimization
4. Suggest improvements and refactoring
5. Create documentation and comments

Current context:
- Project: ${this.state.currentWorkingDirectory}
- Current file: ${this.state.currentFile || 'None'}

When providing code, use appropriate markdown formatting with language-specific code blocks.
Be concise but thorough in your explanations.
If asked to generate code, provide complete, working examples when possible.`;
  }

  private renderMessages(): void {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    messagesContainer.innerHTML = '';

    this.chatState.messages.forEach(message => {
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${message.role}`;
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.textContent = message.content;

      const timeDiv = document.createElement('div');
      timeDiv.className = 'message-time';
      timeDiv.textContent = message.timestamp.toLocaleTimeString();

      messageDiv.appendChild(contentDiv);
      messageDiv.appendChild(timeDiv);
      messagesContainer.appendChild(messageDiv);
    });

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  private showTypingIndicator(): void {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = `
      <span>AI is thinking</span>
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;

    messagesContainer.appendChild(indicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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

    quickActions.style.display = quickActions.style.display === 'none' ? 'block' : 'none';
  }

  private hideQuickActions(): void {
    const quickActions = document.getElementById('quick-actions');
    if (quickActions) {
      quickActions.style.display = 'none';
    }
  }

  private handleQuickAction(action: string): void {
    const actionMap: { [key: string]: string } = {
      'explain': 'Please explain the current code and what it does.',
      'debug': 'Please review this code for potential bugs or issues.',
      'optimize': 'Please suggest optimizations for this code.',
      'comment': 'Please add appropriate comments to this code.',
      'test': 'Please create unit tests for this code.',
      'refactor': 'Please refactor this code to improve readability and maintainability.'
    };

    const message = actionMap[action];
    if (message) {
      const input = document.getElementById('chat-input') as HTMLTextAreaElement;
      if (input) {
        input.value = message;
        input.focus();
        this.hideQuickActions();
      }
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
}
