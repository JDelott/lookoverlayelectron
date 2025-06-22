export class ChatStyles {
  private styleId = 'chat-styles';

  inject(): void {
    if (document.getElementById(this.styleId)) return;

    const style = document.createElement('style');
    style.id = this.styleId;
    style.textContent = this.getStyles();
    document.head.appendChild(style);
  }

  remove(): void {
    const existingStyle = document.getElementById(this.styleId);
    if (existingStyle) {
      existingStyle.remove();
    }
  }

  private getStyles(): string {
    return `
      ${this.getExistingStyles()}
      
      /* CRITICAL: Interactive textarea code blocks */
      .code-textarea {
        width: 100%;
        background: transparent !important;
        border: none !important;
        outline: none !important;
        resize: vertical;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace !important;
        font-size: 0.8125rem !important;
        line-height: 1.6 !important;
        color: #e6edf3 !important;
        white-space: pre !important;
        overflow-wrap: normal !important;
        overflow-x: auto;
        tab-size: 2;
        user-select: text !important;
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        cursor: text !important;
        padding: 1.25rem !important;
      }
      
      .code-textarea:focus {
        outline: none !important;
      }
      
      /* Enhanced code block focus state */
      .code-block.focused {
        border-color: #60a5fa !important;
        box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2) !important;
      }
      
      /* Better selection highlighting in code blocks */
      .code-textarea::selection {
        background: rgba(96, 165, 250, 0.3) !important;
        color: inherit !important;
      }
      
      .code-textarea::-moz-selection {
        background: rgba(96, 165, 250, 0.3) !important;
        color: inherit !important;
      }

      .chunked-progress-content {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem;
        background: rgba(124, 58, 237, 0.05);
        border: 1px solid rgba(124, 58, 237, 0.2);
        border-radius: 0.5rem;
      }

      .progress-text {
        font-size: 0.875rem;
        color: #a855f7;
        font-weight: 500;
      }

      .progress-bar {
        width: 100%;
        height: 4px;
        background: rgba(124, 58, 237, 0.2);
        border-radius: 2px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: #a855f7;
        transition: width 0.3s ease;
        border-radius: 2px;
      }

      .chunked-completion {
        text-align: center;
        padding: 0.5rem;
        opacity: 1;
        transition: opacity 0.3s ease;
      }

      .completion-text {
        font-size: 0.75rem;
        color: #10b981;
        font-weight: 500;
        background: rgba(16, 185, 129, 0.1);
        padding: 0.375rem 0.75rem;
        border-radius: 0.375rem;
        display: inline-block;
      }

      .message.chunked-complete .message-text::after {
        content: '✓ Complete Response';
        display: block;
        font-size: 0.75rem;
        color: #10b981;
        margin-top: 0.5rem;
        font-weight: 500;
      }

      .message.streaming .message-text {
        font-size: 0.875rem;
        line-height: 1.6;
        color: #d4d4d8;
        word-wrap: break-word;
        white-space: pre-wrap;
        background: rgba(124, 58, 237, 0.05);
        border-radius: 8px;
        padding: 0.75rem;
        border: 1px solid rgba(124, 58, 237, 0.1);
        min-height: 1.2em;
        position: relative;
        overflow-wrap: break-word;
        word-break: break-word;
        max-width: 100%;
        box-sizing: border-box;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      @media (max-width: 400px) {
        .quick-actions-grid {
          grid-template-columns: 1fr;
        }
        
        .input-container {
          padding: 0.75rem;
        }
        
        .api-key-setup {
          padding: 1rem;
        }
        
        .api-key-content h3 {
          font-size: 1.1rem;
        }
        
        .api-key-content p {
          font-size: 0.75rem;
        }
      }

      /* Code Apply Styles */
      .code-actions {
        display: flex;
        gap: 0.5rem;
      }
      
      .apply-btn {
        background: #3b82f6 !important;
        color: white !important;
        border: none;
        padding: 0.25rem 0.75rem;
        border-radius: 4px;
        font-size: 0.75rem;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .apply-btn:hover {
        background: #2563eb !important;
      }
      
      .apply-btn:disabled {
        background: #6b7280 !important;
        cursor: not-allowed;
      }
      
      .copy-btn {
        background: #374151 !important;
        color: #d4d4d8 !important;
      }
      
      .copy-btn:hover {
        background: #4b5563 !important;
      }
    `;
  }

  private getExistingStyles(): string {
    return `
      /* REFACTORED: Clean container hierarchy with stable layout */
      .chat-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #1a1a1a;
        color: #e4e4e7;
        position: relative;
        overflow: hidden;
      }

      .chat-main {
        height: 100%;
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
      }

      /* CRITICAL: Stable scrollable container with no layout shifts */
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 1rem;
        display: block;
        contain: layout style;
      }

      /* Individual messages with stable layout */
      .message {
        display: flex;
        gap: 0.75rem;
        max-width: 100%;
        margin-bottom: 1.5rem;
        contain: layout;
        animation: slideIn 0.3s ease-out;
      }

      .message.streaming {
        animation: none;
        contain: layout style;
      }

      .streaming-content {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        contain: layout;
      }

      .message-text.typing-cursor {
        position: relative;
        min-height: 1.2em;
      }

      .typing-cursor::after {
        content: '▊';
        color: #60a5fa;
        animation: blink 1s infinite;
        margin-left: 2px;
        font-weight: normal;
        position: absolute;
        width: 0;
        overflow: visible;
      }

      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }

      .message.has-code {
        flex-direction: column;
        gap: 0.5rem;
      }

      .message.has-code .message-main {
        display: flex;
        gap: 0.75rem;
        align-items: flex-start;
      }

      /* Attached files header */
      .attached-files-header {
        background: #171717;
        border-bottom: 1px solid #2a2a2a;
        padding: 0.75rem 1rem;
        flex-shrink: 0;
      }

      .attached-files-content {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .attached-files-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #60a5fa;
        font-size: 0.875rem;
        font-weight: 500;
      }

      .attached-files-list {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        flex: 1;
      }

      .attached-file-tag {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        background: #262626;
        border: 1px solid #404040;
        border-radius: 0.375rem;
        padding: 0.375rem 0.5rem;
        font-size: 0.75rem;
        max-width: 200px;
      }

      .file-tag-icon {
        font-size: 0.875rem;
        flex-shrink: 0;
      }

      .file-tag-name {
        color: #d4d4d8;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        flex: 1;
        min-width: 0;
      }

      .remove-file-tag {
        background: none;
        border: none;
        color: #71717a;
        cursor: pointer;
        font-size: 0.875rem;
        padding: 0;
        margin-left: 0.25rem;
        line-height: 1;
        flex-shrink: 0;
      }

      .remove-file-tag:hover {
        color: #ef4444;
      }

      .clear-all-files-btn {
        background: transparent;
        border: 1px solid #404040;
        color: #71717a;
        padding: 0.375rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
        flex-shrink: 0;
      }

      .clear-all-files-btn:hover {
        border-color: #ef4444;
        color: #ef4444;
      }

      .input-action-btn.has-files {
        color: #10b981;
        border-color: #10b981;
        background: rgba(16, 185, 129, 0.1);
      }

      /* Input Area with stable layout */
      .chat-input-area {
        background: #1a1a1a;
        border-top: 1px solid #262626;
        flex-shrink: 0;
      }

      .input-container {
        padding: 1rem;
      }

      .input-wrapper {
        background: #262626;
        border: 1px solid #404040;
        border-radius: 0.75rem;
        transition: all 0.2s;
        overflow: hidden;
      }

      .input-wrapper:focus-within {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .textarea-container {
        position: relative;
      }

      .chat-input-area textarea {
        width: 100%;
        background: transparent;
        border: none;
        outline: none;
        resize: none;
        padding: 1rem;
        color: #e4e4e7;
        font-size: 0.875rem;
        line-height: 1.5;
        font-family: inherit;
        min-height: 2.5rem;
        max-height: 150px;
      }

      .chat-input-area textarea::placeholder {
        color: #71717a;
      }

      .input-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 1rem;
        background: #1f1f1f;
        border-top: 1px solid #404040;
      }

      .char-count {
        font-size: 0.75rem;
        color: #71717a;
      }

      .char-count.warning {
        color: #f59e0b;
      }

      .char-count.error {
        color: #ef4444;
      }

      .input-actions {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }

      .input-action-btn {
        background: transparent;
        border: 1px solid #404040;
        color: #71717a;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 0.375rem;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        font-size: 0.875rem;
      }

      .input-action-btn:hover {
        color: #60a5fa;
        border-color: #60a5fa;
        background: rgba(96, 165, 250, 0.1);
      }

      .send-btn {
        background: #3b82f6;
        border: none;
        border-radius: 0.375rem;
        width: 2rem;
        height: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        color: white;
      }

      .send-btn:hover:not(:disabled) {
        background: #2563eb;
        transform: scale(1.05);
      }

      .send-btn:disabled {
        background: #374151;
        cursor: not-allowed;
        transform: none;
      }

      /* Quick Actions Panel */
      .quick-actions {
        padding: 1rem;
        background: #171717;
        border-top: 1px solid #262626;
        border-bottom: 1px solid #262626;
        flex-shrink: 0;
      }

      .quick-actions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 0.5rem;
      }

      .quick-action {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.75rem 0.5rem;
        background: #262626;
        border: 1px solid #404040;
        border-radius: 0.5rem;
        color: #d4d4d8;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.8125rem;
        text-align: center;
        min-height: 44px;
      }

      .quick-action:hover {
        background: #404040;
        border-color: #60a5fa;
        transform: translateY(-1px);
      }

      .action-icon {
        font-size: 1rem;
        flex-shrink: 0;
      }

      .action-text {
        font-weight: 500;
        font-size: 0.75rem;
      }

      /* API Key Setup */
      .api-key-setup {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 1.5rem;
      }

      .api-key-content {
        text-align: center;
        max-width: 100%;
        width: 100%;
      }

      .api-key-icon {
        font-size: 2.5rem;
        margin-bottom: 1rem;
        opacity: 0.8;
      }

      .api-key-content h3 {
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0 0 0.5rem 0;
        color: #ffffff;
      }

      .api-key-content p {
        font-size: 0.8rem;
        color: #a1a1aa;
        margin: 0 0 1.5rem 0;
        line-height: 1.4;
      }

      .api-key-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .input-group {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .input-group input {
        width: 100%;
        background: #262626;
        border: 1px solid #404040;
        border-radius: 0.5rem;
        padding: 0.75rem;
        color: #e4e4e7;
        font-size: 0.8rem;
        outline: none;
        transition: all 0.2s;
        box-sizing: border-box;
      }

      .input-group input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
      }

      .primary-btn {
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 0.5rem;
        padding: 0.75rem 1rem;
        font-size: 0.8rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        width: 100%;
        box-sizing: border-box;
      }

      .primary-btn:hover:not(:disabled) {
        background: #2563eb;
        transform: translateY(-1px);
      }

      .primary-btn:disabled {
        background: #374151;
        cursor: not-allowed;
        transform: none;
      }

      .api-key-help {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
        font-size: 0.7rem;
        color: #71717a;
        flex-wrap: wrap;
      }

      .api-key-help a {
        color: #60a5fa;
        text-decoration: none;
      }

      .api-key-help a:hover {
        text-decoration: underline;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .message-avatar {
        width: 2rem;
        height: 2rem;
        border-radius: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.875rem;
        flex-shrink: 0;
        margin-top: 0.125rem;
      }

      .message.user .message-avatar {
        background: #3b82f6;
        color: white;
      }

      .message.assistant .message-avatar {
        background: #7c3aed;
        color: white;
      }

      .message-content {
        flex: 1;
        min-width: 0;
      }

      .message-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .message-role {
        font-size: 0.875rem;
        font-weight: 600;
        color: #e4e4e7;
      }

      .message-time {
        font-size: 0.75rem;
        color: #71717a;
      }

      .message-text {
        font-size: 0.875rem;
        line-height: 1.6;
        color: #d4d4d8;
        word-wrap: break-word;
        white-space: pre-wrap;
      }

      /* Enhanced Code Blocks */
      .code-block {
        margin: 1rem 0;
        border-radius: 0.75rem;
        background: #0d1117;
        border: 1px solid #30363d;
        overflow: hidden;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace;
        transition: all 0.2s ease;
      }

      .message.has-code .code-block {
        margin: 0.75rem 0 0 0;
        width: 100%;
      }

      .code-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background: #161b22;
        border-bottom: 1px solid #30363d;
        font-size: 0.75rem;
      }

      .code-language {
        color: #7c3aed;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-size: 0.6875rem;
      }

      .code-actions {
        display: flex;
        gap: 0.5rem;
      }

      .code-action {
        background: transparent;
        border: 1px solid #30363d;
        border-radius: 0.375rem;
        padding: 0.375rem 0.75rem;
        color: #8b949e;
        cursor: pointer;
        font-size: 0.6875rem;
        font-weight: 500;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .code-action:hover {
        border-color: #7c3aed;
        color: #a855f7;
        background: rgba(124, 58, 237, 0.1);
      }

      .code-action:active {
        transform: scale(0.95);
      }

      .code-content {
        position: relative;
        overflow: hidden;
        background: #0d1117;
      }

      .code-content pre {
        margin: 0;
        padding: 1.25rem;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace;
        font-size: 0.8125rem;
        line-height: 1.6;
        color: #e6edf3;
        white-space: pre;
        min-width: max-content;
        tab-size: 2;
      }

      .code-content code {
        font-family: inherit;
        font-size: inherit;
        color: inherit;
        background: none;
        padding: 0;
        border: none;
      }

      .code-content::-webkit-scrollbar {
        height: 8px;
        background: #161b22;
      }

      .code-content::-webkit-scrollbar-thumb {
        background: #30363d;
        border-radius: 4px;
      }

      .code-content::-webkit-scrollbar-thumb:hover {
        background: #484f58;
      }

      .code-content::-webkit-scrollbar-corner {
        background: #161b22;
      }

      .code-block.large {
        max-height: 600px;
        overflow: hidden;
      }

      .code-block.large .code-content {
        max-height: 500px;
        overflow: auto;
      }

      .code-content pre {
        white-space: pre;
        word-wrap: normal;
        overflow-wrap: normal;
      }

      .code-content .keyword { color: #c678dd; }
      .code-content .string { color: #98c379; }
      .code-content .comment { color: #5c6370; font-style: italic; }
      .code-content .number { color: #d19a66; }
      .code-content .function { color: #61afef; }
      .code-content .variable { color: #e06c75; }
      .code-content .operator { color: #56b6c2; }

      .message-text code:not(.code-block code) {
        background: #262626;
        color: #fbbf24;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
        font-size: 0.8125rem;
        border: 1px solid #404040;
      }

      .message.user.code-heavy .message-text {
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
        background: #0d0d0d;
        border: 1px solid #2a2a2a;
        border-radius: 0.5rem;
        padding: 1rem;
        overflow-x: auto;
        white-space: pre;
        font-size: 0.8125rem;
        line-height: 1.5;
      }

      .typing-indicator {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem;
        color: #71717a;
        font-size: 0.875rem;
        flex-shrink: 0;
      }

      .typing-dots {
        display: flex;
        gap: 0.25rem;
      }

      .typing-dot {
        width: 0.375rem;
        height: 0.375rem;
        background: #71717a;
        border-radius: 50%;
        animation: pulse 1.4s infinite;
      }

      .typing-dot:nth-child(2) { animation-delay: 0.2s; }
      .typing-dot:nth-child(3) { animation-delay: 0.4s; }

      @keyframes pulse {
        0%, 80%, 100% { 
          opacity: 0.3; 
          transform: scale(0.8); 
        }
        40% { 
          opacity: 1; 
          transform: scale(1); 
        }
      }

      .input-action-btn.recording {
        color: #ef4444 !important;
        border-color: #ef4444 !important;
        background: rgba(239, 68, 68, 0.1) !important;
        animation: recordingPulse 1.5s ease-in-out infinite;
      }

      @keyframes recordingPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.05); }
      }

      .speech-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        color: white;
        font-size: 0.875rem;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      }

      .speech-notification.success {
        background: #10b981;
      }

      .speech-notification.error {
        background: #ef4444;
      }
    `;
  }
}
