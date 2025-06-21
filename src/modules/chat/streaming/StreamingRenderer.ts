import { ChatMessage, StreamingState } from '../core/ChatTypes.js';
import { ChatStateManager } from '../core/ChatStateManager.js';
import { ScrollManager } from '../utils/ScrollManager.js';

// Enhanced streaming with better performance
interface StreamingBuffer {
  tokens: string[];
  lastUpdate: number;
  updateScheduled: boolean;
}

interface ChunkedResponseState {
  isChunked: boolean;
  currentChunk: number;
  totalChunks: number;
  progressElement?: HTMLElement;
}

export class StreamingRenderer {
  private stateManager: ChatStateManager;
  private scrollManager: ScrollManager;
  private streamingBuffer: StreamingBuffer;
  private chunkedState: ChunkedResponseState = {
    isChunked: false,
    currentChunk: 0,
    totalChunks: 0
  };

  // Configuration for smooth streaming
  private readonly BATCH_UPDATE_INTERVAL = 16; // ~60fps
  private readonly BATCH_SIZE = 5; // Tokens per batch

  constructor(stateManager: ChatStateManager, scrollManager: ScrollManager) {
    this.stateManager = stateManager;
    this.scrollManager = scrollManager;
    this.streamingBuffer = {
      tokens: [],
      lastUpdate: 0,
      updateScheduled: false
    };
  }

  createStreamingMessageElement(message: ChatMessage): void {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    // Create the message element with better structure
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant streaming';
    messageDiv.setAttribute('data-message-id', message.id);
    
    // Avatar with improved styling
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = '<div class="avatar-icon assistant">🤖</div>';

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

    // Add streaming indicator
    const indicator = document.createElement('span');
    indicator.className = 'streaming-indicator';
    indicator.innerHTML = '<span class="dots"><span>.</span><span>.</span><span>.</span></span>';

    header.appendChild(role);
    header.appendChild(time);
    header.appendChild(indicator);

    // Create the streaming text container with proper structure
    const messageText = document.createElement('div');
    messageText.className = 'message-text streaming-text';
    
    // Pre-create a content span for smoother updates
    const contentSpan = document.createElement('span');
    contentSpan.className = 'streaming-content';
    contentSpan.textContent = '';
    
    // Add typing cursor
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    cursor.textContent = '▊';
    
    messageText.appendChild(contentSpan);
    messageText.appendChild(cursor);

    contentDiv.appendChild(header);
    contentDiv.appendChild(messageText);

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);

    // Add to container with smooth animation
    messageDiv.style.opacity = '0';
    messageDiv.style.transform = 'translateY(10px)';
    container.appendChild(messageDiv);

    // Animate in
    requestAnimationFrame(() => {
      messageDiv.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      messageDiv.style.opacity = '1';
      messageDiv.style.transform = 'translateY(0)';
    });

    // Update state with references
    this.stateManager.setStreamingState({
      streamingMessageElement: messageDiv,
      streamingContentContainer: contentSpan,
      streamingIndicator: indicator
    });

    // Smooth scroll to the new message
    this.scrollManager.scheduleScrollUpdate();
  }

  appendToken(token: string): void {
    // Add token to buffer for batched updates
    this.streamingBuffer.tokens.push(token);
    
    // Schedule update if not already scheduled
    if (!this.streamingBuffer.updateScheduled) {
      this.scheduleBufferUpdate();
    }
  }

  private scheduleBufferUpdate(): void {
    if (this.streamingBuffer.updateScheduled) return;
    
    this.streamingBuffer.updateScheduled = true;
    
    // Use requestAnimationFrame for smooth 60fps updates
    requestAnimationFrame(() => {
      this.flushBuffer();
      this.streamingBuffer.updateScheduled = false;
    });
  }

  private flushBuffer(): void {
    const streamingState = this.stateManager.getStreamingState();
    if (!streamingState.streamingContentContainer || this.streamingBuffer.tokens.length === 0) {
      return;
    }

    // Get all pending tokens
    const tokens = this.streamingBuffer.tokens.splice(0);
    const newText = tokens.join('');
    
    // Update content smoothly
    const currentText = streamingState.streamingContentContainer.textContent || '';
    const updatedText = currentText + newText;
    
    // Use textContent for better performance during streaming
    streamingState.streamingContentContainer.textContent = updatedText;
    
    // Update the cursor position (keep it at the end)
    const cursor = streamingState.streamingContentContainer.parentElement?.querySelector('.typing-cursor') as HTMLElement;
    if (cursor) {
      cursor.style.opacity = '1';
    }
    
    // Schedule smooth scroll update
    this.scrollManager.scheduleScrollUpdate();
  }

  finalizeStreamingMessage(): void {
    const streamingState = this.stateManager.getStreamingState();
    
    if (streamingState.streamingMessageElement) {
      // Remove streaming classes and indicators
      streamingState.streamingMessageElement.classList.remove('streaming');
      
      // Hide streaming indicator
      if (streamingState.streamingIndicator) {
        (streamingState.streamingIndicator as HTMLElement).style.opacity = '0';
        setTimeout(() => {
          streamingState.streamingIndicator?.remove();
        }, 300);
      }
      
      // Remove typing cursor with smooth fade
      const cursor = streamingState.streamingMessageElement.querySelector('.typing-cursor') as HTMLElement;
      if (cursor) {
        cursor.style.opacity = '0';
        setTimeout(() => cursor.remove(), 300);
      }
      
      // Process final content with markdown after a brief delay
      setTimeout(() => {
        if (streamingState.streamingContentContainer) {
          const finalText = streamingState.streamingContentContainer.textContent || '';
          if (finalText) {
            this.processFinalContent(finalText, streamingState.streamingContentContainer);
          }
        }
      }, 200);
    }

    // Clear buffer
    this.streamingBuffer.tokens = [];
    this.streamingBuffer.updateScheduled = false;
  }

  private processFinalContent(content: string, container: HTMLElement): void {
    // Check if content needs markdown processing
    const needsMarkdown = content.includes('```') || 
                         content.includes('**') || 
                         content.includes('*') ||
                         content.includes('`') ||
                         /^\s*[-•]\s/.test(content);

    if (needsMarkdown) {
      // For complex content, rebuild with proper markdown processing
      this.rebuildWithMarkdown(content, container);
    } else {
      // For simple text, just clean up and format
      container.innerHTML = this.processSimpleText(content);
    }
  }

  private rebuildWithMarkdown(content: string, container: HTMLElement): void {
    // Find the parent message content to rebuild
    const messageContent = container.closest('.message-content') as HTMLElement;
    if (!messageContent) return;

    // Keep the header, rebuild the content
    const header = messageContent.querySelector('.message-header');
    
    // Smooth transition out
    const currentHeight = messageContent.offsetHeight;
    messageContent.style.height = currentHeight + 'px';
    messageContent.style.overflow = 'hidden';
    
    setTimeout(() => {
      // Clear content but keep header
      messageContent.innerHTML = '';
      if (header) {
        messageContent.appendChild(header);
      }

      // Process content with proper markdown handling
      if (content.includes('```')) {
        this.processMarkdownWithCodeBlocks(content, messageContent);
      } else {
        // Simple content - create a single text div
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerHTML = this.processSimpleMarkdown(content);
        messageContent.appendChild(textDiv);
      }
      
      // Smooth transition back
      messageContent.style.height = 'auto';
      const newHeight = messageContent.offsetHeight;
      messageContent.style.height = currentHeight + 'px';
      
      requestAnimationFrame(() => {
        messageContent.style.transition = 'height 0.3s ease';
        messageContent.style.height = newHeight + 'px';
        
        setTimeout(() => {
          messageContent.style.height = 'auto';
          messageContent.style.overflow = 'visible';
          messageContent.style.transition = '';
        }, 300);
      });
    }, 100);
  }

  private processMarkdownWithCodeBlocks(content: string, container: HTMLElement): void {
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    parts.forEach(part => {
      if (part.startsWith('```') && part.endsWith('```')) {
        // This is a code block
        const lines = part.split('\n');
        const firstLine = lines[0].replace('```', '');
        
        // Check for file path pattern
        let language = firstLine.trim() || 'text';
        let filePath = '';
        
        if (firstLine.includes(':')) {
          const colonIndex = firstLine.indexOf(':');
          language = firstLine.substring(0, colonIndex).trim() || 'text';
          filePath = firstLine.substring(colonIndex + 1).trim();
        }
        
        const code = lines.slice(1, -1).join('\n');
        
        if (code.trim()) {
          if (filePath) {
            // This is a file creation block
            const fileBlock = this.createFileCreationBlock(code, language, filePath);
            container.appendChild(fileBlock);
          } else {
            // Regular code block
            const codeBlock = this.createInteractiveCodeBlock(code, language);
            container.appendChild(codeBlock);
          }
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

  private createFileCreationBlock(code: string, language: string, filePath: string): HTMLElement {
    const container = document.createElement('div');
    container.className = 'file-creation-container';

    // File header
    const header = document.createElement('div');
    header.className = 'file-creation-header';

    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-creation-info';

    const fileIcon = document.createElement('span');
    fileIcon.className = 'file-creation-icon';
    fileIcon.textContent = this.getFileIcon(filePath);

    const pathSpan = document.createElement('span');
    pathSpan.className = 'file-creation-path';
    pathSpan.textContent = filePath;

    const status = document.createElement('span');
    status.className = 'file-creation-status new';
    status.textContent = 'NEW';

    fileInfo.appendChild(fileIcon);
    fileInfo.appendChild(pathSpan);
    fileInfo.appendChild(status);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'file-creation-actions';

    const createBtn = document.createElement('button');
    createBtn.className = 'file-action-btn create-btn';
    createBtn.innerHTML = '<span class="btn-icon">📁</span><span class="btn-text">Create File</span>';
    createBtn.onclick = () => this.createFile(filePath, code, container);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'file-action-btn copy-btn';
    copyBtn.innerHTML = '<span class="btn-icon">📋</span><span class="btn-text">Copy</span>';
    copyBtn.onclick = () => this.copyCodeToClipboard(code);

    actions.appendChild(createBtn);
    actions.appendChild(copyBtn);

    header.appendChild(fileInfo);
    header.appendChild(actions);

    // Code content
    const content = document.createElement('div');
    content.className = 'file-creation-content';

    const textarea = document.createElement('textarea');
    textarea.className = 'file-code-textarea';
    textarea.value = code;
    textarea.readOnly = true;
    textarea.rows = Math.min(Math.max(code.split('\n').length + 1, 5), 30);

    content.appendChild(textarea);
    container.appendChild(header);
    container.appendChild(content);

    return container;
  }

  private async createFile(filePath: string, content: string, container: HTMLElement): Promise<void> {
    try {
      const result = await (window as any).electronAPI.createFileWithContent({
        path: filePath,
        content: content,
        createDirectories: true
      });
      
      if (result.success) {
        const status = container.querySelector('.file-creation-status') as HTMLElement;
        const createBtn = container.querySelector('.create-btn') as HTMLButtonElement;
        
        if (status) {
          status.textContent = 'CREATED';
          status.className = 'file-creation-status created';
        }
        
        if (createBtn) {
          createBtn.innerHTML = '<span class="btn-icon">✅</span><span class="btn-text">Created</span>';
          createBtn.disabled = true;
        }
      }
    } catch (error) {
      console.error('Failed to create file:', error);
    }
  }

  private getFileIcon(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const iconMap: { [key: string]: string } = {
      'js': '🟨', 'ts': '🔷', 'jsx': '⚛️', 'tsx': '⚛️',
      'py': '🐍', 'html': '🌐', 'css': '🎨', 'scss': '🎨',
      'json': '📋', 'md': '📝', 'yml': '⚙️', 'yaml': '⚙️'
    };
    return iconMap[ext] || '📄';
  }

  private createInteractiveCodeBlock(code: string, language: string): HTMLElement {
    const codeBlock = document.createElement('div');
    codeBlock.className = 'code-block';
    
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
    
    actions.appendChild(copyBtn);
    header.appendChild(langSpan);
    header.appendChild(actions);
    
    // Content
    const content = document.createElement('div');
    content.className = 'code-content';
    
    const textarea = document.createElement('textarea');
    textarea.className = 'code-textarea';
    textarea.value = code;
    textarea.readOnly = false;
    textarea.spellcheck = false;
    
    // Auto-size
    const lines = code.split('\n').length;
    textarea.rows = Math.min(Math.max(lines + 1, 5), 30);
    
    content.appendChild(textarea);
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
    processed = processed.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    
    // Bullet points
    processed = processed.replace(/^[-•]\s+(.*$)/gim, '• $1');
    
    // Convert newlines to proper line breaks
    processed = processed.replace(/\n/g, '<br>');
    
    return processed;
  }

  private processSimpleText(content: string): string {
    return content.replace(/\n/g, '<br>');
  }

  private async copyCodeToClipboard(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      // Could add success feedback here
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  // Chunked processing UI
  showChunkedProgress(currentChunk: number, totalChunks: number): void {
    this.chunkedState.isChunked = true;
    this.chunkedState.currentChunk = currentChunk;
    this.chunkedState.totalChunks = totalChunks;

    if (!this.chunkedState.progressElement) {
      this.createChunkedProgressElement();
    }

    this.updateChunkedProgress();
  }

  private createChunkedProgressElement(): void {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const progressDiv = document.createElement('div');
    progressDiv.className = 'chunked-progress-container';
    
    progressDiv.innerHTML = `
      <div class="chunked-progress">
        <div class="chunked-progress-icon">🔄</div>
        <div class="chunked-progress-text">
          <span class="chunked-progress-title">Processing complex response...</span>
          <span class="chunked-progress-status">Chunk <span class="current-chunk">1</span> of <span class="total-chunks">1</span></span>
        </div>
        <div class="chunked-progress-bar">
          <div class="chunked-progress-fill"></div>
        </div>
      </div>
    `;

    container.appendChild(progressDiv);
    this.chunkedState.progressElement = progressDiv;

    // Animate in
    requestAnimationFrame(() => {
      progressDiv.style.opacity = '1';
      progressDiv.style.transform = 'translateY(0)';
    });
  }

  private updateChunkedProgress(): void {
    if (!this.chunkedState.progressElement) return;

    const currentSpan = this.chunkedState.progressElement.querySelector('.current-chunk') as HTMLElement;
    const totalSpan = this.chunkedState.progressElement.querySelector('.total-chunks') as HTMLElement;
    const progressFill = this.chunkedState.progressElement.querySelector('.chunked-progress-fill') as HTMLElement;

    if (currentSpan) currentSpan.textContent = this.chunkedState.currentChunk.toString();
    if (totalSpan) totalSpan.textContent = this.chunkedState.totalChunks.toString();
    
    if (progressFill) {
      const percent = (this.chunkedState.currentChunk / this.chunkedState.totalChunks) * 100;
      progressFill.style.width = `${percent}%`;
    }
  }

  hideChunkedProgress(): void {
    if (this.chunkedState.progressElement) {
      this.chunkedState.progressElement.style.opacity = '0';
      this.chunkedState.progressElement.style.transform = 'translateY(-10px)';
      
      setTimeout(() => {
        this.chunkedState.progressElement?.remove();
        this.chunkedState.progressElement = undefined;
      }, 300);
    }

    this.chunkedState = {
      isChunked: false,
      currentChunk: 0,
      totalChunks: 0
    };
  }
}
