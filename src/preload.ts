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
    ipcRenderer.invoke('read-file-contents', filePath)
});
