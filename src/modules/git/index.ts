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
  private searchQuery = ''; // Add search query state

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

      const indexStatus = line[0]; // Status in index (staged)
      const workingStatus = line[1]; // Status in working tree (unstaged)
      const filePath = line.substring(3).trim();
      
      let status: GitFileStatus['status'];
      
      // Parse git status codes more accurately
      if (indexStatus !== ' ' && indexStatus !== '?') {
        // File has staged changes
        switch (indexStatus) {
          case 'M': status = 'staged'; break;
          case 'A': status = 'added'; break;
          case 'D': status = 'staged'; break; // Staged deletion
          case 'R': status = 'renamed'; break;
          default: status = 'staged';
        }
      } else if (workingStatus !== ' ') {
        // File has unstaged changes
        switch (workingStatus) {
          case 'M': status = 'modified'; break;
          case 'D': status = 'deleted'; break;
          case '?': status = 'untracked'; break;
          default: status = 'modified';
        }
      } else {
        continue; // No changes
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
    if (!gitPanel) {
      console.error('Git panel element not found');
      return;
    }

    console.log('Rendering git panel with search query:', this.searchQuery);
    console.log('Git status count:', this.gitStatus.length);

    // Filter files based on search query
    const filteredGitStatus = this.searchQuery 
      ? this.gitStatus.filter(file => 
          file.path.toLowerCase().includes(this.searchQuery.toLowerCase())
        )
      : this.gitStatus;

    const stagedFiles = filteredGitStatus.filter(f => f.status === 'staged' || (f.status === 'added'));
    const unstagedFiles = filteredGitStatus.filter(f => f.status !== 'staged' && f.status !== 'added');

    // Get total counts for display (including filtered)
    const totalStaged = this.gitStatus.filter(f => f.status === 'staged' || (f.status === 'added')).length;
    const totalUnstaged = this.gitStatus.filter(f => f.status !== 'staged' && f.status !== 'added').length;

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

      <!-- Search Input -->
      ${this.gitStatus.length > 0 ? `
        <div class="git-search-section mb-3">
          <div class="relative">
            <input 
              type="text" 
              id="git-search-input"
              placeholder="Search changed files..."
              value="${this.searchQuery}"
              class="w-full px-3 py-2 pl-8 pr-8 text-sm bg-gray-800 border border-gray-600 rounded 
                     text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500 
                     focus:ring-1 focus:ring-blue-500"
              oninput="window.gitManager?.handleSearchInput(this.value)"
            />
            <div class="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
              <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            ${this.searchQuery ? `
              <button 
                class="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-200"
                onclick="window.gitManager?.clearSearch()"
                title="Clear search"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            ` : ''}
          </div>
          ${this.searchQuery && filteredGitStatus.length !== this.gitStatus.length ? `
            <div class="text-xs text-gray-400 mt-1">
              Showing ${filteredGitStatus.length} of ${this.gitStatus.length} changed files
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${stagedFiles.length > 0 ? `
        <div class="git-section mb-4">
          <div class="flex items-center justify-between p-2 bg-gray-700 rounded-t">
            <span class="text-sm font-medium text-green-400">
              Staged Changes (${stagedFiles.length}${stagedFiles.length !== totalStaged ? ` of ${totalStaged}` : ''})
            </span>
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
      ` : totalStaged > 0 && this.searchQuery ? `
        <div class="git-section mb-4">
          <div class="flex items-center justify-between p-2 bg-gray-700 rounded-t">
            <span class="text-sm font-medium text-green-400">
              Staged Changes (0 of ${totalStaged} shown)
            </span>
          </div>
          <div class="bg-gray-800 rounded-b p-3 text-center text-gray-500 text-sm">
            No staged files match search criteria
          </div>
        </div>
      ` : ''}

      ${unstagedFiles.length > 0 ? `
        <div class="git-section mb-4">
          <div class="flex items-center justify-between p-2 bg-gray-700 rounded-t">
            <span class="text-sm font-medium text-yellow-400">
              Changes (${unstagedFiles.length}${unstagedFiles.length !== totalUnstaged ? ` of ${totalUnstaged}` : ''})
            </span>
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
      ` : totalUnstaged > 0 && this.searchQuery ? `
        <div class="git-section mb-4">
          <div class="flex items-center justify-between p-2 bg-gray-700 rounded-t">
            <span class="text-sm font-medium text-yellow-400">
              Changes (0 of ${totalUnstaged} shown)
            </span>
          </div>
          <div class="bg-gray-800 rounded-b p-3 text-center text-gray-500 text-sm">
            No unstaged files match search criteria
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
      ` : filteredGitStatus.length === 0 && this.searchQuery ? `
        <div class="text-center text-gray-500 text-sm p-4">
          <div class="mb-2">🔍</div>
          <div>No files match "${this.searchQuery}"</div>
          <button 
            class="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
            onclick="window.gitManager?.clearSearch()"
          >
            Clear search
          </button>
        </div>
      ` : ''}
    `;

    console.log('Git panel rendered successfully');

    // Focus search input if it exists and has content
    if (this.searchQuery) {
      setTimeout(() => {
        const searchInput = document.getElementById('git-search-input') as HTMLInputElement;
        if (searchInput) {
          const cursorPos = this.searchQuery.length;
          searchInput.focus();
          searchInput.setSelectionRange(cursorPos, cursorPos);
        }
      }, 0);
    }
  }

  private renderGitFile(file: GitFileStatus, isStaged: boolean): string {
    const statusIcon = this.getStatusIcon(file.status);
    const statusColor = this.getStatusColor(file.status);
    const fileName = file.path.split('/').pop() || file.path;
    const filePath = file.path;

    // Highlight search matches in file path
    const highlightedPath = this.searchQuery 
      ? this.highlightSearchMatch(filePath, this.searchQuery)
      : filePath;
    
    const highlightedFileName = this.searchQuery 
      ? this.highlightSearchMatch(fileName, this.searchQuery)
      : fileName;

    return `
      <div class="git-file-item flex items-center p-2 hover:bg-gray-700 cursor-pointer group" 
           onclick="window.gitManager?.openFile('${filePath}')">
        <span class="text-sm ${statusColor} mr-2 w-4">${statusIcon}</span>
        <span class="flex-1 text-sm text-gray-300 truncate" title="${highlightedPath}">${highlightedFileName}</span>
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
        // Refresh git status
        await this.refreshGitStatus();
        
        // If the file is currently open in the editor, reload its content
        await this.reloadFileInEditor(filePath);
        
        console.log('✅ Changes discarded for:', filePath);
      } else {
        console.error('Failed to discard file:', result.output);
        alert('Failed to discard changes: ' + result.output);
      }
    } catch (error) {
      console.error('Error discarding file:', error);
      alert('Error discarding changes: ' + error);
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
      // Store currently open files before discarding
      const openFiles = Array.from(this.state.openTabs.keys());
      
      const result = await this.electronAPI.executeGitCommand('checkout -- .');
      if (result.success) {
        // Refresh git status
        await this.refreshGitStatus();
        
        // Reload all open files that were modified
        for (const filePath of openFiles) {
          await this.reloadFileInEditor(filePath);
        }
        
        console.log('✅ All changes discarded');
      } else {
        console.error('Failed to discard all changes:', result.output);
        alert('Failed to discard all changes: ' + result.output);
      }
    } catch (error) {
      console.error('Error discarding all changes:', error);
      alert('Error discarding changes: ' + error);
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

  private async reloadFileInEditor(filePath: string): Promise<void> {
    try {
      // Check if the file is currently open in a tab
      const tab = this.state.openTabs.get(filePath);
      if (!tab) return; // File not open, nothing to reload

      console.log('🔄 Reloading file content in editor:', filePath);

      // Read the updated file content from disk
      const updatedContent = await this.electronAPI.readFile(filePath);
      
      // Update the tab content
      tab.content = updatedContent;
      tab.isDirty = false; // Mark as clean since we just reverted changes

      // If this is the currently active tab, update the editor
      if (this.state.activeTabPath === filePath && this.state.monacoEditor) {
        // Get current cursor position to restore it after reload
        const position = this.state.monacoEditor.getPosition();
        
        // Update the editor content
        this.state.monacoEditor.setValue(updatedContent);
        
        // Restore cursor position if possible
        if (position) {
          try {
            this.state.monacoEditor.setPosition(position);
          } catch (e) {
            // If position is invalid (e.g., line was deleted), just go to start
            this.state.monacoEditor.setPosition({ lineNumber: 1, column: 1 });
          }
        }
        
        console.log('✅ Editor content updated for:', filePath);
      }

      // Update tab visual state to show it's no longer dirty
      this.updateTabVisualState(filePath);
      
      // Dispatch event to notify other components
      const event = new CustomEvent('file-reverted', { 
        detail: { filePath, content: updatedContent } 
      });
      document.dispatchEvent(event);
      
    } catch (error) {
      console.error('❌ Failed to reload file in editor:', error);
    }
  }

  private updateTabVisualState(filePath: string): void {
    try {
      // Find the tab element and update its visual state
      const tabElements = document.querySelectorAll('.tab-bar > div');
      const openTabPaths = Array.from(this.state.openTabs.keys());
      
      tabElements.forEach((tabElement, index) => {
        if (openTabPaths[index] === filePath) {
          // Remove any "dirty" indicators from the tab
          const dirtyIndicator = tabElement.querySelector('.dirty-indicator');
          if (dirtyIndicator) {
            dirtyIndicator.remove();
          }
          
          // Update tab styling to reflect clean state
          tabElement.classList.remove('dirty');
        }
      });
    } catch (error) {
      console.error('Error updating tab visual state:', error);
    }
  }

  async handleFileSave(filePath: string): Promise<void> {
    // Refresh git status when a file is saved
    if (this.isGitRepo) {
      setTimeout(() => this.refreshGitStatus(), 100);
    }
  }

  // New search-related methods
  public handleSearchInput(query: string): void {
    console.log('Search input changed:', query);
    this.searchQuery = query;
    this.renderGitPanel();
  }

  public clearSearch(): void {
    console.log('Clearing search');
    this.searchQuery = '';
    this.renderGitPanel();
    
    // Focus the search input after clearing
    setTimeout(() => {
      const searchInput = document.getElementById('git-search-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    }, 0);
  }

  private highlightSearchMatch(text: string, query: string): string {
    if (!query) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="bg-yellow-400 text-black">$1</span>');
  }
} 
