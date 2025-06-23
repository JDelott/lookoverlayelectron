export class CommandHistoryManager {
  private commandHistory: string[] = [];
  private historyIndex = -1;

  addCommand(command: string): void {
    if (command.trim()) {
      this.commandHistory.push(command);
      this.historyIndex = this.commandHistory.length;
    }
  }

  getPreviousCommand(): string | null {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      return this.commandHistory[this.historyIndex] || '';
    }
    return null;
  }

  getNextCommand(): string | null {
    if (this.historyIndex < this.commandHistory.length - 1) {
      this.historyIndex++;
      return this.commandHistory[this.historyIndex] || '';
    } else {
      this.historyIndex = this.commandHistory.length;
      return '';
    }
  }

  getHistory(): string[] {
    return [...this.commandHistory];
  }

  clearHistory(): void {
    this.commandHistory = [];
    this.historyIndex = -1;
  }

  resetIndex(): void {
    this.historyIndex = this.commandHistory.length;
  }
}
