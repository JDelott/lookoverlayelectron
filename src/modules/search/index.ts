import { AppState } from '../types/index.js';

export interface SearchResult {
  filePath: string;
  fileName: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  includePattern: string;
  excludePattern: string;
}

export class SearchManager {
  private state: AppState;
  private electronAPI: any;
  private searchResults: SearchResult[] = [];
  private currentQuery = '';
  private searchTimeout: NodeJS.Timeout | null = null;
  private searchOptions: SearchOptions = {
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
    includePattern: '',
    excludePattern: 'node_modules,dist,.git,*.log'
  };

  constructor(state: AppState) {
    this.state = state;
    this.electronAPI = (window as any).electronAPI;
  }

  async performSearch(query: string): Promise<void> {
    console.log('🔍 performSearch called with:', query);
    
    if (!query || !query.trim()) {
      this.searchResults = [];
      this.currentQuery = '';
      this.renderSearchResults();
      return;
    }

    this.currentQuery = query.trim();
    console.log('🔍 Searching for:', this.currentQuery);

    try {
      // Use simple file-based search
      const results = await this.simpleFileSearch(this.currentQuery);
      this.searchResults = results;
      console.log('🔍 Found', results.length, 'results');
      this.renderSearchResults();
    } catch (error) {
      console.error('Search failed:', error);
      this.searchResults = [];
      this.renderSearchResults();
    }
  }

  private async simpleFileSearch(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    try {
      // Get list of files using a simple approach
      const files = await this.getFileList();
      console.log('📁 Found', files.length, 'files to search');
      
      // Search through each file
      for (const filePath of files.slice(0, 50)) { // Limit to first 50 files for performance
        try {
          console.log('🔍 Searching in:', filePath);
          const content = await this.electronAPI.readFile(filePath);
          if (!content) continue;
          
          const lines = content.split('\n');
          const searchRegex = this.createSearchRegex(query);
          
          lines.forEach((line, index) => {
            if (searchRegex.test(line)) {
              const match = line.match(searchRegex);
              if (match) {
                const matchStart = line.indexOf(match[0]);
                results.push({
                  filePath: filePath.replace(/^\.\//, ''),
                  fileName: filePath.split('/').pop() || filePath,
                  lineNumber: index + 1,
                  lineContent: line,
                  matchStart,
                  matchEnd: matchStart + match[0].length
                });
              }
            }
          });
        } catch (fileError) {
          console.warn('Could not read file:', filePath, fileError);
          continue;
        }
      }
    } catch (error) {
      console.error('File search failed:', error);
    }
    
    return results.slice(0, 100); // Limit total results
  }

  private async getFileList(): Promise<string[]> {
    try {
      // Get current directory contents recursively
      const files = await this.recursiveFileList(this.state.currentWorkingDirectory);
      return files.filter(file => this.isSearchableFile(file));
    } catch (error) {
      console.error('Failed to get file list:', error);
      return [];
    }
  }

  private async recursiveFileList(dir: string, depth: number = 0): Promise<string[]> {
    if (depth > 3) return []; // Limit recursion depth
    
    const files: string[] = [];
    
    try {
      const contents = await this.electronAPI.getDirectoryContents(dir);
      
      for (const item of contents) {
        if (this.shouldSkipPath(item.path)) continue;
        
        if (item.type === 'file') {
          files.push(item.path);
        } else if (item.type === 'directory' && depth < 3) {
          const subFiles = await this.recursiveFileList(item.path, depth + 1);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      console.warn('Could not read directory:', dir);
    }
    
    return files;
  }

  private shouldSkipPath(path: string): boolean {
    const skipPatterns = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
    return skipPatterns.some(pattern => path.includes(pattern));
  }

  private isSearchableFile(filePath: string): boolean {
    const searchableExtensions = ['.ts', '.js', '.tsx', '.jsx', '.css', '.scss', '.html', '.json', '.md', '.txt', '.py', '.java', '.cpp', '.c', '.php', '.rb'];
    return searchableExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
  }

  private createSearchRegex(query: string): RegExp {
    let pattern = query;
    
    if (!this.searchOptions.useRegex) {
      pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    if (this.searchOptions.wholeWord) {
      pattern = `\\b${pattern}\\b`;
    }
    
    const flags = this.searchOptions.caseSensitive ? 'g' : 'gi';
    return new RegExp(pattern, flags);
  }

  private renderSearchResults(): void {
    const searchPanel = document.getElementById('search-panel');
    if (!searchPanel) {
      console.error('Search panel not found');
      return;
    }

    console.log('🎨 Rendering search results');

    const resultCount = this.searchResults.length;
    const fileCount = new Set(this.searchResults.map(r => r.filePath)).size;

    searchPanel.innerHTML = `
      <div class="search-header">
        <div class="search-title">Search</div>
      </div>
      <div class="search-content">
        <!-- Search Input -->
        <div class="search-input-section p-3 border-b border-gray-700">
          <div class="relative mb-3">
            <input 
              type="text" 
              id="search-input"
              placeholder="Search in files..."
              value="${this.currentQuery}"
              class="w-full px-3 py-2 pl-8 text-sm bg-gray-800 border border-gray-600 rounded 
                     text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500 
                     focus:ring-1 focus:ring-blue-500"
            />
            <div class="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
              <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            ${this.currentQuery ? `
              <button 
                class="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-200"
                id="clear-search-btn"
                title="Clear search"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            ` : ''}
          </div>
          
          <!-- Search Options -->
          <div class="flex flex-wrap gap-3 text-xs">
            <label class="flex items-center gap-1 text-gray-400 cursor-pointer">
              <input 
                type="checkbox" 
                ${this.searchOptions.caseSensitive ? 'checked' : ''}
                class="w-3 h-3"
                id="case-sensitive-cb"
              />
              <span title="Match Case">Aa</span>
            </label>
            <label class="flex items-center gap-1 text-gray-400 cursor-pointer">
              <input 
                type="checkbox" 
                ${this.searchOptions.wholeWord ? 'checked' : ''}
                class="w-3 h-3"
                id="whole-word-cb"
              />
              <span title="Match Whole Word">Ab</span>
            </label>
            <label class="flex items-center gap-1 text-gray-400 cursor-pointer">
              <input 
                type="checkbox" 
                ${this.searchOptions.useRegex ? 'checked' : ''}
                class="w-3 h-3"
                id="regex-cb"
              />
              <span title="Use Regular Expression">.*</span>
            </label>
          </div>
        </div>

        <!-- Search Results -->
        ${this.currentQuery ? `
          <div class="search-results-header p-2 text-xs text-gray-400 border-b border-gray-700">
            ${resultCount} results in ${fileCount} files
          </div>
        ` : ''}

        <div class="search-results flex-1 overflow-y-auto">
          ${this.renderSearchResultsList()}
        </div>
      </div>
    `;

    // Set up event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    console.log('🔧 Setting up event listeners');
    
    // Search input
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    if (searchInput) {
      console.log('✅ Search input found, adding listeners');
      
      // Remove any existing listeners by cloning the node
      const newSearchInput = searchInput.cloneNode(true) as HTMLInputElement;
      searchInput.parentNode?.replaceChild(newSearchInput, searchInput);
      
      newSearchInput.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        console.log('📝 Search input changed:', value);
        this.handleSearchInput(value);
      });
      
      newSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const value = (e.target as HTMLInputElement).value;
          console.log('⏎ Enter pressed, searching:', value);
          this.performSearch(value);
        }
      });
    }

    // Clear button
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        console.log('🗑️ Clear button clicked');
        this.clearSearch();
      });
    }

    // Search options
    const caseSensitiveCb = document.getElementById('case-sensitive-cb') as HTMLInputElement;
    if (caseSensitiveCb) {
      caseSensitiveCb.addEventListener('change', (e) => {
        this.searchOptions.caseSensitive = (e.target as HTMLInputElement).checked;
        if (this.currentQuery) this.performSearch(this.currentQuery);
      });
    }

    const wholeWordCb = document.getElementById('whole-word-cb') as HTMLInputElement;
    if (wholeWordCb) {
      wholeWordCb.addEventListener('change', (e) => {
        this.searchOptions.wholeWord = (e.target as HTMLInputElement).checked;
        if (this.currentQuery) this.performSearch(this.currentQuery);
      });
    }

    const regexCb = document.getElementById('regex-cb') as HTMLInputElement;
    if (regexCb) {
      regexCb.addEventListener('change', (e) => {
        this.searchOptions.useRegex = (e.target as HTMLInputElement).checked;
        if (this.currentQuery) this.performSearch(this.currentQuery);
      });
    }
  }

  private renderSearchResultsList(): string {
    if (!this.currentQuery) {
      return `
        <div class="text-center text-gray-500 text-sm p-4">
          <div class="mb-2">🔍</div>
          <div>Search for text across files</div>
          <div class="text-xs mt-2 text-gray-600">
            Enter search terms above to find matches
          </div>
        </div>
      `;
    }

    if (this.searchResults.length === 0) {
      return `
        <div class="text-center text-gray-500 text-sm p-4">
          <div class="mb-2">📭</div>
          <div>No results found for "${this.currentQuery}"</div>
          <div class="text-xs mt-2 text-gray-600">
            Try different search terms
          </div>
        </div>
      `;
    }

    // Group results by file
    const groupedResults = this.groupResultsByFile();
    
    return Object.entries(groupedResults).map(([filePath, results]) => {
      const fileName = filePath.split('/').pop() || filePath;
      const fileDir = filePath.substring(0, filePath.lastIndexOf('/')) || '';
      
      return `
        <div class="search-file-group">
          <div class="search-file-header p-2 bg-gray-700 text-sm font-medium text-gray-200 cursor-pointer flex items-center justify-between">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-xs">📄</span>
              <span class="font-medium">${fileName}</span>
              ${fileDir ? `<span class="text-xs text-gray-400 truncate">${fileDir}</span>` : ''}
            </div>
            <span class="text-xs text-gray-400 flex-shrink-0">${results.length}</span>
          </div>
          <div class="search-file-results">
            ${results.map(result => this.renderSearchResult(result)).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  private groupResultsByFile(): Record<string, SearchResult[]> {
    const grouped: Record<string, SearchResult[]> = {};
    
    for (const result of this.searchResults) {
      if (!grouped[result.filePath]) {
        grouped[result.filePath] = [];
      }
      grouped[result.filePath].push(result);
    }
    
    return grouped;
  }

  private renderSearchResult(result: SearchResult): string {
    const beforeMatch = result.lineContent.substring(0, result.matchStart);
    const match = result.lineContent.substring(result.matchStart, result.matchEnd);
    const afterMatch = result.lineContent.substring(result.matchEnd);
    
    return `
      <div class="search-result-item p-2 hover:bg-gray-700 cursor-pointer border-b border-gray-800 text-sm"
           onclick="window.searchManager?.openSearchResult('${result.filePath}', ${result.lineNumber})">
        <div class="flex items-start gap-2">
          <span class="text-xs text-gray-500 font-mono min-w-[3rem] text-right">${result.lineNumber}</span>
          <div class="flex-1 font-mono text-xs overflow-hidden">
            <span class="text-gray-400">${this.escapeHtml(beforeMatch)}</span><span class="bg-yellow-400 text-black font-semibold">${this.escapeHtml(match)}</span><span class="text-gray-400">${this.escapeHtml(afterMatch)}</span>
          </div>
        </div>
      </div>
    `;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public API methods
  public handleSearchInput(query: string): void {
    console.log('🔄 handleSearchInput called with:', query);
    
    // Clear previous timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    // For empty query, clear immediately
    if (!query || !query.trim()) {
      this.currentQuery = '';
      this.searchResults = [];
      this.renderSearchResults();
      return;
    }
    
    // Debounce search for non-empty queries
    this.searchTimeout = setTimeout(() => {
      this.performSearch(query);
    }, 500);
  }

  public clearSearch(): void {
    console.log('🗑️ Clearing search');
    this.currentQuery = '';
    this.searchResults = [];
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
    this.renderSearchResults();
    
    // Focus search input
    setTimeout(() => {
      const searchInput = document.getElementById('search-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.value = '';
      }
    }, 0);
  }

  public async openSearchResult(filePath: string, lineNumber: number): Promise<void> {
    try {
      console.log('📂 Opening search result:', filePath, 'line:', lineNumber);
      
      // Use existing tab manager to open the file
      const tabManager = (window as any).app?.tabManager;
      if (tabManager) {
        await tabManager.openFile(filePath);
        
        // Navigate to the specific line
        setTimeout(() => {
          if (this.state.monacoEditor) {
            this.state.monacoEditor.revealLineInCenter(lineNumber);
            this.state.monacoEditor.setPosition({ lineNumber, column: 1 });
            this.state.monacoEditor.focus();
          }
        }, 100);
      }
    } catch (error) {
      console.error('Failed to open search result:', error);
    }
  }

  public initialize(): void {
    console.log('🚀 Initializing search manager');
    this.renderSearchResults();
  }

  public exposeGlobally(): void {
    (window as any).searchManager = this;
  }
}
