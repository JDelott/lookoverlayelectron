import { ChatMessage, StreamingState } from '../core/ChatTypes.js';
import { ChatStateManager } from '../core/ChatStateManager.js';
import { ScrollManager } from '../utils/ScrollManager.js';

// Enhanced streaming with progressive container building
interface StreamingBuffer {
  tokens: string[];
  lastUpdate: number;
  updateScheduled: boolean;
}

interface ProgressiveContainer {
  type: 'file-creation' | 'code-block';
  startPattern: string;
  element: HTMLElement;
  content: string;
  language: string;
  filePath?: string;
  isComplete: boolean;
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

  // Progressive container tracking
  private currentContainer: ProgressiveContainer | null = null;
  private pendingText: string = '';
  private fullStreamedContent: string = '';

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
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = 'message assistant streaming';
    messageElement.setAttribute('data-message-id', message.id);
    
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

    // Create the streaming content area (this will hold both text and containers)
    const streamingArea = document.createElement('div');
    streamingArea.className = 'streaming-area';

    contentDiv.appendChild(header);
    contentDiv.appendChild(streamingArea);

    messageElement.appendChild(avatar);
    messageElement.appendChild(contentDiv);

    // Add to container with smooth animation
    messageElement.style.opacity = '0';
    messageElement.style.transform = 'translateY(10px)';
    messagesContainer.appendChild(messageElement);

    // Animate in
    requestAnimationFrame(() => {
      messageElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      messageElement.style.opacity = '1';
      messageElement.style.transform = 'translateY(0)';
    });

    // Update state with references
    this.stateManager.setStreamingState({
      streamingMessageElement: messageElement,
      streamingContentContainer: streamingArea,
      streamingIndicator: indicator
    });

    // Reset progressive state
    this.currentContainer = null;
    this.pendingText = '';
    this.fullStreamedContent = '';

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
    
    // Add to full content and pending text
    this.fullStreamedContent += newText;
    this.pendingText += newText;

    // Process the text progressively
    this.processProgressiveContent(streamingState.streamingContentContainer);
    
    // Schedule smooth scroll update
    this.scrollManager.scheduleScrollUpdate();
  }

  private processProgressiveContent(container: HTMLElement): void {
    // Check if we're currently building a container
    if (this.currentContainer) {
      this.updateCurrentContainer();
      return;
    }

    // Look for container start patterns in pending text
    const codeBlockMatch = this.pendingText.match(/(```(\w*):([^\n]+)|```(\w*))\n/);
    
    if (codeBlockMatch) {
      // We found a potential file creation or code block
      const beforePattern = this.pendingText.substring(0, codeBlockMatch.index!);
      
      // Render any text before the pattern
      if (beforePattern.trim()) {
        this.renderTextContent(beforePattern, container);
      }

      // Start building the container
      this.startProgressiveContainer(codeBlockMatch, container);
      
      // Remove processed text from pending
      this.pendingText = this.pendingText.substring(codeBlockMatch.index! + codeBlockMatch[0].length);
    } else {
      // No pattern found, check if we should render current text
      const lines = this.pendingText.split('\n');
      if (lines.length > 1) {
        // Render complete lines, keep the last incomplete line
        const completeLines = lines.slice(0, -1).join('\n') + '\n';
        this.renderTextContent(completeLines, container);
        this.pendingText = lines[lines.length - 1];
      }
    }
  }

  private renderTextContent(text: string, container: HTMLElement): void {
    if (!text.trim()) return;

    // Create or get the current text element
    let textElement = container.querySelector('.streaming-text') as HTMLElement;
    if (!textElement) {
      textElement = document.createElement('div');
      textElement.className = 'streaming-text';
      container.appendChild(textElement);
    }

    // Process simple markdown in the text
    const processedText = this.processSimpleMarkdown(text);
    textElement.innerHTML += processedText;
  }

  private startProgressiveContainer(match: RegExpMatchArray, container: HTMLElement): void {
    const isFileCreation = match[3] !== undefined; // Has file path
    const language = isFileCreation ? match[2] : match[4] || 'text';
    const filePath = match[3] || '';

    // Create the container element
    const containerElement = document.createElement('div');
    containerElement.className = isFileCreation ? 'file-creation-container streaming' : 'code-block streaming';

    if (isFileCreation) {
      this.createFileCreationStructure(containerElement, language, filePath);
    } else {
      this.createCodeBlockStructure(containerElement, language);
    }

    // Add to DOM
    container.appendChild(containerElement);

    // Track the progressive container
    this.currentContainer = {
      type: isFileCreation ? 'file-creation' : 'code-block',
      startPattern: match[0],
      element: containerElement,
      content: '',
      language,
      filePath,
      isComplete: false
    };
  }

  private updateCurrentContainer(): void {
    if (!this.currentContainer) return;

    // Look for the end pattern
    const endPattern = '\n```';
    const endIndex = this.pendingText.indexOf(endPattern);

    if (endIndex !== -1) {
      // Container is complete
      const containerContent = this.pendingText.substring(0, endIndex);
      this.currentContainer.content += containerContent;
      
      // Finalize the container
      this.finalizeContainer();
      
      // Remove processed content from pending
      this.pendingText = this.pendingText.substring(endIndex + endPattern.length);
      this.currentContainer = null;
    } else {
      // Still building, add all pending text to container
      this.currentContainer.content += this.pendingText;
      this.updateContainerContent();
      this.pendingText = '';
    }
  }

  private createFileCreationStructure(container: HTMLElement, language: string, filePath: string): void {
    container.innerHTML = `
      <div class="file-creation-header">
        <div class="file-creation-info">
          <span class="file-creation-icon">${this.getFileIcon(filePath)}</span>
          <span class="file-creation-path">${filePath}</span>
          <span class="file-creation-status new">NEW</span>
        </div>
        <div class="file-creation-actions">
          <button class="file-action-btn create-btn">
            <span class="btn-icon">📁</span><span class="btn-text">Create File</span>
          </button>
          <button class="file-action-btn copy-btn">
            <span class="btn-icon">📋</span><span class="btn-text">Copy</span>
          </button>
        </div>
      </div>
      <div class="file-creation-content">
        <textarea class="file-code-textarea streaming" readonly></textarea>
        <div class="streaming-cursor">▊</div>
      </div>
    `;
  }

  private createCodeBlockStructure(container: HTMLElement, language: string): void {
    container.innerHTML = `
      <div class="code-header">
        <span class="code-language">${language}</span>
        <div class="code-actions">
          <button class="code-action">📋 Copy</button>
        </div>
      </div>
      <div class="code-content">
        <textarea class="code-textarea streaming" readonly></textarea>
        <div class="streaming-cursor">▊</div>
      </div>
    `;
  }

  private updateContainerContent(): void {
    if (!this.currentContainer) return;

    const textarea = this.currentContainer.element.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = this.currentContainer.content;
      // Auto-resize
      const lines = this.currentContainer.content.split('\n').length;
      textarea.rows = Math.max(Math.min(lines + 2, 30), 5);
    }
  }

  private finalizeContainer(): void {
    if (!this.currentContainer) return;

    // Update final content
    this.updateContainerContent();

    // Remove streaming classes and cursor
    this.currentContainer.element.classList.remove('streaming');
    const cursor = this.currentContainer.element.querySelector('.streaming-cursor');
    if (cursor) {
      cursor.remove();
    }

    // Set up button handlers for file creation
    if (this.currentContainer.type === 'file-creation') {
      this.setupFileCreationButtons();
    } else {
      this.setupCodeBlockButtons();
    }

    // Make textarea editable
    const textarea = this.currentContainer.element.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.readOnly = false;
      textarea.classList.remove('streaming');
    }
  }

  private setupFileCreationButtons(): void {
    if (!this.currentContainer) return;

    const createBtn = this.currentContainer.element.querySelector('.create-btn') as HTMLButtonElement;
    const copyBtn = this.currentContainer.element.querySelector('.copy-btn') as HTMLButtonElement;

    if (createBtn) {
      createBtn.onclick = () => this.createFile(
        this.currentContainer!.filePath!,
        this.currentContainer!.content,
        this.currentContainer!.element
      );
    }

    if (copyBtn) {
      copyBtn.onclick = () => this.copyCodeToClipboard(this.currentContainer!.content);
    }
  }

  private setupCodeBlockButtons(): void {
    if (!this.currentContainer) return;

    const copyBtn = this.currentContainer.element.querySelector('.code-action') as HTMLButtonElement;
    if (copyBtn) {
      copyBtn.onclick = () => this.copyCodeToClipboard(this.currentContainer!.content);
    }
  }

  finalizeStreamingMessage(): void {
    const streamingState = this.stateManager.getStreamingState();
    
    // Finalize any pending container
    if (this.currentContainer) {
      this.finalizeContainer();
      this.currentContainer = null;
    }

    // Render any remaining pending text
    if (this.pendingText.trim() && streamingState.streamingContentContainer) {
      this.renderTextContent(this.pendingText, streamingState.streamingContentContainer);
    }

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

      // CRITICAL FIX: Mark the message as preserving its current DOM structure
      // This prevents MessageRenderer from re-processing the content
      streamingState.streamingMessageElement.setAttribute('data-preserve-structure', 'true');
      streamingState.streamingMessageElement.classList.add('streaming-complete');
    }

    // Clear streaming state
    this.streamingBuffer.tokens = [];
    this.streamingBuffer.updateScheduled = false;
    this.pendingText = '';
    this.fullStreamedContent = '';
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
