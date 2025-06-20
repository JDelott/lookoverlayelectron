import { ChatMessage, AttachedFile } from '../core/ChatTypes.js';
import { DOMHelpers } from '../utils/DOMHelpers.js';

export class MessageRenderer {
  renderMessages(messages: ChatMessage[]): void {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    container.innerHTML = '';

    messages.forEach(message => {
      const messageElement = this.createMessageElement(message);
      container.appendChild(messageElement);
    });
  }

  private createMessageElement(message: ChatMessage): HTMLElement {
    const hasCodeBlocks = /```[\s\S]*?```/.test(message.content);
    const isCodeHeavy = DOMHelpers.detectCodeContent(message.content);
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;
    
    if (hasCodeBlocks) messageDiv.classList.add('has-code');
    if (isCodeHeavy && message.role === 'user') messageDiv.classList.add('code-heavy');

    if (hasCodeBlocks) {
      this.createComplexMessage(messageDiv, message);
    } else {
      this.createSimpleMessage(messageDiv, message, isCodeHeavy);
    }
    
    return messageDiv;
  }

  private createComplexMessage(messageDiv: HTMLElement, message: ChatMessage): void {
    const mainDiv = document.createElement('div');
    mainDiv.className = 'message-main';
    
    // Avatar and content
    const avatar = this.createAvatar(message.role);
    const contentDiv = this.createMessageContent(message);
    
    mainDiv.appendChild(avatar);
    mainDiv.appendChild(contentDiv);
    messageDiv.appendChild(mainDiv);
    
    // Process content with code blocks
    const processedContent = this.processMarkdownWithCodeBlocks(message.content);
    messageDiv.appendChild(processedContent);
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
    avatar.textContent = role === 'user' ? '👤' : '🤖';
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
        
        const codeBlock = this.createCodeBlock(code, language);
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

  private createCodeBlock(code: string, language: string): HTMLElement {
    const codeBlock = document.createElement('div');
    codeBlock.className = 'code-block';
    
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
    copyBtn.onclick = () => this.copyToClipboard(code);
    
    const insertBtn = document.createElement('button');
    insertBtn.className = 'code-action';
    insertBtn.innerHTML = '📥 Insert';
    insertBtn.onclick = () => this.insertCode(code);
    
    actions.appendChild(copyBtn);
    actions.appendChild(insertBtn);
    header.appendChild(langSpan);
    header.appendChild(actions);
    
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

  private processSimpleMarkdown(content: string): string {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/^• (.*$)/gim, '• $1')
      .replace(/\n/g, '<br>');
  }

  private async copyToClipboard(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      DOMHelpers.showNotification('✅ Copied to clipboard', 'success');
    } catch (error) {
      console.error('Failed to copy:', error);
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
