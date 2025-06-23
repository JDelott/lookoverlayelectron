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

    // Enhanced command detection and pre-processing using TerminalUtils
    if (TerminalUtils.isPackageManagerCommand(command)) {
      terminal.output += `\x1b[36m📦 Running package manager command...\x1b[0m\n`;
    } else if (TerminalUtils.isGitCommand(command)) {
      terminal.output += `\x1b[36m🌿 Running git command...\x1b[0m\n`;
    } else if (TerminalUtils.isFileSystemCommand(command)) {
      terminal.output += `\x1b[36m📁 Running file system command...\x1b[0m\n`;
    }

    try {
      if (!this.electronAPI) {
        const errorMsg = 'Electron API not available - check if Electron is running';
        terminal.output += `\x1b[91m❌ Error: ${errorMsg}\x1b[0m\n`;
        console.error('❌ Electron API not available for command execution');
        return { success: false, output: errorMsg };
      }

      console.log(`🔧 Executing: "${command}" in directory: ${terminal.workingDirectory}`);
      
      const result = await this.electronAPI.executeCommand(
        command, 
        terminal.workingDirectory,
        terminal.id
      );
      
      console.log(`📊 Command result:`, result);
      
      if (result.success) {
        if (result.output) {
          terminal.output += result.output + '\n';
        }
        
        // Enhanced success messages for different command types
        if (TerminalUtils.isPackageManagerCommand(command)) {
          terminal.output += `\x1b[32m✅ Package command completed successfully!\x1b[0m\n`;
        } else if (TerminalUtils.isGitCommand(command)) {
          terminal.output += `\x1b[32m✅ Git command completed successfully!\x1b[0m\n`;
        }
        
        console.log(`✅ Command succeeded: "${command}"`);
        
        return {
          success: true,
          output: result.output,
          workingDir: result.workingDir
        };
      } else {
        const errorOutput = result.output || 'Unknown error';
        terminal.output += `\x1b[91m❌ ${errorOutput}\x1b[0m\n`;
        
        // Enhanced error messages for different command types
        if (TerminalUtils.isPackageManagerCommand(command)) {
          terminal.output += `\x1b[93m💡 Package manager tips:\n`;
          terminal.output += `   • Check your internet connection\n`;
          terminal.output += `   • Verify package name spelling\n`;
          terminal.output += `   • Try: npm cache clean --force\x1b[0m\n`;
        } else if (TerminalUtils.isGitCommand(command)) {
          terminal.output += `\x1b[93m💡 Git tips:\n`;
          terminal.output += `   • Check if you're in a git repository\n`;
          terminal.output += `   • Verify remote repository access\n`;
          terminal.output += `   • Check git configuration: git config --list\x1b[0m\n`;
        }
        
        console.error(`❌ Command failed: "${command}" - ${errorOutput}`);
        
        return { success: false, output: errorOutput };
      }
    } catch (error) {
      const errorMsg = `Error: ${error}`;
      terminal.output += `\x1b[91m❌ ${errorMsg}\x1b[0m\n`;
      console.error(`❌ Command execution error: "${command}"`, error);
      return { success: false, output: errorMsg };
    }
  }

  private getStyledPrompt(workingDir: string): string {
    const shortDir = workingDir.split('/').pop() || workingDir;
    return `\x1b[36m╭─\x1b[0m \x1b[1;34m${shortDir}\x1b[0m
\x1b[36m╰─\x1b[0m \x1b[1;32m$\x1b[0m `;
  }
}
