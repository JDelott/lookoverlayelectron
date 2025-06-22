export interface ApplyCodeOptions {
  insertionMode: 'replace' | 'cursor' | 'merge';
  filePath?: string;
}

export class CodeApplicator {
  private state: any; // AppState reference

  constructor(state: any) {
    this.state = state;
  }

  async applyCode(code: string, language: string, options: ApplyCodeOptions = { insertionMode: 'cursor' }): Promise<void> {
    console.log('🔧 === CodeApplicator.applyCode START ===');
    console.log('🔧 Code preview:', code.substring(0, 100) + (code.length > 100 ? '...' : ''));
    console.log('🔧 Language:', language);
    console.log('🔧 State available:', !!this.state);
    console.log('🔧 Monaco editor available:', !!this.state?.monacoEditor);
    
    // Check if we have an editor available
    if (!this.state?.monacoEditor) {
      console.error('❌ No Monaco editor available');
      
      // Show a more helpful error with options
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
      return;
    }

    try {
      const selection = this.state.monacoEditor.getSelection();
      const hasSelection = selection && !selection.isEmpty();
      
      console.log('🔧 Selection info:', { hasSelection, selection });

      // Show apply preview dialog
      this.showApplyPreview(code, language, hasSelection, options);
      console.log('✅ Apply preview shown');
      
    } catch (error: unknown) {
      console.error('❌ Error in applyCode:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      this.showError(`Error: ${errorMessage}`);
    }
  }

  private showApplyPreview(code: string, language: string, hasSelection: boolean, options: ApplyCodeOptions): void {
    const overlay = document.createElement('div');
    overlay.className = 'apply-code-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'apply-code-modal';
    
    modal.innerHTML = `
      <div class="apply-code-header">
        <h3>Apply Code</h3>
        <button class="close-btn" onclick="this.closest('.apply-code-overlay').remove()">✕</button>
      </div>
      
      <div class="apply-code-content">
        <div class="apply-code-preview">
          <div class="preview-label">Code to apply:</div>
          <textarea class="code-preview" readonly>${code}</textarea>
        </div>
        
        <div class="apply-options">
          <div class="option-group">
            <label class="option">
              <input type="radio" name="apply-mode" value="replace" ${hasSelection ? 'checked' : ''} ${!hasSelection ? 'disabled' : ''}>
              Replace selected text ${!hasSelection ? '(no selection)' : ''}
            </label>
            <label class="option">
              <input type="radio" name="apply-mode" value="cursor" ${!hasSelection ? 'checked' : ''}>
              Insert at cursor position
            </label>
            <label class="option">
              <input type="radio" name="apply-mode" value="merge">
              Smart merge (experimental)
            </label>
          </div>
          
          <div class="additional-options">
            <label class="option">
              <input type="checkbox" id="format-after-apply" checked>
              Format code after applying
            </label>
          </div>
        </div>
      </div>
      
      <div class="apply-code-actions">
        <button class="btn-secondary" onclick="this.closest('.apply-code-overlay').remove()">Cancel</button>
        <button class="btn-primary" id="confirm-apply">Apply Code</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.injectApplyCodeStyles();

    // Handle apply confirmation
    const confirmBtn = modal.querySelector('#confirm-apply') as HTMLButtonElement;
    confirmBtn.onclick = () => {
      const selectedMode = (modal.querySelector('input[name="apply-mode"]:checked') as HTMLInputElement)?.value;
      const formatAfter = (modal.querySelector('#format-after-apply') as HTMLInputElement).checked;
      
      this.performApplication(code, selectedMode as ApplyCodeOptions['insertionMode'], formatAfter);
      overlay.remove();
    };

    // Handle keyboard shortcuts
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') overlay.remove();
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) confirmBtn.click();
    });

    modal.tabIndex = -1;
    modal.focus();
  }

  private performApplication(code: string, mode: ApplyCodeOptions['insertionMode'], formatAfter: boolean): void {
    if (!this.state.monacoEditor) return;

    try {
      const editor = this.state.monacoEditor;
      const model = editor.getModel();
      const selection = editor.getSelection();
      const position = editor.getPosition();

      let range: any;
      
      switch (mode) {
        case 'replace':
          if (selection && !selection.isEmpty()) {
            range = selection;
          } else {
            this.showError('No text selected for replacement');
            return;
          }
          break;
          
        case 'cursor':
          range = {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          };
          break;
          
        case 'merge':
          // For merge, we'll replace the entire file content with a merged version
          return this.performSmartMerge(code, formatAfter);
      }

      // Apply the edit
      const edit = {
        range: range,
        text: code
      };

      editor.executeEdits('code-applicator', [edit]);

      // Format if requested
      if (formatAfter) {
        setTimeout(() => {
          editor.getAction('editor.action.formatDocument')?.run();
        }, 100);
      }

      // Focus editor and position cursor
      editor.focus();
      const newPosition = {
        lineNumber: range.startLineNumber,
        column: range.startColumn + code.split('\n')[0].length
      };
      editor.setPosition(newPosition);

      this.showSuccess('Code applied successfully');

    } catch (error) {
      console.error('Application failed:', error);
      this.showError('Failed to apply code. Please try again.');
    }
  }

  private performSmartMerge(newCode: string, formatAfter: boolean): void {
    if (!this.state.monacoEditor) return;

    const editor = this.state.monacoEditor;
    const currentCode = editor.getValue();
    
    // Simple merge strategy: append or replace based on content similarity
    let mergedCode: string;
    
    // Check if the new code is a function/component that should replace an existing one
    const functionMatch = newCode.match(/(?:function|const|class|export)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    
    if (functionMatch) {
      const functionName = functionMatch[1];
      const existingFunctionRegex = new RegExp(`(?:function|const|class|export)\\s+${functionName}[\\s\\S]*?(?=(?:function|const|class|export|$))`, 'g');
      
      if (currentCode.match(existingFunctionRegex)) {
        // Replace existing function
        mergedCode = currentCode.replace(existingFunctionRegex, newCode);
      } else {
        // Append new function
        mergedCode = currentCode + '\n\n' + newCode;
      }
    } else {
      // Default: append to end
      mergedCode = currentCode + '\n\n' + newCode;
    }

    // Apply the merged content
    editor.setValue(mergedCode);

    if (formatAfter) {
      setTimeout(() => {
        editor.getAction('editor.action.formatDocument')?.run();
      }, 100);
    }

    this.showSuccess('Code merged successfully');
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
        width: 90%; max-width: 700px; max-height: 80%;
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
      
      .apply-code-content { flex: 1; padding: 1.5rem; }
      
      .code-preview {
        width: 100%; min-height: 120px; max-height: 300px;
        background: #0f0f0f; border: 1px solid #404040; border-radius: 6px;
        padding: 1rem; color: #e4e4e7; font-family: 'Monaco', 'Consolas', monospace;
        font-size: 0.875rem; resize: vertical;
      }
      
      .apply-options { margin-top: 1.5rem; }
      
      .option-group { margin-bottom: 1rem; }
      
      .option {
        display: flex; align-items: center; gap: 0.5rem; color: #d4d4d8;
        margin-bottom: 0.5rem; cursor: pointer;
      }
      
      .option input[disabled] + span { color: #71717a; }
      
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
