import { ChatMessage, StreamingState } from '../core/ChatTypes.js';
import { ChatStateManager } from '../core/ChatStateManager.js';
import { ScrollManager } from '../utils/ScrollManager.js';

// Add chunked response support
interface ChunkedResponseState {
  isChunked: boolean;
  currentChunk: number;
  totalChunks: number;
  progressElement?: HTMLElement;
}

export class StreamingRenderer {
  private stateManager: ChatStateManager;
  private scrollManager: ScrollManager;
  private chunkedState: ChunkedResponseState = {
    isChunked: false,
    currentChunk: 0,
    totalChunks: 0
  };

  constructor(stateManager: ChatStateManager, scrollManager: ScrollManager) {
    this.stateManager = stateManager;
    this.scrollManager = scrollManager;
  }

  createStreamingMessageElement(message: ChatMessage): void {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    // Create the message element with proper structure
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant streaming';
    messageDiv.setAttribute('data-message-id', message.id);
    
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
    time.textContent = message.timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    header.appendChild(role);
    header.appendChild(time);

    // Create proper message text container
    const messageText = document.createElement('div');
    messageText.className = 'message-text typing-cursor';
    messageText.textContent = '';

    contentDiv.appendChild(header);
    contentDiv.appendChild(messageText);

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);

    // Add to container
    container.appendChild(messageDiv);

    // Update state with references
    this.stateManager.setStreamingState({
      streamingMessageElement: messageDiv,
      streamingContentContainer: messageText
    });

    // Force scroll to the new message
    this.scrollManager.forceScrollToBottom();
  }

  appendToken(token: string): void {
    const streamingState = this.stateManager.getStreamingState();
    if (!streamingState.streamingContentContainer) return;

    // Direct text append for simple streaming
    const currentText = streamingState.streamingContentContainer.textContent || '';
    streamingState.streamingContentContainer.textContent = currentText + token;
    
    // Ensure typing cursor is visible
    streamingState.streamingContentContainer.classList.add('typing-cursor');
  }

  finalizeStreamingMessage(): void {
    const streamingState = this.stateManager.getStreamingState();
    
    if (streamingState.streamingMessageElement) {
      streamingState.streamingMessageElement.classList.remove('streaming');
      
      // Remove typing cursor
      if (streamingState.streamingContentContainer) {
        streamingState.streamingContentContainer.classList.remove('typing-cursor');
        
        // Process final content with markdown
        const finalText = streamingState.streamingContentContainer.textContent || '';
        if (finalText) {
          this.processFinalContent(finalText, streamingState.streamingContentContainer);
        }
      }
    }
  }

  private processFinalContent(content: string, container: HTMLElement): void {
    // Check if content has code blocks or complex markdown
    if (content.includes('```') || content.includes('**') || content.includes('*')) {
      // For complex content, rebuild with proper markdown processing
      this.rebuildWithMarkdown(content, container);
    } else {
      // For simple text, just apply basic formatting
      container.innerHTML = this.processSimpleMarkdown(content);
    }
  }

  private rebuildWithMarkdown(content: string, container: HTMLElement): void {
    // Find the parent message content to rebuild
    const messageContent = container.closest('.message-content');
    if (!messageContent) return;

    // Keep the header, rebuild the content
    const header = messageContent.querySelector('.message-header');
    
    // Clear content but keep header
    messageContent.innerHTML = '';
    if (header) {
      messageContent.appendChild(header);
    }

    // Process content with proper markdown handling
    if (content.includes('```')) {
      this.processMarkdownWithCodeBlocks(content, messageContent as HTMLElement);
    } else {
      // Simple content - create a single text div
      const textDiv = document.createElement('div');
      textDiv.className = 'message-text';
      textDiv.innerHTML = this.processSimpleMarkdown(content);
      messageContent.appendChild(textDiv);
    }
  }

  private processMarkdownWithCodeBlocks(content: string, container: HTMLElement): void {
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    parts.forEach(part => {
      if (part.startsWith('```') && part.endsWith('```')) {
        // This is a code block
        const lines = part.split('\n');
        const firstLine = lines[0].replace('```', '');
        const language = firstLine.trim() || 'text';
        const code = lines.slice(1, -1).join('\n');
        
        if (code.trim()) {
          const codeBlock = this.createInteractiveCodeBlock(code, language);
          container.appendChild(codeBlock);
        }
      } else if (part.trim()) {
        // This is regular text
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerHTML = this.processSimpleMarkdown(part.trim());
        container.appendChild(textDiv);
      }
    });
  }

  private processSimpleMarkdown(content: string): string {
    let processed = content;
    
    // Bold text
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic text
    processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Inline code
    processed = processed.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    
    // Bullet points
    processed = processed.replace(/^• (.*$)/gim, '• $1');
    
    // Convert newlines to proper line breaks
    processed = processed.replace(/\n/g, '<br>');
    
    return processed;
  }

  // CRITICAL: Create interactive code blocks with textarea for full cursor control
  private createInteractiveCodeBlock(code: string, language: string): HTMLElement {
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
    copyBtn.innerHTML = '📋 Copy All';
    copyBtn.onclick = () => this.copyCodeToClipboard(code);
    
    // Add copy selected button
    const copySelectedBtn = document.createElement('button');
    copySelectedBtn.className = 'code-action';
    copySelectedBtn.innerHTML = '📋 Copy Selected';
    copySelectedBtn.onclick = () => this.copySelectedCode(codeBlock);
    
    const insertBtn = document.createElement('button');
    insertBtn.className = 'code-action';
    insertBtn.innerHTML = '📥 Insert';
    insertBtn.onclick = () => this.insertCodeIntoEditor(code);
    
    actions.appendChild(copyBtn);
    actions.appendChild(copySelectedBtn);
    actions.appendChild(insertBtn);
    
    header.appendChild(langSpan);
    header.appendChild(actions);
    
    // CRITICAL: Use textarea instead of pre/code for full interaction
    const content = document.createElement('div');
    content.className = 'code-content';
    
    const textarea = document.createElement('textarea');
    textarea.className = 'code-textarea';
    textarea.value = code;
    textarea.readOnly = false; // Allow editing for full cursor control
    textarea.spellcheck = false;
    
    // Set up the textarea for proper code display and interaction
    textarea.style.cssText = `
      width: 100%;
      height: ${Math.min(Math.max(code.split('\n').length * 1.6 + 2, 4), 30)}rem;
      background: transparent;
      border: none;
      outline: none;
      resize: vertical;
      padding: 1.25rem;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace;
      font-size: 0.8125rem;
      line-height: 1.6;
      color: #e6edf3;
      white-space: pre;
      overflow-wrap: normal;
      overflow-x: auto;
      tab-size: 2;
      user-select: text;
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
      cursor: text;
    `;
    
    // Add event handlers for better UX
    textarea.addEventListener('focus', () => {
      codeBlock.classList.add('focused');
    });
    
    textarea.addEventListener('blur', () => {
      codeBlock.classList.remove('focused');
    });
    
    // Add keyboard shortcuts
    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        textarea.select();
      }
    });
    
    content.appendChild(textarea);
    codeBlock.appendChild(header);
    codeBlock.appendChild(content);
    
    return codeBlock;
  }

  private copySelectedCode(codeBlock: HTMLElement): void {
    const textarea = codeBlock.querySelector('.code-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    if (selectedText) {
      this.copyCodeToClipboard(selectedText);
    } else {
      // If nothing selected, copy all
      this.copyCodeToClipboard(textarea.value);
    }
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
    }
  }

  private insertCodeIntoEditor(code: string): void {
    // This will be handled by the CodeInsertion module
    const event = new CustomEvent('insertCode', { detail: { code } });
    document.dispatchEvent(event);
  }

  // Add method to show chunked response progress
  showChunkedProgress(currentChunk: number, totalChunks: number): void {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    // Remove existing progress if any
    const existingProgress = container.querySelector('.chunked-progress');
    if (existingProgress) {
      existingProgress.remove();
    }

    // Create progress indicator
    const progressDiv = document.createElement('div');
    progressDiv.className = 'chunked-progress message assistant';
    progressDiv.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-role">Claude</span>
          <span class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="chunked-progress-content">
          <div class="progress-text">Processing complex request... (${currentChunk}/${totalChunks})</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${(currentChunk / totalChunks) * 100}%"></div>
          </div>
        </div>
      </div>
    `;

    container.appendChild(progressDiv);
    this.chunkedState.progressElement = progressDiv;
    this.scrollManager.forceScrollToBottom();
  }

  hideChunkedProgress(): void {
    if (this.chunkedState.progressElement) {
      this.chunkedState.progressElement.remove();
      this.chunkedState.progressElement = undefined;
    }
  }
}
