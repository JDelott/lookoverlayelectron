export interface RefactorRequest {
  existingCode: string;
  newCode: string;
  language: string;
  filePath?: string;
  instruction?: string;
  mode: 'merge' | 'replace' | 'integrate' | 'optimize';
}

export interface RefactorResponse {
  success: boolean;
  refactoredCode: string;
  explanation?: string;
  changes?: string[];
  error?: string;
}

export class AICodeRefactor {
  private electronAPI: any;
  private state: any;

  constructor(state: any) {
    this.state = state;
    this.electronAPI = (window as any).electronAPI;
  }

  async refactorCode(request: RefactorRequest): Promise<RefactorResponse> {
    console.log('🔧 Starting AI-powered code refactoring...', request);

    try {
      // Show loading indicator
      this.showRefactorProgress('Analyzing code...');

      // Prepare the refactoring prompt
      const systemPrompt = this.createRefactorSystemPrompt(request);
      const userPrompt = this.createRefactorUserPrompt(request);

      console.log('🔧 Sending refactor request to AI...');

      // Call the AI API
      const response = await this.electronAPI.callAnthropicAPI([
        { role: 'user', content: userPrompt }
      ], systemPrompt);

      if (!response || !response.content) {
        throw new Error('Invalid response from AI');
      }

      // Parse the AI response
      const refactorResult = this.parseRefactorResponse(response.content, request);
      
      this.hideRefactorProgress();

      console.log('✅ AI refactoring completed successfully');
      return refactorResult;

    } catch (error) {
      console.error('❌ AI refactoring failed:', error);
      this.hideRefactorProgress();
      
      return {
        success: false,
        refactoredCode: request.existingCode,
        error: `Refactoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private createRefactorSystemPrompt(request: RefactorRequest): string {
    const basePrompt = `You are an expert code refactoring assistant. Your job is to intelligently merge, integrate, or refactor code based on the user's request.

CRITICAL INSTRUCTIONS:
1. Always preserve the essential functionality of existing code
2. Integrate new code seamlessly with existing patterns and style
3. Maintain proper code structure, imports, and dependencies
4. Follow best practices for the programming language
5. Provide clean, readable, and maintainable code
6. ONLY return the complete refactored code, no explanations or markdown formatting
7. Do not add any comments about the changes unless they improve code clarity

REFACTOR MODE: ${request.mode}
LANGUAGE: ${request.language}
FILE PATH: ${request.filePath || 'unknown'}

MODE DESCRIPTIONS:
- merge: Combine new code with existing code, avoiding duplicates
- replace: Replace specific functions/components while preserving others
- integrate: Add new functionality to existing code structure
- optimize: Improve existing code while adding new features`;

    return basePrompt;
  }

  private createRefactorUserPrompt(request: RefactorRequest): string {
    const instruction = request.instruction || `Please ${request.mode} the new code with the existing code.`;
    
    return `${instruction}

EXISTING CODE:
\`\`\`${request.language}
${request.existingCode}
\`\`\`

NEW CODE TO ${request.mode.toUpperCase()}:
\`\`\`${request.language}
${request.newCode}
\`\`\`

Please provide the complete refactored file content. Return ONLY the code, no explanations.`;
  }

  private parseRefactorResponse(aiResponse: string, request: RefactorRequest): RefactorResponse {
    // Extract code from AI response (remove any markdown formatting)
    let refactoredCode = aiResponse;
    
    // Remove markdown code blocks if present
    const codeBlockMatch = refactoredCode.match(/```[a-zA-Z]*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      refactoredCode = codeBlockMatch[1];
    }
    
    // Clean up any extra whitespace
    refactoredCode = refactoredCode.trim();
    
    // Basic validation
    if (!refactoredCode || refactoredCode.length < 10) {
      throw new Error('AI returned invalid or empty code');
    }

    return {
      success: true,
      refactoredCode: refactoredCode,
      explanation: `Code ${request.mode}d successfully using AI`
    };
  }

  async showRefactorPreview(request: RefactorRequest): Promise<boolean> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'refactor-preview-overlay';
      
      const modal = document.createElement('div');
      modal.className = 'refactor-preview-modal';
      
      modal.innerHTML = `
        <div class="refactor-preview-header">
          <h3>AI Code Refactoring</h3>
          <button class="close-btn" onclick="this.remove()">✕</button>
        </div>
        
        <div class="refactor-preview-content">
          <div class="refactor-info">
            <div class="refactor-mode">Mode: <strong>${request.mode}</strong></div>
            <div class="refactor-language">Language: <strong>${request.language}</strong></div>
            ${request.filePath ? `<div class="refactor-file">File: <strong>${request.filePath}</strong></div>` : ''}
          </div>
          
          <div class="code-comparison">
            <div class="code-section">
              <h4>Current Code (${this.getCodeStats(request.existingCode)})</h4>
              <textarea class="code-preview existing" readonly>${request.existingCode}</textarea>
            </div>
            
            <div class="code-section">
              <h4>New Code to Apply (${this.getCodeStats(request.newCode)})</h4>
              <textarea class="code-preview new" readonly>${request.newCode}</textarea>
            </div>
          </div>
          
          <div class="refactor-options">
            <label class="option">
              <select id="refactor-mode">
                <option value="merge" ${request.mode === 'merge' ? 'selected' : ''}>Smart Merge</option>
                <option value="replace" ${request.mode === 'replace' ? 'selected' : ''}>Replace Functions</option>
                <option value="integrate" ${request.mode === 'integrate' ? 'selected' : ''}>Integrate Features</option>
                <option value="optimize" ${request.mode === 'optimize' ? 'selected' : ''}>Optimize & Enhance</option>
              </select>
            </label>
            
            <label class="option">
              <input type="text" id="custom-instruction" placeholder="Custom instructions (optional)" 
                     value="${request.instruction || ''}" />
            </label>
          </div>
        </div>
        
        <div class="refactor-preview-actions">
          <button class="btn-secondary" onclick="this.closest('.refactor-preview-overlay').remove(); resolve(false)">Cancel</button>
          <button class="btn-primary" id="start-refactor">🤖 Start AI Refactoring</button>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      this.injectRefactorStyles();

      // Handle refactor start
      const startBtn = modal.querySelector('#start-refactor') as HTMLButtonElement;
      startBtn.onclick = async () => {
        const selectedMode = (modal.querySelector('#refactor-mode') as HTMLSelectElement).value;
        const customInstruction = (modal.querySelector('#custom-instruction') as HTMLInputElement).value;
        
        // Update request with user choices
        request.mode = selectedMode as RefactorRequest['mode'];
        if (customInstruction.trim()) {
          request.instruction = customInstruction.trim();
        }
        
        overlay.remove();
        resolve(true);
      };

      // Handle close
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });
    });
  }

  private getCodeStats(code: string): string {
    const lines = code.split('\n').length;
    const chars = code.length;
    return `${lines} lines, ${chars} chars`;
  }

  private showRefactorProgress(message: string): void {
    // Remove existing progress
    this.hideRefactorProgress();

    const progress = document.createElement('div');
    progress.id = 'refactor-progress';
    progress.className = 'refactor-progress';
    progress.innerHTML = `
      <div class="progress-content">
        <div class="progress-spinner">🤖</div>
        <div class="progress-message">${message}</div>
      </div>
    `;

    document.body.appendChild(progress);
  }

  private hideRefactorProgress(): void {
    const progress = document.getElementById('refactor-progress');
    if (progress) {
      progress.remove();
    }
  }

  async applyRefactoredCode(refactoredCode: string, showDiff: boolean = true): Promise<void> {
    if (!this.state.monacoEditor) {
      throw new Error('No editor available');
    }

    if (showDiff) {
      const shouldApply = await this.showRefactoredCodePreview(refactoredCode);
      if (!shouldApply) {
        return;
      }
    }

    // Apply the refactored code
    this.state.monacoEditor.setValue(refactoredCode);
    
    // Format the code
    setTimeout(() => {
      this.state.monacoEditor?.getAction('editor.action.formatDocument')?.run();
    }, 100);

    this.showSuccessNotification('Code refactored successfully!');
  }

  private async showRefactoredCodePreview(refactoredCode: string): Promise<boolean> {
    return new Promise((resolve) => {
      const currentCode = this.state.monacoEditor.getValue();
      
      const overlay = document.createElement('div');
      overlay.className = 'refactor-preview-overlay';
      
      overlay.innerHTML = `
        <div class="refactor-preview-modal large">
          <div class="refactor-preview-header">
            <h3>Refactored Code Preview</h3>
            <button class="close-btn" onclick="this.closest('.refactor-preview-overlay').remove(); resolve(false)">✕</button>
          </div>
          
          <div class="refactor-preview-content">
            <div class="diff-view">
              <div class="code-section">
                <h4>Before (${this.getCodeStats(currentCode)})</h4>
                <textarea class="code-preview before" readonly>${currentCode}</textarea>
              </div>
              
              <div class="code-section">
                <h4>After (${this.getCodeStats(refactoredCode)})</h4>
                <textarea class="code-preview after" readonly>${refactoredCode}</textarea>
              </div>
            </div>
          </div>
          
          <div class="refactor-preview-actions">
            <button class="btn-secondary" onclick="this.closest('.refactor-preview-overlay').remove(); resolve(false)">Cancel</button>
            <button class="btn-primary" onclick="this.closest('.refactor-preview-overlay').remove(); resolve(true)">✅ Apply Refactored Code</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      
      // Set up resolution handlers
      const cancelBtn = overlay.querySelector('.btn-secondary') as HTMLButtonElement;
      const applyBtn = overlay.querySelector('.btn-primary') as HTMLButtonElement;
      
      cancelBtn.onclick = () => {
        overlay.remove();
        resolve(false);
      };
      
      applyBtn.onclick = () => {
        overlay.remove();
        resolve(true);
      };
    });
  }

  private showSuccessNotification(message: string): void {
    const notification = document.createElement('div');
    notification.className = 'refactor-notification success';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  private injectRefactorStyles(): void {
    if (document.getElementById('refactor-styles')) return;

    const style = document.createElement('style');
    style.id = 'refactor-styles';
    style.textContent = `
      .refactor-preview-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.8); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
      }
      
      .refactor-preview-modal {
        background: #1a1a1a; border: 1px solid #404040; border-radius: 12px;
        width: 90%; max-width: 1200px; max-height: 90%;
        display: flex; flex-direction: column;
      }
      
      .refactor-preview-modal.large { max-width: 1400px; }
      
      .refactor-preview-header {
        padding: 1rem 1.5rem; border-bottom: 1px solid #404040;
        display: flex; align-items: center; justify-content: space-between;
      }
      
      .refactor-preview-header h3 { margin: 0; color: #e4e4e7; }
      
      .close-btn {
        background: none; border: none; color: #71717a;
        cursor: pointer; padding: 0.25rem; border-radius: 0.25rem;
      }
      
      .refactor-preview-content { flex: 1; padding: 1.5rem; overflow: auto; }
      
      .refactor-info {
        margin-bottom: 1rem; padding: 1rem; background: #2a2a2a; border-radius: 6px;
        display: flex; gap: 2rem; flex-wrap: wrap;
      }
      
      .refactor-info > div { color: #d4d4d8; font-size: 0.9rem; }
      
      .code-comparison, .diff-view {
        display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;
      }
      
      .code-section h4 { margin: 0 0 0.5rem 0; color: #e4e4e7; font-size: 0.9rem; }
      
      .code-preview {
        width: 100%; height: 200px; background: #0f0f0f; border: 1px solid #404040;
        border-radius: 6px; padding: 1rem; color: #e4e4e7;
        font-family: 'Monaco', 'Consolas', monospace; font-size: 0.875rem;
        resize: vertical;
      }
      
      .code-preview.before { border-left: 3px solid #ef4444; }
      .code-preview.after { border-left: 3px solid #10b981; }
      .code-preview.existing { border-left: 3px solid #3b82f6; }
      .code-preview.new { border-left: 3px solid #f59e0b; }
      
      .refactor-options {
        display: flex; gap: 1rem; margin-top: 1rem; flex-wrap: wrap;
      }
      
      .option { display: flex; flex-direction: column; gap: 0.25rem; }
      .option label { color: #d4d4d8; font-size: 0.875rem; }
      .option select, .option input {
        padding: 0.5rem; background: #2a2a2a; border: 1px solid #404040;
        border-radius: 4px; color: #e4e4e7;
      }
      
      .refactor-preview-actions {
        padding: 1rem 1.5rem; border-top: 1px solid #404040;
        display: flex; gap: 0.75rem; justify-content: flex-end;
      }
      
      .btn-secondary, .btn-primary {
        padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.875rem;
        cursor: pointer; border: none; min-width: 120px;
      }
      
      .btn-secondary { background: #374151; color: #d4d4d8; }
      .btn-primary { background: #3b82f6; color: white; }
      
      .refactor-progress {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        z-index: 10001; background: #1a1a1a; border: 1px solid #404040;
        border-radius: 12px; padding: 2rem; text-align: center;
      }
      
      .progress-spinner { font-size: 2rem; margin-bottom: 1rem; animation: spin 2s linear infinite; }
      .progress-message { color: #e4e4e7; }
      
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      
      .refactor-notification {
        position: fixed; top: 1rem; right: 1rem; z-index: 10001;
        padding: 0.75rem 1rem; border-radius: 6px; color: white;
        animation: slideIn 0.3s ease-out;
      }
      
      .refactor-notification.success { background: #10b981; }
      
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
