import { Terminal, AppState } from '../../types/index.js';

export interface TerminalState {
  terminals: Map<string, Terminal>;
  activeTerminalId: string;
  terminalCounter: number;
  currentWorkingDirectory: string;
  activeTerminalTab: 'terminal' | 'problems';
}

export class TerminalStateManager {
  private state: AppState;

  constructor(state: AppState) {
    this.state = state;
    
    if (!this.state.activeTerminalTab) {
      this.state.activeTerminalTab = 'terminal';
    }
  }

  getActiveTerminal(): Terminal | undefined {
    return this.state.terminals.get(this.state.activeTerminalId);
  }

  setActiveTerminal(terminalId: string): void {
    const currentTerminal = this.state.terminals.get(this.state.activeTerminalId);
    if (currentTerminal) {
      currentTerminal.isActive = false;
    }

    const newTerminal = this.state.terminals.get(terminalId);
    if (newTerminal) {
      newTerminal.isActive = true;
      this.state.activeTerminalId = terminalId;
      this.state.currentWorkingDirectory = newTerminal.workingDirectory;
    }
  }

  addTerminal(terminal: Terminal): void {
    this.state.terminals.set(terminal.id, terminal);
    this.state.activeTerminalId = terminal.id;
  }

  removeTerminal(terminalId: string): boolean {
    const removed = this.state.terminals.delete(terminalId);
    
    if (this.state.activeTerminalId === terminalId) {
      const remainingTerminals = Array.from(this.state.terminals.keys());
      if (remainingTerminals.length > 0) {
        this.setActiveTerminal(remainingTerminals[remainingTerminals.length - 1]);
      } else {
        this.state.activeTerminalId = '';
      }
    }
    
    return removed;
  }

  getAllTerminals(): Terminal[] {
    return Array.from(this.state.terminals.values());
  }

  getTerminalById(id: string): Terminal | undefined {
    return this.state.terminals.get(id);
  }

  switchToTerminalTab(): void {
    this.state.activeTerminalTab = 'terminal';
  }

  switchToProblemsTab(): void {
    this.state.activeTerminalTab = 'problems';
  }

  getCurrentTab(): 'terminal' | 'problems' {
    return this.state.activeTerminalTab;
  }

  updateWorkingDirectory(terminalId: string, newPath: string): void {
    const terminal = this.state.terminals.get(terminalId);
    if (terminal) {
      terminal.workingDirectory = newPath;
      if (terminalId === this.state.activeTerminalId) {
        this.state.currentWorkingDirectory = newPath;
      }
    }
  }
}
