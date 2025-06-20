import { ChatMessage, StreamingState, EventCallbacks } from '../core/ChatTypes.js';
import { ChatStateManager } from '../core/ChatStateManager.js';
import { StreamingRenderer } from './StreamingRenderer.js';
import { ScrollManager } from '../utils/ScrollManager.js';

export class ChatStreaming {
  private stateManager: ChatStateManager;
  private streamingRenderer: StreamingRenderer;
  private scrollManager: ScrollManager;
  private callbacks: EventCallbacks;

  constructor(
    stateManager: ChatStateManager,
    scrollManager: ScrollManager,
    callbacks: EventCallbacks = {}
  ) {
    this.stateManager = stateManager;
    this.scrollManager = scrollManager;
    this.callbacks = callbacks;
    this.streamingRenderer = new StreamingRenderer(stateManager, scrollManager);
    this.setupStreamingListeners();
  }

  private setupStreamingListeners(): void {
    if (!window.electronAPI) return;

    window.electronAPI.onAIStreamStart?.((data: { sessionId: string }) => {
      console.log('🚀 Stream started:', data.sessionId);
      this.handleStreamStart(data.sessionId);
    });

    window.electronAPI.onAIStreamToken?.((data: { sessionId: string; token: string; type: string }) => {
      const streamingState = this.stateManager.getStreamingState();
      if (data.sessionId === streamingState.currentStreamSessionId) {
        this.handleStreamToken(data.token);
      }
    });

    window.electronAPI.onAIStreamEnd?.((data: { sessionId: string }) => {
      const streamingState = this.stateManager.getStreamingState();
      if (data.sessionId === streamingState.currentStreamSessionId) {
        console.log('✅ Stream completed:', data.sessionId);
        this.handleStreamEnd();
      }
    });

    window.electronAPI.onAIStreamError?.((data: { error: string }) => {
      console.error('❌ Stream error:', data.error);
      this.handleStreamError(data.error);
    });
  }

  private handleStreamStart(sessionId: string): void {
    // Force enable auto-scroll during streaming
    this.scrollManager.enableAutoScroll();
    
    console.log('🚀 Stream started - FORCING auto-scroll enabled');
    
    // Create streaming message
    const streamingMessage: ChatMessage = {
      id: sessionId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };

    // Update state
    this.stateManager.setStreamingState({
      currentStreamSessionId: sessionId,
      currentStreamingMessage: streamingMessage,
      isInCodeBlock: false,
      codeBlockBuffer: ''
    });

    // Add to messages
    this.stateManager.addMessage(streamingMessage);
    
    // Create UI element
    this.streamingRenderer.createStreamingMessageElement(streamingMessage);
    
    // Scroll to new message
    this.scrollManager.forceScrollToBottom();

    // Callback
    this.callbacks.onStreamStart?.(sessionId);
  }

  private handleStreamToken(token: string): void {
    const streamingState = this.stateManager.getStreamingState();
    if (!streamingState.currentStreamingMessage) return;

    // Add token to message content
    streamingState.currentStreamingMessage.content += token;
    
    // Render token
    this.streamingRenderer.appendToken(token);
    
    // Force scroll to bottom
    this.scrollManager.forceScrollToBottom();

    // Callback
    this.callbacks.onStreamToken?.(token);
  }

  private handleStreamEnd(): void {
    console.log('✅ Stream ended - cleaning up');
    
    const streamingState = this.stateManager.getStreamingState();
    
    // Finalize rendering
    this.streamingRenderer.finalizeStreamingMessage();
    
    // Clear streaming state
    this.stateManager.clearStreamingState();
    this.stateManager.setLoading(false);

    // Re-enable normal scroll monitoring
    this.scrollManager.enableAutoScroll();
    
    // Final scroll to bottom
    setTimeout(() => {
      this.scrollManager.forceScrollToBottom();
    }, 100);
    
    console.log('✅ Stream cleanup complete');

    // Callback
    this.callbacks.onStreamEnd?.();
  }

  private handleStreamError(error: string): void {
    console.error('Stream error:', error);
    
    const streamingState = this.stateManager.getStreamingState();
    
    // Remove the partial streaming message element if it exists
    if (streamingState.streamingMessageElement) {
      streamingState.streamingMessageElement.remove();
    }
    
    // Remove streaming message from state
    if (streamingState.currentStreamingMessage) {
      this.stateManager.removeMessage(streamingState.currentStreamingMessage.id);
    }
    
    // Clean up streaming state
    this.stateManager.clearStreamingState();
    this.stateManager.setLoading(false);
    
    // Add error message
    const errorMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `❌ **Error**: ${this.getErrorMessage(new Error(error))}

**Suggestions:**
• Try asking a more specific question
• Check your internet connection
• Ensure your API key is valid`,
      timestamp: new Date()
    };

    this.stateManager.addMessage(errorMessage);

    // Callback
    this.callbacks.onStreamError?.(error);
  }

  private getErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('ended response early') || message.includes('incomplete')) {
      return 'Response was cut off by the AI provider. Try asking a shorter question.';
    } else if (message.includes('rate limit')) {
      return 'Rate limit reached. Please wait a moment before sending another message.';
    } else if (message.includes('timeout')) {
      return 'Request timed out. Please check your connection and try again.';
    } else if (message.includes('invalid api key')) {
      return 'Invalid API key. Please check your Anthropic API key.';
    } else {
      return `Failed to get response: ${error.message}`;
    }
  }

  async startStreaming(messages: any[], systemPrompt: string): Promise<void> {
    try {
      await window.electronAPI.callAnthropicAPIStream(messages, systemPrompt);
    } catch (error) {
      console.error('Failed to start streaming:', error);
      this.handleStreamError(this.getErrorMessage(error as Error));
    }
  }
}
