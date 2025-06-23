export class TerminalUtils {
  static isPackageManagerCommand(command: string): boolean {
    const packageCommands = [
      // npm commands
      'npm install', 'npm i ', 'npm add', 'npm update', 'npm upgrade',
      'npm run', 'npm start', 'npm build', 'npm test', 'npm audit',
      'npm cache', 'npm config', 'npm init', 'npm list', 'npm outdated',
      'npm uninstall', 'npm remove', 'npm link', 'npm publish',
      
      // yarn commands
      'yarn install', 'yarn add', 'yarn upgrade', 'yarn remove',
      'yarn run', 'yarn start', 'yarn build', 'yarn test',
      'yarn cache', 'yarn config', 'yarn init', 'yarn list',
      'yarn outdated', 'yarn link', 'yarn publish',
      
      // pnpm commands
      'pnpm install', 'pnpm add', 'pnpm update', 'pnpm remove',
      'pnpm run', 'pnpm start', 'pnpm build', 'pnpm test',
      'pnpm cache', 'pnpm config', 'pnpm init', 'pnpm list',
      'pnpm outdated', 'pnpm link', 'pnpm publish',
      
      // npx commands
      'npx create-', 'npx @', 'npx ', 
      
      // bun commands (if using Bun)
      'bun install', 'bun add', 'bun remove', 'bun run',
      'bun start', 'bun build', 'bun test'
    ];
    
    return packageCommands.some(cmd => command.startsWith(cmd));
  }

  static isGitCommand(command: string): boolean {
    const gitCommands = [
      'git init', 'git clone', 'git add', 'git commit', 'git push', 
      'git pull', 'git status', 'git log', 'git branch', 'git checkout',
      'git merge', 'git diff', 'git stash', 'git remote', 'git fetch',
      'git rebase', 'git reset', 'git tag', 'git config', 'git show',
      'git blame', 'git cherry-pick', 'git clean', 'git describe',
      'git grep', 'git ls-files', 'git mv', 'git rm', 'git submodule'
    ];
    
    return gitCommands.some(cmd => command.startsWith(cmd)) || command.trim() === 'git';
  }

  static detectCommandType(command: string): 'package' | 'git' | 'filesystem' | 'system' | 'unknown' {
    if (this.isPackageManagerCommand(command)) return 'package';
    if (this.isGitCommand(command)) return 'git';
    if (this.isFileSystemCommand(command)) return 'filesystem';
    if (this.isSystemCommand(command)) return 'system';
    return 'unknown';
  }

  static isFileSystemCommand(command: string): boolean {
    const fsCommands = [
      'ls', 'dir', 'cd ', 'mkdir', 'rmdir', 'rm ', 'cp ', 'mv ', 
      'touch', 'cat ', 'more ', 'less ', 'head ', 'tail ', 'find ',
      'grep ', 'chmod', 'chown', 'pwd', 'du ', 'df ', 'tree',
      'locate', 'which', 'whereis', 'file', 'stat'
    ];
    
    return fsCommands.some(cmd => 
      command.startsWith(cmd) || 
      command.trim() === cmd.trim()
    );
  }

  static isSystemCommand(command: string): boolean {
    const systemCommands = [
      'ps', 'top', 'htop', 'kill', 'killall', 'jobs', 'nohup',
      'ping', 'wget', 'curl', 'ssh', 'scp', 'rsync',
      'env', 'export', 'alias', 'history', 'clear', 'cls',
      'echo', 'printf', 'date', 'uptime', 'whoami', 'id',
      'uname', 'hostname', 'sudo', 'su'
    ];
    
    return systemCommands.some(cmd => 
      command.startsWith(cmd) || 
      command.trim() === cmd.trim()
    );
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

  static getCommandHelp(command: string): string | null {
    const helpMessages: { [key: string]: string } = {
      'npm': 'Node Package Manager - try: npm install, npm run, npm start',
      'yarn': 'Yarn Package Manager - try: yarn install, yarn add, yarn start',
      'pnpm': 'PNPM Package Manager - try: pnpm install, pnpm add, pnpm start',
      'git': 'Git Version Control - try: git status, git add, git commit',
      'node': 'Node.js Runtime - try: node --version, node script.js',
      'python': 'Python Interpreter - try: python --version, python script.py',
      'pip': 'Python Package Manager - try: pip install, pip list'
    };

    const baseCommand = command.split(' ')[0];
    return helpMessages[baseCommand] || null;
  }
}
