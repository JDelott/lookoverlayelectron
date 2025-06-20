import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations
  getDirectoryContents: (path?: string) => ipcRenderer.invoke('get-directory-contents', path),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('write-file', filePath, content),
  writeBinaryFile: (filePath: string, base64Data: string) => ipcRenderer.invoke('write-binary-file', filePath, base64Data),
  createFile: (filePath: string) => ipcRenderer.invoke('create-file', filePath),
  createFolder: (folderPath: string) => ipcRenderer.invoke('create-folder', folderPath),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  copyExternalFile: (sourcePath: string, targetDir: string, fileName?: string) => ipcRenderer.invoke('copy-external-file', sourcePath, targetDir, fileName),
  saveDroppedFile: (targetDir: string, fileName: string, fileData: string, isBase64?: boolean) => ipcRenderer.invoke('save-dropped-file', targetDir, fileName, fileData, isBase64),
  getCurrentDirectory: () => ipcRenderer.invoke('get-current-directory'),
  
  // Enhanced command execution with terminal ID support
  executeCommand: (command: string, workingDir?: string, terminalId?: string) => 
    ipcRenderer.invoke('execute-command', command, workingDir, terminalId),
  
  // Git operations
  executeGitCommand: (command: string) => ipcRenderer.invoke('execute-git-command', command),
  
  // Process control
  killProcess: (processId?: string) => ipcRenderer.invoke('kill-process', processId),
  
  // External URL opening
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  
  // Persistent terminal operations
  createTerminal: () => ipcRenderer.invoke('create-terminal'),
  writeTerminal: (data: string) => ipcRenderer.invoke('write-terminal', data),
  killTerminal: () => ipcRenderer.invoke('kill-terminal'),
  
  // Terminal event listeners
  onTerminalOutput: (callback: (data: string) => void) => {
    ipcRenderer.on('terminal-output', (event, data) => callback(data));
  },
  onTerminalClosed: (callback: (code: number) => void) => {
    ipcRenderer.on('terminal-closed', (event, code) => callback(code));
  },
  
  // Command output streaming
  onCommandOutputStream: (callback: (data: string) => void) => {
    ipcRenderer.on('command-output-stream', (event, data) => callback(data));
  },
  
  // Process lifecycle events
  onProcessStarted: (callback: (info: { id: string; command: string }) => void) => {
    ipcRenderer.on('process-started', (event, info) => callback(info));
  },
  onProcessEnded: (callback: (info: { id: string }) => void) => {
    ipcRenderer.on('process-ended', (event, info) => callback(info));
  },
  
  // Screen capture operations
  getSources: () => ipcRenderer.invoke('get-sources'),
  getScreenInfo: () => ipcRenderer.invoke('get-screen-info'),
  
  // AI API calls
  callAnthropicAPI: (messages: any[], systemPrompt?: string) => 
    ipcRenderer.invoke('anthropic-api-call', messages, systemPrompt),
  
  // AI Streaming API calls
  callAnthropicAPIStream: (messages: any[], systemPrompt?: string) => 
    ipcRenderer.invoke('anthropic-api-call-stream', messages, systemPrompt),
  
  // AI Streaming event listeners
  onAIStreamStart: (callback: (data: { sessionId: string }) => void) => {
    ipcRenderer.on('ai-stream-start', (event, data) => callback(data));
  },
  onAIStreamToken: (callback: (data: { sessionId: string; token: string; type: string }) => void) => {
    ipcRenderer.on('ai-stream-token', (event, data) => callback(data));
  },
  onAIStreamEnd: (callback: (data: { sessionId: string }) => void) => {
    ipcRenderer.on('ai-stream-end', (event, data) => callback(data));
  },
  onAIStreamError: (callback: (data: { error: string }) => void) => {
    ipcRenderer.on('ai-stream-error', (event, data) => callback(data));
  },
  
  // Project management
  setCurrentDirectory: (directoryPath: string) => ipcRenderer.invoke('set-current-directory', directoryPath),
  selectProjectDirectory: () => ipcRenderer.invoke('select-project-directory'),
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  saveRecentProject: (projectPath: string) => ipcRenderer.invoke('save-recent-project', projectPath),
  
  // Terminal working directory management
  initTerminalWorkingDir: (terminalId: string, workingDir: string) => ipcRenderer.invoke('init-terminal-working-dir', terminalId, workingDir),
  getTerminalWorkingDir: (terminalId: string) => ipcRenderer.invoke('get-terminal-working-dir', terminalId),
  
  // Speech recognition and recording
  startRecording: () => ipcRenderer.invoke('start-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  transcribeAudio: (audioFilePath?: string) => ipcRenderer.invoke('transcribe-audio', audioFilePath),
  
  // Recording state change listener
  onRecordingStateChanged: (callback: (data: { isRecording: boolean; error?: string }) => void) => {
    ipcRenderer.on('recording-state-changed', (event, data) => callback(data));
  },
  
  // File system change events
  onFileSystemChanged: (callback: (event: { type: string; path: string; parentPath: string }) => void) => {
    ipcRenderer.on('file-system-changed', (event, data) => callback(data));
  },
  
  // Interactive input support
  sendProcessInput: (processId: string, input: string) => ipcRenderer.invoke('send-process-input', processId, input),
  
  // Add chunked processing event listeners
  onAIChunkedStart: (callback: (data: { totalChunks: number }) => void) => 
    ipcRenderer.on('ai-chunked-start', (_event, data) => callback(data)),
  onAIChunkedProgress: (callback: (data: { currentChunk: number; totalChunks: number }) => void) => 
    ipcRenderer.on('ai-chunked-progress', (_event, data) => callback(data)),
  onAIChunkedComplete: (callback: (data: { totalChunks: number; wasCompleted: boolean }) => void) => 
    ipcRenderer.on('ai-chunked-complete', (_event, data) => callback(data)),
  onAIChunkedError: (callback: (data: { error: string }) => void) => 
    ipcRenderer.on('ai-chunked-error', (_event, data) => callback(data)),
});
