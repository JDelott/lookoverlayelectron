import { contextBridge, ipcRenderer, clipboard } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  callAnthropicAPI: (imageData: string, prompt: string) => 
    ipcRenderer.invoke('call-anthropic-api', imageData, prompt),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  copyToClipboard: (text: string) => clipboard.writeText(text)
});

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector: string, text: string) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency] || '');
  }
});
