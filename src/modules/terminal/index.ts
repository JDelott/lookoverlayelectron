import { Terminal, AppState } from '../types';

export class TerminalManager {
  private state: AppState;
  private electronAPI: any;

  constructor(state: AppState) {
    this.state = state;
    this.electronAPI = (window as any).electronAPI;
  }

  initialize(): void {
    this.createNewTerminal();
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
      shell: this.getDefaultShell() // Use a simple default instead of detecting
    };

    this.state.terminals.set(terminalId, terminal);
    this.state.activeTerminalId = terminalId;
    
    this.renderTerminalTabs();
    this.initializeTerminalSession(terminalId);
    
    return terminalId;
  }

  private getDefaultShell(): string {
    // Simple default shell detection without using process
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

    const welcomeMessage = `Welcome to Terminal ${terminal.name}\nWorking directory: ${terminal.workingDirectory}\n\n`;
    terminal.output += welcomeMessage;
    terminal.history.push(welcomeMessage);
    
    this.updateTerminalDisplay();
    console.log(`Terminal ${terminalId} initialized`);
  }

  async executeCommand(command: string): Promise<void> {
    const activeTerminal = this.state.terminals.get(this.state.activeTerminalId);
    if (!activeTerminal) return;

    // Add command to output
    activeTerminal.output += `$ ${command}\n`;
    activeTerminal.history.push(command);

    try {
      if (this.electronAPI) {
        const result = await this.electronAPI.executeCommand(command, activeTerminal.workingDirectory);
        
        if (result.success) {
          activeTerminal.output += result.output + '\n';
          // Update working directory if it changed
          if (result.workingDir) {
            activeTerminal.workingDirectory = result.workingDir;
          }
        } else {
          activeTerminal.output += `Error: ${result.output}\n`;
        }
      } else {
        activeTerminal.output += 'Error: Electron API not available\n';
      }
    } catch (error) {
      activeTerminal.output += `Error: ${error}\n`;
    }

    this.updateTerminalDisplay();
  }

  private renderTerminalTabs(): void {
    const tabsContainer = document.querySelector('.terminal-tabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';
    
    this.state.terminals.forEach((terminal, terminalId) => {
      const tab = document.createElement('div');
      tab.className = `terminal-tab ${terminal.isActive ? 'active' : ''}`;
      tab.innerHTML = `
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
    newTabButton.innerHTML = '+';
    newTabButton.onclick = () => this.createNewTerminal();
    tabsContainer.appendChild(newTabButton);
  }

  private updateTerminalDisplay(): void {
    const terminalOutput = document.querySelector('.terminal-output');
    if (!terminalOutput) return;

    const activeTerminal = this.state.terminals.get(this.state.activeTerminalId);
    if (!activeTerminal) return;

    terminalOutput.innerHTML = `
      <div class="terminal-content">
        <pre>${activeTerminal.output}</pre>
        <div class="terminal-input-line">
          <span class="terminal-prompt">$ </span>
          <input type="text" class="terminal-input" placeholder="Enter command..." />
        </div>
      </div>
    `;

    // Setup input handling
    const input = terminalOutput.querySelector('.terminal-input') as HTMLInputElement;
    if (input) {
      input.focus();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const command = input.value.trim();
          if (command) {
            this.executeCommand(command);
            input.value = '';
          }
        }
      });
    }

    // Scroll to bottom
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
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
    // Let the layout manager handle the toggle
    if ((window as any).layoutManager) {
      (window as any).layoutManager.toggleTerminal();
    } else {
      // Fallback if layout manager isn't available
      this.state.terminalVisible = !this.state.terminalVisible;
      console.warn('Layout manager not available, using fallback toggle');
    }
  }
}
