import { CodeInsertionOptions } from '../core/ChatTypes.js';
import { DOMHelpers } from '../utils/DOMHelpers.js';

export class CodeInsertion {
  private state: any; // AppState reference

  constructor(state: any) {
    this.state = state;
    this.setupCodeInsertionListeners();
  }

  private setupCodeInsertionListeners(): void {
    document.addEventListener('insertCode', (e: any) => {
      const { code } = e.detail;
      this.insertCodeIntoEditor(code);
    });
  }

  insertCodeIntoEditor(code: string): void {
    if (!this.state.monacoEditor) {
      console.warn('Monaco editor not available');
      return;
    }

    const currentContent = this.state.monacoEditor.getValue();
    const selection = this.state.monacoEditor.getSelection();
    const cursorPosition = this.state.monacoEditor.getPosition();

    this.showInsertionPreview(code, currentContent, selection, cursorPosition);
  }

  private showInsertionPreview(code: string, currentContent: string, selection: any, cursorPosition: any): void {
    const overlay = document.createElement('div');
    overlay.className = 'insertion-preview-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'insertion-preview-modal';
    
    modal.innerHTML = `
      <div class="insertion-preview-header">
        <h3>Replace Selection</h3>
        <button class="close-btn" onclick="this.closest('.insertion-preview-overlay').remove()">✕</button>
      </div>
      
      <div class="insertion-preview-content">
        <div class="preview-section">
          <div class="preview-label">Preview:</div>
          <div class="diff-container" id="diff-container"></div>
        </div>
        
        <div class="insertion-options">
          <label class="option">
            <input type="checkbox" id="format-on-insert" checked>
            Format code after insertion
          </label>
          <label class="option">
            <input type="checkbox" id="add-imports" checked>
            Auto-add missing imports
          </label>
        </div>
      </div>
      
      <div class="insertion-preview-actions">
        <button class="btn-secondary" onclick="this.closest('.insertion-preview-overlay').remove()">Cancel</button>
        <button class="btn-primary" id="confirm-insert">Replace Selection</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.injectInsertionPreviewStyles();

    const confirmBtn = modal.querySelector('#confirm-insert') as HTMLButtonElement;
    confirmBtn.onclick = () => {
      const formatOnInsert = (modal.querySelector('#format-on-insert') as HTMLInputElement).checked;
      const addImports = (modal.querySelector('#add-imports') as HTMLInputElement).checked;
      
      this.performInsertion('replace', code, selection, cursorPosition, { formatOnInsert, addImports });
      overlay.remove();
    };

    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') overlay.remove();
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) confirmBtn.click();
    });

    modal.tabIndex = -1;
    modal.focus();
  }

  private performInsertion(mode: string, code: string, selection: any, cursorPosition: any, options: CodeInsertionOptions): void {
    if (!this.state.monacoEditor || !this.hasValidSelection(selection)) {
      this.showError('No text selected. Please select text to replace.');
      return;
    }

    try {
      const insertOperation = {
        range: {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn
        },
        text: code
      };

      this.state.monacoEditor.executeEdits('ai-assistant', [insertOperation]);

      if (options.formatOnInsert) {
        setTimeout(() => this.state.monacoEditor?.getAction('editor.action.formatDocument')?.run(), 100);
      }

      this.state.monacoEditor.focus();
      DOMHelpers.showNotification('✅ Code replaced successfully', 'success');
    } catch (error) {
      console.error('Insertion failed:', error);
      this.showError('Failed to insert code. Please try again.');
    }
  }

  private hasValidSelection(selection: any): boolean {
    return selection && (selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn);
  }

  private showError(message: string): void {
    DOMHelpers.showNotification(`❌ ${message}`, 'error');
  }

  private injectInsertionPreviewStyles(): void {
    if (document.getElementById('insertion-preview-styles')) return;

    const style = document.createElement('style');
    style.id = 'insertion-preview-styles';
    style.textContent = `
      .insertion-preview-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.8); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
      }
      .insertion-preview-modal {
        background: #1a1a1a; border: 1px solid #404040; border-radius: 12px;
        width: 90%; max-width: 900px; max-height: 80%;
        display: flex; flex-direction: column;
      }
      .insertion-preview-header {
        padding: 1rem 1.5rem; border-bottom: 1px solid #404040;
        display: flex; align-items: center; justify-content: space-between;
      }
      .insertion-preview-header h3 { margin: 0; color: #e4e4e7; }
      .close-btn {
        background: none; border: none; color: #71717a;
        cursor: pointer; padding: 0.25rem; border-radius: 0.25rem;
      }
      .insertion-preview-content { flex: 1; padding: 1.5rem; }
      .insertion-preview-actions {
        padding: 1rem 1.5rem; border-top: 1px solid #404040;
        display: flex; gap: 0.75rem; justify-content: flex-end;
      }
      .btn-secondary, .btn-primary {
        padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.875rem;
        cursor: pointer; border: none; min-width: 100px;
      }
      .btn-secondary { background: #374151; color: #d4d4d8; }
      .btn-primary { background: #60a5fa; color: #1a1a1a; }
      .insertion-options { margin-top: 1rem; }
      .option { display: flex; align-items: center; gap: 0.5rem; color: #d4d4d8; }
    `;
    document.head.appendChild(style);
  }
}
