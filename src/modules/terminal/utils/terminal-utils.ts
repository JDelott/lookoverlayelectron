export class TerminalUtils {
  static isPackageManagerCommand(command: string): boolean {
    const packageCommands = [
      'npm install', 'npm i ', 'npm add', 'npm update',
      'yarn install', 'yarn add', 'yarn upgrade',
      'pnpm install', 'pnpm add', 'pnpm update',
      'npx create-', 'npx @'
    ];
    
    return packageCommands.some(cmd => command.startsWith(cmd));
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static truncatePath(path: string, maxLength: number = 50): string {
    if (path.length <= maxLength) return path;
    const parts = path.split('/');
    if (parts.length <= 2) return path;
    
    let result = parts[0] + '/.../' + parts[parts.length - 1];
    if (result.length > maxLength) {
      result = '.../' + parts[parts.length - 1];
    }
    return result;
  }
}
