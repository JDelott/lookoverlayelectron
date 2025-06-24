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
      if (!activeTerminal) {
        console.error('❌ No active terminal for display update');
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
    if (event) {
      event.stopPropagation();
    }

    const terminal = this.stateManager.getTerminalById(terminalId);
    if (!terminal) {
      console.error(`❌ Cannot close terminal - not found: ${terminalId}`);
      return;
    }

    this.stateManager.removeTerminal(terminalId);
    this.renderTabs();
    console.log(`🗑️ Closed terminal: ${terminalId}`);
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
      await this.processHandler.killProcess();
      this.appendToActiveTerminal('\n\x1b[93m^C Process interrupted\x1b[0m\n');
      
      // Clear interactive mode when killing processes
      this.interactiveManager.endInteractiveProcess(this.interactiveManager.getCurrentProcess()?.id || '');
      
      console.log('🛑 Killed running processes');
    } catch (error) {
      console.error('❌ Failed to kill processes:', error);
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
