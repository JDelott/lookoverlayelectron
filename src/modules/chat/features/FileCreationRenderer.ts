import { AttachedFile } from '../core/ChatTypes.js';

export interface FileCreationInfo {
  path: string;
  content: string;
  language: string;
  isNew: boolean;
}

export class FileCreationRenderer {
  private electronAPI: any;

  constructor() {
    this.electronAPI = (window as any).electronAPI;
  }

  // Detect file creation patterns in markdown content
  detectFileCreations(content: string): FileCreationInfo[] {
    const files: FileCreationInfo[] = [];
    
    // Pattern 1: ```language:path/to/file.ext
    const fileCodeBlockPattern = /```(\w+):([^\n]+)\n([\s\S]*?)```/g;
    let match;
    
    while ((match = fileCodeBlockPattern.exec(content)) !== null) {
      const [, language, filePath, code] = match;
      files.push({
        path: filePath.trim(),
        content: code.trim(),
        language: language || this.getLanguageFromPath(filePath),
        isNew: true
      });
    }

    // Pattern 2: ## File: path/to/file.ext followed by code block
    const fileHeaderPattern = /##?\s*(?:File|Create|New File):\s*([^\n]+)\n```(\w*)\n([\s\S]*?)```/gi;
    fileHeaderPattern.lastIndex = 0; // Reset regex
    
    while ((match = fileHeaderPattern.exec(content)) !== null) {
      const [, filePath, language, code] = match;
      files.push({
        path: filePath.trim(),
        content: code.trim(),
        language: language || this.getLanguageFromPath(filePath),
        isNew: true
      });
    }

    // Pattern 3: **path/to/file.ext** followed by code block
    const boldFilePattern = /\*\*([^*]+\.[^*]+)\*\*\s*\n```(\w*)\n([\s\S]*?)```/g;
    boldFilePattern.lastIndex = 0; // Reset regex
    
    while ((match = boldFilePattern.exec(content)) !== null) {
      const [, filePath, language, code] = match;
      files.push({
        path: filePath.trim(),
        content: code.trim(),
        language: language || this.getLanguageFromPath(filePath),
        isNew: true
      });
    }

    return files;
  }

  // Process content and replace file creation patterns with file containers
  processContentWithFileCreations(content: string): string {
    const files = this.detectFileCreations(content);
    let processedContent = content;

    // Replace file creation patterns with placeholders
    files.forEach((file, index) => {
      const placeholder = `<div class="file-creation-placeholder" data-file-index="${index}"></div>`;
      
      // Replace the various patterns
      processedContent = processedContent
        .replace(new RegExp(`\`\`\`\\w*:${this.escapeRegex(file.path)}\\n[\\s\\S]*?\`\`\``, 'g'), placeholder)
        .replace(new RegExp(`##?\\s*(?:File|Create|New File):\\s*${this.escapeRegex(file.path)}\\n\`\`\`\\w*\\n[\\s\\S]*?\`\`\``, 'gi'), placeholder)
        .replace(new RegExp(`\\*\\*${this.escapeRegex(file.path)}\\*\\*\\s*\\n\`\`\`\\w*\\n[\\s\\S]*?\`\`\``, 'g'), placeholder);
    });

    return processedContent;
  }

  // Create file creation container elements
  createFileContainers(files: FileCreationInfo[]): HTMLElement[] {
    return files.map((file, index) => this.createFileContainer(file, index));
  }

  private createFileContainer(file: FileCreationInfo, index: number): HTMLElement {
    const container = document.createElement('div');
    container.className = 'file-creation-container';
    container.setAttribute('data-file-index', index.toString());

    // File header
    const header = document.createElement('div');
    header.className = 'file-creation-header';

    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-creation-info';

    const fileIcon = document.createElement('span');
    fileIcon.className = 'file-creation-icon';
    fileIcon.textContent = this.getFileIcon(file.path);

    const filePath = document.createElement('span');
    filePath.className = 'file-creation-path';
    filePath.textContent = file.path;

    const fileStatus = document.createElement('span');
    fileStatus.className = 'file-creation-status new';
    fileStatus.textContent = 'NEW';

    fileInfo.appendChild(fileIcon);
    fileInfo.appendChild(filePath);
    fileInfo.appendChild(fileStatus);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'file-creation-actions';

    const createBtn = document.createElement('button');
    createBtn.className = 'file-action-btn create-btn';
    createBtn.innerHTML = '<span class="btn-icon">📁</span><span class="btn-text">Create File</span>';
    createBtn.onclick = () => this.createFile(file, container);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'file-action-btn copy-btn';
    copyBtn.innerHTML = '<span class="btn-icon">📋</span><span class="btn-text">Copy</span>';
    copyBtn.onclick = () => this.copyFileContent(file.content);

    const editBtn = document.createElement('button');
    editBtn.className = 'file-action-btn edit-btn';
    editBtn.innerHTML = '<span class="btn-icon">✏️</span><span class="btn-text">Edit</span>';
    editBtn.onclick = () => this.toggleEdit(container);

    actions.appendChild(createBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(editBtn);

    header.appendChild(fileInfo);
    header.appendChild(actions);

    // File content
    const content = document.createElement('div');
    content.className = 'file-creation-content';

    const codeContainer = document.createElement('div');
    codeContainer.className = 'file-code-container';

    const textarea = document.createElement('textarea');
    textarea.className = 'file-code-textarea';
    textarea.value = file.content;
    textarea.readOnly = true;
    textarea.spellcheck = false;

    // Auto-size the textarea
    const lines = file.content.split('\n').length;
    textarea.rows = Math.min(Math.max(lines + 1, 5), 30);

    // Style the textarea
    textarea.style.cssText = `
      width: 100%;
      background: transparent;
      border: none;
      outline: none;
      resize: vertical;
      padding: 16px;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.5;
      color: #e6edf3;
      white-space: pre;
      overflow-wrap: normal;
      overflow-x: auto;
      tab-size: 2;
    `;

    codeContainer.appendChild(textarea);
    content.appendChild(codeContainer);

    container.appendChild(header);
    container.appendChild(content);

    return container;
  }

  private async createFile(file: FileCreationInfo, container: HTMLElement): Promise<void> {
    try {
      // Get current working directory
      const currentDir = await this.electronAPI.getCurrentDirectory();
      const fullPath = file.path.startsWith('/') ? file.path : `${currentDir}/${file.path}`;

      // Create the file
      const result = await this.electronAPI.writeFile(fullPath, file.content);
      
      if (result.success) {
        // Update UI to show success
        const status = container.querySelector('.file-creation-status');
        const createBtn = container.querySelector('.create-btn');
        
        if (status) {
          status.textContent = 'CREATED';
          status.className = 'file-creation-status created';
        }
        
        if (createBtn) {
          createBtn.innerHTML = '<span class="btn-icon">✅</span><span class="btn-text">Created</span>';
          (createBtn as HTMLButtonElement).disabled = true;
        }

        this.showNotification(`File created: ${file.path}`, 'success');
      } else {
        throw new Error(result.error || 'Failed to create file');
      }
    } catch (error) {
      console.error('Failed to create file:', error);
      this.showNotification(`Failed to create ${file.path}: ${error}`, 'error');
    }
  }

  private async copyFileContent(content: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(content);
      this.showNotification('Content copied to clipboard', 'success');
    } catch (error) {
      console.error('Failed to copy:', error);
      this.showNotification('Failed to copy content', 'error');
    }
  }

  private toggleEdit(container: HTMLElement): void {
    const textarea = container.querySelector('.file-code-textarea') as HTMLTextAreaElement;
    const editBtn = container.querySelector('.edit-btn') as HTMLButtonElement;
    
    if (!textarea || !editBtn) return;

    if (textarea.readOnly) {
      textarea.readOnly = false;
      textarea.style.backgroundColor = '#1a1a1a';
      textarea.style.border = '1px solid #404040';
      editBtn.innerHTML = '<span class="btn-icon">💾</span><span class="btn-text">Save</span>';
      textarea.focus();
    } else {
      textarea.readOnly = true;
      textarea.style.backgroundColor = 'transparent';
      textarea.style.border = 'none';
      editBtn.innerHTML = '<span class="btn-icon">✏️</span><span class="btn-text">Edit</span>';
    }
  }

  private getLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const langMap: { [key: string]: string } = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'jsx',
      'tsx': 'tsx',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
      'xml': 'xml',
      'sql': 'sql',
      'sh': 'bash',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp'
    };
    return langMap[ext] || 'text';
  }

  private getFileIcon(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const iconMap: { [key: string]: string } = {
      'js': '🟨',
      'ts': '🔷',
      'jsx': '⚛️',
      'tsx': '⚛️',
      'py': '🐍',
      'html': '🌐',
      'css': '🎨',
      'scss': '🎨',
      'json': '📋',
      'md': '📝',
      'yml': '⚙️',
      'yaml': '⚙️',
      'xml': '📄',
      'sql': '🗃️',
      'sh': '🐚',
      'php': '🐘',
      'rb': '💎',
      'go': '🐹',
      'rs': '🦀',
      'java': '☕',
      'cpp': '⚡',
      'c': '⚡',
      'cs': '🔷'
    };
    return iconMap[ext] || '📄';
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private showNotification(message: string, type: 'success' | 'error'): void {
    // Use existing notification system if available
    const event = new CustomEvent('showNotification', { 
      detail: { message, type } 
    });
    document.dispatchEvent(event);
  }
}
