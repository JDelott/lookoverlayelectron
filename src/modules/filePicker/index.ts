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
    this.electronAPI = (window as any).electronAPI;
    this.callbacks = callbacks;
    this.options = options;
    this.injectStyles();
    this.createModal();
  }

  public async show(): Promise<void> {
    const modal = document.getElementById('file-picker-modal');
    if (!modal) return;

    this.isVisible = true;
    modal.style.display = 'flex';
    await this.loadAvailableFiles();
    this.renderFileTree();
    this.setupEventListeners();
    
    // Focus search input
    const searchInput = document.getElementById('file-search-input') as HTMLInputElement;
    if (searchInput) {
      setTimeout(() => searchInput.focus(), 100);
    }
  }

  public hide(): void {
    const modal = document.getElementById('file-picker-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    
    this.isVisible = false;
    this.clearSearch();
    this.resetFilters();
  }

  public getSelectedFiles(): Map<string, AttachedFile> {
    return new Map(this.selectedFiles);
  }

  public clearSelection(): void {
    this.selectedFiles.clear();
    this.updateSelectedCount();
    this.updateFileElements();
  }

  private createModal(): void {
    // Remove existing modal if present
    const existingModal = document.getElementById('file-picker-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'file-picker-modal';
    modal.className = 'file-picker-modal';
    modal.style.display = 'none';

    modal.innerHTML = `
      <div class="file-picker-overlay"></div>
      <div class="file-picker-content">
        <div class="file-picker-header">
          <h3>Select Files to Attach</h3>
          <button class="close-btn" data-action="close">✕</button>
        </div>
        
        <div class="file-picker-search">
          <div class="search-input-container">
            <input type="text" id="file-search-input" placeholder="Search files..." />
            <span class="search-icon">🔍</span>
          </div>
          <div class="file-picker-filters">
            <button class="filter-btn active" data-filter="all">All Files</button>
            <button class="filter-btn" data-filter="js">JS/TS</button>
            <button class="filter-btn" data-filter="css">CSS</button>
            <button class="filter-btn" data-filter="html">HTML</button>
            <button class="filter-btn" data-filter="json">JSON</button>
            <button class="filter-btn" data-filter="md">Markdown</button>
          </div>
        </div>
        
        <div class="file-picker-body">
          <div class="file-picker-tree" id="file-picker-tree">
            <div class="file-picker-loading">Loading files...</div>
          </div>
        </div>
        
        <div class="file-picker-footer">
          <div class="selected-count">
            <span id="selected-files-count">0 files selected</span>
          </div>
          <div class="file-picker-actions">
            <button class="btn-secondary" data-action="close">Cancel</button>
            <button class="btn-primary" data-action="attach">Attach Files</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  private async loadAvailableFiles(): Promise<void> {
    try {
      const fileSystem = (window as any).app?.fileSystemManager;
      if (fileSystem) {
        this.availableFiles = fileSystem.getFileTree();
      } else {
        // Fallback: get from electronAPI
        const files = await this.electronAPI.getFileTree();
        this.availableFiles = files || [];
      }
    } catch (error) {
      console.error('Failed to load available files:', error);
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
  }

  private renderFileItems(items: FileItem[], container: HTMLElement, depth: number): void {
    items.forEach(item => {
      if (item.type === 'file') {
        const fileElement = this.createFileElement(item, depth);
        container.appendChild(fileElement);
      } else if (item.type === 'directory' && item.children) {
        const dirElement = this.createDirectoryElement(item, depth);
        container.appendChild(dirElement);
        
        if (item.isExpanded) {
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
        <span class="file-size"></span>
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

    // Remove existing listeners
    modal.removeEventListener('click', this.handleModalClick);
    
    // Add click handler
    modal.addEventListener('click', this.handleModalClick.bind(this));

    // Search functionality
    const searchInput = document.getElementById('file-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.removeEventListener('input', this.handleSearch);
      searchInput.addEventListener('input', this.handleSearch.bind(this));
    }

    // Filter buttons
    const filterBtns = modal.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.removeEventListener('click', this.handleFilterClick);
      btn.addEventListener('click', this.handleFilterClick.bind(this));
    });

    // Keyboard shortcuts
    document.removeEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleModalClick = (e: Event): void => {
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
  };

  private handleSearch = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.filterFiles(input.value);
    }, 300);
  };

  private searchTimeout: NodeJS.Timeout | null = null;

  private handleFilterClick = (e: Event): void => {
    const btn = e.target as HTMLElement;
    const filter = btn.getAttribute('data-filter') || 'all';
    
    // Update active filter
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    this.filterFilesByType(filter);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.isVisible) return;
    
    if (e.key === 'Escape') {
      this.hide();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      this.attachSelectedFiles();
    }
  };

  private async toggleDirectory(path: string): Promise<void> {
    const fileSystem = (window as any).app?.fileSystemManager;
    if (fileSystem) {
      const item = this.findItemByPath(this.availableFiles, path);
      if (item) {
        await fileSystem.toggleDirectory(item);
        this.availableFiles = fileSystem.getFileTree();
        this.renderFileTree();
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

  private clearSearch(): void {
    const searchInput = document.getElementById('file-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = '';
    }
    this.filterFiles('');
  }

  private resetFilters(): void {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => btn.classList.remove('active'));
    const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
    if (allBtn) allBtn.classList.add('active');
    this.filterFilesByType('all');
  }

  private getFileIcon(extension: string): string {
    const iconMap: { [key: string]: string } = {
      'js': '📄', 'jsx': '⚛️', 'ts': '📘', 'tsx': '⚛️',
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
    console.error(message);
    // You can implement a toast notification here
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
        max-width: 800px;
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
        font-size: 1.1rem;
        font-weight: 600;
      }

      .close-btn {
        background: none;
        border: none;
        color: #71717a;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 0.25rem;
        transition: all 0.2s;
      }

      .close-btn:hover {
        background: #374151;
        color: #e4e4e7;
      }

      .file-picker-search {
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #404040;
      }

      .search-input-container {
        position: relative;
        margin-bottom: 1rem;
      }

      .search-input-container input {
        width: 100%;
        background: #262626;
        border: 1px solid #404040;
        border-radius: 0.5rem;
        padding: 0.75rem 2.5rem 0.75rem 1rem;
        color: #e4e4e7;
        font-size: 0.875rem;
        outline: none;
        transition: all 0.2s;
        box-sizing: border-box;
      }

      .search-input-container input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
      }

      .search-icon {
        position: absolute;
        right: 0.75rem;
        top: 50%;
        transform: translateY(-50%);
        color: #71717a;
        font-size: 0.875rem;
      }

      .file-picker-filters {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .filter-btn {
        background: #262626;
        border: 1px solid #404040;
        color: #d4d4d8;
        padding: 0.5rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .filter-btn:hover {
        border-color: #60a5fa;
        color: #60a5fa;
      }

      .filter-btn.active {
        background: #3b82f6;
        border-color: #3b82f6;
        color: white;
      }

      .file-picker-body {
        flex: 1;
        overflow-y: auto;
        padding: 1rem 0;
      }

      .file-picker-tree {
        padding: 0 1.5rem;
      }

      .file-picker-loading {
        text-align: center;
        color: #71717a;
        padding: 2rem;
      }

      .no-files {
        text-align: center;
        color: #71717a;
        padding: 2rem;
        font-style: italic;
      }

      .file-picker-item {
        display: flex;
        align-items: center;
        padding: 0.5rem 0;
        cursor: pointer;
        border-radius: 0.375rem;
        margin: 0.125rem 0;
        transition: all 0.2s;
      }

      .file-picker-item:hover {
        background: #262626;
      }

      .file-picker-item.selected {
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid #3b82f6;
      }

      .file-picker-item-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
      }

      .file-checkbox {
        width: 1rem;
        height: 1rem;
        accent-color: #3b82f6;
      }

      .file-icon {
        font-size: 0.875rem;
      }

      .file-name, .dir-name {
        flex: 1;
        font-size: 0.875rem;
        color: #d4d4d8;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
      }

      .file-size {
        color: #71717a;
        font-size: 0.75rem;
      }

      .expand-icon {
        font-size: 0.875rem;
        margin-right: 0.25rem;
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

      .btn-secondary, .btn-primary {
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }

      .btn-secondary {
        background: #374151;
        color: #d4d4d8;
      }

      .btn-secondary:hover {
        background: #4b5563;
      }

      .btn-primary {
        background: #3b82f6;
        color: white;
      }

      .btn-primary:hover {
        background: #2563eb;
        transform: translateY(-1px);
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideIn {
        from { transform: translateY(-30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    
    document.head.appendChild(style);
  }

  public dispose(): void {
    const modal = document.getElementById('file-picker-modal');
    if (modal) {
      modal.remove();
    }
    
    const style = document.getElementById('file-picker-styles');
    if (style) {
      style.remove();
    }
    
    document.removeEventListener('keydown', this.handleKeyDown);
  }
}
