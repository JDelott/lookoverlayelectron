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
      model: 'claude-3-sonnet-20240229',
      maxTokens: 4096,
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
    return `You are an AI coding assistant integrated into a VS Code-like IDE. You help users with:

1. **Code Analysis**: Analyze and explain code snippets, functions, and files
2. **Code Generation**: Create new code based on requirements
3. **Debugging**: Help identify and fix issues in code
4. **Refactoring**: Suggest improvements and optimizations
5. **Documentation**: Generate comments and documentation
6. **Learning**: Explain programming concepts and best practices

When responding:
- Be concise but thorough
- Provide working code examples when appropriate
- Consider the context of the current file/project
- Suggest file paths and names for new components
- Use markdown formatting for better readability
- If suggesting code changes, be specific about where they should go

The user can share their current file content, selected text, or ask general programming questions.`;
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
    return `You are a code generation specialist. Generate clean, working code based on user requirements.

Guidelines:
- Write production-ready code with error handling
- Include necessary imports and dependencies
- Add helpful comments
- Follow best practices for the specified language/framework
- Provide complete, runnable examples
- Suggest file names and folder structure when appropriate
- Format code properly with syntax highlighting`;
  }
}

export default AnthropicAIService;
