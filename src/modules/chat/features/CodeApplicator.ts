import { AICodeRefactor, RefactorRequest } from './AICodeRefactor.js';

export interface ApplyCodeOptions {
  insertionMode: 'replace' | 'cursor' | 'ai-refactor';
  filePath?: string;
}

export class CodeApplicator {
  private state: any;
  private aiRefactor: AICodeRefactor;

  constructor(state: any) {
    this.state = state;
    this.aiRefactor = new AICodeRefactor(state);
  }

  async applyCode(code: string, language: string, options: ApplyCodeOptions = { insertionMode: 'ai-refactor' }): Promise<void> {
    console.log('🔧 === CodeApplicator.applyCode START ===');
    console.log('🔧 Options:', options);
    
    if (!this.state?.monacoEditor) {
      console.error('❌ No Monaco editor available');
      this.showNoEditorDialog(code);
      return;
    }

    try {
      const currentCode = this.state.monacoEditor.getValue();
      const hasSelection = this.hasValidSelection();
      
      // Show application method selection
      this.showApplicationMethodDialog(code, language, currentCode, hasSelection);
      
    } catch (error) {
      console.error('❌ Error in applyCode:', error);
      this.showError(`Error: ${this.getErrorMessage(error)}`);
    }
  }

  private showApplicationMethodDialog(code: string, language: string, currentCode: string, hasSelection: boolean): void {
    const overlay = document.createElement('div');
    overlay.className = 'apply-code-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'apply-code-modal';
    
    modal.innerHTML = `
      <div class="apply-code-header">
        <h3>How would you like to apply this code?</h3>
        <button class="close-btn" onclick="this.closest('.apply-code-overlay').remove()">✕</button>
      </div>
      
      <div class="apply-code-content">
        <div class="apply-code-preview">
          <div class="preview-label">Code to apply (${this.getCodeStats(code)}):</div>
          <textarea class="code-preview" readonly>${code}</textarea>
        </div>
        
        <div class="apply-methods">
          <div class="method-card recommended" data-method="ai-refactor">
            <div class="method-header">
              <span class="method-icon">🤖</span>
              <span class="method-title">AI Smart Refactor</span>
              <span class="recommended-badge">Recommended</span>
            </div>
            <div class="method-description">
              Let AI intelligently merge and refactor the new code with your existing code
            </div>
          </div>
          
          ${hasSelection ? `
          <div class="method-card" data-method="replace">
            <div class="method-header">
              <span class="method-icon">🔄</span>
              <span class="method-title">Replace Selection</span>
            </div>
            <div class="method-description">
              Replace the selected text with the new code
            </div>
          </div>
          ` : ''}
          
          <div class="method-card" data-method="cursor">
            <div class="method-header">
              <span class="method-icon">📍</span>
              <span class="method-title">Insert at Cursor</span>
            </div>
            <div class="method-description">
              Insert the new code at the current cursor position
            </div>
          </div>
        </div>
      </div>
      
      <div class="apply-code-actions">
        <button class="btn-secondary" onclick="this.closest('.apply-code-overlay').remove()">Cancel</button>
        <button class="btn-primary" id="apply-with-method" disabled>Apply Code</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.injectApplyCodeStyles();

    // Handle method selection
    let selectedMethod = 'ai-refactor'; // Default to AI refactor
    const methodCards = modal.querySelectorAll('.method-card');
    const applyBtn = modal.querySelector('#apply-with-method') as HTMLButtonElement;

    // Pre-select AI refactor
    modal.querySelector('.method-card[data-method="ai-refactor"]')?.classList.add('selected');
    applyBtn.disabled = false;

    methodCards.forEach(card => {
      card.addEventListener('click', () => {
        methodCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedMethod = card.getAttribute('data-method')!;
        applyBtn.disabled = false;
      });
    });

    // Handle apply
    applyBtn.onclick = async () => {
      overlay.remove();
      
      switch (selectedMethod) {
        case 'ai-refactor':
          await this.performAIRefactor(code, language, currentCode);
          break;
        case 'replace':
          this.performSimpleApplication(code, 'replace');
          break;
        case 'cursor':
          this.performSimpleApplication(code, 'cursor');
          break;
      }
    };
  }

  private async performAIRefactor(newCode: string, language: string, existingCode: string): Promise<void> {
    try {
      // Create refactor request
      const request: RefactorRequest = {
        existingCode,
        newCode,
        language,
        filePath: this.state.currentFile,
        mode: 'merge',
        instruction: 'Please intelligently merge the new code with the existing code, maintaining the existing structure and style while integrating the new functionality.'
      };

      // Show preview and get user confirmation
      const shouldProceed = await this.aiRefactor.showRefactorPreview(request);
      if (!shouldProceed) {
        return;
      }

      // Perform AI refactoring
      const result = await this.aiRefactor.refactorCode(request);
      
      if (result.success) {
        // Apply the refactored code
        await this.aiRefactor.applyRefactoredCode(result.refactoredCode, true);
      } else {
        this.showError(result.error || 'AI refactoring failed');
      }

    } catch (error) {
      console.error('❌ AI refactor failed:', error);
      this.showError(`AI refactoring failed: ${this.getErrorMessage(error)}`);
    }
  }

  private performSimpleApplication(code: string, mode: 'replace' | 'cursor'): void {
    if (!this.state.monacoEditor) return;

    try {
      const editor = this.state.monacoEditor;
      const selection = editor.getSelection();
      const position = editor.getPosition();

      let range: any;
      
      if (mode === 'replace' && this.hasValidSelection()) {
        range = selection;
      } else {
        range = {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        };
      }

      // Apply the edit
      editor.executeEdits('code-applicator', [{
        range: range,
        text: code
      }]);

      // Format code
      setTimeout(() => {
        editor.getAction('editor.action.formatDocument')?.run();
      }, 100);

      editor.focus();
      this.showSuccess('Code applied successfully');

    } catch (error) {
      console.error('Application failed:', error);
      this.showError('Failed to apply code. Please try again.');
    }
  }

  private hasValidSelection(): boolean {
    if (!this.state.monacoEditor) return false;
    const selection = this.state.monacoEditor.getSelection();
    return selection && !selection.isEmpty();
  }

  private getCodeStats(code: string): string {
    const lines = code.split('\n').length;
    const chars = code.length;
    return `${lines} lines, ${chars} chars`;
  }

  // Helper function to safely extract error messages
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  }

  private showNoEditorDialog(code: string): void {
    const overlay = document.createElement('div');
    overlay.className = 'apply-code-overlay';
    overlay.innerHTML = `
      <div class="apply-code-modal">
        <div class="apply-code-header">
          <h3>No File Open</h3>
          <button class="close-btn" onclick="this.closest('.apply-code-overlay').remove()">✕</button>
        </div>
        <div class="apply-code-content">
          <p>To apply code, you need to have a file open in the editor first.</p>
          <div class="apply-code-preview">
            <div class="preview-label">Code to apply:</div>
            <textarea class="code-preview" readonly>${code}</textarea>
          </div>
        </div>
        <div class="apply-code-actions">
          <button class="btn-secondary" onclick="this.closest('.apply-code-overlay').remove()">Cancel</button>
          <button class="btn-primary" onclick="navigator.clipboard.writeText(\`${code.replace(/`/g, '\\`')}\`).then(() => { this.closest('.apply-code-overlay').remove(); alert('Code copied to clipboard!'); })">Copy Code</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    this.injectApplyCodeStyles();
  }

  private showSuccess(message: string): void {
    this.showNotification(message, 'success');
  }

  private showError(message: string): void {
    this.showNotification(message, 'error');
  }

  private showNotification(message: string, type: 'success' | 'error'): void {
    const notification = document.createElement('div');
    notification.className = `code-apply-notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  private injectApplyCodeStyles(): void {
    if (document.getElementById('apply-code-styles')) return;

    const style = document.createElement('style');
    style.id = 'apply-code-styles';
    style.textContent = `
      .apply-code-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.8); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
      }
      
      .apply-code-modal {
        background: #1a1a1a; border: 1px solid #404040; border-radius: 12px;
        width: 90%; max-width: 800px; max-height: 80%;
        display: flex; flex-direction: column;
      }
      
      .apply-code-header {
        padding: 1rem 1.5rem; border-bottom: 1px solid #404040;
        display: flex; align-items: center; justify-content: space-between;
      }
      
      .apply-code-header h3 { margin: 0; color: #e4e4e7; }
      
      .close-btn {
        background: none; border: none; color: #71717a;
        cursor: pointer; padding: 0.25rem; border-radius: 0.25rem;
      }
      
      .apply-code-content { flex: 1; padding: 1.5rem; overflow: auto; }
      
      .code-preview {
        width: 100%; min-height: 120px; max-height: 300px;
        background: #0f0f0f; border: 1px solid #404040; border-radius: 6px;
        padding: 1rem; color: #e4e4e7; font-family: 'Monaco', 'Consolas', monospace;
        font-size: 0.875rem; resize: vertical;
      }
      
      .apply-methods {
        display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem;
      }
      
      .method-card {
        border: 2px solid #404040; border-radius: 8px; padding: 1rem;
        cursor: pointer; transition: all 0.2s;
      }
      
      .method-card:hover { border-color: #3b82f6; }
      .method-card.selected { border-color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
      .method-card.recommended { border-color: #10b981; }
      
      .method-header {
        display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;
      }
      
      .method-icon { font-size: 1.2rem; }
      .method-title { font-weight: 600; color: #e4e4e7; }
      .recommended-badge {
        background: #10b981; color: white; padding: 0.125rem 0.5rem;
        border-radius: 12px; font-size: 0.75rem; margin-left: auto;
      }
      
      .method-description { color: #a1a1aa; font-size: 0.875rem; }
      
      .apply-code-actions {
        padding: 1rem 1.5rem; border-top: 1px solid #404040;
        display: flex; gap: 0.75rem; justify-content: flex-end;
      }
      
      .btn-secondary, .btn-primary {
        padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.875rem;
        cursor: pointer; border: none; min-width: 100px;
      }
      
      .btn-secondary { background: #374151; color: #d4d4d8; }
      .btn-primary { background: #3b82f6; color: white; }
      .btn-primary:disabled { background: #6b7280; cursor: not-allowed; }
      
      .code-apply-notification {
        position: fixed; top: 1rem; right: 1rem; z-index: 10001;
        padding: 0.75rem 1rem; border-radius: 6px; color: white;
        animation: slideIn 0.3s ease-out;
      }
      
      .code-apply-notification.success { background: #10b981; }
      .code-apply-notification.error { background: #ef4444; }
      
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}
