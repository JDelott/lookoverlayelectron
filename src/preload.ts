import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations
  getDirectoryContents: (path?: string) => ipcRenderer.invoke('get-directory-contents', path),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  getCurrentDirectory: () => ipcRenderer.invoke('get-current-directory'),
  
  // Single command execution with working directory support
  executeCommand: (command: string, workingDir?: string) => ipcRenderer.invoke('execute-command', command, workingDir),
  
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
  
  // Screen capture operations
  getSources: () => ipcRenderer.invoke('get-sources'),
  getScreenInfo: () => ipcRenderer.invoke('get-screen-info')
});
