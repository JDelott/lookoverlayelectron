import { contextBridge, ipcRenderer, clipboard } from 'electron';

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  callAnthropicAPI: (imageData: string, prompt: string) => 
    ipcRenderer.invoke('call-anthropic-api', imageData, prompt),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  copyToClipboard: (text: string) => clipboard.writeText(text),
  
  // File system operations
  getDirectoryContents: (directoryPath?: string) => 
    ipcRenderer.invoke('get-directory-contents', directoryPath),
  readFileContents: (filePath: string) => 
    ipcRenderer.invoke('read-file-contents', filePath),
  writeFileContents: (filePath: string, content: string) => 
    ipcRenderer.invoke('write-file-contents', filePath, content),
  
  // Terminal operations
  terminalStart: () => ipcRenderer.invoke('terminal-start'),
  terminalWrite: (data: string) => ipcRenderer.invoke('terminal-write', data),
  terminalResize: (cols: number, rows: number) => ipcRenderer.invoke('terminal-resize', cols, rows),
  terminalKill: () => ipcRenderer.invoke('terminal-kill'),
  
  // Terminal event listeners
  onTerminalData: (callback: (data: string) => void) => 
    ipcRenderer.on('terminal-data', (event, data) => callback(data)),
  onTerminalExit: (callback: (code: number) => void) => 
    ipcRenderer.on('terminal-exit', (event, code) => callback(code)),
  
  // Remove listeners
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
});
