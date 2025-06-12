import { FileItem } from '../types/index.js';

export interface AttachedFile {
  path: string;
  name: string;
  content: string;
  language: string;
  size: number;
}

export interface FilePickerOptions {
  allowMultiple: boolean;
  fileTypes?: string[];
  maxFiles?: number;
}

export interface FilePickerCallbacks {
  onFilesSelected: (files: Map<string, AttachedFile>) => void;
  onFileRemoved: (filePath: string) => void;
  onAllFilesCleared: () => void;
}

export class FilePicker {
  private electronAPI: any;
  private availableFiles: FileItem[] = [];
  private selectedFiles: Map<string, AttachedFile> = new Map();
  private callbacks: FilePickerCallbacks;
  private options: FilePickerOptions;
  private isVisible = false;

  constructor(callbacks: FilePickerCallbacks, options: FilePickerOptions = { allowMultiple: true }) {
    this.callbacks = callbacks;
    this.options = options;
    this.electronAPI = (window as any).electronAPI;
  }

  public async show(): Promise<void> {
    if (this.isVisible) return;
    
    this.isVisible = true;
    this.createModal();
    this.injectStyles();
    
    // Load files after modal is created
    await this.loadAvailableFiles();
    this.renderFileTree();
    this.setupEventListeners();
    
    console.log('🔧 FilePicker shown, loaded', this.availableFiles.length, 'files');
  }

  public hide(): void {
    if (!this.isVisible) return;
    
    this.isVisible = false;
    const modal = document.getElementById('file-picker-modal');
    if (modal) {
      modal.remove();
    }
    
    // Clear selection when hiding
    this.selectedFiles.clear();
  }

  public getSelectedFiles(): Map<string, AttachedFile> {
    return new Map(this.selectedFiles);
  }

  public clearSelection(): void {
    this.selectedFiles.clear();
    this.updateFileElements();
    this.updateSelectedCount();
  }

  private createModal(): void {
    // Remove existing modal if any
    const existingModal = document.getElementById('file-picker-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'file-picker-modal';
    modal.className = 'file-picker-modal';
    
    modal.innerHTML = `
      <div class="file-picker-overlay" data-action="close"></div>
      <div class="file-picker-content">
        <div class="file-picker-header">
          <h3>Select Files</h3>
          <button class="file-picker-close" data-action="close">×</button>
        </div>
        
        <div class="file-picker-search">
          <input 
            type="text" 
            id="file-search-input" 
            placeholder="Search files..." 
            class="file-search-input"
          />
          <div class="file-filters">
            <button class="filter-btn active" data-filter="all">All</button>
            <button class="filter-btn" data-filter="js">JS/TS</button>
            <button class="filter-btn" data-filter="css">CSS</button>
            <button class="filter-btn" data-filter="html">HTML</button>
            <button class="filter-btn" data-filter="json">JSON</button>
            <button class="filter-btn" data-filter="md">Markdown</button>
          </div>
        </div>
        
        <div class="file-picker-tree-container">
          <div id="file-picker-tree" class="file-picker-tree">
            <div class="loading-files">Loading files...</div>
          </div>
        </div>
        
        <div class="file-picker-footer">
          <div id="selected-files-count" class="selected-count">0 files selected</div>
          <div class="file-picker-actions">
            <button class="file-picker-cancel" data-action="close">Cancel</button>
            <button class="file-picker-attach" data-action="attach">Attach Files</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  private async loadAvailableFiles(): Promise<void> {
    try {
      console.log('🔧 Loading files...');
      
      // Try to get files from the app's file system manager
      const app = (window as any).app;
      if (app && app.fileSystem) {
        const files = app.fileSystem.getFileTree();
        this.availableFiles = files || [];
        console.log('📁 Loaded from app fileSystem:', this.availableFiles.length, 'files');
      } else if (this.electronAPI && this.electronAPI.getFileTree) {
        // Fallback to electronAPI
        const files = await this.electronAPI.getFileTree();
        this.availableFiles = files || [];
        console.log('📁 Loaded from electronAPI:', this.availableFiles.length, 'files');
      } else {
        console.error('❌ No file source available');
        this.availableFiles = [];
      }
    } catch (error) {
      console.error('❌ Failed to load files:', error);
      this.availableFiles = [];
    }
  }

  private renderFileTree(): void {
    const container = document.getElementById('file-picker-tree');
    if (!container) return;

    if (this.availableFiles.length === 0) {
      container.innerHTML = '<div class="no-files">No files found in project</div>';
      return;
    }

    container.innerHTML = '';
    this.renderFileItems(this.availableFiles, container, 0);
    console.log('🎨 Rendered file tree with', this.availableFiles.length, 'items');
  }

  private renderFileItems(items: FileItem[], container: HTMLElement, depth: number): void {
    items.forEach(item => {
      if (item.type === 'file') {
        const fileElement = this.createFileElement(item, depth);
        container.appendChild(fileElement);
      } else if (item.type === 'directory') {
        const dirElement = this.createDirectoryElement(item, depth);
        container.appendChild(dirElement);
        
        // Render children if expanded and they exist
        if (item.isExpanded && item.children && item.children.length > 0) {
          this.renderFileItems(item.children, container, depth + 1);
        }
      }
    });
  }

  private createFileElement(item: FileItem, depth: number): HTMLElement {
    const element = document.createElement('div');
    const isSelected = this.selectedFiles.has(item.path);
    
    element.className = `file-picker-item file-item ${isSelected ? 'selected' : ''}`;
    element.style.paddingLeft = `${depth * 1.5 + 0.5}rem`;
    element.setAttribute('data-path', item.path);
    element.setAttribute('data-type', 'file');

    const extension = item.name.split('.').pop() || '';
    const icon = this.getFileIcon(extension);

    element.innerHTML = `
      <div class="file-picker-item-content">
        <input type="checkbox" class="file-checkbox" ${isSelected ? 'checked' : ''} />
        <span class="file-icon">${icon}</span>
        <span class="file-name">${item.name}</span>
      </div>
    `;

    return element;
  }

  private createDirectoryElement(item: FileItem, depth: number): HTMLElement {
    const element = document.createElement('div');
    element.className = 'file-picker-item directory-item';
    element.style.paddingLeft = `${depth * 1.5 + 0.5}rem`;
    element.setAttribute('data-path', item.path);
    element.setAttribute('data-type', 'directory');

    const expandIcon = item.isExpanded ? '📂' : '📁';
    
    element.innerHTML = `
      <div class="file-picker-item-content">
        <span class="expand-icon">${expandIcon}</span>
        <span class="dir-name">${item.name}</span>
      </div>
    `;

    return element;
  }

  private setupEventListeners(): void {
    const modal = document.getElementById('file-picker-modal');
    if (!modal) return;

    // Modal click handler
    modal.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      const action = target.getAttribute('data-action');
      
      if (action === 'close') {
        this.hide();
        return;
      }
      
      if (action === 'attach') {
        this.attachSelectedFiles();
        return;
      }

      // Handle overlay click
      if (target.classList.contains('file-picker-overlay')) {
        this.hide();
        return;
      }

      // Handle file item clicks
      const fileItem = target.closest('.file-picker-item') as HTMLElement;
      if (fileItem) {
        const path = fileItem.getAttribute('data-path');
        const type = fileItem.getAttribute('data-type');
        
        if (type === 'file' && path) {
          this.toggleFileSelection(path);
        } else if (type === 'directory' && path) {
          this.toggleDirectory(path);
        }
      }
    });

    // Search functionality
    const searchInput = document.getElementById('file-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e: Event) => {
        const input = e.target as HTMLInputElement;
        this.filterFiles(input.value);
      });
    }

    // Filter buttons
    const filterBtns = modal.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        const filter = target.getAttribute('data-filter') || 'all';
        
        // Update active filter
        filterBtns.forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        
        this.filterFilesByType(filter);
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.isVisible) return;
      
      if (e.key === 'Escape') {
        this.hide();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        this.attachSelectedFiles();
      }
    });
  }

  private async toggleDirectory(path: string): Promise<void> {
    // Try to get the file system manager to toggle the directory
    const app = (window as any).app;
    if (app && app.fileSystem) {
      const item = this.findItemByPath(this.availableFiles, path);
      if (item) {
        try {
          await app.fileSystem.toggleDirectory(item);
          this.availableFiles = app.fileSystem.getFileTree();
          this.renderFileTree();
        } catch (error) {
          console.error('Failed to toggle directory:', error);
        }
      }
    }
  }

  private findItemByPath(items: FileItem[], path: string): FileItem | null {
    for (const item of items) {
      if (item.path === path) {
        return item;
      }
      if (item.children) {
        const found = this.findItemByPath(item.children, path);
        if (found) return found;
      }
    }
    return null;
  }

  private async toggleFileSelection(filePath: string): Promise<void> {
    if (this.selectedFiles.has(filePath)) {
      this.selectedFiles.delete(filePath);
    } else {
      if (!this.options.allowMultiple && this.selectedFiles.size >= 1) {
        this.selectedFiles.clear();
      }
      
      if (this.options.maxFiles && this.selectedFiles.size >= this.options.maxFiles) {
        this.showError(`Maximum ${this.options.maxFiles} files allowed`);
        return;
      }
      
      await this.addFileToSelection(filePath);
    }
    
    this.updateSelectedCount();
    this.updateFileElements();
  }

  private async addFileToSelection(filePath: string): Promise<void> {
    try {
      const content = await this.electronAPI.readFile(filePath);
      const fileName = filePath.split('/').pop() || filePath;
      const extension = fileName.split('.').pop() || '';
      const language = this.getLanguageFromExtension(extension);
      
      const attachedFile: AttachedFile = {
        path: filePath,
        name: fileName,
        content,
        language,
        size: content.length
      };
      
      this.selectedFiles.set(filePath, attachedFile);
      console.log('📎 Added file to selection:', fileName);
    } catch (error) {
      console.error('Failed to read file:', error);
      this.showError(`Failed to read file: ${filePath}`);
    }
  }

  private updateSelectedCount(): void {
    const countElement = document.getElementById('selected-files-count');
    if (countElement) {
      const count = this.selectedFiles.size;
      countElement.textContent = `${count} file${count !== 1 ? 's' : ''} selected`;
    }
  }

  private updateFileElements(): void {
    const fileItems = document.querySelectorAll('.file-picker-item.file-item');
    fileItems.forEach(item => {
      const path = item.getAttribute('data-path');
      const checkbox = item.querySelector('.file-checkbox') as HTMLInputElement;
      
      if (path && checkbox) {
        const isSelected = this.selectedFiles.has(path);
        checkbox.checked = isSelected;
        if (isSelected) {
          item.classList.add('selected');
        } else {
          item.classList.remove('selected');
        }
      }
    });
  }

  private attachSelectedFiles(): void {
    if (this.selectedFiles.size === 0) {
      this.showError('No files selected');
      return;
    }

    console.log('📎 Attaching', this.selectedFiles.size, 'files');
    this.callbacks.onFilesSelected(new Map(this.selectedFiles));
    this.hide();
  }

  private filterFiles(searchTerm: string): void {
    const items = document.querySelectorAll('.file-picker-item');
    const term = searchTerm.toLowerCase();
    
    items.forEach(item => {
      const name = item.querySelector('.file-name, .dir-name')?.textContent?.toLowerCase() || '';
      const shouldShow = !term || name.includes(term);
      (item as HTMLElement).style.display = shouldShow ? 'block' : 'none';
    });
  }

  private filterFilesByType(filter: string): void {
    const items = document.querySelectorAll('.file-picker-item.file-item');
    
    items.forEach(item => {
      const fileName = item.querySelector('.file-name')?.textContent || '';
      const extension = fileName.split('.').pop()?.toLowerCase() || '';
      
      let shouldShow = filter === 'all';
      
      if (!shouldShow) {
        switch (filter) {
          case 'js':
            shouldShow = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(extension);
            break;
          case 'css':
            shouldShow = ['css', 'scss', 'less', 'sass'].includes(extension);
            break;
          case 'html':
            shouldShow = ['html', 'htm', 'xml'].includes(extension);
            break;
          case 'json':
            shouldShow = ['json', 'jsonc'].includes(extension);
            break;
          case 'md':
            shouldShow = ['md', 'markdown', 'mdx'].includes(extension);
            break;
        }
      }
      
      (item as HTMLElement).style.display = shouldShow ? 'block' : 'none';
    });
  }

  private getFileIcon(extension: string): string {
    const iconMap: { [key: string]: string } = {
      'js': '🟨', 'jsx': '⚛️', 'ts': '🔵', 'tsx': '⚛️',
      'html': '🌐', 'css': '🎨', 'scss': '🎨', 'less': '🎨',
      'json': '📋', 'md': '📝', 'txt': '📄', 'py': '🐍',
      'java': '☕', 'cpp': '⚙️', 'c': '⚙️', 'php': '🐘',
      'rb': '💎', 'go': '🐹', 'rs': '🦀', 'swift': '🦉'
    };
    return iconMap[extension.toLowerCase()] || '📄';
  }

  private getLanguageFromExtension(extension: string): string {
    const languageMap: { [key: string]: string } = {
      'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
      'py': 'python', 'java': 'java', 'cpp': 'cpp', 'c': 'c', 'cs': 'csharp',
      'php': 'php', 'rb': 'ruby', 'go': 'go', 'rs': 'rust', 'swift': 'swift',
      'html': 'html', 'css': 'css', 'scss': 'scss', 'json': 'json',
      'md': 'markdown', 'sh': 'shell', 'bash': 'shell'
    };
    return languageMap[extension.toLowerCase()] || 'text';
  }

  private showError(message: string): void {
    console.error('FilePicker Error:', message);
    // Create a simple error notification
    const notification = document.createElement('div');
    notification.className = 'file-picker-error';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; 
      background: #ef4444; color: white; 
      padding: 12px 16px; border-radius: 6px; 
      z-index: 10002; font-size: 14px;
      animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  private injectStyles(): void {
    const existingStyle = document.getElementById('file-picker-styles');
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = 'file-picker-styles';
    style.textContent = `
      /* File Picker Modal */
      .file-picker-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease-out;
      }

      .file-picker-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        cursor: pointer;
      }

      .file-picker-content {
        background: #1a1a1a;
        border: 1px solid #404040;
        border-radius: 12px;
        width: 90%;
        max-width: 700px;
        max-height: 80%;
        display: flex;
        flex-direction: column;
        z-index: 10001;
        animation: slideIn 0.3s ease-out;
      }

      .file-picker-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #404040;
      }

      .file-picker-header h3 {
        margin: 0;
        color: #e4e4e7;
        font-size: 1.125rem;
        font-weight: 600;
      }

      .file-picker-close {
        background: none;
        border: none;
        color: #71717a;
        cursor: pointer;
        font-size: 1.5rem;
        padding: 0;
        width: 2rem;
        height: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s;
      }

      .file-picker-close:hover {
        background: #374151;
        color: #e4e4e7;
      }

      .file-picker-search {
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #404040;
      }

      .file-search-input {
        width: 100%;
        background: #262626;
        border: 1px solid #404040;
        border-radius: 6px;
        padding: 0.5rem 0.75rem;
        color: #e4e4e7;
        font-size: 0.875rem;
        margin-bottom: 0.75rem;
      }

      .file-search-input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 1px #3b82f6;
      }

      .file-filters {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .filter-btn {
        background: #262626;
        border: 1px solid #404040;
        color: #71717a;
        padding: 0.25rem 0.75rem;
        border-radius: 4px;
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .filter-btn:hover {
        background: #374151;
        color: #e4e4e7;
      }

      .filter-btn.active {
        background: #3b82f6;
        border-color: #3b82f6;
        color: white;
      }

      .file-picker-tree-container {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
      }

      .file-picker-tree {
        padding: 0.5rem;
      }

      .file-picker-item {
        display: flex;
        align-items: center;
        padding: 0.375rem 0;
        cursor: pointer;
        border-radius: 4px;
        transition: background 0.15s;
        min-height: 2rem;
      }

      .file-picker-item:hover {
        background: #262626;
      }

      .file-picker-item.selected {
        background: rgba(59, 130, 246, 0.15);
        border: 1px solid rgba(59, 130, 246, 0.3);
      }

      .file-picker-item-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
      }

      .file-checkbox {
        accent-color: #3b82f6;
        margin: 0;
      }

      .file-icon,
      .expand-icon {
        font-size: 1rem;
        width: 1.25rem;
        text-align: center;
      }

      .file-name,
      .dir-name {
        color: #d4d4d8;
        font-size: 0.875rem;
        font-family: 'Monaco', 'Consolas', monospace;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .directory-item .dir-name {
        color: #60a5fa;
        font-weight: 500;
      }

      .file-picker-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        border-top: 1px solid #404040;
      }

      .selected-count {
        color: #71717a;
        font-size: 0.875rem;
      }

      .file-picker-actions {
        display: flex;
        gap: 0.75rem;
      }

      .file-picker-cancel,
      .file-picker-attach {
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .file-picker-cancel {
        background: transparent;
        border: 1px solid #404040;
        color: #71717a;
      }

      .file-picker-cancel:hover {
        background: #374151;
        color: #e4e4e7;
      }

      .file-picker-attach {
        background: #3b82f6;
        border: 1px solid #3b82f6;
        color: white;
      }

      .file-picker-attach:hover {
        background: #2563eb;
        border-color: #2563eb;
      }

      .loading-files,
      .no-files {
        text-align: center;
        color: #71717a;
        padding: 2rem;
        font-style: italic;
      }

      /* Animations */
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideIn {
        from { transform: scale(0.9) translateY(-20px); opacity: 0; }
        to { transform: scale(1) translateY(0); opacity: 1; }
      }

      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }

      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    
    document.head.appendChild(style);
  }

  public dispose(): void {
    this.hide();
    const style = document.getElementById('file-picker-styles');
    if (style) style.remove();
  }
}
