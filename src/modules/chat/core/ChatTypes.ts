export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    codeContext?: string;
    filePath?: string;
    selectedText?: string;
    projectPath?: string;
  };
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  apiKeyConfigured: boolean;
}

export interface StreamingState {
  currentStreamingMessage: ChatMessage | null;
  currentStreamSessionId: string | null;
  streamingMessageElement: HTMLElement | null;
  streamingContentContainer: HTMLElement | null;
  currentCodeBlock: HTMLElement | null;
  isInCodeBlock: boolean;
  codeBlockBuffer: string;
}

export interface SpeechState {
  isRecording: boolean;
  recordingStartTime: number;
}

export interface ScrollState {
  isScrolling: boolean;
  scrollAnimationFrame: number | null;
  autoScrollEnabled: boolean;
  lastScrollPosition: number;
  scrollUpdateScheduled: boolean;
}

export interface ChatManagerOptions {
  typingSpeed?: number;
}

export interface AttachedFile {
  name: string;
  content: string;
  language: string;
  path: string;
}

export interface CodeInsertionOptions {
  formatOnInsert: boolean;
  addImports: boolean;
}

export interface FilePickerCallbacks {
  onFilesSelected: (files: Map<string, AttachedFile>) => void;
  onFileRemoved: (filePath: string) => void;
  onAllFilesCleared: () => void;
}

export interface EventCallbacks {
  onMessageSent?: (message: ChatMessage) => void;
  onStreamStart?: (sessionId: string) => void;
  onStreamToken?: (token: string) => void;
  onStreamEnd?: () => void;
  onStreamError?: (error: string) => void;
  onAPIKeyConfigured?: () => void;
  onRecordingStateChanged?: (isRecording: boolean) => void;
}
