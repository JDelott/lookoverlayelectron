import { AppState } from '../types';
import { TabManager } from '../tabs';

declare const monaco: typeof import('monaco-editor');

// Add type declarations for Monaco and RequireJS
declare global {
  interface Window {
    monaco: typeof import('monaco-editor');
    require: {
      config: (config: { paths: { [key: string]: string } }) => void;
      (modules: string[], onLoad: () => void, onError?: (error: any) => void): void;
    };
  }
}

export class MonacoEditorManager {
  private state: AppState;
  private tabManager: TabManager;

  constructor(state: AppState, tabManager: TabManager) {
    this.state = state;
    this.tabManager = tabManager;
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if Monaco is already loaded
      if ((window as any).monaco) {
        this.createEditor();
        resolve();
        return;
      }

      // Configure RequireJS to load Monaco from CDN
      if ((window as any).require && (window as any).require.config) {
        (window as any).require.config({ 
          paths: { vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs' } 
        });
        
        (window as any).require(['vs/editor/editor.main'], () => {
          this.createEditor();
          resolve();
        }, (error: any) => {
          console.error('Failed to load Monaco editor:', error);
          reject(error);
        });
      } else {
        console.error('RequireJS not available');
        reject(new Error('RequireJS not available'));
      }
    });
  }

  private createEditor(): void {
    const container = document.getElementById('editor-container');
    if (!container || !(window as any).monaco) return;

    this.state.monacoEditor = (window as any).monaco.editor.create(container, {
      value: '// Welcome to Lightweight IDE\n// Select a file to start editing',
      language: 'javascript',
      theme: 'vs-dark',
      fontSize: 14,
      wordWrap: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true
    });

    this.setupKeybindings();
    this.setupContentChangeHandling();

    console.log('Monaco editor initialized');
  }

  private setupKeybindings(): void {
    if (!this.state.monacoEditor || !(window as any).monaco) return;

    // Ctrl+S to save
    this.state.monacoEditor.addCommand(
      (window as any).monaco.KeyMod.CtrlCmd | (window as any).monaco.KeyCode.KeyS,
      () => this.saveCurrentFile()
    );

    // Ctrl+W to close tab
    this.state.monacoEditor.addCommand(
      (window as any).monaco.KeyMod.CtrlCmd | (window as any).monaco.KeyCode.KeyW,
      () => {
        if (this.state.activeTabPath) {
          this.tabManager.closeTab(this.state.activeTabPath);
        }
      }
    );
  }

  private setupContentChangeHandling(): void {
    if (!this.state.monacoEditor) return;

    this.state.monacoEditor.onDidChangeModelContent(() => {
      if (this.state.activeTabPath) {
        this.tabManager.markTabAsDirty(this.state.activeTabPath);
      }
    });
  }

  private async saveCurrentFile(): Promise<void> {
    if (!this.state.activeTabPath || !this.state.monacoEditor) return;

    try {
      const content = this.state.monacoEditor.getValue();
      const electronAPI = (window as any).electronAPI;
      
      if (electronAPI) {
        await electronAPI.writeFile(this.state.activeTabPath, content);
        this.tabManager.markTabAsClean(this.state.activeTabPath);
        this.showSaveIndicator();
      }
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }

  private showSaveIndicator(): void {
    // Simple save indicator
    const indicator = document.createElement('div');
    indicator.textContent = '✅ Saved';
    indicator.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      background: #4ade80;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      z-index: 1000;
      transition: opacity 0.3s;
    `;
    
    document.body.appendChild(indicator);
    
    setTimeout(() => {
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 300);
    }, 2000);
  }

  updateLanguage(language: string): void {
    if (this.state.monacoEditor && (window as any).monaco) {
      const model = this.state.monacoEditor.getModel();
      if (model) {
        (window as any).monaco.editor.setModelLanguage(model, language);
      }
    }
  }

  focus(): void {
    if (this.state.monacoEditor) {
      this.state.monacoEditor.focus();
    }
  }

  dispose(): void {
    if (this.state.monacoEditor) {
      this.state.monacoEditor.dispose();
      this.state.monacoEditor = null;
    }
  }
}
