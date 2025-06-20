import { ChatMessage } from '../core/ChatTypes.js';

export class ChatAPI {
  private electronAPI: any;

  constructor() {
    this.electronAPI = (window as any).electronAPI;
  }

  async validateAPIKey(apiKey: string): Promise<boolean> {
    try {
      const testResult = await this.electronAPI.callAnthropicAPI(
        [{ role: 'user', content: 'Hello' }],
        'You are a helpful assistant. Respond with just "OK" to confirm the connection.'
      );

      return !!(testResult && (typeof testResult === 'string' || testResult.content));
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }

  async startStreaming(messages: any[], systemPrompt: string): Promise<void> {
    return await this.electronAPI.callAnthropicAPIStream(messages, systemPrompt);
  }

  buildEnhancedContext(state: any, attachedFiles: Map<string, any>): string {
    if (!state.currentFile && !state.currentWorkingDirectory) return '';

    let context = '\n**Enhanced Context:**\n';
    
    if (state.currentFile) {
      const fileName = state.currentFile.split('/').pop() || '';
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
      const fileType = this.getFileTypeDescription(fileExtension);
      
      context += `- **Current File:** ${fileName} (${fileType})\n`;
      context += `- **Full Path:** ${state.currentFile}\n`;
    }

    if (state.currentWorkingDirectory) {
      const projectName = state.currentWorkingDirectory.split('/').pop() || 'Unknown';
      context += `- **Project:** ${projectName}\n`;
      context += `- **Working Directory:** ${state.currentWorkingDirectory}\n`;
    }

    const selectedText = this.getSelectedText(state);
    if (selectedText && selectedText.length > 0) {
      const lineCount = selectedText.split('\n').length;
      context += `- **Selected Text:** ${lineCount} line${lineCount !== 1 ? 's' : ''} selected in editor\n`;
    }

    if (attachedFiles.size > 0) {
      context += `- **Attached Files:** ${attachedFiles.size} file${attachedFiles.size !== 1 ? 's' : ''} provided\n`;
    }

    context += '\n**Instructions:** Analyze the provided context and deliver TypeScript/Node.js solutions that leverage the specific files, selection, and project structure mentioned above.';
    
    return context;
  }

  getSystemPrompt(state: any, attachedFiles: Map<string, any>): string {
    const contextInfo = this.buildEnhancedContext(state, attachedFiles);

    return `You are an expert TypeScript and Node.js senior developer and architect. Write clean, minimal, and strictly typed code using modern standards (ES2022+, Node.js 20+). 

**Core Principles:**
- Avoid 'any' types - use proper type definitions
- Write production-ready, maintainable code
- Use modern TypeScript features (satisfies, const assertions, template literals)
- Implement proper error handling with Result/Either patterns when appropriate
- Follow SOLID principles and clean architecture
- Use functional programming concepts where beneficial

**Code Standards:**
- Prefer 'const' over 'let', avoid 'var'
- Use destructuring, spread operator, and modern array methods
- Implement proper async/await patterns, avoid callback hell
- Use type guards and discriminated unions for type safety
- Prefer composition over inheritance
- Write self-documenting code - avoid unnecessary comments

**Response Format:**
- Return working code that passes TypeScript strict mode
- Include complete imports and exports
- Provide multiple approaches for complex problems
- Show type definitions for complex data structures
- Include error handling and edge cases
- Optimize for performance and memory efficiency

**Avoid:**
- Browser-specific APIs (unless explicitly requested)
- Deprecated Node.js features
- Any/unknown types without proper type guards
- Mutating operations on arrays/objects (prefer immutable patterns)
- Console.log in production code (use proper logging)

${contextInfo}

Focus on practical, enterprise-grade solutions that improve code quality, performance, and maintainability.`;
  }

  private getSelectedText(state: any): string | undefined {
    if (state.monacoEditor) {
      const selection = state.monacoEditor.getSelection();
      if (selection && !selection.isEmpty()) {
        return state.monacoEditor.getModel()?.getValueInRange(selection);
      }
    }
    return undefined;
  }

  private getFileTypeDescription(extension: string): string {
    const typeMap: { [key: string]: string } = {
      'ts': 'TypeScript', 'js': 'JavaScript', 'tsx': 'TypeScript React', 'jsx': 'JavaScript React',
      'json': 'JSON Configuration', 'md': 'Markdown Documentation', 'yml': 'YAML Configuration',
      'yaml': 'YAML Configuration', 'html': 'HTML Template', 'css': 'CSS Stylesheet',
      'scss': 'SCSS Stylesheet', 'less': 'LESS Stylesheet', 'env': 'Environment Variables',
      'gitignore': 'Git Ignore Rules', 'dockerfile': 'Docker Configuration'
    };
    
    return typeMap[extension] || 'Source Code';
  }
}
