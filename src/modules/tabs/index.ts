import { OpenTab, AppState } from '../types';
import { FileSystemManager } from '../fileSystem';

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
      if (this.state.openTabs.has(filePath)) {
        this.switchToTab(filePath);
        return;
      }

      const content = await this.fileSystem.readFile(filePath);
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
    } catch (error) {
      console.error('Failed to open file:', error);
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
    if (!tab) return;

    this.state.activeTabPath = filePath;
    this.state.currentFile = filePath;

    if (this.state.monacoEditor) {
      this.state.monacoEditor.setValue(tab.content);
      const model = this.state.monacoEditor.getModel();
      if (model && monaco) {
        monaco.editor.setModelLanguage(model, tab.language);
      }
    }

    this.updateActiveTabStyling();
  }

  renderTabs(): void {
    const tabContainer = document.querySelector('.tab-bar');
    if (!tabContainer) return;

    tabContainer.innerHTML = '';

    this.state.openTabs.forEach((tab, filePath) => {
      const tabElement = document.createElement('div');
      tabElement.className = `
        flex items-center px-3 py-2 bg-gray-800 border border-gray-600 
        border-b-0 mr-1 cursor-pointer text-sm text-gray-300 max-w-48
        hover:bg-gray-700 transition-colors
        ${this.state.activeTabPath === filePath ? 'bg-gray-900 border-blue-500 border-b-2' : ''}
      `;
      
      const icon = document.createElement('span');
      icon.className = 'mr-2 text-xs';
      const extension = tab.name.split('.').pop() || '';
      icon.textContent = this.fileSystem.getFileIcon(extension);
      
      const name = document.createElement('span');
      name.className = 'flex-1 overflow-hidden text-ellipsis whitespace-nowrap';
      name.textContent = tab.name;
      
      const closeBtn = document.createElement('button');
      closeBtn.className = `
        ml-2 px-1 rounded text-gray-400 hover:bg-gray-600 hover:text-white
        opacity-60 hover:opacity-100 transition-all
      `;
      closeBtn.innerHTML = '×';
      closeBtn.onclick = (e) => this.closeTab(filePath, e);
      
      tabElement.appendChild(icon);
      tabElement.appendChild(name);
      tabElement.appendChild(closeBtn);
      
      tabElement.onclick = () => this.switchToTab(filePath);
      
      tabContainer.appendChild(tabElement);
    });
  }

  private updateActiveTabStyling(): void {
    const tabs = document.querySelectorAll('.tab-bar > div');
    tabs.forEach((tab, index) => {
      const filePath = Array.from(this.state.openTabs.keys())[index];
      if (filePath === this.state.activeTabPath) {
        tab.classList.add('bg-gray-900', 'border-blue-500', 'border-b-2');
        tab.classList.remove('bg-gray-800');
      } else {
        tab.classList.remove('bg-gray-900', 'border-blue-500', 'border-b-2');
        tab.classList.add('bg-gray-800');
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
    if (tab) {
      tab.isDirty = false;
    }
  }
}
