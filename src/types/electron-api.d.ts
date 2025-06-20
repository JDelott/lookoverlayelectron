export {};

declare global {
  interface Window {
    electronAPI: {
      // File system operations
      getDirectoryContents: (path?: string) => Promise<any[]>;
      readFile: (filePath: string) => Promise<string>;
      writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
      writeBinaryFile: (filePath: string, base64Data: string) => Promise<{ success: boolean; error?: string }>;
      createFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      createFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
      deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      renameFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
      copyExternalFile: (sourcePath: string, targetDir: string, fileName?: string) => Promise<{ success: boolean; targetPath?: string; error?: string }>;
      saveDroppedFile: (targetDir: string, fileName: string, fileData: string, isBase64?: boolean) => Promise<{ success: boolean; targetPath?: string; error?: string }>;
      getCurrentDirectory: () => Promise<string>;
      
      // Enhanced command execution with terminal ID support
      executeCommand: (command: string, workingDir?: string, terminalId?: string) => Promise<any>;
      
      // Git operations
      executeGitCommand: (command: string) => Promise<any>;
      
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
      onProcessStarted: (callback: (info: { id: string; command: string; isInteractive?: boolean }) => void) => void;
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
      
      // AI Chunked Processing API
      onAIChunkedStart: (callback: (data: { totalChunks: number }) => void) => void;
      onAIChunkedProgress: (callback: (data: { currentChunk: number; totalChunks: number }) => void) => void;
      onAIChunkedComplete: (callback: (data: { totalChunks: number; wasCompleted: boolean }) => void) => void;
      onAIChunkedError: (callback: (data: { error: string }) => void) => void;
      
      // Project management
      setCurrentDirectory: (directoryPath: string) => Promise<{ success: boolean; currentDirectory?: string; error?: string }>;
      selectProjectDirectory: () => Promise<string | null>;
      getRecentProjects: () => Promise<any[]>;
      saveRecentProject: (projectPath: string) => Promise<{ success: boolean; error?: string }>;
      
      // Terminal working directory management
      initTerminalWorkingDir: (terminalId: string, workingDir: string) => Promise<{ success: boolean }>;
      getTerminalWorkingDir: (terminalId: string) => Promise<string>;
      
      // Speech Recognition
      startRecording: () => Promise<{ success: boolean; error?: string }>;
      stopRecording: () => Promise<{ success: boolean; error?: string }>;
      transcribeAudio: (audioFilePath?: string) => Promise<{ success: boolean; text?: string; error?: string }>;
      onRecordingStateChanged: (callback: (data: { isRecording: boolean; error?: string }) => void) => void;
      
      // File system change events
      onFileSystemChanged: (callback: (event: { type: string; path: string; parentPath: string; oldPath?: string }) => void) => void;
      
      // Interactive input support
      sendProcessInput: (processId: string, input: string) => Promise<{ success: boolean; error?: string }>;
    }
  }
}
