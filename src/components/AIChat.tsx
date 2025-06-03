import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AnthropicAIService } from '../api/ai/anthropic';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { CodeContext } from './CodeContext';

interface AIChatProps {
  isVisible: boolean;
  onToggle: () => void;
  currentFile?: string;
  selectedText?: string;
  monacoEditor?: any;
}

export const AIChat: React.FC<AIChatProps> = ({
  isVisible,
  onToggle,
  currentFile,
  selectedText,
  monacoEditor
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiService, setAIService] = useState<AnthropicAIService | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeAPIKey = (key: string) => {
    try {
      const service = new AnthropicAIService({ apiKey: key });
      setAIService(service);
      setApiKey(key);
      setShowApiKeyInput(false);
      
      // Add welcome message
      const welcomeMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Hello! I'm your AI coding assistant. I can help you with:

• **Code Analysis** - Explain and review your code
• **Code Generation** - Create new components, functions, or files
• **Debugging** - Find and fix issues
• **Refactoring** - Improve code quality
• **Documentation** - Generate comments and docs

Feel free to ask questions about your code or request new functionality!`,
        timestamp: new Date()
      };
      
      setMessages([welcomeMessage]);
    } catch (error) {
      alert('Invalid API key. Please check your Anthropic API key.');
    }
  };

  const sendMessage = async (content: string, includeContext: boolean = false) => {
    if (!aiService || !content.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
      metadata: includeContext ? {
        codeContext: currentFile,
        selectedText: selectedText
      } : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const allMessages = [...messages, userMessage];
      const response = await aiService.sendMessage(allMessages);
      setMessages(prev => [...prev, response]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateCode = async (prompt: string) => {
    if (!aiService) return;

    setIsLoading(true);
    try {
      const context = {
        currentFile: currentFile,
        selectedText: selectedText,
        language: getCurrentLanguage(),
        framework: detectFramework()
      };

      const generatedCode = await aiService.generateCode(prompt, context);
      
      const codeMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: generatedCode,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, codeMessage]);
    } catch (error) {
      console.error('Code generation failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentLanguage = (): string => {
    if (!currentFile) return 'javascript';
    const extension = currentFile.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'json': 'json'
    };
    return languageMap[extension || ''] || 'javascript';
  };

  const detectFramework = (): string => {
    if (currentFile?.includes('react') || currentFile?.endsWith('.tsx') || currentFile?.endsWith('.jsx')) {
      return 'react';
    }
    if (currentFile?.includes('vue')) return 'vue';
    if (currentFile?.includes('angular')) return 'angular';
    return 'vanilla';
  };

  const insertCodeIntoEditor = (code: string) => {
    if (monacoEditor) {
      const selection = monacoEditor.getSelection();
      const id = { major: 1, minor: 1 };
      const op = {
        identifier: id,
        range: selection,
        text: code,
        forceMoveMarkers: true
      };
      monacoEditor.executeEdits('ai-assistant', [op]);
      monacoEditor.focus();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="ai-chat-container">
      <div className="ai-chat-header">
        <div className="ai-chat-title">
          <span className="ai-icon">🤖</span>
          <span>AI Assistant</span>
        </div>
        <div className="ai-chat-controls">
          <button onClick={clearChat} className="chat-control-btn" title="Clear Chat">
            🗑️
          </button>
          <button onClick={onToggle} className="chat-control-btn" title="Close">
            ✕
          </button>
        </div>
      </div>

      {showApiKeyInput ? (
        <div className="api-key-setup">
          <h3>Setup AI Assistant</h3>
          <p>Enter your Anthropic API key to get started:</p>
          <div className="api-key-input-container">
            <input
              type="password"
              placeholder="sk-ant-api03-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && apiKey.trim()) {
                  initializeAPIKey(apiKey.trim());
                }
              }}
              className="api-key-input"
            />
            <button 
              onClick={() => initializeAPIKey(apiKey.trim())}
              disabled={!apiKey.trim()}
              className="api-key-submit"
            >
              Connect
            </button>
          </div>
          <p className="api-key-note">
            Get your API key from{' '}
            <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">
              Anthropic Console
            </a>
          </p>
        </div>
      ) : (
        <>
          <CodeContext 
            currentFile={currentFile}
            selectedText={selectedText}
          />
          
          <div className="ai-chat-messages" ref={chatContainerRef}>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onInsertCode={insertCodeIntoEditor}
              />
            ))}
            {isLoading && (
              <div className="typing-indicator">
                <span>AI is thinking</span>
                <span className="dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <ChatInput
            onSendMessage={sendMessage}
            onGenerateCode={generateCode}
            isLoading={isLoading}
            hasContext={!!(currentFile || selectedText)}
          />
        </>
      )}
    </div>
  );
};
