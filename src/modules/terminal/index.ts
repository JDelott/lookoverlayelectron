import { Terminal, AppState } from '../types';

export class TerminalManager {
  private state: AppState;
  private ipcRenderer: any;

  constructor(state: AppState) {
    this.state = state;
    this.ipcRenderer = (window as any).electronAPI || (window as any).require?.('electron').ipcRenderer;
  }

  initialize(): void {
    this.createNewTerminal();
    this.setupTerminalResize();
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
      shell: this.detectShell()
    };

    this.state.terminals.set(terminalId, terminal);
    this.state.activeTerminalId = terminalId;
    
    this.renderTerminalTabs();
    this.initializeTerminalSession(terminalId);
    
    return terminalId;
  }

  private async initializeTerminalSession(terminalId: string): Promise<void> {
    try {
      await this.ipcRenderer.invoke('start-terminal', terminalId, this.state.currentWorkingDirectory);
      this.writeToTerminal(`Welcome to terminal ${terminalId}\n`);
      this.writeToTerminal(`Working directory: ${this.state.currentWorkingDirectory}\n`);
      this.writeToTerminal('$ ');
    } catch (error) {
      console.error('Failed to initialize terminal session:', error);
    }
  }

  async executeCommand(command: string): Promise<void> {
    if (!this.state.activeTerminalId) return;

    const terminal = this.state.terminals.get(this.state.activeTerminalId);
    if (!terminal) return;

    terminal.history.push(command);
    this.writeToTerminal(`${command}\n`);

    try {
      if (command.trim().startsWith('cd ')) {
        await this.handleCdCommand(command.trim().split(' ').slice(1));
      } else {
        await this.ipcRenderer.invoke('execute-command', this.state.activeTerminalId, command);
      }
    } catch (error) {
      this.writeToTerminal(`Error: ${error}\n`);
    }
  }

  private async handleCdCommand(args: string[]): Promise<void> {
    const terminal = this.state.terminals.get(this.state.activeTerminalId);
    if (!terminal) return;

    try {
      const newPath = args.length > 0 ? args[0] : '~';
      const result = await this.ipcRenderer.invoke('change-directory', newPath);
      
      if (result.success) {
        terminal.workingDirectory = result.path;
        this.state.currentWorkingDirectory = result.path;
        this.writeToTerminal(`Changed directory to: ${result.path}\n`);
      } else {
        this.writeToTerminal(`cd: ${result.error}\n`);
      }
    } catch (error) {
      this.writeToTerminal(`cd: ${error}\n`);
    }

    this.writeToTerminal('$ ');
  }

  writeToTerminal(text: string): void {
    const terminal = this.state.terminals.get(this.state.activeTerminalId);
    if (!terminal) return;

    terminal.output += text;
    
    const terminalOutput = document.querySelector('.terminal-output') as HTMLElement;
    if (terminalOutput) {
      terminalOutput.innerHTML += this.escapeHtml(text).replace(/\n/g, '<br>');
      terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }
  }

  clearTerminal(): void {
    const terminal = this.state.terminals.get(this.state.activeTerminalId);
    if (!terminal) return;

    terminal.output = '';
    
    const terminalOutput = document.querySelector('.terminal-output') as HTMLElement;
    if (terminalOutput) {
      terminalOutput.innerHTML = '';
    }
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

  toggleTerminal(): void {
    this.state.terminalVisible = !this.state.terminalVisible;
    if ((window as any).layoutManager) {
      (window as any).layoutManager.toggleTerminal();
    }
  }

  private updateTerminalDisplay(): void {
    const terminalOutput = document.querySelector('.terminal-output') as HTMLElement;
    if (terminalOutput) {
      const terminal = this.state.terminals.get(this.state.activeTerminalId);
      if (terminal) {
        terminalOutput.innerHTML = this.escapeHtml(terminal.output).replace(/\n/g, '<br>');
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
      } else {
        terminalOutput.innerHTML = '';
      }
    }
  }

  private renderTerminalTabs(): void {
    const tabContainer = document.querySelector('.terminal-tabs') as HTMLElement;
    if (!tabContainer) return;

    tabContainer.innerHTML = '';

    this.state.terminals.forEach((terminal, terminalId) => {
      const tabElement = document.createElement('div');
      tabElement.className = `
        flex items-center px-3 py-1 cursor-pointer text-sm border-r border-gray-600
        ${terminal.isActive ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}
        transition-colors
      `;
      
      const name = document.createElement('span');
      name.textContent = terminal.name;
      
      const closeBtn = document.createElement('button');
      closeBtn.className = 'ml-2 px-1 rounded text-gray-400 hover:text-white hover:bg-gray-600';
      closeBtn.innerHTML = '×';
      closeBtn.onclick = (e) => this.closeTerminal(terminalId, e);
      
      tabElement.appendChild(name);
      tabElement.appendChild(closeBtn);
      
      tabElement.onclick = () => this.switchToTerminal(terminalId);
      
      tabContainer.appendChild(tabElement);
    });

    // Add new terminal button
    const newTerminalBtn = document.createElement('button');
    newTerminalBtn.className = `
      px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white
      border-r border-gray-600 transition-colors
    `;
    newTerminalBtn.innerHTML = '+';
    newTerminalBtn.onclick = () => this.createNewTerminal();
    
    tabContainer.appendChild(newTerminalBtn);
  }

  private updateActiveTerminalTab(): void {
    const tabs = document.querySelectorAll('.terminal-tabs > div');
    tabs.forEach((tab, index) => {
      const terminalId = Array.from(this.state.terminals.keys())[index];
      if (terminalId === this.state.activeTerminalId) {
        tab.classList.add('bg-gray-700', 'text-white');
        tab.classList.remove('bg-gray-800', 'text-gray-400');
      } else {
        tab.classList.remove('bg-gray-700', 'text-white');
        tab.classList.add('bg-gray-800', 'text-gray-400');
      }
    });
  }

  private setupTerminalResize(): void {
    // The layout manager now handles terminal resizing
    // This method can be simplified or removed entirely
  }

  private detectShell(): string {
    if (process.platform === 'win32') return 'cmd.exe';
    if (process.platform === 'darwin') return '/bin/zsh';
    return '/bin/bash';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
