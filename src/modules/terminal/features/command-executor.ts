import { Terminal } from '../../types/index.js';
import { TerminalUtils } from '../utils/index.js';

export class CommandExecutor {
  private electronAPI: any;

  constructor() {
    this.electronAPI = (window as any).electronAPI;
  }

  async executeCommand(command: string, terminal: Terminal): Promise<{ success: boolean; output?: string; workingDir?: string }> {
    const prompt = this.getStyledPrompt(terminal.workingDirectory);
    terminal.output += `${prompt}${command}\n`;
    terminal.history.push(command);

    if (TerminalUtils.isPackageManagerCommand(command)) {
      terminal.output += `\x1b[36m🔄 Running package installation...\x1b[0m\n`;
    }

    try {
      if (this.electronAPI) {
        const result = await this.electronAPI.executeCommand(
          command, 
          terminal.workingDirectory,
          terminal.id
        );
        
        if (result.success) {
          if (result.output) {
            terminal.output += result.output + '\n';
          }
          
          if (TerminalUtils.isPackageManagerCommand(command)) {
            terminal.output += `\x1b[32m✅ Package installation completed successfully!\x1b[0m\n`;
          }
          
          return {
            success: true,
            output: result.output,
            workingDir: result.workingDir
          };
        } else {
          terminal.output += `\x1b[91m❌ ${result.output}\x1b[0m\n`;
          
          if (TerminalUtils.isPackageManagerCommand(command)) {
            terminal.output += `\x1b[93m💡 Try checking your internet connection or package name.\x1b[0m\n`;
          }
          
          return { success: false, output: result.output };
        }
      } else {
        terminal.output += '\x1b[91m❌ Error: Electron API not available\x1b[0m\n';
        return { success: false, output: 'Electron API not available' };
      }
    } catch (error) {
      const errorMsg = `Error: ${error}`;
      terminal.output += `\x1b[91m❌ ${errorMsg}\x1b[0m\n`;
      return { success: false, output: errorMsg };
    }
  }

  private getStyledPrompt(workingDir: string): string {
    const shortDir = workingDir.split('/').pop() || workingDir;
    return `\x1b[36m╭─\x1b[0m \x1b[1;34m${shortDir}\x1b[0m
\x1b[36m╰─\x1b[0m \x1b[1;32m$\x1b[0m `;
  }
}
