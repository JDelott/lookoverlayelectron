import { ChatMessage, AttachedFile } from '../core/ChatTypes.js';
import { DOMHelpers } from '../utils/DOMHelpers.js';
import { FileCreationRenderer, FileCreationInfo } from './FileCreationRenderer.js';

export class MessageRenderer {
  private fileCreationRenderer: FileCreationRenderer;

  constructor() {
    this.fileCreationRenderer = new FileCreationRenderer();
  }

  renderMessages(messages: ChatMessage[]): void {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    // Find existing messages that should be preserved
    const existingPreserved = container.querySelectorAll('[data-preserve-structure="true"]');
    const preservedMap = new Map<string, HTMLElement>();
    
    existingPreserved.forEach(element => {
      const messageId = element.getAttribute('data-message-id');
      if (messageId) {
        preservedMap.set(messageId, element as HTMLElement);
      }
    });

    container.innerHTML = '';

    messages.forEach(message => {
      // Check if this message should preserve its structure
      const preserved = preservedMap.get(message.id);
      if (preserved) {
        // Re-append the preserved element instead of recreating
        container.appendChild(preserved);
      } else {
        const messageElement = this.createMessageElement(message);
        messageElement.setAttribute('data-message-id', message.id);
        container.appendChild(messageElement);
      }
    });
  }

  private createMessageElement(message: ChatMessage): HTMLElement {
    // Detect file creations first
    const fileCreations = this.fileCreationRenderer.detectFileCreations(message.content);
    const hasFileCreations = fileCreations.length > 0;
    const hasCodeBlocks = /```[\s\S]*?```/.test(message.content);
    const isCodeHeavy = DOMHelpers.detectCodeContent(message.content);
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;
    
    if (hasCodeBlocks) messageDiv.classList.add('has-code');
    if (isCodeHeavy && message.role === 'user') messageDiv.classList.add('code-heavy');
    if (hasFileCreations) messageDiv.classList.add('has-file-creations');

    if (hasFileCreations || hasCodeBlocks) {
      this.createComplexMessage(messageDiv, message, fileCreations);
    } else {
      this.createSimpleMessage(messageDiv, message, isCodeHeavy);
    }
    
    return messageDiv;
  }

  private createComplexMessage(messageDiv: HTMLElement, message: ChatMessage, fileCreations: FileCreationInfo[]): void {
    const mainDiv = document.createElement('div');
    mainDiv.className = 'message-main';
    
    // Avatar and content
    const avatar = this.createAvatar(message.role);
    const contentDiv = this.createMessageContent(message);
    
    mainDiv.appendChild(avatar);
    mainDiv.appendChild(contentDiv);
    messageDiv.appendChild(mainDiv);
    
    // Process content with file creations and code blocks
    if (fileCreations.length > 0) {
      const processedContent = this.processContentWithFileCreations(message.content, fileCreations);
      messageDiv.appendChild(processedContent);
    } else {
      const processedContent = this.processMarkdownWithCodeBlocks(message.content);
      messageDiv.appendChild(processedContent);
    }
  }

  private processContentWithFileCreations(content: string, fileCreations: FileCreationInfo[]): DocumentFragment {
    const fragment = document.createDocumentFragment();
    
    // Process content and replace file creation patterns
    let processedContent = this.fileCreationRenderer.processContentWithFileCreations(content);
    
    // Split by file creation placeholders and regular content
    const parts = processedContent.split(/(<div class="file-creation-placeholder" data-file-index="\d+"><\/div>)/);
    
    parts.forEach(part => {
      if (part.includes('file-creation-placeholder')) {
        // Extract file index from placeholder
        const match = part.match(/data-file-index="(\d+)"/);
        if (match) {
          const index = parseInt(match[1]);
          const file = fileCreations[index];
          if (file) {
            const fileContainer = this.fileCreationRenderer.createFileContainers([file])[0];
            fragment.appendChild(fileContainer);
          }
        }
      } else if (part.trim()) {
        // Process remaining content (may still have code blocks)
        const remainingFragment = this.processMarkdownWithCodeBlocks(part);
        fragment.appendChild(remainingFragment);
      }
    });
    
    return fragment;
  }

  private createSimpleMessage(messageDiv: HTMLElement, message: ChatMessage, isCodeHeavy: boolean): void {
    const avatar = this.createAvatar(message.role);
    const contentDiv = this.createMessageContent(message);
    
    // Message text
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    
    if (isCodeHeavy && message.role === 'user') {
      textDiv.textContent = message.content;
    } else {
      textDiv.innerHTML = this.processSimpleMarkdown(message.content);
    }
    
    contentDiv.appendChild(textDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
  }

  private createAvatar(role: string): HTMLElement {
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = role === 'user' ? 
      '<div class="avatar-icon user">👤</div>' : 
      '<div class="avatar-icon assistant">🤖</div>';
    return avatar;
  }

  private createMessageContent(message: ChatMessage): HTMLElement {
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
    
    return contentDiv;
  }

  private processMarkdownWithCodeBlocks(content: string): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    parts.forEach(part => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.split('\n');
        const firstLine = lines[0].replace('```', '');
        const language = firstLine.trim() || 'text';
        const code = lines.slice(1, -1).join('\n');
        
        const codeBlock = this.createInteractiveCodeBlock(code, language);
        fragment.appendChild(codeBlock);
      } else if (part.trim()) {
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerHTML = this.processSimpleMarkdown(part);
        fragment.appendChild(textDiv);
      }
    });
    
    return fragment;
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
    insertBtn.onclick = () => this.insertCode(code);
    
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

  private processSimpleMarkdown(content: string): string {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/^• (.*$)/gim, '• $1')
      .replace(/\n/g, '<br>');
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
      console.error('Failed to copy:', error);
      DOMHelpers.showNotification('❌ Failed to copy code', 'error');
    }
  }

  private insertCode(code: string): void {
    const event = new CustomEvent('insertCode', { detail: { code } });
    document.dispatchEvent(event);
  }

  addWelcomeMessage(): ChatMessage {
    return {
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
  }
}
