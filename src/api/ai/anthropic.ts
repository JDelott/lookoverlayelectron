import Anthropic from '@anthropic-ai/sdk';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    codeContext?: string;
    filePath?: string;
    selectedText?: string;
    projectPath?: string;
  };
}

export interface AIServiceConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class AnthropicAIService {
  private client: Anthropic;
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = {
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 8192,
      ...config
    };
    
    this.client = new Anthropic({
      apiKey: this.config.apiKey,
      dangerouslyAllowBrowser: true // Note: In production, API calls should go through your backend
    });
  }

  async sendMessage(
    messages: ChatMessage[], 
    systemPrompt?: string
  ): Promise<ChatMessage> {
    try {
      // Convert our message format to Anthropic's format
      const anthropicMessages = messages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }));

      const response = await this.client.messages.create({
        model: this.config.model!,
        max_tokens: this.config.maxTokens!,
        system: systemPrompt || this.getDefaultSystemPrompt(),
        messages: anthropicMessages
      });

      const responseText = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as any).text)
        .join('');

      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('AI Service Error:', error);
      throw new Error(`AI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getDefaultSystemPrompt(): string {
    return `You are Claude 3.5 Sonnet, an advanced AI coding assistant integrated into a VS Code-like IDE. You excel at:

**CORE CAPABILITIES:**
1. **Code Analysis & Review**: Deep analysis of code structure, logic, patterns, and potential issues
2. **Code Generation**: Creating production-ready, well-structured code with proper error handling
3. **Debugging & Problem Solving**: Identifying bugs, performance issues, and architectural problems
4. **Refactoring & Optimization**: Improving code quality, performance, and maintainability
5. **Architecture & Design**: Suggesting better patterns, structures, and design principles
6. **Documentation**: Generating comprehensive comments, documentation, and explanations

**RESPONSE GUIDELINES:**
- Provide precise, actionable solutions with complete code examples
- Explain the reasoning behind your suggestions
- Consider edge cases, error handling, and performance implications
- Use modern best practices and idiomatic code patterns
- Format code with proper syntax highlighting and clear structure
- When suggesting changes, show both the problem and the solution
- Consider the broader codebase context when making recommendations

**CODE QUALITY FOCUS:**
- Write clean, readable, and maintainable code
- Include proper error handling and input validation
- Follow language-specific conventions and best practices
- Optimize for both performance and developer experience
- Suggest testing strategies when appropriate

You have access to the user's current file, selected text, and project structure. Use this context to provide highly relevant and specific assistance.`;
  }

  async generateCode(prompt: string, context?: {
    language?: string;
    framework?: string;
    currentFile?: string;
    selectedText?: string;
  }): Promise<string> {
    const enhancedPrompt = this.buildCodeGenerationPrompt(prompt, context);
    
    const messages: ChatMessage[] = [{
      id: Date.now().toString(),
      role: 'user',
      content: enhancedPrompt,
      timestamp: new Date()
    }];

    const response = await this.sendMessage(messages, this.getCodeGenerationSystemPrompt());
    return response.content;
  }

  private buildCodeGenerationPrompt(prompt: string, context?: {
    language?: string;
    framework?: string;
    currentFile?: string;
    selectedText?: string;
  }): string {
    let enhancedPrompt = `Generate code for: ${prompt}\n\n`;

    if (context?.language) {
      enhancedPrompt += `Language: ${context.language}\n`;
    }
    if (context?.framework) {
      enhancedPrompt += `Framework: ${context.framework}\n`;
    }
    if (context?.currentFile) {
      enhancedPrompt += `Current file context:\n\`\`\`\n${context.currentFile}\n\`\`\`\n`;
    }
    if (context?.selectedText) {
      enhancedPrompt += `Selected text:\n\`\`\`\n${context.selectedText}\n\`\`\`\n`;
    }

    enhancedPrompt += '\nPlease provide clean, working code with explanations.';
    
    return enhancedPrompt;
  }

  private getCodeGenerationSystemPrompt(): string {
    return `You are an expert code generation specialist using Claude 3.5 Sonnet's advanced reasoning capabilities.

**CODE GENERATION EXCELLENCE:**
- Generate production-ready code with comprehensive error handling
- Include all necessary imports, dependencies, and setup code
- Write self-documenting code with clear, meaningful names
- Add strategic comments explaining complex logic or design decisions
- Follow language-specific best practices and modern conventions
- Consider scalability, maintainability, and performance from the start

**TECHNICAL STANDARDS:**
- Implement proper validation and edge case handling
- Use appropriate design patterns and architectural principles
- Include type safety where applicable (TypeScript, etc.)
- Optimize for both readability and performance
- Suggest folder structure and file organization when relevant
- Provide complete, runnable examples that work out of the box

**RESPONSE FORMAT:**
- Start with a brief explanation of the approach
- Provide the complete code solution
- Explain key design decisions and trade-offs
- Suggest next steps or improvements where applicable
- Include usage examples when helpful

Focus on creating code that other developers would be proud to maintain and extend.`;
  }
}

export default AnthropicAIService;
