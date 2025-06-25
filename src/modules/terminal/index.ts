import { Terminal, AppState } from '../types/index.js';
import { ProblemsManager } from '../problems/index.js';

// Core modules
import { 
  TerminalStateManager, 
  TerminalInstanceManager,
  type TerminalState 
} from './core/index.js';

// Feature modules
import { 
  CommandHistoryManager, 
  CommandExecutor, 
  InteractiveModeManager,
  type InteractiveProcess 
} from './features/index.js';

// Streaming modules
import { 
  OutputHandler, 
  ProcessHandler,
  type ProcessInfo 
} from './streaming/index.js';

// UI modules
import { 
  TerminalRenderer, 
  TabsRenderer,
  type ProblemsTabInfo,
  type ProblemsCount 
} from './ui/index.js';

// Integration modules
import { 
  ProblemsIntegration, 
  FilesystemIntegration 
} from './integrations/index.js';

export class TerminalManager {
  // Core components
  private state: AppState;
  private stateManager: TerminalStateManager;
  private instanceManager: TerminalInstanceManager;
  
  // Feature components
  private historyManager: CommandHistoryManager;
  private commandExecutor: CommandExecutor;
  private interactiveManager: InteractiveModeManager;
  
  // Streaming components
  private outputHandler: OutputHandler;
  private processHandler: ProcessHandler;
  
  // UI components
  private terminalRenderer: TerminalRenderer;
  private tabsRenderer: TabsRenderer;
  
  // Integration components
  private problemsIntegration: ProblemsIntegration;
  private filesystemIntegration: FilesystemIntegration;

  constructor(state: AppState, problemsManager: ProblemsManager) {
    this.state = state;
    
    // Initialize core components
    this.stateManager = new TerminalStateManager(state);
    this.instanceManager = new TerminalInstanceManager();
    
    // Initialize feature components
    this.historyManager = new CommandHistoryManager();
    this.commandExecutor = new CommandExecutor();
    this.interactiveManager = new InteractiveModeManager();
    
    // Initialize streaming components
    this.outputHandler = new OutputHandler();
    this.processHandler = new ProcessHandler();
    
    // Initialize UI components
    this.terminalRenderer = new TerminalRenderer();
    this.tabsRenderer = new TabsRenderer();
    
    // Initialize integration components
    this.problemsIntegration = new ProblemsIntegration(problemsManager);
    this.filesystemIntegration = new FilesystemIntegration();
  }

  initialize(): void {
    console.log('🔧 Initializing modular terminal manager...');
    
    this.createNewTerminal();
    this.setupStreamingHandlers();
    this.setupEventListeners();
    
    // Initialize sub-modules
    this.problemsIntegration.initialize();
    this.filesystemIntegration.initialize();
    
    // Ensure initial terminal display is rendered
    this.updateTerminalDisplay();
    
    console.log('✅ Modular terminal manager initialized');
  }

  private setupStreamingHandlers(): void {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) {
      console.warn('⚠️ Electron API not available for terminal streaming');
      return;
    }

    // Setup output streaming
    electronAPI.onCommandOutputStream((data: string) => {
      console.log('📥 Received stream data:', data.substring(0, 100) + (data.length > 100 ? '...' : ''));
      this.appendToActiveTerminal(data);
    });

    // Setup process handlers
    this.processHandler.initialize({
      onProcessStarted: (info: ProcessInfo) => {
        console.log(`🟢 Process started: ${info.command} (${info.id})`);
        if (info.isInteractive) {
          this.interactiveManager.startInteractiveProcess(info.id, info.command);
          this.outputHandler.setInteractiveProcess(info.id);
        }
        this.updateTerminalStatus();
      },
      onProcessEnded: (id: string) => {
        console.log(`🔴 Process ended: ${id}`);
        this.interactiveManager.endInteractiveProcess(id);
        this.outputHandler.setInteractiveProcess(null);
        this.updateTerminalStatus();
      }
    });
  }

  private setupEventListeners(): void {
    // Terminal management events
    document.addEventListener('terminal-switch', (event: any) => {
      this.switchToTerminal(event.detail.terminalId);
    });

    document.addEventListener('terminal-switch-to-problems', () => {
      this.switchToProblems();
    });

    document.addEventListener('terminal-create-new', () => {
      this.createNewTerminal();
    });

    // Add the close event listener
    document.addEventListener('terminal-close', (event: any) => {
      console.log(`🎯 Terminal close event received for: ${event.detail.terminalId}`);
      this.closeTerminal(event.detail.terminalId);
    });

    // Problems integration events
    document.addEventListener('terminal-problems-updated', () => {
      if (this.state.terminalVisible && this.stateManager.getCurrentTab() === 'problems') {
        this.renderTabs();
        this.updateTerminalDisplay();
      } else {
        this.renderTabs();
      }
    });

    document.addEventListener('terminal-problems-count-changed', () => {
      this.renderTabs();
    });
  }

  private appendToActiveTerminal(data: string): void {
    const activeTerminal = this.stateManager.getActiveTerminal();
    if (activeTerminal) {
      const processedData = this.outputHandler.processOutput(data);
      activeTerminal.output += processedData;
      console.log('📝 Terminal output updated, length:', activeTerminal.output.length);
      this.updateTerminalDisplay();
    } else {
      console.warn('⚠️ No active terminal to append data to');
    }
  }

  private updateTerminalDisplay(): void {
    console.log('🔄 Updating terminal display...');
    const terminalOutput = document.querySelector('.terminal-output');
    if (!terminalOutput) {
      console.error('❌ Terminal output element not found');
      return;
    }

    if (this.stateManager.getCurrentTab() === 'problems') {
      const problemsInfo = this.problemsIntegration.getProblemsTab();
      terminalOutput.innerHTML = `
        <div class="problems-panel">
          ${problemsInfo.content}
        </div>
      `;
      this.problemsIntegration.injectProblemsStyles();
    } else {
      const activeTerminal = this.stateManager.getActiveTerminal();
      const allTerminals = this.stateManager.getAllTerminals();
      
      if (!activeTerminal || allTerminals.length === 0) {
        // Show empty state when no terminals exist
        terminalOutput.innerHTML = `
          <div class="terminal-empty-state" style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100%;
            color: #666;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', 'Courier New', monospace;
            text-align: center;
            padding: 2rem;
          ">
            <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">🖥️</div>
            <div style="font-size: 1.2rem; margin-bottom: 0.5rem; color: #888;">No terminal available</div>
            <div style="font-size: 0.9rem; opacity: 0.7; margin-bottom: 1.5rem;">Click '+ New Terminal' to create one</div>
            <button 
              onclick="document.dispatchEvent(new CustomEvent('terminal-create-new'))"
              style="
                background: #4a5568;
                color: #e2e8f0;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 0.375rem;
                cursor: pointer;
                font-family: inherit;
                font-size: 0.875rem;
                transition: background-color 0.2s;
              "
              onmouseover="this.style.backgroundColor='#2d3748'"
              onmouseout="this.style.backgroundColor='#4a5568'"
            >
              + Create New Terminal
            </button>
          </div>
        `;
        console.log('📄 Showing empty terminal state');
        return;
      }

      console.log('🖥️ Rendering terminal content, output length:', activeTerminal.output.length);
      
      const wasInputFocused = document.activeElement?.classList.contains('terminal-input');
      const isInteractive = this.interactiveManager.isInInteractiveMode();
      
      // Render terminal using the terminal renderer
      const terminalContent = this.terminalRenderer.render(activeTerminal, isInteractive);
      
      // Setup input handlers
      const input = this.terminalRenderer.setupInputHandlers(terminalContent, (e, input) => {
        this.handleKeyDown(e, input);
      });

      // Replace terminal output content
      terminalOutput.innerHTML = '';
      terminalOutput.appendChild(terminalContent);

      // Handle focus management with proper boolean type handling
      const shouldFocus = Boolean(
        wasInputFocused && 
        this.state.terminalVisible && 
        this.stateManager.getCurrentTab() === 'terminal' &&
        !this.isMonacoFocused()
      );
      
      this.terminalRenderer.focusInput(terminalContent, shouldFocus);
      this.terminalRenderer.scrollToBottom(terminalContent);
      
      console.log('✅ Terminal display updated successfully');
    }
  }

  private isMonacoFocused(): boolean {
    return !!(document.activeElement?.closest('#editor-container') || 
              document.activeElement?.closest('.monaco-editor'));
  }

  private handleKeyDown(e: KeyboardEvent, input: HTMLInputElement): void {
    switch (e.key) {
      case 'Enter':
        const command = input.value.trim();
        if (command) {
          console.log(`🎯 User entered command: "${command}"`);
          
          // Force exit interactive mode for git commands and other regular commands
          if (this.interactiveManager.isInInteractiveMode() && !this.shouldUseInteractiveMode(command)) {
            console.log('🔄 Exiting interactive mode for regular command');
            const currentProcess = this.interactiveManager.getCurrentProcess();
            if (currentProcess) {
              this.interactiveManager.endInteractiveProcess(currentProcess.id);
            }
          }
          
          if (this.interactiveManager.isInInteractiveMode()) {
            this.sendInteractiveInput(command);
          } else {
            this.executeCommand(command);
          }
          input.value = '';
        }
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        const prevCommand = this.historyManager.getPreviousCommand();
        if (prevCommand !== null) {
          input.value = prevCommand;
        }
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        const nextCommand = this.historyManager.getNextCommand();
        if (nextCommand !== null) {
          input.value = nextCommand;
        }
        break;
        
      case 'Tab':
        e.preventDefault();
        // Could add auto-completion in the future
        break;
        
      case 'c':
        if (e.ctrlKey) {
          e.preventDefault();
          this.killRunningProcesses();
        }
        break;
    }
  }

  private async sendInteractiveInput(input: string): Promise<void> {
    this.historyManager.resetIndex();
    const success = await this.interactiveManager.sendInput(input);
    if (!success) {
      console.error('❌ Failed to send interactive input');
    }
  }

  createNewTerminal(): string {
    const terminal = this.instanceManager.createTerminal(this.state.currentWorkingDirectory);
    this.stateManager.addTerminal(terminal);
    this.renderTabs();
    
    // Automatically update display when creating new terminal
    this.updateTerminalDisplay();
    
    console.log(`✅ Created new terminal: ${terminal.id}`);
    
    return terminal.id;
  }

  async executeCommand(command: string): Promise<void> {
    const activeTerminal = this.stateManager.getActiveTerminal();
    if (!activeTerminal) {
      console.error('❌ No active terminal for command execution');
      return;
    }

    console.log(`🔧 Executing command: "${command}" in terminal ${activeTerminal.id}`);
    console.log(`📂 Working directory: ${activeTerminal.workingDirectory}`);
    
    this.historyManager.addCommand(command);

    try {
      const result = await this.commandExecutor.executeCommand(command, activeTerminal);
      
      console.log(`📊 Command execution result:`, result);
      
      if (result.success && result.workingDir && result.workingDir !== activeTerminal.workingDirectory) {
        console.log(`🔄 Working directory changed from ${activeTerminal.workingDirectory} to ${result.workingDir}`);
        this.stateManager.updateWorkingDirectory(activeTerminal.id, result.workingDir);
        this.triggerFileTreeRefresh();
      }

      // Force terminal display update
      console.log('🔄 Forcing terminal display update after command execution');
      this.updateTerminalDisplay();
      console.log(`✅ Command executed successfully: "${command}"`);
    } catch (error) {
      console.error(`❌ Command execution failed: "${command}"`, error);
      // Still update display to show any error messages
      this.updateTerminalDisplay();
    }
  }

  switchToProblems(): void {
    this.stateManager.switchToProblemsTab();
    
    const currentTerminal = this.stateManager.getActiveTerminal();
    if (currentTerminal) {
      currentTerminal.isActive = false;
    }
    
    this.renderTabs();
    this.updateTerminalDisplay();
    console.log('🔄 Switched to problems tab');
  }

  switchToTerminal(terminalId: string): void {
    if (!this.stateManager.getTerminalById(terminalId)) {
      console.error(`❌ Terminal not found: ${terminalId}`);
      return;
    }

    this.stateManager.switchToTerminalTab();
    this.stateManager.setActiveTerminal(terminalId);

    this.updateTerminalDisplay();
    this.renderTabs();
    
    console.log(`🔄 Switched to terminal: ${terminalId}`);
    
    // Focus input after switching
    setTimeout(() => {
      const input = document.querySelector('.terminal-input') as HTMLInputElement;
      if (input && this.stateManager.getCurrentTab() === 'terminal') {
        input.focus();
      }
    }, 100);
  }

  closeTerminal(terminalId: string, event?: Event): void {
    console.log(`🗑️ Attempting to close terminal: ${terminalId}`);
    
    if (event) {
      event.stopPropagation();
    }

    const terminal = this.stateManager.getTerminalById(terminalId);
    if (!terminal) {
      console.error(`❌ Cannot close terminal - not found: ${terminalId}`);
      return;
    }

    // ALWAYS kill any running processes first, regardless of whether we're closing or clearing
    this.killTerminalProcesses(terminalId);

    // Check if this is the last terminal - if so, don't allow closing
    const allTerminals = this.stateManager.getAllTerminals();
    if (allTerminals.length <= 1) {
      console.log(`⚠️ Cannot close last terminal - clearing content instead`);
      
      // Clear the terminal content but keep it alive
      terminal.output = '';
      terminal.history = [];
      
      // Clear interactive mode
      const currentProcess = this.interactiveManager.getCurrentProcess();
      if (currentProcess) {
        this.interactiveManager.endInteractiveProcess(currentProcess.id);
      }
      
      // Update the display to show the cleared terminal
      this.updateTerminalDisplay();
      
      console.log(`✅ Cleared terminal content instead of closing: ${terminal.name}`);
      return;
    }

    console.log(`✅ Found terminal to close: ${terminal.name} (${allTerminals.length} terminals total)`);

    // Clear interactive mode if this terminal is in interactive mode
    const currentProcess = this.interactiveManager.getCurrentProcess();
    if (currentProcess && currentProcess.id.includes(terminalId)) {
      this.interactiveManager.endInteractiveProcess(currentProcess.id);
    }

    // Remove terminal from state
    const wasRemoved = this.stateManager.removeTerminal(terminalId);
    
    if (wasRemoved) {
      console.log(`✅ Successfully closed terminal: ${terminalId}`);
      
      // Update the display to reflect the change
      this.renderTabs();
      this.updateTerminalDisplay();
    } else {
      console.error(`❌ Failed to remove terminal from state: ${terminalId}`);
    }
  }

  // Enhanced method to kill processes specific to a terminal
  private async killTerminalProcesses(terminalId: string): Promise<void> {
    try {
      console.log(`🛑 Killing all processes for terminal: ${terminalId}`);
      
      // Kill ALL running processes when closing a terminal
      // This is more aggressive but ensures dev servers and other long-running processes are terminated
      const result = await this.processHandler.killProcess();
      
      // Also clear interactive mode for any processes
      const currentProcess = this.interactiveManager.getCurrentProcess();
      if (currentProcess) {
        this.interactiveManager.endInteractiveProcess(currentProcess.id);
        console.log(`🛑 Ended interactive process: ${currentProcess.id}`);
      }
      
      // Additional aggressive cleanup - kill via electron API
      if ((window as any).electronAPI) {
        try {
          await (window as any).electronAPI.killProcess();
          console.log(`🛑 Sent kill signal via electron API`);
        } catch (error) {
          console.warn('Failed to kill via electron API:', error);
        }
      }
      
      console.log(`✅ Successfully killed processes for terminal ${terminalId}`);
    } catch (error) {
      console.error(`❌ Failed to kill processes for terminal ${terminalId}:`, error);
    }
  }

  private renderTabs(): void {
    const terminals = this.stateManager.getAllTerminals();
    const runningProcesses = this.processHandler.getRunningProcesses();
    const problemsTabInfo = this.problemsIntegration.getProblemsTab();
    const problemsCount = this.problemsIntegration.getProblemsCount();

    this.tabsRenderer.renderTabs(
      terminals,
      this.state.activeTerminalId,
      this.stateManager.getCurrentTab(),
      runningProcesses,
      problemsTabInfo,
      problemsCount
    );
  }

  private updateTerminalStatus(): void {
    this.renderTabs();
  }

  private triggerFileTreeRefresh(): void {
    const event = new CustomEvent('refresh-file-tree');
    document.dispatchEvent(event);
    console.log('🔄 Triggered file tree refresh');
  }

  private async killRunningProcesses(): Promise<void> {
    try {
      console.log('🛑 Attempting to kill running processes with Ctrl+C...');
      
      // Get the count of running processes before killing
      const runningProcesses = this.processHandler.getRunningProcesses();
      const processCount = runningProcesses.size;
      
      if (processCount === 0) {
        console.log('ℹ️ No running processes to kill');
        this.appendToActiveTerminal('\n\x1b[93m^C No running processes\x1b[0m\n');
        return;
      }
      
      console.log(`🛑 Killing ${processCount} running processes...`);
      
      // First attempt: Regular kill
      await this.processHandler.killProcess();
      
      // Clear interactive mode when killing processes
      const currentProcess = this.interactiveManager.getCurrentProcess();
      if (currentProcess) {
        this.interactiveManager.endInteractiveProcess(currentProcess.id);
        console.log(`🛑 Ended interactive process: ${currentProcess.id}`);
      }
      
      // Additional aggressive cleanup for stubborn processes like Next.js dev servers
      if ((window as any).electronAPI) {
        try {
          // Send additional kill signals via electron API
          await (window as any).electronAPI.killProcess();
          console.log(`🛑 Sent additional kill signal via electron API`);
          
          // Wait a moment and check if processes are still running
          setTimeout(async () => {
            const stillRunning = this.processHandler.getRunningProcesses();
            if (stillRunning.size > 0) {
              console.log(`⚠️ ${stillRunning.size} processes still running, sending SIGKILL...`);
              // Send SIGKILL for stubborn processes
              try {
                await (window as any).electronAPI.killProcess();
              } catch (error) {
                console.warn('Failed to send SIGKILL:', error);
              }
            }
          }, 2000);
          
        } catch (error) {
          console.warn('Failed to kill via electron API:', error);
        }
      }
      
      this.appendToActiveTerminal('\n\x1b[93m^C Process interrupted\x1b[0m\n');
      console.log('🛑 Killed running processes via Ctrl+C');
      
    } catch (error) {
      console.error('❌ Failed to kill processes:', error);
      this.appendToActiveTerminal('\n\x1b[91m^C Failed to interrupt process\x1b[0m\n');
    }
  }

  // Public API methods for external access
  public async debugPackageManager(): Promise<void> {
    const activeTerminal = this.stateManager.getActiveTerminal();
    if (!activeTerminal) return;

    activeTerminal.output += `\x1b[36m🔍 Debugging package manager setup...\x1b[0m\n`;
    
    console.log('🔧 Running package manager debug commands...');
    
    try {
      await this.executeCommand('node --version');
      await this.executeCommand('npm --version');
      await this.executeCommand('npm config get registry');
      await this.executeCommand('yarn --version');
      await this.executeCommand('pwd');
      await this.executeCommand('ls -la');
      
      activeTerminal.output += `\x1b[36m✅ Debug info collected\x1b[0m\n`;
      console.log('✅ Package manager debug completed');
    } catch (error) {
      console.error('❌ Package manager debug failed:', error);
      activeTerminal.output += `\x1b[91m❌ Debug failed: ${error}\x1b[0m\n`;
    }
  }

  public handleFileSystemChange(event: { type: string; path: string }): void {
    this.filesystemIntegration.handleFileSystemChange(event);
  }

  // Expose the terminal state for external components
  public getActiveTerminal(): Terminal | undefined {
    return this.stateManager.getActiveTerminal();
  }

  public getAllTerminals(): Terminal[] {
    return this.stateManager.getAllTerminals();
  }

  public isInInteractiveMode(): boolean {
    return this.interactiveManager.isInInteractiveMode();
  }

  public hasRunningProcesses(): boolean {
    return this.processHandler.hasRunningProcesses();
  }

  // Add a debug method to test git commands
  public async testGitCommand(): Promise<void> {
    console.log('🧪 Testing git command execution...');
    await this.executeCommand('git status');
  }

  // Add this helper method
  private shouldUseInteractiveMode(command: string): boolean {
    // Only use interactive mode for truly interactive commands
    const interactiveCommands = [
      'python', 'node', 'irb', 'rails console', 'mysql', 'psql'
    ];
    
    return interactiveCommands.some(cmd => command.startsWith(cmd));
  }
}
