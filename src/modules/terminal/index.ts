import { Terminal, AppState } from '../types';
import { ProblemsManager } from '../problems/index.js';

export class TerminalManager {
  private state: AppState;
  private electronAPI: any;
  private commandHistory: string[] = [];
  private historyIndex = -1;
  private runningProcesses = new Map<string, { command: string; started: Date }>();
  private problemsManager: ProblemsManager;

  constructor(state: AppState, problemsManager: ProblemsManager) {
    this.state = state;
    this.electronAPI = (window as any).electronAPI;
    this.problemsManager = problemsManager;
    
    // Initialize activeTerminalTab if not set
    if (!this.state.activeTerminalTab) {
      this.state.activeTerminalTab = 'terminal';
    }
  }

  initialize(): void {
    this.createNewTerminal();
    this.setupStreamingHandlers();
    this.setupFileSystemChangeListener();
    this.setupProblemsListeners();
  }

  private setupStreamingHandlers(): void {
    // Listen for streaming command output
    if (this.electronAPI) {
      this.electronAPI.onCommandOutputStream((data: string) => {
        this.appendToActiveTerminal(data);
      });

      this.electronAPI.onProcessStarted((info: { id: string; command: string }) => {
        this.runningProcesses.set(info.id, { 
          command: info.command, 
          started: new Date() 
        });
        this.updateTerminalStatus();
      });

      this.electronAPI.onProcessEnded((info: { id: string }) => {
        this.runningProcesses.delete(info.id);
        this.updateTerminalStatus();
      });
    }
  }

  private setupProblemsListeners(): void {
    // Listen for problems updates
    document.addEventListener('problems-updated', (event: any) => {
      this.renderTerminalTabs();
      this.updateTerminalDisplay();
    });

    document.addEventListener('problems-count-changed', (event: any) => {
      this.renderTerminalTabs(); // Update tab with new counts
    });
  }

  createNewTerminal(): string {
    const terminalId = `terminal-${this.state.terminalCounter++}`;
    const terminal: Terminal = {
      id: terminalId,
      name: `Terminal ${this.state.terminalCounter - 1}`,
      workingDirectory: this.state.currentWorkingDirectory,
      output: '',
      history: [],
      isActive: true,
      runningProcesses: new Set(),
      currentProcess: '',
      shell: this.getDefaultShell()
    };

    this.state.terminals.set(terminalId, terminal);
    this.state.activeTerminalId = terminalId;
    
    // Initialize the working directory for this terminal in the main process
    if (this.electronAPI && this.electronAPI.initTerminalWorkingDir) {
      this.electronAPI.initTerminalWorkingDir(terminalId, terminal.workingDirectory)
        .then(() => {
          console.log(`✅ Terminal ${terminalId} working directory initialized`);
        })
        .catch((error: any) => {
          console.error(`❌ Failed to initialize terminal working directory:`, error);
        });
    }
    
    this.renderTerminalTabs();
    this.initializeTerminalSession(terminalId);
    
    return terminalId;
  }

  private getDefaultShell(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) {
      return 'cmd.exe';
    } else if (userAgent.includes('mac')) {
      return '/bin/zsh';
    } else {
      return '/bin/bash';
    }
  }

  private initializeTerminalSession(terminalId: string): void {
    const terminal = this.state.terminals.get(terminalId);
    if (!terminal) return;

    const welcomeMessage = `\x1b[36m╭─────────────────────────────────────────────────────────────╮\x1b[0m
\x1b[36m│\x1b[0m \x1b[1;37mWelcome to ${terminal.name}\x1b[0m                                   \x1b[36m│\x1b[0m
\x1b[36m│\x1b[0m \x1b[90mWorking directory: ${terminal.workingDirectory}\x1b[0m
\x1b[36m╰─────────────────────────────────────────────────────────────╯\x1b[0m

`;
    terminal.output += welcomeMessage;
    terminal.history.push(welcomeMessage);
    
    this.updateTerminalDisplay();
    console.log(`Terminal ${terminalId} initialized`);
  }

  async executeCommand(command: string): Promise<void> {
    const activeTerminal = this.state.terminals.get(this.state.activeTerminalId);
    if (!activeTerminal) return;

    // Add to command history
    if (command.trim()) {
      this.commandHistory.push(command);
      this.historyIndex = this.commandHistory.length;
    }

    // Add command to output with styled prompt
    const prompt = this.getStyledPrompt(activeTerminal.workingDirectory);
    activeTerminal.output += `${prompt}${command}\n`;
    activeTerminal.history.push(command);

    try {
      if (this.electronAPI) {
        // Pass terminal ID for proper working directory tracking
        const result = await this.electronAPI.executeCommand(
          command, 
          activeTerminal.workingDirectory,
          activeTerminal.id
        );
        
        if (result.success) {
          if (result.output) {
            activeTerminal.output += result.output + '\n';
          }
          
          // Update working directory if it changed (especially for cd commands)
          if (result.workingDir && result.workingDir !== activeTerminal.workingDirectory) {
            console.log(`🔄 Working directory changed from ${activeTerminal.workingDirectory} to ${result.workingDir}`);
            activeTerminal.workingDirectory = result.workingDir;
            this.state.currentWorkingDirectory = result.workingDir;
            
            // Refresh file tree when directory changes
            this.triggerFileTreeRefresh();
          }
        } else {
          activeTerminal.output += `\x1b[91m❌ ${result.output}\x1b[0m\n`;
        }
      } else {
        activeTerminal.output += '\x1b[91m❌ Error: Electron API not available\x1b[0m\n';
      }
    } catch (error) {
      activeTerminal.output += `\x1b[91m❌ Error: ${error}\x1b[0m\n`;
    }

    this.updateTerminalDisplay();
  }

  private getStyledPrompt(workingDir: string): string {
    const shortDir = workingDir.split('/').pop() || workingDir;
    return `\x1b[36m╭─\x1b[0m \x1b[1;34m${shortDir}\x1b[0m
\x1b[36m╰─\x1b[0m \x1b[1;32m$\x1b[0m `;
  }

  private appendToActiveTerminal(data: string): void {
    const activeTerminal = this.state.terminals.get(this.state.activeTerminalId);
    if (activeTerminal) {
      activeTerminal.output += data;
      this.updateTerminalDisplay();
    }
  }

  private renderTerminalTabs(): void {
    const tabsContainer = document.querySelector('.terminal-tabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';
    
    // Terminal tabs
    this.state.terminals.forEach((terminal, terminalId) => {
      const tab = document.createElement('div');
      tab.className = `terminal-tab ${terminal.isActive && this.state.activeTerminalTab === 'terminal' ? 'active' : ''}`;
      
      const isRunning = this.runningProcesses.size > 0;
      const statusIcon = isRunning ? '🟢' : '⚫';
      
      tab.innerHTML = `
        <span class="terminal-tab-icon">${statusIcon}</span>
        <span class="terminal-tab-name">${terminal.name}</span>
        <button class="terminal-tab-close" onclick="window.app?.terminalManager?.closeTerminal('${terminalId}', event)">×</button>
      `;
      
      tab.onclick = (e) => {
        if (!(e.target as HTMLElement).classList.contains('terminal-tab-close')) {
          this.switchToTerminal(terminalId);
        }
      };
      
      tabsContainer.appendChild(tab);
    });

    // Problems tab
    const problemsTab = document.createElement('div');
    const problemsInfo = this.problemsManager.getProblemsTab();
    const problemsCount = this.problemsManager.getProblemsCount();
    
    problemsTab.className = `terminal-tab problems-tab ${this.state.activeTerminalTab === 'problems' ? 'active' : ''}`;
    
    let problemsIcon = '📋';
    if (problemsCount.errors > 0) {
      problemsIcon = '❌';
    } else if (problemsCount.warnings > 0) {
      problemsIcon = '⚠️';
    }
    
    let problemsLabel = 'Problems';
    if (problemsCount.total > 0) {
      const parts: string[] = [];
      if (problemsCount.errors > 0) parts.push(`${problemsCount.errors}`);
      if (problemsCount.warnings > 0) parts.push(`${problemsCount.warnings}`);
      if (parts.length > 0) {
        problemsLabel = `Problems ${parts.join('/')}`;
      }
    }
    
    problemsTab.innerHTML = `
      <span class="terminal-tab-icon">${problemsIcon}</span>
      <span class="terminal-tab-name">${problemsLabel}</span>
      <button class="problems-refresh-btn" onclick="event.stopPropagation(); window.problemsManager?.refreshProblems()" title="Refresh Problems">🔄</button>
    `;
    
    problemsTab.onclick = () => {
      this.switchToProblems();
    };
    
    tabsContainer.appendChild(problemsTab);

    // Add new terminal button
    const newTabButton = document.createElement('button');
    newTabButton.className = 'terminal-new-tab';
    newTabButton.innerHTML = '+ New Terminal';
    newTabButton.onclick = () => this.createNewTerminal();
    tabsContainer.appendChild(newTabButton);
  }

  private updateTerminalDisplay(): void {
    const terminalOutput = document.querySelector('.terminal-output');
    if (!terminalOutput) return;

    if (this.state.activeTerminalTab === 'problems') {
      // Show problems content
      const problemsInfo = this.problemsManager.getProblemsTab();
      terminalOutput.innerHTML = `
        <div class="problems-panel">
          ${problemsInfo.content}
        </div>
      `;
      this.injectProblemsStyles();
    } else {
      // Show terminal content
      const activeTerminal = this.state.terminals.get(this.state.activeTerminalId);
      if (!activeTerminal) return;

      const terminalContent = document.createElement('div');
      terminalContent.className = 'terminal-content';
      
      terminalContent.innerHTML = `
        <div class="terminal-scroll-content">
          <pre class="terminal-output-text">${this.ansiToHtml(activeTerminal.output)}</pre>
        </div>
        <div class="terminal-input-section">
          <div class="terminal-input-line">
            <span class="terminal-current-prompt">${this.getStyledPrompt(activeTerminal.workingDirectory)}</span>
            <input type="text" class="terminal-input" placeholder="Type a command..." />
          </div>
        </div>
      `;

      terminalOutput.innerHTML = '';
      terminalOutput.appendChild(terminalContent);

      // Setup input handling
      const input = terminalContent.querySelector('.terminal-input') as HTMLInputElement;
      if (input) {
        input.addEventListener('keydown', (e) => this.handleKeyDown(e, input));
        input.focus();
      }

      // Auto-scroll to bottom
      const scrollContent = terminalContent.querySelector('.terminal-scroll-content');
      if (scrollContent) {
        scrollContent.scrollTop = scrollContent.scrollHeight;
      }
    }
  }

  private handleKeyDown(e: KeyboardEvent, input: HTMLInputElement): void {
    switch (e.key) {
      case 'Enter':
        const command = input.value.trim();
        if (command) {
          this.executeCommand(command);
          input.value = '';
        }
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        if (this.historyIndex > 0) {
          this.historyIndex--;
          input.value = this.commandHistory[this.historyIndex] || '';
        }
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        if (this.historyIndex < this.commandHistory.length - 1) {
          this.historyIndex++;
          input.value = this.commandHistory[this.historyIndex] || '';
        } else {
          this.historyIndex = this.commandHistory.length;
          input.value = '';
        }
        break;
        
      case 'Tab':
        e.preventDefault();
        // TODO: Implement tab completion
        break;
        
      case 'c':
        if (e.ctrlKey) {
          e.preventDefault();
          this.killRunningProcesses();
        }
        break;
    }
  }

  private ansiToHtml(text: string): string {
    const ansiRegex = /\x1b\[[0-9;]*m/g;
    const ansiMap: { [key: string]: string } = {
      '\x1b[0m': '</span>',     // Reset
      '\x1b[1m': '<span class="bold">',      // Bold
      '\x1b[90m': '<span class="dim">',      // Dim
      '\x1b[91m': '<span class="red">',      // Red
      '\x1b[92m': '<span class="green">',    // Green
      '\x1b[93m': '<span class="yellow">',   // Yellow
      '\x1b[94m': '<span class="blue">',     // Blue
      '\x1b[95m': '<span class="magenta">',  // Magenta
      '\x1b[96m': '<span class="cyan">',     // Cyan
      '\x1b[97m': '<span class="white">',    // White
      '\x1b[30m': '<span class="black">',    // Black
      '\x1b[31m': '<span class="red">',      // Red
      '\x1b[32m': '<span class="green">',    // Green
      '\x1b[33m': '<span class="yellow">',   // Yellow
      '\x1b[34m': '<span class="blue">',     // Blue
      '\x1b[35m': '<span class="magenta">',  // Magenta
      '\x1b[36m': '<span class="cyan">',     // Cyan
      '\x1b[37m': '<span class="white">',    // White
      '\x1b[1;37m': '<span class="bold white">', // Bold White
      '\x1b[1;32m': '<span class="bold green">', // Bold Green
      '\x1b[1;34m': '<span class="bold blue">',  // Bold Blue
    };

    return text.replace(ansiRegex, (match) => ansiMap[match] || '');
  }

  private async killRunningProcesses(): Promise<void> {
    if (this.electronAPI) {
      try {
        await this.electronAPI.killProcess();
        this.appendToActiveTerminal('\n\x1b[93m^C Process interrupted\x1b[0m\n');
      } catch (error) {
        console.error('Failed to kill processes:', error);
      }
    }
  }

  private updateTerminalStatus(): void {
    this.renderTerminalTabs();
  }

  switchToProblems(): void {
    this.state.activeTerminalTab = 'problems';
    this.problemsManager.setActive(true);
    
    // Deactivate current terminal
    const currentTerminal = this.state.terminals.get(this.state.activeTerminalId);
    if (currentTerminal) {
      currentTerminal.isActive = false;
    }
    
    this.renderTerminalTabs();
    this.updateTerminalDisplay();
  }

  switchToTerminal(terminalId: string): void {
    if (!this.state.terminals.has(terminalId)) return;

    this.state.activeTerminalTab = 'terminal';
    this.problemsManager.setActive(false);

    // Deactivate current terminal
    const currentTerminal = this.state.terminals.get(this.state.activeTerminalId);
    if (currentTerminal) {
      currentTerminal.isActive = false;
    }

    // Activate new terminal
    const newTerminal = this.state.terminals.get(terminalId);
    if (newTerminal) {
      newTerminal.isActive = true;
      this.state.activeTerminalId = terminalId;
      this.state.currentWorkingDirectory = newTerminal.workingDirectory;
    }

    this.updateTerminalDisplay();
    this.renderTerminalTabs();
  }

  closeTerminal(terminalId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    this.state.terminals.delete(terminalId);

    if (this.state.activeTerminalId === terminalId) {
      const remainingTerminals = Array.from(this.state.terminals.keys());
      if (remainingTerminals.length > 0) {
        this.switchToTerminal(remainingTerminals[remainingTerminals.length - 1]);
      } else {
        this.state.activeTerminalId = '';
      }
    }

    this.renderTerminalTabs();
  }

  private injectProblemsStyles(): void {
    const existingStyle = document.getElementById('problems-styles');
    if (existingStyle) return; // Already injected

    const style = document.createElement('style');
    style.id = 'problems-styles';
    style.textContent = `
      .problems-panel {
        height: 100%;
        overflow-y: auto;
        background: #1e1e1e;
        color: #cccccc;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', 'Courier New', monospace;
      }

      .problems-container {
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .problems-header {
        border-bottom: 1px solid #333;
        padding: 8px 12px;
        background: #252526;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
      }

      .problems-filter-buttons {
        display: flex;
        gap: 8px;
      }

      .problems-filter-btn {
        background: transparent;
        border: 1px solid #555;
        color: #cccccc;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .problems-filter-btn:hover {
        background: #3c3c3c;
        border-color: #777;
      }

      .problems-filter-btn.active {
        background: #0e639c;
        border-color: #0e639c;
        color: white;
      }

      .problems-actions {
        display: flex;
        gap: 8px;
      }

      .problems-action-btn {
        background: transparent;
        border: 1px solid #555;
        color: #cccccc;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .problems-action-btn:hover {
        background: #3c3c3c;
        border-color: #777;
      }

      .problems-list {
        flex: 1;
        overflow-y: auto;
        padding: 4px;
      }

      .problems-file-group {
        margin-bottom: 8px;
      }

      .problems-file-header {
        background: #2d2d30;
        padding: 6px 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        border-radius: 4px;
        transition: background 0.2s;
      }

      .problems-file-header:hover {
        background: #3c3c3c;
      }

      .problems-file-expand {
        font-size: 10px;
        width: 12px;
        text-align: center;
      }

      .problems-file-icon {
        font-size: 14px;
      }

      .problems-file-name {
        font-weight: 600;
        font-size: 13px;
      }

      .problems-file-path {
        color: #888;
        font-size: 11px;
        margin-left: auto;
      }

      .problems-file-counts {
        display: flex;
        gap: 4px;
      }

      .problems-count-error {
        background: #dc3545;
        color: white;
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 600;
      }

      .problems-count-warning {
        background: #ffc107;
        color: black;
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 600;
      }

      .problems-file-items {
        padding-left: 16px;
      }

      .problems-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 6px 8px;
        cursor: pointer;
        border-radius: 4px;
        transition: background 0.2s;
        border-left: 3px solid transparent;
      }

      .problems-item:hover {
        background: #2d2d30;
      }

      .problems-severity-error {
        border-left-color: #dc3545;
      }

      .problems-severity-warning {
        border-left-color: #ffc107;
      }

      .problems-severity-info {
        border-left-color: #17a2b8;
      }

      .problems-item-icon {
        font-size: 14px;
        margin-top: 2px;
      }

      .problems-item-content {
        flex: 1;
        min-width: 0;
      }

      .problems-item-message {
        font-size: 13px;
        line-height: 1.4;
        word-wrap: break-word;
      }

      .problems-item-location {
        font-size: 11px;
        color: #888;
        margin-top: 2px;
      }

      .problems-item-actions {
        opacity: 0;
        transition: opacity 0.2s;
        display: flex;
        gap: 4px;
      }

      .problems-item:hover .problems-item-actions {
        opacity: 1;
      }

      .problems-item-action {
        background: transparent;
        border: none;
        color: #888;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 2px;
        font-size: 12px;
        transition: all 0.2s;
      }

      .problems-item-action:hover {
        background: #3c3c3c;
        color: #cccccc;
      }

      .problems-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        text-align: center;
        color: #888;
      }

      .problems-empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }

      .problems-empty-message {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
        color: #cccccc;
      }

      .problems-empty-subtitle {
        font-size: 14px;
      }

      .problems-tab.active {
        position: relative;
      }

      .problems-tab.active::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: #0e639c;
      }
    `;
    
    document.head.appendChild(style);
  }

  private async refreshFileTree(): Promise<void> {
    // Trigger file tree refresh
    const event = new CustomEvent('refresh-file-tree');
    document.dispatchEvent(event);
  }

  private triggerFileTreeRefresh(): void {
    // Trigger file tree refresh
    const event = new CustomEvent('refresh-file-tree');
    document.dispatchEvent(event);
    console.log('🔄 Triggered file tree refresh');
  }

  // Add method to handle file system changes
  handleFileSystemChange(event: { type: string; path: string }): void {
    console.log('File system changed:', event);
    this.refreshFileTree();
  }

  private setupFileSystemChangeListener(): void {
    if (this.electronAPI && this.electronAPI.onFileSystemChanged) {
      this.electronAPI.onFileSystemChanged((event: { type: string; path: string; parentPath: string }) => {
        console.log('📁 File system changed:', event);
        this.triggerFileTreeRefresh();
      });
    }
  }
}
