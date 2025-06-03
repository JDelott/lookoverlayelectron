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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim(), includeContext);
      setMessage('');
      setIncludeContext(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
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
      label: 'Generate component',
      action: () => {
        const componentName = prompt('What component would you like to create?');
        if (componentName) {
          onGenerateCode(`Create a React component called ${componentName}`);
        }
      }
    }
  ];

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  React.useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

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
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your code or request new functionality..."
            className="chat-textarea"
            disabled={isLoading}
            rows={1}
          />
          
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
              disabled={!message.trim() || isLoading}
            >
              {isLoading ? '⏳' : '📤'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
