import { AppState } from '../types';
import { TabManager } from '../tabs';

declare const monaco: typeof import('monaco-editor');

export class MonacoEditorManager {
  private state: AppState;
  private tabManager: TabManager;

  constructor(state: AppState, tabManager: TabManager) {
    this.state = state;
    this.tabManager = tabManager;
  }

  async initialize(): Promise<void> {
    try {
      // Load Monaco Editor
      await this.loadMonacoEditor();
      await this.setupEditor();
      this.setupValidation();
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize Monaco Editor:', error);
    }
  }

  private async loadMonacoEditor(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if Monaco is already loaded
      if (window.monaco) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = './node_modules/monaco-editor/min/vs/loader.js';
      script.onload = () => {
        window.require.config({ paths: { vs: './node_modules/monaco-editor/min/vs' } });
        window.require(['vs/editor/editor.main'], () => {
          resolve();
        }, reject);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  private async setupEditor(): Promise<void> {
    const editorContainer = document.getElementById('editor-container');
    if (!editorContainer) return;

    this.state.monacoEditor = monaco.editor.create(editorContainer, {
      value: this.getWelcomeContent(),
      language: 'markdown',
      theme: 'vs-dark',
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      automaticLayout: true,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      folding: true,
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true
      },
      suggest: {
        showKeywords: true
      }
    });

    // Setup keybindings
    this.setupKeybindings();
  }

  private setupKeybindings(): void {
    if (!this.state.monacoEditor) return;

    // Ctrl+S to save
    this.state.monacoEditor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => this.saveCurrentFile()
    );

    // Ctrl+W to close tab
    this.state.monacoEditor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW,
      () => {
        if (this.state.activeTabPath) {
          this.tabManager.closeTab(this.state.activeTabPath);
        }
      }
    );
  }

  private setupValidation(): void {
    if (!this.state.monacoEditor || !monaco) return;

    // Setup TypeScript/JavaScript validation
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false
    });

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false
    });

    // Add React types
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `declare module 'react' { export * from '@types/react'; }`,
      'file:///node_modules/@types/react/index.d.ts'
    );
  }

  private setupEventListeners(): void {
    if (!this.state.monacoEditor) return;

    // Track content changes
    this.state.monacoEditor.onDidChangeModelContent(() => {
      if (this.state.activeTabPath) {
        this.tabManager.markTabAsDirty(this.state.activeTabPath);
        const tab = this.state.openTabs.get(this.state.activeTabPath);
        if (tab) {
          tab.content = this.state.monacoEditor.getValue();
        }
      }
    });

    // Handle cursor position changes
    this.state.monacoEditor.onDidChangeCursorPosition((e: any) => {
      this.updateStatusBar(e.position);
    });
  }

  private async saveCurrentFile(): Promise<void> {
    if (!this.state.activeTabPath || !this.state.monacoEditor) return;

    try {
      const content = this.state.monacoEditor.getValue();
      const ipcRenderer = (window as any).electronAPI || (window as any).require?.('electron').ipcRenderer;
      
      await ipcRenderer.invoke('write-file', this.state.activeTabPath, content);
      this.tabManager.markTabAsClean(this.state.activeTabPath);
      this.showSaveIndicator();
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }

  private showSaveIndicator(): void {
    const indicator = document.createElement('div');
    indicator.className = `
      fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg
      transition-all duration-300 z-50
    `;
    indicator.textContent = 'File saved!';
    
    document.body.appendChild(indicator);
    
    setTimeout(() => {
      indicator.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(indicator);
      }, 300);
    }, 2000);
  }

  private updateStatusBar(position: any): void {
    const statusBar = document.querySelector('.status-bar');
    if (statusBar) {
      statusBar.textContent = `Line ${position.lineNumber}, Column ${position.column}`;
    }
  }

  private getWelcomeContent(): string {
    return `# Welcome to LookOverlay IDE

## Features
- 📝 **Monaco Editor** - VS Code-like editing experience
- 🗂️ **File Explorer** - Navigate your project files
- 💻 **Integrated Terminal** - Run commands without leaving the editor
- 🤖 **AI Assistant** - Get help with coding tasks
- 🎨 **Syntax Highlighting** - Support for multiple languages

## Getting Started
1. Open a project folder using the project selector
2. Browse files in the sidebar
3. Start editing your code
4. Use the terminal for running commands
5. Chat with the AI assistant for help

Happy coding! 🚀`;
  }

  setValue(content: string): void {
    if (this.state.monacoEditor) {
      this.state.monacoEditor.setValue(content);
    }
  }

  getValue(): string {
    return this.state.monacoEditor?.getValue() || '';
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
