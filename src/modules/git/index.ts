import { AppState } from '../types/index.js';

export interface GitFileStatus {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'staged' | 'unstaged';
  oldPath?: string; // For renamed files
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
  shortHash: string;
}

export class GitManager {
  private state: AppState;
  private electronAPI: any;
  private gitStatus: GitFileStatus[] = [];
  private currentBranch = '';
  private branches: GitBranch[] = [];
  private isGitRepo = false;

  constructor(state: AppState) {
    this.state = state;
    this.electronAPI = (window as any).electronAPI;
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing Git manager...');
    await this.checkGitRepository();
    if (this.isGitRepo) {
      await this.refreshGitStatus();
      await this.loadBranches();
    }
    this.setupEventListeners();
  }

  private async checkGitRepository(): Promise<void> {
    try {
      const result = await this.electronAPI.executeGitCommand('rev-parse --git-dir');
      this.isGitRepo = result.success;
      console.log('📁 Git repository detected:', this.isGitRepo);
    } catch (error) {
      this.isGitRepo = false;
      console.log('📁 No Git repository found');
    }
  }

  async refreshGitStatus(): Promise<void> {
    if (!this.isGitRepo) return;

    try {
      // Get current branch
      const branchResult = await this.electronAPI.executeGitCommand('rev-parse --abbrev-ref HEAD');
      if (branchResult.success) {
        this.currentBranch = branchResult.output.trim();
      }

      // Get git status in porcelain format
      const statusResult = await this.electronAPI.executeGitCommand('status --porcelain');
      if (statusResult.success) {
        this.parseGitStatus(statusResult.output);
      }

      this.updateGitUI();
    } catch (error) {
      console.error('❌ Failed to refresh git status:', error);
    }
  }

  private parseGitStatus(output: string): void {
    this.gitStatus = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      if (line.length < 3) continue;

      const statusCode = line.substring(0, 2);
      const filePath = line.substring(3).trim();
      
      let status: GitFileStatus['status'];
      
      // Parse git status codes
      switch (statusCode.trim()) {
        case 'M': status = 'modified'; break;
        case 'A': status = 'added'; break;
        case 'D': status = 'deleted'; break;
        case 'R': status = 'renamed'; break;
        case '??': status = 'untracked'; break;
        case 'MM': status = 'modified'; break; // Modified in index and working tree
        default:
          if (statusCode[0] !== ' ') status = 'staged';
          else status = 'unstaged';
      }

      this.gitStatus.push({
        path: filePath,
        status,
        oldPath: status === 'renamed' ? this.parseRenamedPath(filePath) : undefined
      });
    }
  }

  private parseRenamedPath(path: string): string | undefined {
    // Handle renamed files format: "oldname -> newname"
    const match = path.match(/^(.+) -> (.+)$/);
    return match ? match[1] : undefined;
  }

  private async loadBranches(): Promise<void> {
    try {
      const result = await this.electronAPI.executeGitCommand('branch -a');
      if (result.success) {
        this.branches = this.parseBranches(result.output);
      }
    } catch (error) {
      console.error('❌ Failed to load branches:', error);
    }
  }

  private parseBranches(output: string): GitBranch[] {
    const branches: GitBranch[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const current = trimmed.startsWith('*');
      const name = trimmed.replace(/^\*\s*/, '').replace(/^remotes\//, '');
      
      if (!name.includes('HEAD ->')) {
        branches.push({
          name,
          current,
          remote: name.includes('/') ? name.split('/')[0] : undefined
        });
      }
    }

    return branches;
  }

  private updateGitUI(): void {
    this.renderGitPanel();
    this.updateFileTreeWithGitStatus();
  }

  private renderGitPanel(): void {
    const gitPanel = document.getElementById('git-panel');
    if (!gitPanel) return;

    const stagedFiles = this.gitStatus.filter(f => f.status === 'staged' || (f.status === 'added'));
    const unstagedFiles = this.gitStatus.filter(f => f.status !== 'staged' && f.status !== 'added');

    gitPanel.innerHTML = `
      <div class="git-branch-info">
        <div class="flex items-center gap-2 p-2 bg-gray-800 rounded mb-2">
          <span class="text-sm">🌿</span>
          <span class="text-sm font-medium text-gray-300">${this.currentBranch || 'No branch'}</span>
          <button class="ml-auto text-xs text-blue-400 hover:text-blue-300" onclick="window.gitManager?.showBranches()">
            Switch
          </button>
        </div>
      </div>

      ${stagedFiles.length > 0 ? `
        <div class="git-section mb-4">
          <div class="flex items-center justify-between p-2 bg-gray-700 rounded-t">
            <span class="text-sm font-medium text-green-400">Staged Changes (${stagedFiles.length})</span>
            <div class="flex gap-1">
              <button class="text-xs text-gray-400 hover:text-gray-200" onclick="window.gitManager?.unstageAll()" title="Unstage All">
                ↶
              </button>
            </div>
          </div>
          <div class="git-file-list bg-gray-800 rounded-b">
            ${stagedFiles.map(file => this.renderGitFile(file, true)).join('')}
          </div>
        </div>
      ` : ''}

      ${unstagedFiles.length > 0 ? `
        <div class="git-section mb-4">
          <div class="flex items-center justify-between p-2 bg-gray-700 rounded-t">
            <span class="text-sm font-medium text-yellow-400">Changes (${unstagedFiles.length})</span>
            <div class="flex gap-1">
              <button class="text-xs text-gray-400 hover:text-gray-200" onclick="window.gitManager?.stageAll()" title="Stage All">
                +
              </button>
              <button class="text-xs text-gray-400 hover:text-gray-200" onclick="window.gitManager?.discardAll()" title="Discard All">
                ↻
              </button>
            </div>
          </div>
          <div class="git-file-list bg-gray-800 rounded-b">
            ${unstagedFiles.map(file => this.renderGitFile(file, false)).join('')}
          </div>
        </div>
      ` : ''}

      ${stagedFiles.length > 0 ? `
        <div class="git-commit-section">
          <div class="p-2 bg-gray-700 rounded-t">
            <span class="text-sm font-medium text-blue-400">Commit</span>
          </div>
          <div class="p-2 bg-gray-800 rounded-b">
            <textarea 
              id="commit-message" 
              placeholder="Commit message..." 
              class="w-full p-2 text-sm bg-gray-900 border border-gray-600 rounded resize-none"
              rows="3"
            ></textarea>
            <div class="flex gap-2 mt-2">
              <button 
                class="flex-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                onclick="window.gitManager?.commit()"
              >
                Commit
              </button>
              <button 
                class="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded"
                onclick="window.gitManager?.commitAndPush()"
                title="Commit & Push"
              >
                Commit & Push
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      ${this.gitStatus.length === 0 ? `
        <div class="text-center text-gray-500 text-sm p-4">
          <div class="mb-2">✨</div>
          <div>No changes</div>
        </div>
      ` : ''}
    `;
  }

  private renderGitFile(file: GitFileStatus, isStaged: boolean): string {
    const statusIcon = this.getStatusIcon(file.status);
    const statusColor = this.getStatusColor(file.status);
    const fileName = file.path.split('/').pop() || file.path;
    const filePath = file.path;

    return `
      <div class="git-file-item flex items-center p-2 hover:bg-gray-700 cursor-pointer group" 
           onclick="window.gitManager?.openFile('${filePath}')">
        <span class="text-sm ${statusColor} mr-2 w-4">${statusIcon}</span>
        <span class="flex-1 text-sm text-gray-300 truncate" title="${filePath}">${fileName}</span>
        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          ${isStaged ? `
            <button class="text-xs text-gray-400 hover:text-yellow-400 p-1" 
                    onclick="event.stopPropagation(); window.gitManager?.unstageFile('${filePath}')" 
                    title="Unstage">
              ↶
            </button>
          ` : `
            <button class="text-xs text-gray-400 hover:text-green-400 p-1" 
                    onclick="event.stopPropagation(); window.gitManager?.stageFile('${filePath}')" 
                    title="Stage">
              +
            </button>
            <button class="text-xs text-gray-400 hover:text-red-400 p-1" 
                    onclick="event.stopPropagation(); window.gitManager?.discardFile('${filePath}')" 
                    title="Discard Changes">
              ↻
            </button>
          `}
          <button class="text-xs text-gray-400 hover:text-blue-400 p-1" 
                  onclick="event.stopPropagation(); window.gitManager?.showDiff('${filePath}')" 
                  title="Show Diff">
            👁
          </button>
        </div>
      </div>
    `;
  }

  private getStatusIcon(status: GitFileStatus['status']): string {
    const icons = {
      'modified': 'M',
      'added': 'A',
      'deleted': 'D',
      'renamed': 'R',
      'untracked': 'U',
      'staged': 'S',
      'unstaged': '•'
    };
    return icons[status] || '?';
  }

  private getStatusColor(status: GitFileStatus['status']): string {
    const colors = {
      'modified': 'text-yellow-400',
      'added': 'text-green-400',
      'deleted': 'text-red-400',
      'renamed': 'text-blue-400',
      'untracked': 'text-gray-400',
      'staged': 'text-green-400',
      'unstaged': 'text-yellow-400'
    };
    return colors[status] || 'text-gray-400';
  }

  private updateFileTreeWithGitStatus(): void {
    // Add git status indicators to file tree
    this.gitStatus.forEach(gitFile => {
      const fileElements = document.querySelectorAll(`[data-file-path="${gitFile.path}"]`);
      fileElements.forEach(element => {
        const statusIcon = this.getStatusIcon(gitFile.status);
        const statusColor = this.getStatusColor(gitFile.status);
        
        // Add or update git status indicator
        let indicator = element.querySelector('.git-status-indicator');
        if (!indicator) {
          indicator = document.createElement('span');
          indicator.className = 'git-status-indicator ml-auto text-xs';
          element.appendChild(indicator);
        }
        
        indicator.textContent = statusIcon;
        indicator.className = `git-status-indicator ml-auto text-xs ${statusColor}`;
      });
    });
  }

  private setupEventListeners(): void {
    // Listen for file system changes to refresh git status
    document.addEventListener('file-tree-updated', () => {
      if (this.isGitRepo) {
        setTimeout(() => this.refreshGitStatus(), 100);
      }
    });

    // Listen for file saves to refresh git status
    document.addEventListener('file-saved', () => {
      if (this.isGitRepo) {
        setTimeout(() => this.refreshGitStatus(), 100);
      }
    });
  }

  // Public API methods
  async stageFile(filePath: string): Promise<void> {
    try {
      const result = await this.electronAPI.executeGitCommand(`add "${filePath}"`);
      if (result.success) {
        await this.refreshGitStatus();
      } else {
        console.error('Failed to stage file:', result.output);
      }
    } catch (error) {
      console.error('Error staging file:', error);
    }
  }

  async unstageFile(filePath: string): Promise<void> {
    try {
      const result = await this.electronAPI.executeGitCommand(`reset HEAD "${filePath}"`);
      if (result.success) {
        await this.refreshGitStatus();
      } else {
        console.error('Failed to unstage file:', result.output);
      }
    } catch (error) {
      console.error('Error unstaging file:', error);
    }
  }

  async discardFile(filePath: string): Promise<void> {
    const confirmed = confirm(`Are you sure you want to discard changes to ${filePath}?`);
    if (!confirmed) return;

    try {
      const result = await this.electronAPI.executeGitCommand(`checkout -- "${filePath}"`);
      if (result.success) {
        await this.refreshGitStatus();
      } else {
        console.error('Failed to discard file:', result.output);
      }
    } catch (error) {
      console.error('Error discarding file:', error);
    }
  }

  async stageAll(): Promise<void> {
    try {
      const result = await this.electronAPI.executeGitCommand('add .');
      if (result.success) {
        await this.refreshGitStatus();
      }
    } catch (error) {
      console.error('Error staging all files:', error);
    }
  }

  async unstageAll(): Promise<void> {
    try {
      const result = await this.electronAPI.executeGitCommand('reset HEAD');
      if (result.success) {
        await this.refreshGitStatus();
      }
    } catch (error) {
      console.error('Error unstaging all files:', error);
    }
  }

  async discardAll(): Promise<void> {
    const confirmed = confirm('Are you sure you want to discard all changes?');
    if (!confirmed) return;

    try {
      const result = await this.electronAPI.executeGitCommand('checkout -- .');
      if (result.success) {
        await this.refreshGitStatus();
      }
    } catch (error) {
      console.error('Error discarding all changes:', error);
    }
  }

  async commit(): Promise<void> {
    const messageInput = document.getElementById('commit-message') as HTMLTextAreaElement;
    const message = messageInput?.value.trim();
    
    if (!message) {
      alert('Please enter a commit message');
      return;
    }

    try {
      const result = await this.electronAPI.executeGitCommand(`commit -m "${message}"`);
      if (result.success) {
        messageInput.value = '';
        await this.refreshGitStatus();
        console.log('✅ Commit successful');
      } else {
        console.error('Failed to commit:', result.output);
        alert('Commit failed: ' + result.output);
      }
    } catch (error) {
      console.error('Error committing:', error);
    }
  }

  async commitAndPush(): Promise<void> {
    await this.commit();
    // Add small delay to ensure commit completes
    setTimeout(async () => {
      try {
        const result = await this.electronAPI.executeGitCommand('push');
        if (result.success) {
          console.log('✅ Push successful');
        } else {
          console.error('Failed to push:', result.output);
          alert('Push failed: ' + result.output);
        }
      } catch (error) {
        console.error('Error pushing:', error);
      }
    }, 500);
  }

  async showDiff(filePath: string): Promise<void> {
    try {
      const result = await this.electronAPI.executeGitCommand(`diff "${filePath}"`);
      if (result.success) {
        this.showDiffModal(filePath, result.output);
      }
    } catch (error) {
      console.error('Error showing diff:', error);
    }
  }

  private showDiffModal(filePath: string, diff: string): void {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-gray-800 rounded-lg w-4/5 h-4/5 flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 class="text-lg font-semibold text-white">Diff: ${filePath}</h3>
          <button class="text-gray-400 hover:text-white" onclick="this.closest('.fixed').remove()">✕</button>
        </div>
        <div class="flex-1 overflow-auto p-4">
          <pre class="text-sm text-gray-300 whitespace-pre-wrap font-mono">${this.formatDiff(diff)}</pre>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  private formatDiff(diff: string): string {
    return diff
      .split('\n')
      .map(line => {
        if (line.startsWith('+')) return `<span class="text-green-400">${line}</span>`;
        if (line.startsWith('-')) return `<span class="text-red-400">${line}</span>`;
        if (line.startsWith('@@')) return `<span class="text-blue-400">${line}</span>`;
        return line;
      })
      .join('\n');
  }

  async openFile(filePath: string): Promise<void> {
    // Use existing tab manager to open the file
    const tabManager = (window as any).app?.tabManager;
    if (tabManager) {
      await tabManager.openFile(filePath);
    }
  }

  showBranches(): void {
    // Implement branch switching UI
    console.log('Show branches:', this.branches);
  }

  exposeGlobally(): void {
    (window as any).gitManager = this;
  }

  getGitStatus(): GitFileStatus[] {
    return this.gitStatus;
  }

  getCurrentBranch(): string {
    return this.currentBranch;
  }

  isRepository(): boolean {
    return this.isGitRepo;
  }
} 
