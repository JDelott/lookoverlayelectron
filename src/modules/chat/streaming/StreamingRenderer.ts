import { ChatMessage, StreamingState } from '../core/ChatTypes.js';
import { ChatStateManager } from '../core/ChatStateManager.js';
import { ScrollManager } from '../utils/ScrollManager.js';

export class StreamingRenderer {
  private stateManager: ChatStateManager;
  private scrollManager: ScrollManager;

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
          const codeBlock = this.createCodeBlock(code, language);
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
    codeElement.textContent = code;
    
    pre.appendChild(codeElement);
    content.appendChild(pre);
    
    codeBlock.appendChild(header);
    codeBlock.appendChild(content);
    
    return codeBlock;
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
}
