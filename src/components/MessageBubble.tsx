import React, { useState } from 'react';
import { ChatMessage } from '../api/ai/anthropic';

interface MessageBubbleProps {
  message: ChatMessage;
  onInsertCode?: (code: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onInsertCode
}) => {
  const [showMetadata, setShowMetadata] = useState(false);

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const extractCodeBlocks = (content: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks: { language: string; code: string; fullMatch: string }[] = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
        fullMatch: match[0]
      });
    }

    return blocks;
  };

  const renderContent = () => {
    const codeBlocks = extractCodeBlocks(message.content);
    
    if (codeBlocks.length === 0) {
      // No code blocks, render as plain text with basic markdown
      return (
        <div 
          className="message-content"
          dangerouslySetInnerHTML={{
            __html: message.content
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.*?)\*/g, '<em>$1</em>')
              .replace(/`(.*?)`/g, '<code>$1</code>')
              .replace(/\n/g, '<br>')
          }}
        />
      );
    }

    // Render content with code blocks
    let contentWithCodeBlocks = message.content;
    codeBlocks.forEach((block, index) => {
      const codeBlockElement = `
        <div class="code-block-container">
          <div class="code-block-header">
            <span class="code-language">${block.language}</span>
            <button class="insert-code-btn" data-code-index="${index}">Insert Code</button>
            <button class="copy-code-btn" data-code="${encodeURIComponent(block.code)}">Copy</button>
          </div>
          <pre><code class="language-${block.language}">${escapeHtml(block.code)}</code></pre>
        </div>
      `;
      contentWithCodeBlocks = contentWithCodeBlocks.replace(block.fullMatch, codeBlockElement);
    });

    return (
      <div 
        className="message-content"
        dangerouslySetInnerHTML={{ __html: contentWithCodeBlocks }}
        onClick={(e) => handleContentClick(e, codeBlocks)}
      />
    );
  };

  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const handleContentClick = (e: React.MouseEvent, codeBlocks: any[]) => {
    const target = e.target as HTMLElement;
    
    if (target.classList.contains('insert-code-btn')) {
      const codeIndex = parseInt(target.getAttribute('data-code-index') || '0');
      const codeBlock = codeBlocks[codeIndex];
      if (codeBlock && onInsertCode) {
        onInsertCode(codeBlock.code);
      }
    }
    
    if (target.classList.contains('copy-code-btn')) {
      const encodedCode = target.getAttribute('data-code');
      if (encodedCode) {
        const code = decodeURIComponent(encodedCode);
        navigator.clipboard.writeText(code);
        
        // Visual feedback
        const originalText = target.textContent;
        target.textContent = 'Copied!';
        setTimeout(() => {
          target.textContent = originalText;
        }, 1000);
      }
    }
  };

  return (
    <div className={`message-bubble ${message.role}`}>
      <div className="message-header">
        <span className="message-role">
          {message.role === 'user' ? '👤' : '🤖'} {message.role}
        </span>
        <span className="message-time">{formatTime(message.timestamp)}</span>
        {message.metadata && (
          <button 
            className="metadata-toggle"
            onClick={() => setShowMetadata(!showMetadata)}
            title="Show context"
          >
            📎
          </button>
        )}
      </div>
      
      {renderContent()}
      
      {showMetadata && message.metadata && (
        <div className="message-metadata">
          {message.metadata.filePath && (
            <div className="metadata-item">
              <strong>File:</strong> {message.metadata.filePath}
            </div>
          )}
          {message.metadata.selectedText && (
            <div className="metadata-item">
              <strong>Selected:</strong>
              <pre>{message.metadata.selectedText}</pre>
            </div>
          )}
          {message.metadata.codeContext && (
            <div className="metadata-item">
              <strong>Context:</strong>
              <pre>{message.metadata.codeContext.substring(0, 200)}...</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
