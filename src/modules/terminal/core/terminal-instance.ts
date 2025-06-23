import { Terminal } from '../../types/index.js';

export class TerminalInstanceManager {
  private electronAPI: any;
  private terminalCounter = 1;

  constructor() {
    this.electronAPI = (window as any).electronAPI;
  }

  createTerminal(workingDirectory: string): Terminal {
    const terminalId = `terminal-${this.terminalCounter++}`;
    const terminal: Terminal = {
      id: terminalId,
      name: `Terminal ${this.terminalCounter - 1}`,
      workingDirectory,
      output: '',
      history: [],
      isActive: true,
      runningProcesses: new Set(),
      currentProcess: '',
      shell: this.getDefaultShell()
    };

    this.initializeTerminalSession(terminal);
    
    if (this.electronAPI && this.electronAPI.initTerminalWorkingDir) {
      this.electronAPI.initTerminalWorkingDir(terminalId, workingDirectory)
        .then(() => {
          console.log(`✅ Terminal ${terminalId} working directory initialized`);
        })
        .catch((error: any) => {
          console.error(`❌ Failed to initialize terminal working directory:`, error);
        });
    }
    
    return terminal;
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

  private initializeTerminalSession(terminal: Terminal): void {
    const welcomeMessage = `\x1b[36m╭─────────────────────────────────────────────────────────────╮\x1b[0m
\x1b[36m│\x1b[0m \x1b[1;37mWelcome to ${terminal.name}\x1b[0m                                   \x1b[36m│\x1b[0m
\x1b[36m│\x1b[0m \x1b[90mWorking directory: ${terminal.workingDirectory}\x1b[0m
\x1b[36m╰─────────────────────────────────────────────────────────────╯\x1b[0m

`;
    terminal.output += welcomeMessage;
    terminal.history.push(welcomeMessage);
    
    console.log(`Terminal ${terminal.id} initialized`);
  }

  getStyledPrompt(workingDir: string): string {
    const shortDir = workingDir.split('/').pop() || workingDir;
    return `\x1b[36m╭─\x1b[0m \x1b[1;34m${shortDir}\x1b[0m
\x1b[36m╰─\x1b[0m \x1b[1;32m$\x1b[0m `;
  }
}
