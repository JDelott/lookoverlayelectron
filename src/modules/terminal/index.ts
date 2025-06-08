import { Terminal, AppState } from '../types';

export class TerminalManager {
  private state: AppState;
  private electronAPI: any;
  private commandHistory: string[] = [];
  private historyIndex = -1;
  private runningProcesses = new Map<string, { command: string; started: Date }>();

  constructor(state: AppState) {
    this.state = state;
    this.electronAPI = (window as any).electronAPI;
  }

  initialize(): void {
    this.createNewTerminal();
    this.setupStreamingHandlers();
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
        const result = await this.electronAPI.executeCommand(command, activeTerminal.workingDirectory);
        
        if (result.success) {
          if (result.output) {
            activeTerminal.output += result.output + '\n';
          }
          // Update working directory if it changed
          if (result.workingDir) {
            activeTerminal.workingDirectory = result.workingDir;
          }
        } else {
          activeTerminal.output += `\x1b[91m❌ Error: ${result.output}\x1b[0m\n`;
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
    
    this.state.terminals.forEach((terminal, terminalId) => {
      const tab = document.createElement('div');
      tab.className = `terminal-tab ${terminal.isActive ? 'active' : ''}`;
      
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

    const activeTerminal = this.state.terminals.get(this.state.activeTerminalId);
    if (!activeTerminal) return;

    // Convert ANSI codes to HTML
    const formattedOutput = this.ansiToHtml(activeTerminal.output);
    const currentPrompt = this.getStyledPrompt(activeTerminal.workingDirectory);

    terminalOutput.innerHTML = `
      <div class="terminal-content">
        <div class="terminal-scroll-content">
          <pre class="terminal-output-text">${formattedOutput}</pre>
        </div>
        <div class="terminal-input-section">
          <div class="terminal-input-line">
            <span class="terminal-current-prompt">${this.ansiToHtml(currentPrompt)}</span>
            <input type="text" class="terminal-input" placeholder="" spellcheck="false" autocomplete="off" />
          </div>
        </div>
      </div>
    `;

    // Setup input handling
    const input = terminalOutput.querySelector('.terminal-input') as HTMLInputElement;
    if (input) {
      input.focus();
      input.addEventListener('keydown', (e) => this.handleKeyDown(e, input));
    }

    // Scroll to bottom
    const scrollContent = terminalOutput.querySelector('.terminal-scroll-content');
    if (scrollContent) {
      scrollContent.scrollTop = scrollContent.scrollHeight;
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

  switchToTerminal(terminalId: string): void {
    if (!this.state.terminals.has(terminalId)) return;

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
    this.updateActiveTerminalTab();
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

  private updateActiveTerminalTab(): void {
    const tabs = document.querySelectorAll('.terminal-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    const activeTerminal = this.state.terminals.get(this.state.activeTerminalId);
    if (activeTerminal) {
      const activeTab = Array.from(tabs).find(tab => 
        tab.querySelector('.terminal-tab-name')?.textContent === activeTerminal.name
      );
      if (activeTab) {
        activeTab.classList.add('active');
      }
    }
  }

  toggleTerminal(): void {
    if ((window as any).layoutManager) {
      (window as any).layoutManager.toggleTerminal();
    } else {
      this.state.terminalVisible = !this.state.terminalVisible;
      console.warn('Layout manager not available, using fallback toggle');
    }
  }
}
