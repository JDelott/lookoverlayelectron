export {};

declare global {
  interface Window {
    electronAPI: {
      // File system operations
      getDirectoryContents: (path?: string) => Promise<any[]>;
      readFile: (filePath: string) => Promise<string>;
      writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
      getCurrentDirectory: () => Promise<string>;
      
      // Command execution
      executeCommand: (command: string, workingDir?: string) => Promise<any>;
      
      // Process control
      killProcess: (processId?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
      
      // External operations
      openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
      
      // Terminal operations
      createTerminal: () => Promise<{ success: boolean; error?: string }>;
      writeTerminal: (data: string) => Promise<{ success: boolean; error?: string }>;
      killTerminal: () => Promise<{ success: boolean }>;
      
      // Event listeners
      onTerminalOutput: (callback: (data: string) => void) => void;
      onTerminalClosed: (callback: (code: number) => void) => void;
      onCommandOutputStream: (callback: (data: string) => void) => void;
      onProcessStarted: (callback: (info: { id: string; command: string }) => void) => void;
      onProcessEnded: (callback: (info: { id: string }) => void) => void;
      
      // Screen capture
      getSources: () => Promise<any[]>;
      getScreenInfo: () => Promise<any>;
      
      // AI API
      callAnthropicAPI: (messages: any[], systemPrompt?: string) => Promise<any>;
      
      // AI Streaming API
      callAnthropicAPIStream: (messages: any[], systemPrompt?: string) => Promise<{ success: boolean; sessionId: string }>;
      onAIStreamStart: (callback: (data: { sessionId: string }) => void) => void;
      onAIStreamToken: (callback: (data: { sessionId: string; token: string; type: string }) => void) => void;
      onAIStreamEnd: (callback: (data: { sessionId: string }) => void) => void;
      onAIStreamError: (callback: (data: { error: string }) => void) => void;
      
      // Speech Recognition
      startRecording: () => Promise<{ success: boolean; error?: string }>;
      stopRecording: () => Promise<{ success: boolean; error?: string }>;
      transcribeAudio: (audioFilePath: string) => Promise<{ success: boolean; text?: string; error?: string }>;
      onRecordingStateChanged: (callback: (data: { isRecording: boolean; error?: string }) => void) => void;
      
      // Project management
      setCurrentDirectory: (directoryPath: string) => Promise<{ success: boolean; currentDirectory?: string; error?: string }>;
      selectProjectDirectory: () => Promise<string | null>;
      getRecentProjects: () => Promise<any[]>;
      saveRecentProject: (projectPath: string) => Promise<{ success: boolean; error?: string }>;
    }
  }
}
