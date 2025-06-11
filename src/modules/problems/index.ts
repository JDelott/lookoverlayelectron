import { AppState } from '../types/index.js';

export interface ProblemItem {
  id: string;
  filePath: string;
  fileName: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  source: string; // e.g., 'TypeScript', 'ESLint', etc.
  code?: string | number;
}

export interface ProblemsState {
  problems: ProblemItem[];
  isActive: boolean;
  selectedProblem: ProblemItem | null;
  filter: 'all' | 'errors' | 'warnings' | 'info';
}

export class ProblemsManager {
  private state: AppState;
  private problemsState: ProblemsState;
  private updateTimeout: NodeJS.Timeout | null = null;

  constructor(state: AppState) {
    this.state = state;
    this.problemsState = {
      problems: [],
      isActive: false,
      selectedProblem: null,
      filter: 'all'
    };
  }

  initialize(): void {
    console.log('🔧 Initializing Problems Manager...');
    this.setupMonacoListeners();
    this.setupEventListeners();
    console.log('✅ Problems Manager initialized');
  }

  private setupMonacoListeners(): void {
    if (!window.monaco) {
      // Monaco not ready yet, wait for it
      setTimeout(() => this.setupMonacoListeners(), 100);
      return;
    }

    // Listen for model changes and diagnostics updates
    window.monaco.editor.onDidCreateModel((model: any) => {
      console.log('📄 New model created for problems tracking:', model.uri.path);
      
      // Listen for content changes
      model.onDidChangeContent(() => {
        this.scheduleProblemsUpdate();
      });

      // Initial problems check
      this.scheduleProblemsUpdate();
    });

    // Listen for marker changes (diagnostics) - fix the parameter type
    window.monaco.editor.onDidChangeMarkers((uris: readonly any[]) => {
      console.log('🔍 Markers changed for URIs:', uris.map((uri: any) => uri.path));
      this.updateProblemsFromMarkers(uris);
    });

    console.log('✅ Monaco listeners setup for problems tracking');
  }

  private scheduleProblemsUpdate(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    
    // Fix the setTimeout return type
    this.updateTimeout = setTimeout(() => {
      this.updateProblems();
    }, 500) as NodeJS.Timeout;
  }

  private updateProblems(): void {
    if (!window.monaco || !this.state.monacoEditor) return;

    const problems: ProblemItem[] = [];
    
    // Get all models (open files)
    const models = window.monaco.editor.getModels();
    
    models.forEach((model: any) => {
      const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
      
      markers.forEach((marker: any) => {
        // Skip certain markers we don't want to show
        if (this.shouldIgnoreMarker(marker)) return;

        const filePath = model.uri.path;
        const fileName = filePath.split('/').pop() || filePath;
        
        const problem: ProblemItem = {
          id: `${filePath}-${marker.startLineNumber}-${marker.startColumn}-${marker.code}`,
          filePath,
          fileName,
          message: marker.message,
          severity: this.mapSeverity(marker.severity),
          line: marker.startLineNumber,
          column: marker.startColumn,
          endLine: marker.endLineNumber,
          endColumn: marker.endColumn,
          source: marker.source || 'TypeScript',
          code: marker.code
        };

        problems.push(problem);
      });
    });

    this.problemsState.problems = problems;
    this.renderProblemsTab();
    this.dispatchProblemsUpdateEvent();
  }

  private updateProblemsFromMarkers(uris: readonly any[]): void {
    if (!window.monaco) return;

    // Update problems immediately when markers change
    this.updateProblems();
  }

  private shouldIgnoreMarker(marker: any): boolean {
    // Ignore certain types of markers that are not useful
    const ignoreCodes = [
      1108, 1109, 1005, 1161, // Unreachable code, etc.
      6133, 6196, // Unused variables (can be noisy)
    ];

    return ignoreCodes.includes(marker.code);
  }

  private mapSeverity(monacoSeverity: number): 'error' | 'warning' | 'info' {
    // Monaco severity: 1=Hint, 2=Info, 4=Warning, 8=Error
    switch (monacoSeverity) {
      case 8: return 'error';
      case 4: return 'warning';
      case 2: 
      case 1:
      default: return 'info';
    }
  }

  private setupEventListeners(): void {
    // Listen for tab changes to update problems
    document.addEventListener('tab-changed', () => {
      this.scheduleProblemsUpdate();
    });

    // Listen for file saves to refresh problems
    document.addEventListener('file-saved', () => {
      this.scheduleProblemsUpdate();
    });
  }

  getProblemsTab(): { name: string; content: string; isActive: boolean } {
    const errorCount = this.problemsState.problems.filter(p => p.severity === 'error').length;
    const warningCount = this.problemsState.problems.filter(p => p.severity === 'warning').length;
    
    let tabName = 'Problems';
    if (errorCount > 0 || warningCount > 0) {
      const parts: string[] = [];
      if (errorCount > 0) parts.push(`${errorCount} error${errorCount !== 1 ? 's' : ''}`);
      if (warningCount > 0) parts.push(`${warningCount} warning${warningCount !== 1 ? 's' : ''}`);
      tabName = `Problems (${parts.join(', ')})`;
    }

    return {
      name: tabName,
      content: this.generateProblemsContent(),
      isActive: this.problemsState.isActive
    };
  }

  private generateProblemsContent(): string {
    const filteredProblems = this.getFilteredProblems();
    
    if (filteredProblems.length === 0) {
      return `
        <div class="problems-empty">
          <div class="problems-empty-icon">✅</div>
          <div class="problems-empty-message">No problems found</div>
          <div class="problems-empty-subtitle">Great work! Your code has no issues.</div>
        </div>
      `;
    }

    const problemsByFile = this.groupProblemsByFile(filteredProblems);
    
    let html = `
      <div class="problems-container">
        <div class="problems-header">
          <div class="problems-filter-buttons">
            <button class="problems-filter-btn ${this.problemsState.filter === 'all' ? 'active' : ''}" 
                    onclick="window.problemsManager?.setFilter('all')">
              All (${filteredProblems.length})
            </button>
            <button class="problems-filter-btn ${this.problemsState.filter === 'errors' ? 'active' : ''}" 
                    onclick="window.problemsManager?.setFilter('errors')">
              Errors (${filteredProblems.filter(p => p.severity === 'error').length})
            </button>
            <button class="problems-filter-btn ${this.problemsState.filter === 'warnings' ? 'active' : ''}" 
                    onclick="window.problemsManager?.setFilter('warnings')">
              Warnings (${filteredProblems.filter(p => p.severity === 'warning').length})
            </button>
            <button class="problems-filter-btn ${this.problemsState.filter === 'info' ? 'active' : ''}" 
                    onclick="window.problemsManager?.setFilter('info')">
              Info (${filteredProblems.filter(p => p.severity === 'info').length})
            </button>
          </div>
          <div class="problems-actions">
            <button class="problems-action-btn" onclick="window.problemsManager?.copyAllProblems()" 
                    title="Copy all problems to clipboard">
              📋 Copy All
            </button>
            <button class="problems-action-btn" onclick="window.problemsManager?.sendToChat()" 
                    title="Send problems to AI chat">
              🤖 Send to Chat
            </button>
          </div>
        </div>
        <div class="problems-list">
    `;

    Object.entries(problemsByFile).forEach(([filePath, problems]) => {
      const fileName = filePath.split('/').pop() || filePath;
      const errorCount = problems.filter(p => p.severity === 'error').length;
      const warningCount = problems.filter(p => p.severity === 'warning').length;
      
      // Use data attributes instead of onclick with parameters
      html += `
        <div class="problems-file-group" data-file-path="${this.escapeHtml(filePath)}">
          <div class="problems-file-header" onclick="window.problemsManager?.toggleFileGroupByElement(this)">
            <span class="problems-file-expand">▼</span>
            <span class="problems-file-icon">📄</span>
            <span class="problems-file-name">${fileName}</span>
            <span class="problems-file-path">${filePath}</span>
            <span class="problems-file-counts">
              ${errorCount > 0 ? `<span class="problems-count-error">${errorCount}</span>` : ''}
              ${warningCount > 0 ? `<span class="problems-count-warning">${warningCount}</span>` : ''}
            </span>
          </div>
          <div class="problems-file-items">
      `;

      problems.forEach(problem => {
        const severityIcon = this.getSeverityIcon(problem.severity);
        const severityClass = `problems-severity-${problem.severity}`;
        
        html += `
          <div class="problems-item ${severityClass}" 
               data-problem-id="${this.escapeHtml(problem.id)}"
               onclick="window.problemsManager?.goToProblemByElement(this)"
               oncontextmenu="window.problemsManager?.showProblemContextMenuByElement(event, this)">
            <span class="problems-item-icon">${severityIcon}</span>
            <div class="problems-item-content">
              <div class="problems-item-message">${this.escapeHtml(problem.message)}</div>
              <div class="problems-item-location">
                Line ${problem.line}, Column ${problem.column}
                ${problem.source ? `• ${problem.source}` : ''}
                ${problem.code ? `• ${problem.code}` : ''}
              </div>
            </div>
            <div class="problems-item-actions">
              <button class="problems-item-action" 
                      onclick="event.stopPropagation(); window.problemsManager?.copyProblemByElement(this.closest('.problems-item'))"
                      title="Copy problem">
                📋
              </button>
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    return html;
  }

  private groupProblemsByFile(problems: ProblemItem[]): { [filePath: string]: ProblemItem[] } {
    return problems.reduce((groups, problem) => {
      if (!groups[problem.filePath]) {
        groups[problem.filePath] = [];
      }
      groups[problem.filePath].push(problem);
      return groups;
    }, {} as { [filePath: string]: ProblemItem[] });
  }

  private getFilteredProblems(): ProblemItem[] {
    const { problems, filter } = this.problemsState;
    
    switch (filter) {
      case 'errors':
        return problems.filter(p => p.severity === 'error');
      case 'warnings':
        return problems.filter(p => p.severity === 'warning');
      case 'info':
        return problems.filter(p => p.severity === 'info');
      default:
        return problems;
    }
  }

  private getSeverityIcon(severity: 'error' | 'warning' | 'info'): string {
    switch (severity) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '•';
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Helper method to escape strings for HTML attributes
  private escapeForAttribute(text: string): string {
    return text.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
  }

  private renderProblemsTab(): void {
    // This will be called by the terminal manager to render the tab content
    const event = new CustomEvent('problems-updated', {
      detail: this.getProblemsTab()
    });
    document.dispatchEvent(event);
  }

  private dispatchProblemsUpdateEvent(): void {
    const event = new CustomEvent('problems-count-changed', {
      detail: {
        total: this.problemsState.problems.length,
        errors: this.problemsState.problems.filter(p => p.severity === 'error').length,
        warnings: this.problemsState.problems.filter(p => p.severity === 'warning').length,
        info: this.problemsState.problems.filter(p => p.severity === 'info').length
      }
    });
    document.dispatchEvent(event);
  }

  // Public API methods
  setFilter(filter: 'all' | 'errors' | 'warnings' | 'info'): void {
    this.problemsState.filter = filter;
    this.renderProblemsTab();
  }

  goToProblem(problemId: string): void {
    const problem = this.problemsState.problems.find(p => p.id === problemId);
    if (!problem) return;

    // Open the file if it's not already open
    const app = (window as any).app;
    if (app?.tabManager) {
      app.tabManager.openFile(problem.filePath).then(() => {
        // Navigate to the problem location
        if (this.state.monacoEditor && window.monaco) {
          this.state.monacoEditor.setPosition({
            lineNumber: problem.line,
            column: problem.column
          });
          
          // Reveal the line in the center
          this.state.monacoEditor.revealLineInCenter(problem.line);
          
          // Focus the editor
          this.state.monacoEditor.focus();
          
          // Optionally highlight the range
          if (problem.endLine && problem.endColumn) {
            const range = new window.monaco.Range(
              problem.line, problem.column,
              problem.endLine, problem.endColumn
            );
            this.state.monacoEditor.setSelection(range);
          }
        }
      });
    }
  }

  copyProblem(problemId: string): void {
    const problem = this.problemsState.problems.find(p => p.id === problemId);
    if (!problem) return;

    const text = this.formatProblemForCopy(problem);
    this.copyToClipboard(text);
  }

  copyAllProblems(): void {
    const filteredProblems = this.getFilteredProblems();
    if (filteredProblems.length === 0) return;

    const text = filteredProblems.map(p => this.formatProblemForCopy(p)).join('\n\n');
    this.copyToClipboard(text);
  }

  private formatProblemForCopy(problem: ProblemItem): string {
    return `${problem.severity.toUpperCase()}: ${problem.message}\nFile: ${problem.filePath}\nLine: ${problem.line}, Column: ${problem.column}${problem.source ? `\nSource: ${problem.source}` : ''}${problem.code ? `\nCode: ${problem.code}` : ''}`;
  }

  private copyToClipboard(text: string): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.showNotification('Copied to clipboard', 'success');
      }).catch(() => {
        this.fallbackCopy(text);
      });
    } else {
      this.fallbackCopy(text);
    }
  }

  private fallbackCopy(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      this.showNotification('Copied to clipboard', 'success');
    } catch (err) {
      this.showNotification('Failed to copy', 'error');
    }
    document.body.removeChild(textArea);
  }

  sendToChat(): void {
    const filteredProblems = this.getFilteredProblems();
    if (filteredProblems.length === 0) return;

    const chatManager = (window as any).chatManager;
    if (!chatManager) {
      this.showNotification('Chat not available', 'error');
      return;
    }

    // Show AI chat panel
    const layoutManager = (window as any).layoutManager;
    if (layoutManager) {
      layoutManager.showAIChat();
    }

    // Format problems for chat
    const problemsText = this.formatProblemsForChat(filteredProblems);
    
    // Auto-fill the chat input with the problems
    setTimeout(() => {
      const chatInput = document.querySelector('#chat-input, .chat-input') as HTMLTextAreaElement;
      if (chatInput) {
        chatInput.value = problemsText;
        
        // Auto-resize and focus
        if (chatManager.autoResizeTextarea) {
          chatManager.autoResizeTextarea(chatInput);
        }
        chatInput.focus();
        
        this.showNotification('Problems sent to chat', 'success');
      }
    }, 300); // Wait for chat panel to open
  }

  private formatProblemsForChat(problems: ProblemItem[]): string {
    const errorCount = problems.filter(p => p.severity === 'error').length;
    const warningCount = problems.filter(p => p.severity === 'warning').length;
    
    let text = `I have ${problems.length} code issue${problems.length !== 1 ? 's' : ''} that need help with:\n\n`;
    
    if (errorCount > 0) {
      text += `**ERRORS (${errorCount}):**\n`;
      problems.filter(p => p.severity === 'error').forEach((problem, index) => {
        text += `${index + 1}. ${problem.message}\n   File: ${problem.fileName} (Line ${problem.line})\n\n`;
      });
    }
    
    if (warningCount > 0) {
      text += `**WARNINGS (${warningCount}):**\n`;
      problems.filter(p => p.severity === 'warning').forEach((problem, index) => {
        text += `${index + 1}. ${problem.message}\n   File: ${problem.fileName} (Line ${problem.line})\n\n`;
      });
    }
    
    text += `Can you help me understand and fix these issues?`;
    
    return text;
  }

  showProblemContextMenu(event: MouseEvent, problemId: string): void {
    event.preventDefault();
    event.stopPropagation();

    const problem = this.problemsState.problems.find(p => p.id === problemId);
    if (!problem) return;

    // Remove existing context menu
    const existingMenu = document.querySelector('.problems-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'problems-context-menu context-menu';
    
    // Create menu items with click handlers instead of onclick attributes
    const goToItem = document.createElement('div');
    goToItem.className = 'context-menu-item';
    goToItem.innerHTML = `
      <span class="context-menu-icon">📍</span>
      Go to Problem
    `;
    goToItem.onclick = () => {
      this.goToProblem(problemId);
      menu.remove();
    };

    const copyItem = document.createElement('div');
    copyItem.className = 'context-menu-item';
    copyItem.innerHTML = `
      <span class="context-menu-icon">📋</span>
      Copy Problem
    `;
    copyItem.onclick = () => {
      this.copyProblem(problemId);
      menu.remove();
    };

    const separator = document.createElement('div');
    separator.className = 'context-menu-separator';

    const chatItem = document.createElement('div');
    chatItem.className = 'context-menu-item';
    chatItem.innerHTML = `
      <span class="context-menu-icon">🤖</span>
      Send to Chat
    `;
    chatItem.onclick = () => {
      this.sendProblemToChat(problemId);
      menu.remove();
    };

    menu.appendChild(goToItem);
    menu.appendChild(copyItem);
    menu.appendChild(separator);
    menu.appendChild(chatItem);

    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;
    document.body.appendChild(menu);

    // Close menu when clicking elsewhere
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 0);
  }

  sendProblemToChat(problemId: string): void {
    const problem = this.problemsState.problems.find(p => p.id === problemId);
    if (!problem) return;

    const chatManager = (window as any).chatManager;
    if (!chatManager) {
      this.showNotification('Chat not available', 'error');
      return;
    }

    // Show AI chat panel
    const layoutManager = (window as any).layoutManager;
    if (layoutManager) {
      layoutManager.showAIChat();
    }

    const problemText = `I'm getting this ${problem.severity} in my code:\n\n${problem.message}\n\nFile: ${problem.fileName} (Line ${problem.line}, Column ${problem.column})\n\nCan you help me fix this issue?`;
    
    // Auto-fill the chat input
    setTimeout(() => {
      const chatInput = document.querySelector('#chat-input, .chat-input') as HTMLTextAreaElement;
      if (chatInput) {
        chatInput.value = problemText;
        
        if (chatManager.autoResizeTextarea) {
          chatManager.autoResizeTextarea(chatInput);
        }
        chatInput.focus();
        
        this.showNotification('Problem sent to chat', 'success');
      }
    }, 300);
  }

  toggleFileGroup(filePath: string): void {
    const fileGroup = document.querySelector(`[data-file-path="${this.escapeHtml(filePath)}"]`);
    if (fileGroup) {
      const items = fileGroup.querySelector('.problems-file-items') as HTMLElement;
      const arrow = fileGroup.querySelector('.problems-file-expand') as HTMLElement;
      
      if (items.style.display === 'none') {
        items.style.display = 'block';
        arrow.textContent = '▼';
      } else {
        items.style.display = 'none';
        arrow.textContent = '▶';
      }
    }
  }

  private showNotification(message: string, type: 'success' | 'error'): void {
    const notification = document.createElement('div');
    notification.className = `problems-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      z-index: 10000;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s ease;
      ${type === 'success' ? 'background: #10b981;' : 'background: #ef4444;'}
    `;

    document.body.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    });

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(-10px)';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  setActive(active: boolean): void {
    this.problemsState.isActive = active;
    if (active) {
      this.updateProblems(); // Refresh when becoming active
    }
  }

  getProblemsCount(): { total: number; errors: number; warnings: number; info: number } {
    return {
      total: this.problemsState.problems.length,
      errors: this.problemsState.problems.filter(p => p.severity === 'error').length,
      warnings: this.problemsState.problems.filter(p => p.severity === 'warning').length,
      info: this.problemsState.problems.filter(p => p.severity === 'info').length
    };
  }

  exposeGlobally(): void {
    (window as any).problemsManager = this;
  }

  dispose(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    delete (window as any).problemsManager;
  }

  // New methods that use element-based approach instead of string parameters
  toggleFileGroupByElement(headerElement: HTMLElement): void {
    const fileGroup = headerElement.parentElement;
    if (fileGroup) {
      const items = fileGroup.querySelector('.problems-file-items') as HTMLElement;
      const arrow = fileGroup.querySelector('.problems-file-expand') as HTMLElement;
      
      if (items.style.display === 'none') {
        items.style.display = 'block';
        arrow.textContent = '▼';
      } else {
        items.style.display = 'none';
        arrow.textContent = '▶';
      }
    }
  }

  goToProblemByElement(problemElement: HTMLElement): void {
    const problemId = problemElement.getAttribute('data-problem-id');
    if (problemId) {
      this.goToProblem(problemId);
    }
  }

  showProblemContextMenuByElement(event: MouseEvent, problemElement: HTMLElement): void {
    const problemId = problemElement.getAttribute('data-problem-id');
    if (problemId) {
      this.showProblemContextMenu(event, problemId);
    }
  }

  copyProblemByElement(problemElement: HTMLElement): void {
    const problemId = problemElement.getAttribute('data-problem-id');
    if (problemId) {
      this.copyProblem(problemId);
    }
  }
}
