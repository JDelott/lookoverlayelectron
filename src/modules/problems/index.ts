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
  relatedInformation?: string;
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
  private isMonacoReady = false;
  private modelListeners = new Map<string, any[]>();
  private immediateUpdateTimeout: NodeJS.Timeout | null = null;

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
    console.log('🔧 Initializing STRICT Problems Manager...');
    this.setupStrictMonacoConfiguration();
    this.setupMonacoListeners();
    this.setupEventListeners();
    console.log('✅ STRICT Problems Manager initialized');
  }

  private setupStrictMonacoConfiguration(): void {
    if (!window.monaco) {
      setTimeout(() => this.setupStrictMonacoConfiguration(), 50);
      return;
    }

    console.log('🔧 PROBLEMS: Setting up balanced Monaco configuration...');

    // Let Monaco handle diagnostics, but we'll filter at display time
    // Don't override Monaco settings here to avoid conflicts
    
    console.log('✅ PROBLEMS: Letting editor module handle Monaco configuration');
  }

  private setupMonacoListeners(): void {
    if (!window.monaco) {
      setTimeout(() => this.setupMonacoListeners(), 50);
      return;
    }

    this.isMonacoReady = true;
    console.log('🔧 Setting up STRICT Monaco listeners...');

    // Listen for ALL marker changes with immediate updates
    window.monaco.editor.onDidChangeMarkers((uris: readonly any[]) => {
      console.log('🚨 MARKERS CHANGED IMMEDIATELY:', uris.map((uri: any) => uri.path || uri.toString()));
      this.updateProblemsImmediately();
    });

    // Listen for new models
    window.monaco.editor.onDidCreateModel((model: any) => {
      console.log('📄 NEW MODEL - immediate problems check:', model.uri.path);
      this.setupStrictModelListeners(model);
      this.updateProblemsImmediately();
    });

    // Check all existing models immediately
    const existingModels = window.monaco.editor.getModels();
    existingModels.forEach((model: any) => {
      console.log('📄 Setting up STRICT listeners for existing model:', model.uri.path);
      this.setupStrictModelListeners(model);
    });

    // Force immediate update
    this.updateProblemsImmediately();
    console.log('✅ STRICT Monaco listeners ready');
  }

  private setupStrictModelListeners(model: any): void {
    const modelPath = model.uri.path;
    console.log('🎯 Setting up STRICT listeners for model:', modelPath);
    
    // Clean up existing listeners for this model
    this.cleanupModelListeners(modelPath);
    
    const listeners: any[] = [];

    // Listen for content changes (typing)
    const contentListener = model.onDidChangeContent(() => {
      console.log('📝 STRICT Content changed in:', modelPath);
      this.scheduleProblemsUpdate();
    });
    listeners.push(contentListener);

    // Listen for language changes
    const languageListener = model.onDidChangeLanguage(() => {
      console.log('🗣️ STRICT Language changed in:', modelPath);
      this.updateProblemsImmediately();
    });
    listeners.push(languageListener);

    // Listen for model disposal
    const disposeListener = model.onWillDispose(() => {
      console.log('🗑️ Model disposing:', modelPath);
      this.cleanupModelListeners(modelPath);
      this.updateProblemsImmediately();
    });
    listeners.push(disposeListener);

    this.modelListeners.set(modelPath, listeners);
  }

  private cleanupModelListeners(modelPath: string): void {
    const existingListeners = this.modelListeners.get(modelPath);
    if (existingListeners) {
      existingListeners.forEach(listener => {
        if (listener && listener.dispose) {
          listener.dispose();
        }
      });
      this.modelListeners.delete(modelPath);
    }
  }

  private updateProblemsImmediately(): void {
    // Clear any existing timeout
    if (this.immediateUpdateTimeout) {
      clearTimeout(this.immediateUpdateTimeout);
    }
    
    // Very short delay to batch rapid changes
    this.immediateUpdateTimeout = setTimeout(() => {
      this.updateProblems();
    }, 100) as NodeJS.Timeout; // Much faster response
  }

  private scheduleProblemsUpdate(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    
    // Also much faster for scheduled updates
    this.updateTimeout = setTimeout(() => {
      this.updateProblems();
    }, 150) as NodeJS.Timeout;
  }

  private updateProblems(): void {
    if (!this.isMonacoReady || !window.monaco) return;

    const problems: ProblemItem[] = [];
    console.log('🔍 Balanced problems update - allowing real errors through...');
    
    const models = window.monaco.editor.getModels();
    
    models.forEach((model: any) => {
      const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
      
      markers.forEach((marker: any) => {
        // Only filter out the specific noise patterns
        if (this.shouldIgnoreMarkerStrict(marker)) {
          return;
        }

        // Get the correct file path from the model URI
        let filePath = model.uri.path;
        
        // Handle Monaco's internal URI schemes 
        if (model.uri.scheme === 'file') {
          filePath = model.uri.path;
        } else if (model.uri.toString().includes('file://')) {
          filePath = model.uri.toString().replace('file://', '');
        } else {
          // For models that don't have proper file paths, try to get from tab manager
          const app = (window as any).app;
          const currentFile = app?.state?.currentFile || app?.tabManager?.state?.activeTabPath;
          if (currentFile && currentFile !== '/1') {
            filePath = currentFile;
          }
        }
        
        console.log('🔍 Processing marker for file:', filePath, 'URI:', model.uri.toString());
        
        const fileName = filePath.split('/').pop() || filePath;
        
        // Create problem with simpler ID
        const problem: ProblemItem = {
          id: `${fileName}-${marker.startLineNumber}-${marker.startColumn}`, // Much simpler ID
          filePath,
          fileName,
          message: marker.message,
          severity: this.mapSeverity(marker.severity),
          line: marker.startLineNumber,
          column: marker.startColumn,
          endLine: marker.endLineNumber,
          endColumn: marker.endColumn,
          source: marker.source || 'TypeScript',
          code: marker.code,
          relatedInformation: marker.relatedInformation ? 
            marker.relatedInformation.map((info: any) => info.message).join('; ') : undefined
        };

        console.log(`➕ Adding problem: ${problem.severity.toUpperCase()}: ${problem.message.substring(0, 60)}... in ${problem.fileName}`);
        problems.push(problem);
      });
    });

    console.log(`📊 BALANCED TOTAL: ${problems.length} problems`);
    
    this.problemsState.problems = problems;
    this.renderProblemsTab();
    this.dispatchProblemsUpdateEvent();
  }

  private shouldIgnoreMarkerStrict(marker: any): boolean {
    // Much more targeted filtering - only ignore specific noise patterns
    const message = marker.message.toLowerCase();
    const source = (marker.source || '').toLowerCase();
    
    console.log(`🔍 Checking marker: Code ${marker.code}, Source: ${source}, Message: ${message.substring(0, 50)}...`);

    // Only ignore these specific noise patterns that were bothering you
    const specificNoisePatterns = [
      'jsx element implicitly has type \'any\' because no interface \'jsx.intrinsicelements\' exists',
      '\'interface\' declarations can only be used in typescript files',
      'type annotations can only be used in typescript files',
      'cannot find module \'react/jsx-runtime\' or its corresponding type declarations',
      'cannot find name \'react\'',
      'cannot find name \'jsx\'',
      '\'jsx\' refers to a umd global',
    ];

    // Check for exact noise patterns
    if (specificNoisePatterns.some(pattern => message.includes(pattern))) {
      console.log('❌ Filtering specific noise pattern');
      return true;
    }

    // Only ignore these specific error codes
    const specificNoiseCodes = [
      7026, // JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists
      8006, // 'interface' declarations can only be used in TypeScript files
      8010, // Type annotations can only be used in TypeScript files
      2307, // Cannot find module 'react/jsx-runtime' (when it's specifically react/jsx-runtime)
      2304, // Cannot find name 'React' (when it's specifically React)
      2591, // Cannot find name 'JSX'
      2786, // 'JSX' refers to a UMD global
    ];

    // Only ignore if it's the specific codes AND about React/JSX/TypeScript usage in TS files
    if (specificNoiseCodes.includes(marker.code)) {
      if (message.includes('react') || message.includes('jsx') || 
          message.includes('interface') && message.includes('typescript') ||
          message.includes('type annotations') && message.includes('typescript')) {
        console.log(`❌ Filtering specific noise code: ${marker.code}`);
        return true;
      }
    }

    // Allow everything else through
    console.log(`✅ Allowing marker through`);
    return false;
  }

  private mapSeverity(monacoSeverity: number): 'error' | 'warning' | 'info' {
    // Standard severity mapping
    switch (monacoSeverity) {
      case 8: return 'error';
      case 4: return 'warning';
      case 2: return 'info';
      case 1: return 'info';
      default: return 'info';
    }
  }

  private isRealSyntaxError(message: string): boolean {
    // Only these are real syntax errors worth showing
    const realSyntaxPatterns = [
      'unterminated string literal',
      'unexpected end of input', 
      'unexpected token',
      'missing closing',
      'unclosed',
      ';} expected',
      'identifier expected',
      'expression expected',
    ];

    return realSyntaxPatterns.some(pattern => message.includes(pattern));
  }

  private setupEventListeners(): void {
    // More aggressive event listening
    document.addEventListener('tab-changed', () => {
      console.log('🔄 TAB CHANGED - immediate problems update');
      this.updateProblemsImmediately();
    });

    document.addEventListener('file-saved', (event: any) => {
      console.log('💾 FILE SAVED - immediate problems update', event.detail?.filePath);
      this.updateProblemsImmediately();
    });

    document.addEventListener('editor-model-changed', () => {
      console.log('📝 EDITOR MODEL CHANGED - immediate problems update');
      this.updateProblemsImmediately();
    });

    // More frequent periodic refresh for strict mode
    setInterval(() => {
      if (this.problemsState.isActive) {
        console.log('⏰ STRICT periodic refresh...');
        this.updateProblems();
      }
    }, 2000); // Every 2 seconds when active

    // Also refresh when window gains focus (catches external file changes)
    window.addEventListener('focus', () => {
      console.log('👀 Window focused - checking for problems');
      this.updateProblemsImmediately();
    });
  }

  // Enhanced methods for strict mode
  public refreshProblems(): void {
    console.log('🔄 MANUAL STRICT REFRESH');
    this.updateProblemsImmediately();
  }

  // Force Monaco to revalidate everything
  public forceRevalidation(): void {
    console.log('🔄 FORCING MONACO REVALIDATION...');
    if (window.monaco) {
      const models = window.monaco.editor.getModels();
      models.forEach(model => {
        // Trigger revalidation by briefly modifying
        const content = model.getValue();
        model.setValue(content + '\n');
        setTimeout(() => {
          model.setValue(content);
          this.updateProblemsImmediately();
        }, 100);
      });
    }
  }

  getProblemsTab(): { name: string; content: string; isActive: boolean } {
    const errorCount = this.problemsState.problems.filter(p => p.severity === 'error').length;
    const warningCount = this.problemsState.problems.filter(p => p.severity === 'warning').length;
    const infoCount = this.problemsState.problems.filter(p => p.severity === 'info').length;
    
    let tabName = 'Problems';
    if (errorCount > 0 || warningCount > 0 || infoCount > 0) {
      const parts: string[] = [];
      if (errorCount > 0) parts.push(`${errorCount}E`);
      if (warningCount > 0) parts.push(`${warningCount}W`);
      if (infoCount > 0) parts.push(`${infoCount}I`);
      tabName = `Problems (${parts.join('/')})`;
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
          <div class="problems-empty-subtitle">STRICT MODE: All code is clean!</div>
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
            <button class="problems-action-btn" onclick="window.problemsManager?.forceRevalidation()" 
                    title="Force revalidation">
              🔄 Force Check
            </button>
            <button class="problems-action-btn" onclick="window.problemsManager?.copyAllProblems()" 
                    title="Copy all problems">
              📋 Copy All
            </button>
            <button class="problems-action-btn" onclick="window.problemsManager?.sendToChat()" 
                    title="Send to AI chat">
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
    if (!problem) {
      console.error('Problem not found:', problemId);
      return;
    }

    console.log(`🎯 Navigating to problem in: ${problem.filePath} at line ${problem.line}`);

    // Check if the file is already open in a tab
    const tabManager = (window as any).app?.tabManager;
    if (!tabManager) {
      console.error('TabManager not available');
      return;
    }

    // Debug: Log all open tabs to see what keys are being used
    console.log('🔍 Debug: Open tabs:', Array.from(tabManager.state.openTabs.keys()));
    console.log('🔍 Debug: Looking for problem path:', problem.filePath);

    // Check multiple path formats to find a match
    const possiblePaths = [
      problem.filePath,
      problem.filePath.replace(/^\/+/, ''), // Remove leading slashes
      problem.filePath.replace(/\\/g, '/'), // Convert backslashes to forward slashes
      `.${problem.filePath}`, // Add leading dot
      problem.filePath.replace(/^.*\/src\//, 'src/'), // Try relative path from src
    ];

    let matchedPath: string | null = null;
    for (const path of possiblePaths) {
      if (tabManager.state.openTabs.has(path)) {
        matchedPath = path;
        console.log('✅ Found matching path:', path);
        break;
      }
    }

    if (matchedPath) {
      // File is already open, just switch to it
      console.log('📄 File already open, switching to existing tab');
      tabManager.switchToTab(matchedPath);
      
      // Navigate to the problem location after a short delay
      setTimeout(() => {
        this.navigateToLocation(problem);
      }, 100);
    } else {
      // File is not open, show which files ARE open for debugging
      const openFiles = Array.from(tabManager.state.openTabs.keys());
      console.log('📄 File not open. Open files:', openFiles);
      this.showNotification(`File ${problem.fileName} is not currently open. Open it first to navigate to problems.`, 'error');
    }
  }

  private navigateToLocation(problem: ProblemItem): void {
    // Try multiple ways to get Monaco editor
    let monacoEditor = (window as any).monacoEditor;
    
    // Fallback to getting it from app state
    if (!monacoEditor) {
      const app = (window as any).app;
      monacoEditor = app?.state?.monacoEditor || app?.editorManager?.state?.monacoEditor;
    }
    
    // Another fallback - get the current active editor
    if (!monacoEditor && window.monaco) {
      const activeEditor = window.monaco.editor.getEditors()?.[0];
      if (activeEditor) {
        monacoEditor = activeEditor;
      }
    }

    if (monacoEditor && window.monaco) {
      console.log(`📍 Navigating to line ${problem.line}, column ${problem.column} in ${problem.fileName}`);
      
      try {
        // Set the cursor position
        monacoEditor.setPosition({
          lineNumber: problem.line,
          column: problem.column
        });

        // Scroll to reveal the position in center
        monacoEditor.revealPositionInCenter({
          lineNumber: problem.line,
          column: problem.column
        });

        // Focus Monaco editor
        setTimeout(() => {
          monacoEditor.focus();
        }, 100);

        // Optionally highlight the problem range
        if (problem.endLine && problem.endColumn) {
          const range = new window.monaco.Range(
            problem.line, problem.column,
            problem.endLine, problem.endColumn
          );
          monacoEditor.setSelection(range);
        }
        
        console.log('✅ Successfully navigated to problem location');
      } catch (error) {
        console.error('❌ Error during navigation:', error);
      }
    } else {
      console.error('❌ Monaco editor not available for navigation. Global ref:', !!(window as any).monacoEditor, 'Monaco available:', !!window.monaco);
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
    if (this.immediateUpdateTimeout) {
      clearTimeout(this.immediateUpdateTimeout);
    }
    
    // Clean up all model listeners
    this.modelListeners.forEach((listeners) => {
      listeners.forEach(listener => listener.dispose());
    });
    this.modelListeners.clear();
    
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
