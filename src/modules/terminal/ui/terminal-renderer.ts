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

    // Add copy/paste keyboard shortcuts
    this.setupCopyPasteHandlers(terminalContent);

    return terminalContent;
  }

  private setupCopyPasteHandlers(terminalContent: HTMLElement): void {
    const scrollContent = terminalContent.querySelector('.terminal-scroll-content') as HTMLElement;
    const terminalInput = terminalContent.querySelector('.terminal-input') as HTMLInputElement;
    
    if (scrollContent && terminalInput) {
      // Handle copy operation with Cmd+C (Mac) or Ctrl+C (Windows/Linux)
      terminalContent.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const copyKey = isMac ? e.metaKey : e.ctrlKey;
        
        if (copyKey && e.key === 'c') {
          const selection = window.getSelection();
          if (selection && selection.toString().length > 0) {
            // There's selected text - allow copy
            e.stopPropagation(); // Prevent terminal interrupt
            this.copySelectedText();
          }
        }
        
        // Handle paste with Cmd+V (Mac) or Ctrl+V (Windows/Linux)
        if (copyKey && e.key === 'v') {
          e.preventDefault();
          this.pasteToInput(terminalInput);
        }
      });

      // Add right-click context menu
      scrollContent.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(e, scrollContent);
      });
    }
  }

  private copySelectedText(): void {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      const selectedText = selection.toString();
      
      // Use the Clipboard API if available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(selectedText).then(() => {
          console.log('📋 Text copied to clipboard');
        }).catch(err => {
          console.error('Failed to copy text:', err);
          this.fallbackCopy(selectedText);
        });
      } else {
        this.fallbackCopy(selectedText);
      }
    }
  }

  private fallbackCopy(text: string): void {
    // Fallback for browsers that don't support Clipboard API
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      console.log('📋 Text copied to clipboard (fallback)');
    } catch (err) {
      console.error('Fallback copy failed:', err);
    }
    
    document.body.removeChild(textArea);
  }

  private async pasteToInput(input: HTMLInputElement): Promise<void> {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        this.insertTextAtCursor(input, text);
      } else {
        // Fallback - focus input and let browser handle paste
        input.focus();
      }
    } catch (err) {
      console.error('Failed to paste:', err);
      input.focus(); // Fallback to focusing input
    }
  }

  private insertTextAtCursor(input: HTMLInputElement, text: string): void {
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const value = input.value;
    
    input.value = value.substring(0, start) + text + value.substring(end);
    input.selectionStart = input.selectionEnd = start + text.length;
    input.focus();
  }

  private showContextMenu(e: MouseEvent, scrollContent: HTMLElement): void {
    // Remove existing context menu
    const existingMenu = document.querySelector('.terminal-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0;

    const contextMenu = document.createElement('div');
    contextMenu.className = 'terminal-context-menu';
    contextMenu.style.cssText = `
      position: fixed;
      top: ${e.clientY}px;
      left: ${e.clientX}px;
      background: #2d3748;
      border: 1px solid #4a5568;
      border-radius: 4px;
      padding: 4px 0;
      z-index: 1000;
      font-size: 12px;
      color: #e2e8f0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    if (hasSelection) {
      const copyItem = this.createContextMenuItem('Copy', () => {
        this.copySelectedText();
        contextMenu.remove();
      });
      contextMenu.appendChild(copyItem);
    }

    const selectAllItem = this.createContextMenuItem('Select All', () => {
      const range = document.createRange();
      range.selectNodeContents(scrollContent);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      contextMenu.remove();
    });
    contextMenu.appendChild(selectAllItem);

    const clearItem = this.createContextMenuItem('Clear Selection', () => {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
      contextMenu.remove();
    });
    contextMenu.appendChild(clearItem);

    document.body.appendChild(contextMenu);

    // Close menu when clicking outside
    const closeMenu = (event: MouseEvent) => {
      if (!contextMenu.contains(event.target as Node)) {
        contextMenu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 0);
  }

  private createContextMenuItem(text: string, onClick: () => void): HTMLElement {
    const item = document.createElement('div');
    item.textContent = text;
    item.style.cssText = `
      padding: 6px 12px;
      cursor: pointer;
      transition: background-color 0.1s;
    `;
    
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = '#4a5568';
    });
    
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
    });
    
    item.addEventListener('click', onClick);
    
    return item;
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
