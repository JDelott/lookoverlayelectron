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

    // Add chunked processing listeners
    window.electronAPI.onAIChunkedStart?.((data: { totalChunks: number }) => {
      console.log('🔄 Chunked processing started:', data.totalChunks, 'chunks');
      this.handleChunkedStart(data.totalChunks);
    });

    window.electronAPI.onAIChunkedProgress?.((data: { currentChunk: number; totalChunks: number }) => {
      console.log('🔄 Chunked progress:', data.currentChunk, '/', data.totalChunks);
      this.handleChunkedProgress(data.currentChunk, data.totalChunks);
    });

    window.electronAPI.onAIChunkedComplete?.((data: { totalChunks: number; wasCompleted: boolean }) => {
      console.log('✅ Chunked processing complete:', data.totalChunks, 'chunks');
      this.handleChunkedComplete(data.totalChunks, data.wasCompleted);
    });

    window.electronAPI.onAIChunkedError?.((data: { error: string }) => {
      console.error('❌ Chunked processing error:', data.error);
      this.handleChunkedError(data.error);
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

  private handleChunkedStart(totalChunks: number): void {
    // Show chunked processing indicator
    this.showChunkedProgress(0, totalChunks);
  }

  private handleChunkedProgress(currentChunk: number, totalChunks: number): void {
    // Update progress indicator
    this.showChunkedProgress(currentChunk, totalChunks);
  }

  private handleChunkedComplete(totalChunks: number, wasCompleted: boolean): void {
    // Hide progress and show completion
    this.hideChunkedProgress();
    
    if (wasCompleted) {
      this.showChunkedCompletionIndicator(totalChunks);
    }
  }

  private handleChunkedError(error: string): void {
    this.hideChunkedProgress();
    // Handle error (could show in chat or log)
    console.error('Chunked processing failed:', error);
  }

  private showChunkedProgress(currentChunk: number, totalChunks: number): void {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    // Remove existing progress if any
    const existingProgress = container.querySelector('.chunked-progress');
    if (existingProgress) {
      existingProgress.remove();
    }

    // Create progress indicator
    const progressDiv = document.createElement('div');
    progressDiv.className = 'chunked-progress message assistant';
    progressDiv.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-role">Claude</span>
          <span class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="chunked-progress-content">
          <div class="progress-text">Processing complex request... ${currentChunk > 0 ? `(${currentChunk}/${totalChunks})` : 'Starting...'}</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${currentChunk > 0 ? (currentChunk / totalChunks) * 100 : 0}%"></div>
          </div>
        </div>
      </div>
    `;

    container.appendChild(progressDiv);
    this.scrollManager.forceScrollToBottom();
  }

  private hideChunkedProgress(): void {
    const existingProgress = document.querySelector('.chunked-progress');
    if (existingProgress) {
      existingProgress.remove();
    }
  }

  private showChunkedCompletionIndicator(totalChunks: number): void {
    // Add a small completion indicator that fades out
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const completionDiv = document.createElement('div');
    completionDiv.className = 'chunked-completion';
    completionDiv.innerHTML = `
      <div class="completion-text">✅ Complete response assembled from ${totalChunks} parts</div>
    `;
    
    container.appendChild(completionDiv);
    
    // Fade out after 3 seconds
    setTimeout(() => {
      completionDiv.style.opacity = '0';
      setTimeout(() => completionDiv.remove(), 300);
    }, 3000);
  }
}
