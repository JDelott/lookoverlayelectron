import { Terminal } from '../../types/index.js';
import { AnsiProcessor } from '../utils/index.js';

export class TerminalRenderer {
  render(terminal: Terminal, isInteractive: boolean): HTMLElement {
    const terminalContent = document.createElement('div');
    terminalContent.className = 'terminal-content';
    
    const promptText = this.getStyledPrompt(terminal.workingDirectory);
    const placeholderText = isInteractive ? "Enter your response..." : "Type a command...";
    
    terminalContent.innerHTML = `
      <div class="terminal-scroll-content">
        <pre class="terminal-output-text">${AnsiProcessor.toHtml(terminal.output)}</pre>
      </div>
      <div class="terminal-input-section">
        <div class="terminal-input-line">
          <span class="terminal-current-prompt">${AnsiProcessor.toHtml(promptText)}</span>
          <input type="text" class="terminal-input" placeholder="${placeholderText}" />
        </div>
      </div>
    `;

    return terminalContent;
  }

  private getStyledPrompt(workingDir: string): string {
    const shortDir = workingDir.split('/').pop() || workingDir;
    return `\x1b[36m╭─\x1b[0m \x1b[1;34m${shortDir}\x1b[0m
\x1b[36m╰─\x1b[0m \x1b[1;32m$\x1b[0m `;
  }

  setupInputHandlers(terminalContent: HTMLElement, keyHandler: (e: KeyboardEvent, input: HTMLInputElement) => void): HTMLInputElement | null {
    const input = terminalContent.querySelector('.terminal-input') as HTMLInputElement;
    if (input) {
      input.addEventListener('keydown', (e) => keyHandler(e, input));
    }
    return input;
  }

  focusInput(terminalContent: HTMLElement, shouldFocus: boolean): void {
    if (!shouldFocus) return;
    
    const input = terminalContent.querySelector('.terminal-input') as HTMLInputElement;
    if (input) {
      setTimeout(() => input.focus(), 0);
    }
  }

  scrollToBottom(terminalContent: HTMLElement): void {
    const scrollContent = terminalContent.querySelector('.terminal-scroll-content');
    if (scrollContent) {
      scrollContent.scrollTop = scrollContent.scrollHeight;
    }
  }
}
