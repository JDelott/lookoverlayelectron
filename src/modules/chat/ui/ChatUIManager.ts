import { ChatMessage, AttachedFile } from '../core/ChatTypes.js';

export class ChatUIManager {
  private eventListeners: Map<string, EventListener[]> = new Map();

  initialize(): void {
    console.log('🔧 ChatUIManager initialize called');
    
    const chatContent = document.getElementById('ai-chat-content');
    const existingContainer = chatContent?.querySelector('.chat-container');
    
    if (!existingContainer) {
      this.setupInitialUI();
    } else {
      console.log('✅ Chat UI already exists, preserving content');
    }
    
    console.log('✅ ChatUIManager initialization complete');
  }

  isInitialized(): boolean {
    const chatContent = document.getElementById('ai-chat-content');
    return !!(chatContent && chatContent.querySelector('.chat-container'));
  }

  private setupInitialUI(): void {
    const chatContent = document.getElementById('ai-chat-content');
    if (!chatContent) {
      console.log('❌ ai-chat-content not found');
      return;
    }

    console.log('🔧 Setting up chat UI...');
    chatContent.innerHTML = this.getUITemplate();
  }

  private getUITemplate(): string {
    return `
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
          <!-- Attached Files Bar -->
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

          <!-- Messages Container -->
          <div id="chat-messages" class="chat-messages"></div>

          <!-- Quick Actions -->
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
  }

  showAPIKeySetup(): void {
    const apiKeySetup = document.getElementById('api-key-setup');
    const chatMain = document.getElementById('chat-main');
    
    if (apiKeySetup) apiKeySetup.style.display = 'flex';
    if (chatMain) chatMain.style.display = 'none';
  }

  showChatInterface(): void {
    const apiKeySetup = document.getElementById('api-key-setup');
    const chatMain = document.getElementById('chat-main');
    
    if (apiKeySetup) apiKeySetup.style.display = 'none';
    if (chatMain) chatMain.style.display = 'flex';
  }

  updateAttachedFilesDisplay(attachedFiles: Map<string, AttachedFile>, onRemoveFile: (path: string) => void): void {
    const header = document.getElementById('attached-files-header');
    const countElement = document.getElementById('attached-files-count');
    const listElement = document.getElementById('attached-files-list');
    
    if (!header || !countElement || !listElement) return;

    if (attachedFiles.size === 0) {
      header.style.display = 'none';
      return;
    }

    header.style.display = 'block';
    
    const count = attachedFiles.size;
    countElement.textContent = `${count} file${count !== 1 ? 's' : ''}`;

    listElement.innerHTML = '';
    attachedFiles.forEach((file, path) => {
      const fileTag = this.createFileTag(file, path, onRemoveFile);
      listElement.appendChild(fileTag);
    });
  }

  private createFileTag(file: AttachedFile, path: string, onRemove: (path: string) => void): HTMLElement {
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
      removeBtn.addEventListener('click', () => onRemove(path));
    }
    
    return fileTag;
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

  updateAttachButton(hasFiles: boolean, fileCount: number): void {
    const attachBtn = document.getElementById('attach-files');
    if (attachBtn) {
      if (hasFiles) {
        attachBtn.classList.add('has-files');
        attachBtn.title = `${fileCount} files attached`;
      } else {
        attachBtn.classList.remove('has-files');
        attachBtn.title = 'Attach files';
      }
    }
  }

  showTypingIndicator(): void {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    // Remove existing indicator
    this.hideTypingIndicator();

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
  }

  hideTypingIndicator(): void {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  updateCharCount(length: number, maxLength: number = 50000): void {
    const charCount = document.getElementById('char-count');
    if (!charCount) return;

    charCount.textContent = `${length.toLocaleString()} / ${maxLength.toLocaleString()}`;
    
    charCount.className = 'char-count';
    if (length > maxLength * 0.9) {
      charCount.classList.add('error');
    } else if (length > maxLength * 0.8) {
      charCount.classList.add('warning');
    }
  }

  autoResizeTextarea(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 150);
    textarea.style.height = newHeight + 'px';
  }

  addEventListener(elementId: string, event: string, handler: EventListener): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.addEventListener(event, handler);
      
      // Store for cleanup
      if (!this.eventListeners.has(elementId)) {
        this.eventListeners.set(elementId, []);
      }
      this.eventListeners.get(elementId)!.push(handler);
    }
  }

  removeEventListeners(): void {
    this.eventListeners.forEach((handlers, elementId) => {
      const element = document.getElementById(elementId);
      if (element) {
        handlers.forEach(handler => {
          element.removeEventListener('click', handler);
          element.removeEventListener('keypress', handler);
          element.removeEventListener('input', handler);
        });
      }
    });
    this.eventListeners.clear();
  }

  toggleQuickActions(): void {
    const quickActions = document.getElementById('quick-actions');
    if (!quickActions) return;

    const isVisible = quickActions.style.display !== 'none';
    quickActions.style.display = isVisible ? 'none' : 'block';
  }

  updateMicrophoneButton(isRecording: boolean): void {
    const micBtn = document.getElementById('microphone-btn');
    if (!micBtn) return;

    if (isRecording) {
      micBtn.innerHTML = '<span class="action-icon recording">🔴</span>';
      micBtn.classList.add('recording');
      micBtn.title = 'Stop recording';
    } else {
      micBtn.innerHTML = '<span class="action-icon">🎤</span>';
      micBtn.classList.remove('recording');
      micBtn.title = 'Start voice input';
    }
  }

  showNotification(message: string, type: 'success' | 'error'): void {
    const notification = document.createElement('div');
    notification.className = `speech-notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}
