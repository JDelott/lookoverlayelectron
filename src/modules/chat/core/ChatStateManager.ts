import { ChatState, ChatMessage, StreamingState, SpeechState, ScrollState, AttachedFile } from './ChatTypes.js';

export class ChatStateManager {
  private chatState: ChatState;
  private streamingState: StreamingState;
  private speechState: SpeechState;
  private scrollState: ScrollState;
  private attachedFiles: Map<string, AttachedFile>;
  private isUIReady = false;

  constructor() {
    this.chatState = {
      messages: [],
      isLoading: false,
      apiKeyConfigured: false
    };

    this.streamingState = {
      currentStreamingMessage: null,
      currentStreamSessionId: null,
      streamingMessageElement: null,
      streamingContentContainer: null,
      streamingIndicator: null,
      currentCodeBlock: null,
      isInCodeBlock: false,
      codeBlockBuffer: ''
    };

    this.speechState = {
      isRecording: false,
      recordingStartTime: 0
    };

    this.scrollState = {
      isScrolling: false,
      scrollAnimationFrame: null,
      autoScrollEnabled: true,
      lastScrollPosition: 0,
      scrollUpdateScheduled: false
    };

    this.attachedFiles = new Map();
  }

  // Chat state methods
  getChatState(): ChatState {
    return { ...this.chatState };
  }

  setChatState(state: Partial<ChatState>): void {
    this.chatState = { ...this.chatState, ...state };
  }

  addMessage(message: ChatMessage): void {
    this.chatState.messages.push(message);
  }

  removeMessage(messageId: string): void {
    this.chatState.messages = this.chatState.messages.filter(msg => msg.id !== messageId);
  }

  clearMessages(): void {
    this.chatState.messages = [];
  }

  getMessages(): ChatMessage[] {
    return [...this.chatState.messages];
  }

  setLoading(isLoading: boolean): void {
    this.chatState.isLoading = isLoading;
  }

  isLoading(): boolean {
    return this.chatState.isLoading;
  }

  setAPIKeyConfigured(configured: boolean): void {
    this.chatState.apiKeyConfigured = configured;
  }

  isAPIKeyConfigured(): boolean {
    return this.chatState.apiKeyConfigured;
  }

  // Streaming state methods
  getStreamingState(): StreamingState {
    return { ...this.streamingState };
  }

  setStreamingState(state: Partial<StreamingState>): void {
    this.streamingState = { ...this.streamingState, ...state };
  }

  clearStreamingState(): void {
    this.streamingState = {
      currentStreamingMessage: null,
      currentStreamSessionId: null,
      streamingMessageElement: null,
      streamingContentContainer: null,
      streamingIndicator: null,
      currentCodeBlock: null,
      isInCodeBlock: false,
      codeBlockBuffer: ''
    };
  }

  // Speech state methods
  getSpeechState(): SpeechState {
    return { ...this.speechState };
  }

  setSpeechState(state: Partial<SpeechState>): void {
    this.speechState = { ...this.speechState, ...state };
  }

  // Scroll state methods
  getScrollState(): ScrollState {
    return { ...this.scrollState };
  }

  setScrollState(state: Partial<ScrollState>): void {
    this.scrollState = { ...this.scrollState, ...state };
  }

  // Attached files methods
  getAttachedFiles(): Map<string, AttachedFile> {
    return new Map(this.attachedFiles);
  }

  addAttachedFile(filePath: string, file: AttachedFile): void {
    this.attachedFiles.set(filePath, file);
  }

  removeAttachedFile(filePath: string): void {
    this.attachedFiles.delete(filePath);
  }

  clearAttachedFiles(): void {
    this.attachedFiles.clear();
  }

  hasAttachedFiles(): boolean {
    return this.attachedFiles.size > 0;
  }

  getAttachedFilesCount(): number {
    return this.attachedFiles.size;
  }

  // UI state methods
  setUIReady(ready: boolean): void {
    this.isUIReady = ready;
  }

  getUIReady(): boolean {
    return this.isUIReady;
  }
}
