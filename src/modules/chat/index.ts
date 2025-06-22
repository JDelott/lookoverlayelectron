import { AppState } from '../types/index.js';
import { FilePicker, AttachedFile, FilePickerCallbacks } from '../filePicker/index.js';

// Core imports
import { ChatMessage, ChatState, EventCallbacks } from './core/ChatTypes.js';
import { ChatStateManager } from './core/ChatStateManager.js';

// UI imports  
import { ChatUIManager } from './ui/ChatUIManager.js';
import { ChatStyles } from './ui/ChatStyles.js';

// Feature imports
import { ChatStreaming } from './streaming/ChatStreaming.js';
import { SpeechHandler } from './features/SpeechHandler.js';
import { QuickActions } from './features/QuickActions.js';
import { CodeInsertion } from './features/CodeInsertion.js';
import { MessageRenderer } from './features/MessageRenderer.js';
import { CodeApplicator } from './features/CodeApplicator.js';

// Utility imports
import { ScrollManager } from './utils/ScrollManager.js';
import { DOMHelpers } from './utils/DOMHelpers.js';

// API import
import { ChatAPI } from './api/ChatAPI.js';

export { ChatMessage, ChatState };

export class ChatManager {
  private state: AppState;
  private electronAPI: any;
  
  // Core modules
  private stateManager: ChatStateManager;
  private uiManager: ChatUIManager;
  private styles: ChatStyles;
  
  // Feature modules
  private streaming: ChatStreaming;
  private speechHandler: SpeechHandler;
  private quickActions: QuickActions;
  private codeInsertion: CodeInsertion;
  private messageRenderer: MessageRenderer;
  private codeApplicator: CodeApplicator;
  
  // Utility modules
  private scrollManager: ScrollManager;
  private api: ChatAPI;
  
  // File picker integration
  private filePicker: FilePicker | null = null;

  constructor(state: AppState) {
    this.state = state;
    this.electronAPI = (window as any).electronAPI;
    
    // Initialize core modules
    this.stateManager = new ChatStateManager();
    this.uiManager = new ChatUIManager();
    this.styles = new ChatStyles();
    this.scrollManager = new ScrollManager();
    this.api = new ChatAPI();
    
    // Initialize feature modules
    const callbacks: EventCallbacks = {
      onStreamStart: () => this.uiManager.hideTypingIndicator(),
      onStreamEnd: () => this.messageRenderer.renderMessages(this.stateManager.getMessages()),
      onStreamError: (error) => this.messageRenderer.renderMessages(this.stateManager.getMessages()),
      onAPIKeyConfigured: () => this.handleAPIKeyConfigured(),
      onRecordingStateChanged: (isRecording) => this.uiManager.updateMicrophoneButton(isRecording)
    };
    
    this.streaming = new ChatStreaming(this.stateManager, this.scrollManager, callbacks);
    this.speechHandler = new SpeechHandler(this.stateManager, this.uiManager, callbacks);
    this.quickActions = new QuickActions();
    this.codeInsertion = new CodeInsertion(this.state);
    this.messageRenderer = new MessageRenderer();
    
    // Initialize code applicator
    this.codeApplicator = new CodeApplicator(this.state);
    
    this.initializeFilePicker();
  }

  initialize(): void {
    console.log('🔧 ChatManager initialize called');
    
    // Always expose globally first
    this.exposeGlobally();
    
    // Initialize UI
    this.uiManager.initialize();
    this.styles.inject();
    
    // Set up event listeners
    this.setupEventListeners();
    this.quickActions.setupQuickActionListeners();
    
    // Check API key status
    this.checkAPIKey();
    
    this.stateManager.setUIReady(true);
    console.log('✅ ChatManager initialization complete');
  }

  private setupEventListeners(): void {
    // Remove existing listeners first
    this.removeEventListeners();
    
    // API Key setup
    this.uiManager.addEventListener('api-key-submit', 'click', () => this.setupAPIKey());
    this.uiManager.addEventListener('api-key-input', 'keypress', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'Enter') this.setupAPIKey();
    });

    // Chat input
    this.uiManager.addEventListener('send-message', 'click', () => this.sendMessage());
    this.uiManager.addEventListener('chat-input', 'keypress', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.uiManager.addEventListener('chat-input', 'input', (e: Event) => {
      const textarea = e.target as HTMLTextAreaElement;
      DOMHelpers.autoResizeTextarea(textarea);
      DOMHelpers.updateCharCount(textarea);
    });

    // Action buttons
    this.uiManager.addEventListener('quick-actions-toggle', 'click', () => this.quickActions.toggleQuickActions());
    this.uiManager.addEventListener('attach-code', 'click', () => this.attachCurrentCode());
    this.uiManager.addEventListener('microphone-btn', 'click', () => this.speechHandler.toggleRecording());
    this.uiManager.addEventListener('attach-files', 'click', () => this.showFilePicker());
    this.uiManager.addEventListener('clear-all-files', 'click', () => this.clearAllAttachedFiles());

    // Add code application listener with debugging
    document.addEventListener('applyCode', (e: any) => {
      console.log('🚀 === APPLY CODE EVENT RECEIVED ===');
      console.log('🔧 Event detail:', e.detail);
      console.log('🔧 Monaco editor available:', !!this.state.monacoEditor);
      console.log('🔧 Current file:', this.state.currentFile);
      
      if (!this.state.monacoEditor) {
        console.error('❌ No Monaco editor available');
        alert('Please open a file in the editor first before applying code.');
        return;
      }
      
      try {
        const { code, language } = e.detail;
        console.log('🔧 Calling codeApplicator.applyCode with code length:', code.length);
        this.codeApplicator.applyCode(code, language);
        console.log('✅ codeApplicator.applyCode completed');
      } catch (error: unknown) {
        console.error('❌ Error in applyCode event handler:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        alert(`Error applying code: ${errorMessage}`);
      }
    });
    
    console.log('✅ All event listeners set up, including applyCode');
  }

  private removeEventListeners(): void {
    this.uiManager.removeEventListeners();
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
      const isValid = await this.api.validateAPIKey(apiKey);
      
      if (isValid) {
        this.stateManager.setAPIKeyConfigured(true);
        this.uiManager.showChatInterface();
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
    if (this.stateManager.isAPIKeyConfigured()) {
      this.uiManager.showChatInterface();
    } else {
      this.uiManager.showAPIKeySetup();
    }
  }

  private addWelcomeMessage(): void {
    const welcomeMessage = this.messageRenderer.addWelcomeMessage();
    this.stateManager.addMessage(welcomeMessage);
    this.messageRenderer.renderMessages(this.stateManager.getMessages());
  }

  private async sendMessage(): Promise<void> {
    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (!input || !input.value.trim() || this.stateManager.isLoading()) return;

    const userContent = input.value.trim();
    let messageContent = userContent;

    // Include attached files context
    const attachedFiles = this.stateManager.getAttachedFiles();
    if (attachedFiles.size > 0) {
      let contextContent = '\n\n**Attached Files:**\n\n';
      
      attachedFiles.forEach((file) => {
        contextContent += `**${file.name}:**\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n\n`;
      });
      
      contextContent += `**Question:** ${userContent}`;
      messageContent = contextContent;
    }

    // Clear input
    input.value = '';
    DOMHelpers.autoResizeTextarea(input);
    DOMHelpers.updateCharCount(input);

    // Create user message
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

    this.stateManager.addMessage(userMessage);
    this.messageRenderer.renderMessages(this.stateManager.getMessages());

    // Show loading state
    this.stateManager.setLoading(true);
    this.uiManager.showTypingIndicator();

    try {
      // Prepare messages for API
      const apiMessages = this.stateManager.getMessages().slice(0, -1).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      apiMessages.push({
        role: 'user',
        content: messageContent
      });

      await this.streaming.startStreaming(apiMessages, this.api.getSystemPrompt(this.state, attachedFiles));
      
    } catch (error) {
      console.error('Failed to start streaming:', error);
      this.handleSendError(error as Error);
    }
  }

  private handleSendError(error: Error): void {
    this.stateManager.setLoading(false);
    this.uiManager.hideTypingIndicator();
    
    const errorMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `❌ **Error**: Failed to get response: ${error.message}

**Suggestions:**
• Try asking a more specific question
• Check your internet connection
• Ensure your API key is valid`,
      timestamp: new Date()
    };

    this.stateManager.addMessage(errorMessage);
    this.messageRenderer.renderMessages(this.stateManager.getMessages());
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

  private attachCurrentCode(): void {
    if (this.state.monacoEditor && this.state.currentFile) {
      const code = this.state.monacoEditor.getValue();
      const input = document.getElementById('chat-input') as HTMLTextAreaElement;
      if (input && code) {
        const fileName = this.state.currentFile.split('/').pop();
        const extension = fileName?.split('.').pop() || '';
        input.value = `Here's my current code in ${fileName}:\n\n\`\`\`${extension}\n${code}\n\`\`\`\n\n`;
        DOMHelpers.autoResizeTextarea(input);
        DOMHelpers.updateCharCount(input);
        input.focus();
      }
    }
  }

  private handleAPIKeyConfigured(): void {
    this.uiManager.showChatInterface();
    this.addWelcomeMessage();
  }

  // File picker methods
  private initializeFilePicker(): void {
    const callbacks: FilePickerCallbacks = {
      onFilesSelected: (files: Map<string, AttachedFile>) => {
        files.forEach((file, path) => this.stateManager.addAttachedFile(path, file));
        this.updateAttachedFilesDisplay();
      },
      onFileRemoved: (filePath: string) => {
        this.stateManager.removeAttachedFile(filePath);
        this.updateAttachedFilesDisplay();
      },
      onAllFilesCleared: () => {
        this.stateManager.clearAttachedFiles();
        this.updateAttachedFilesDisplay();
      }
    };

    this.filePicker = new FilePicker(callbacks, {
      allowMultiple: true,
      maxFiles: 10
    });
  }

  private async showFilePicker(): Promise<void> {
    if (this.filePicker) {
      await this.filePicker.show();
    }
  }

  private updateAttachedFilesDisplay(): void {
    const attachedFiles = this.stateManager.getAttachedFiles();
    this.uiManager.updateAttachedFilesDisplay(attachedFiles, (path) => {
      this.stateManager.removeAttachedFile(path);
      this.updateAttachedFilesDisplay();
    });
    this.uiManager.updateAttachButton(this.stateManager.hasAttachedFiles(), this.stateManager.getAttachedFilesCount());
  }

  private clearAllAttachedFiles(): void {
    this.stateManager.clearAttachedFiles();
    this.updateAttachedFilesDisplay();
    DOMHelpers.showNotification('All files cleared', 'success');
  }

  // Public API methods
  clearChat(): void {
    console.log('🔧 ChatManager clearChat called');
    this.stateManager.clearMessages();
    this.messageRenderer.renderMessages([]);
    this.addWelcomeMessage();
    console.log('✅ Chat cleared successfully');
  }

  exposeGlobally(): void {
    (window as any).chatManager = this;
    console.log('✅ ChatManager exposed globally');
  }

  dispose(): void {
    this.styles.remove();
    this.removeEventListeners();
    delete (window as any).chatManager;
  }

  getState(): ChatState {
    return this.stateManager.getChatState();
  }

  setState(state: ChatState): void {
    this.stateManager.setChatState(state);
  }

  isReady(): boolean {
    return this.stateManager.getUIReady() && this.isInitialized();
  }

  getChatState(): ChatState {
    return this.stateManager.getChatState();
  }

  public isInitialized(): boolean {
    const chatContent = document.getElementById('ai-chat-content');
    return !!(chatContent && chatContent.querySelector('.chat-container'));
  }
}
