import { OpenTab, AppState } from '../types/index.js';
import { FileSystemManager } from '../fileSystem/index.js';

declare const monaco: typeof import('monaco-editor');

export class TabManager {
  private state: AppState;
  private fileSystem: FileSystemManager;

  constructor(state: AppState, fileSystem: FileSystemManager) {
    this.state = state;
    this.fileSystem = fileSystem;
  }

  async openFile(filePath: string): Promise<void> {
    try {
      console.log('📄 Opening file:', filePath);
      
      if (this.state.openTabs.has(filePath)) {
        console.log('📄 File already open, switching to tab');
        this.switchToTab(filePath);
        return;
      }

      const content = await this.fileSystem.readFile(filePath);
      console.log('📄 File content loaded, length:', content.length);
      
      const fileName = filePath.split('/').pop() || filePath;
      const extension = fileName.split('.').pop() || '';
      const language = this.fileSystem.getLanguageFromExtension(extension);

      const tab: OpenTab = {
        path: filePath,
        name: fileName,
        content,
        language,
        isDirty: false
      };

      this.state.openTabs.set(filePath, tab);
      this.switchToTab(filePath);
      this.renderTabs();
      
      console.log('📄 File opened successfully:', fileName);
    } catch (error) {
      console.error('❌ Failed to open file:', error);
      alert(`Failed to open file: ${error}`);
    }
  }

  closeTab(filePath: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    this.state.openTabs.delete(filePath);

    if (this.state.activeTabPath === filePath) {
      const remainingTabs = Array.from(this.state.openTabs.keys());
      if (remainingTabs.length > 0) {
        this.switchToTab(remainingTabs[remainingTabs.length - 1]);
      } else {
        this.state.activeTabPath = '';
        this.state.currentFile = '';
        if (this.state.monacoEditor) {
          this.state.monacoEditor.setValue('');
        }
      }
    }

    this.renderTabs();
  }

  switchToTab(filePath: string): void {
    const tab = this.state.openTabs.get(filePath);
    if (!tab) {
      console.error('❌ Tab not found:', filePath);
      return;
    }

    // Sync current content before switching if we have an active tab
    if (this.state.activeTabPath && this.state.monacoEditor) {
      const currentTab = this.state.openTabs.get(this.state.activeTabPath);
      if (currentTab) {
        const currentContent = this.state.monacoEditor.getValue();
        currentTab.content = currentContent;
        console.log('🔄 Content synced before tab switch for:', this.state.activeTabPath);
      }
    }

    console.log('📄 Switching to tab:', tab.name);
    
    this.state.activeTabPath = filePath;
    this.state.currentFile = filePath;

    if (this.state.monacoEditor) {
      // Enhanced language detection - aggressive TypeScript detection
      const getMonacoLanguage = (fileName: string, content: string): string => {
        const extension = fileName.split('.').pop()?.toLowerCase() || '';
        
        // Always use TypeScript for JS/TS/JSX/TSX files for maximum feature support
        const tsExtensions = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'];
        if (tsExtensions.includes(extension)) {
          return 'typescript';
        }
        
        // Other language mapping
        const languageMap: { [key: string]: string } = {
          'json': 'json',
          'css': 'css',
          'scss': 'scss',
          'less': 'less',
          'html': 'html',
          'htm': 'html',
          'xml': 'xml',
          'md': 'markdown',
          'py': 'python',
          'java': 'java',
          'cpp': 'cpp',
          'c': 'c',
          'php': 'php',
          'rb': 'ruby',
          'go': 'go',
          'rs': 'rust',
          'sh': 'shell',
          'bash': 'shell',
          'yml': 'yaml',
          'yaml': 'yaml'
        };
        
        // Enhanced content-based TypeScript detection
        const tsFeatures = [
          'interface ', 'type ', 'enum ', 'namespace ', 'declare ',
          'satisfies', 'as const', 'as any', 'as unknown',
          ': string', ': number', ': boolean', ': object',
          'implements ', 'extends ', 'abstract ', 'readonly ',
          'public ', 'private ', 'protected ', 'static ',
          'import type', 'export type', 'keyof ', 'typeof ',
          'React.', 'JSX.', '</', 'useState', 'useEffect',
          'Props', 'Component', 'FC<', 'FunctionComponent'
        ];
        
        if (tsFeatures.some(feature => content.includes(feature))) {
          return 'typescript';
        }
        
        return languageMap[extension] || 'typescript'; // Default to TypeScript for better support
      };

      const monacoLanguage = getMonacoLanguage(tab.name, tab.content);
      
      // Set the content first
      this.state.monacoEditor.setValue(tab.content);
      
      // Then set the language
      if (window.monaco) {
        const model = this.state.monacoEditor.getModel();
        if (model) {
          window.monaco.editor.setModelLanguage(model, monacoLanguage);
          console.log('📄 Set language to:', monacoLanguage, 'for file:', tab.name);
        }
      }
      
      // Expose Monaco editor globally after content change
      if (this.state.monacoEditor) {
        (window as any).monacoEditor = this.state.monacoEditor;
      }
      
      // Dispatch event for problems manager
      const event = new CustomEvent('tab-changed', {
        detail: { filePath, tab }
      });
      document.dispatchEvent(event);

      if (this.state.monacoEditor && window.monaco) {
        // Trigger ESLint check for the newly opened file
        const model = this.state.monacoEditor.getModel();
        if (model && (window as any).monacoEditorManager) {
          // Call ESLint check if available
          setTimeout(() => {
            const editorManager = (window as any).monacoEditorManager;
            if (editorManager && editorManager.runESLintOnModel) {
              editorManager.runESLintOnModel(model);
            }
          }, 100);
        }
      }
    } else {
      console.warn('⚠️ Monaco editor not available');
    }

    this.updateActiveTabStyling();
  }

  renderTabs(): void {
    const tabContainer = document.querySelector('.tab-bar');
    if (!tabContainer) {
      console.error('❌ Tab container not found');
      return;
    }

    tabContainer.innerHTML = '';

    this.state.openTabs.forEach((tab, filePath) => {
      const tabElement = document.createElement('div');
      const isActive = this.state.activeTabPath === filePath;
      
      tabElement.className = `
        group relative flex items-center h-10 px-4 cursor-pointer text-sm max-w-56
        transition-all duration-300 ease-out
        ${isActive 
          ? 'bg-white/95 text-gray-800 shadow-lg border border-gray-200 z-20' 
          : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/60 hover:text-gray-100 border border-gray-700/50 hover:border-gray-600'
        }
        rounded-lg mx-1 transform hover:scale-105 hover:-translate-y-0.5
        ${isActive ? 'scale-105 -translate-y-0.5' : ''}
        before:absolute before:inset-x-0 before:bottom-0 before:h-0.5 before:rounded-full
        ${isActive 
          ? 'before:bg-gradient-to-r before:from-blue-400 before:to-purple-500' 
          : 'before:bg-transparent group-hover:before:bg-gray-600'
        }
      `;
      
      const icon = document.createElement('span');
      icon.className = `
        mr-3 text-sm transition-all duration-200
        ${isActive ? 'opacity-80 scale-110' : 'opacity-60 group-hover:opacity-90 group-hover:scale-105'}
      `;
      const extension = tab.name.split('.').pop() || '';
      icon.textContent = this.fileSystem.getFileIcon(extension);
      
      const name = document.createElement('span');
      name.className = `
        flex-1 overflow-hidden text-ellipsis whitespace-nowrap 
        font-medium transition-all duration-200
        ${isActive ? 'font-semibold text-gray-800' : 'text-gray-300 group-hover:text-gray-100'}
      `;
      name.textContent = tab.name;
      
      const closeBtn = document.createElement('button');
      closeBtn.className = `
        ml-3 w-5 h-5 rounded-md
        opacity-0 group-hover:opacity-100 transition-all duration-200
        flex items-center justify-center
        hover:bg-red-500/20 hover:text-red-500 hover:scale-110
        active:scale-95
        ${isActive ? 'opacity-60 text-gray-600' : 'text-gray-400'}
      `;
      closeBtn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      `;
      closeBtn.onclick = (e) => this.closeTab(filePath, e);
      
      tabElement.appendChild(icon);
      tabElement.appendChild(name);
      tabElement.appendChild(closeBtn);
      
      tabElement.onclick = () => this.switchToTab(filePath);
      
      tabContainer.appendChild(tabElement);
    });
    
    // Update tab bar styling
    tabContainer.className = 'tab-bar relative bg-gray-900/80 border-b border-gray-700/50 px-2 py-1';
  }

  private updateActiveTabStyling(): void {
    const tabs = document.querySelectorAll('.tab-bar > div');
    tabs.forEach((tab, index) => {
      const filePath = Array.from(this.state.openTabs.keys())[index];
      const isActive = filePath === this.state.activeTabPath;
      
      tab.className = `
        group relative flex items-center h-10 px-4 cursor-pointer text-sm max-w-56
        transition-all duration-300 ease-out
        ${isActive 
          ? 'bg-white/95 text-gray-800 shadow-lg border border-gray-200 z-20' 
          : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/60 hover:text-gray-100 border border-gray-700/50 hover:border-gray-600'
        }
        rounded-lg mx-1 transform hover:scale-105 hover:-translate-y-0.5
        ${isActive ? 'scale-105 -translate-y-0.5' : ''}
        before:absolute before:inset-x-0 before:bottom-0 before:h-0.5 before:rounded-full
        ${isActive 
          ? 'before:bg-gradient-to-r before:from-blue-400 before:to-purple-500' 
          : 'before:bg-transparent group-hover:before:bg-gray-600'
        }
      `;
      
      // Update child element styling
      const icon = tab.querySelector('span:first-child');
      const name = tab.querySelector('span:nth-child(2)');
      const closeBtn = tab.querySelector('button');
      
      if (icon) {
        icon.className = `
          mr-3 text-sm transition-all duration-200
          ${isActive ? 'opacity-80 scale-110' : 'opacity-60 group-hover:opacity-90 group-hover:scale-105'}
        `;
      }
      
      if (name) {
        name.className = `
          flex-1 overflow-hidden text-ellipsis whitespace-nowrap 
          font-medium transition-all duration-200
          ${isActive ? 'font-semibold text-gray-800' : 'text-gray-300 group-hover:text-gray-100'}
        `;
      }
      
      if (closeBtn) {
        closeBtn.className = `
          ml-3 w-5 h-5 rounded-md
          opacity-0 group-hover:opacity-100 transition-all duration-200
          flex items-center justify-center
          hover:bg-red-500/20 hover:text-red-500 hover:scale-110
          active:scale-95
          ${isActive ? 'opacity-60 text-gray-600' : 'text-gray-400'}
        `;
      }
    });
  }

  markTabAsDirty(filePath: string): void {
    const tab = this.state.openTabs.get(filePath);
    if (tab) {
      tab.isDirty = true;
    }
  }

  markTabAsClean(filePath: string): void {
    const tab = this.state.openTabs.get(filePath);
    if (tab && this.state.monacoEditor && this.state.activeTabPath === filePath) {
      // Ensure content is synced when marking as clean
      const currentContent = this.state.monacoEditor.getValue();
      tab.content = currentContent;
      tab.isDirty = false;
    } else if (tab) {
      tab.isDirty = false;
    }
    
    // Notify git manager about the file save
    const gitManager = (window as any).gitManager;
    if (gitManager) {
      gitManager.handleFileSave(filePath);
    }
    
    // Dispatch file-saved event
    const event = new CustomEvent('file-saved', { detail: { filePath } });
    document.dispatchEvent(event);
  }
}
