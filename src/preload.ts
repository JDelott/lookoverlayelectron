import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations
  getDirectoryContents: (path?: string) => ipcRenderer.invoke('get-directory-contents', path),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('write-file', filePath, content),
  getCurrentDirectory: () => ipcRenderer.invoke('get-current-directory'),
  
  // Single command execution with working directory support
  executeCommand: (command: string, workingDir?: string) => ipcRenderer.invoke('execute-command', command, workingDir),
  
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
  onProcessStarted: (callback: (process: {id: string, command: string}) => void) => {
    ipcRenderer.on('process-started', (event, process) => callback(process));
  },
  onProcessEnded: (callback: (process: {id: string}) => void) => {
    ipcRenderer.on('process-ended', (event, process) => callback(process));
  },
  
  // Screen capture operations
  getSources: () => ipcRenderer.invoke('get-sources'),
  getScreenInfo: () => ipcRenderer.invoke('get-screen-info'),
  
  // Add secure AI API call
  callAnthropicAPI: (messages: any[], systemPrompt?: string) => 
    ipcRenderer.invoke('anthropic-api-call', messages, systemPrompt),
  
  // Project management
  setCurrentDirectory: (directoryPath: string) => ipcRenderer.invoke('set-current-directory', directoryPath),
  selectProjectDirectory: () => ipcRenderer.invoke('select-project-directory'),
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  saveRecentProject: (projectPath: string) => ipcRenderer.invoke('save-recent-project', projectPath)
});
