import React, { useState, useRef } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string, includeContext?: boolean) => void;
  onGenerateCode: (prompt: string) => void;
  isLoading: boolean;
  hasContext: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onGenerateCode,
  isLoading,
  hasContext
}) => {
  const [message, setMessage] = useState('');
  const [includeContext, setIncludeContext] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Character limit for messages (Claude has token limits)
  const MAX_MESSAGE_LENGTH = 50000; // Roughly 12-15k tokens

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      // Check message length
      if (message.length > MAX_MESSAGE_LENGTH) {
        alert(`Message too long! Please keep messages under ${MAX_MESSAGE_LENGTH} characters. Current length: ${message.length}`);
        return;
      }

      try {
        onSendMessage(message.trim(), includeContext);
        setMessage('');
        setIncludeContext(false);
      } catch (error) {
        console.error('Error sending message:', error);
        alert('Error sending message. Please try again or use a shorter message.');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    const currentText = message;
    const newLength = currentText.length + pastedText.length;
    
    if (newLength > MAX_MESSAGE_LENGTH) {
      e.preventDefault();
      alert(`Pasted content would make message too long! Maximum length is ${MAX_MESSAGE_LENGTH} characters. Current: ${currentText.length}, Pasting: ${pastedText.length}`);
      return;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    
    // Prevent setting values that are too long
    if (newValue.length <= MAX_MESSAGE_LENGTH) {
      setMessage(newValue);
    }
  };

  const quickActions = [
    {
      label: 'Explain this code',
      action: () => onSendMessage('Please explain the current code and what it does.', true)
    },
    {
      label: 'Find bugs',
      action: () => onSendMessage('Please review this code for potential bugs or issues.', true)
    },
    {
      label: 'Optimize code',
      action: () => onSendMessage('Please suggest optimizations for this code.', true)
    },
    {
      label: 'Add comments',
      action: () => onSendMessage('Please add appropriate comments to this code.', true)
    },
    {
      label: 'Write tests',
      action: () => onSendMessage('Please create unit tests for this code.', true)
    },
    {
      label: 'Refactor code',
      action: () => onSendMessage('Please refactor this code to improve readability and maintainability.', true)
    },
    {
      label: 'Generate component',
      action: () => {
        const componentName = prompt('What component would you like to create?');
        if (componentName) {
          onGenerateCode(`Create a React component called ${componentName}`);
        }
      }
    },
    {
      label: 'Format as snippet',
      action: () => {
        if (message.trim()) {
          const formattedMessage = `Please help me with this code:\n\n\`\`\`\n${message.trim()}\n\`\`\`\n\nWhat would you like me to help you with regarding this code?`;
          setMessage(formattedMessage);
        }
      }
    }
  ];

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'; // Increased max height
    }
  };

  React.useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const characterCount = message.length;
  const isNearLimit = characterCount > MAX_MESSAGE_LENGTH * 0.8;
  const isOverLimit = characterCount > MAX_MESSAGE_LENGTH;

  return (
    <div className="chat-input-container">
      {showQuickActions && (
        <div className="quick-actions">
          <div className="quick-actions-header">
            <span>Quick Actions</span>
            <button onClick={() => setShowQuickActions(false)}>✕</button>
          </div>
          <div className="quick-actions-grid">
            {quickActions.map((action, index) => (
              <button
                key={index}
                className="quick-action-btn"
                onClick={() => {
                  action.action();
                  setShowQuickActions(false);
                }}
                disabled={isLoading}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="chat-input-form">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Ask about your code, paste code snippets, or request new functionality..."
            className={`chat-textarea ${isOverLimit ? 'over-limit' : isNearLimit ? 'near-limit' : ''}`}
            disabled={isLoading}
            rows={1}
          />
          
          {/* Character count indicator */}
          <div className="character-count">
            <span className={isOverLimit ? 'over-limit' : isNearLimit ? 'near-limit' : ''}>
              {characterCount.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()}
            </span>
          </div>
          
          <div className="input-controls">
            <button
              type="button"
              className="quick-actions-toggle"
              onClick={() => setShowQuickActions(!showQuickActions)}
              title="Quick Actions"
            >
              ⚡
            </button>
            
            {hasContext && (
              <label className="context-toggle">
                <input
                  type="checkbox"
                  checked={includeContext}
                  onChange={(e) => setIncludeContext(e.target.checked)}
                />
                <span className="context-label">Include Context</span>
              </label>
            )}
            
            <button
              type="submit"
              className="send-button"
              disabled={!message.trim() || isLoading || isOverLimit}
              title={isOverLimit ? 'Message too long' : 'Send message'}
            >
              {isLoading ? '⏳' : '📤'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
