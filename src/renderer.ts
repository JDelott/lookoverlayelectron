console.log('Renderer loaded');

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileItem[];
  isExpanded?: boolean;
}

let monacoEditor: any = null;
let currentFile: string = '';
let terminalVisible: boolean = false;
let terminalHistory: string[] = [];
let historyIndex: number = -1;
let terminalHeight: number = 200;
let isResizing: boolean = false;
let currentWorkingDirectory: string = '/Users/jacobdelott/Downloads/lookoverlayelectron-main'; // Default fallback

// Tab management state
interface OpenTab {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean; // for future save functionality
}

let openTabs: Map<string, OpenTab> = new Map();
let activeTabPath: string = '';

// Terminal management state
interface Terminal {
  id: string;
  name: string;
  workingDirectory: string;
  output: string;
  history: string[];
  isActive: boolean;
  runningProcesses: Set<string>;
  currentProcess: string; // Track current running process
  shell: string; // Track shell type
}

let terminals: Map<string, Terminal> = new Map();
let activeTerminalId: string = '';
let terminalCounter = 1;

// Global styles for VS Code-like layout with resizable terminal
const globalStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  html, body {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #1e1e1e;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    color: #cccccc;
    user-select: none;
  }
  
  #root {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: row;
  }
  
  .sidebar {
    width: 250px;
    background-color: #252526;
    border-right: 1px solid #3c3c3c;
    display: flex;
    flex-direction: column;
  }
  
  .sidebar-header {
    padding: 8px 12px;
    background-color: #2d2d30;
    border-bottom: 1px solid #3c3c3c;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: #cccccc;
  }
  
  .file-tree {
    flex: 1;
    padding: 4px 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
  
  .file-item {
    display: flex;
    align-items: center;
    padding: 2px 4px;
    cursor: pointer;
    font-size: 13px;
    line-height: 22px;
    user-select: none;
    border-radius: 3px;
    margin: 0 4px;
    white-space: nowrap;
    min-height: 22px;
  }
  
  .file-item:hover {
    background-color: #2a2d2e;
  }
  
  .file-item.selected {
    background-color: #094771;
    color: #ffffff;
  }
  
  .file-item.selected:hover {
    background-color: #0e639c;
  }
  
  .expansion-arrow {
    margin-right: 4px;
    font-size: 10px;
    color: #cccccc;
    cursor: pointer;
    width: 10px;
    text-align: center;
    transition: transform 0.1s ease;
  }
  
  .file-icon {
    width: 16px;
    height: 16px;
    margin-right: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    flex-shrink: 0;
  }
  
  .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }
  
  /* Add subtle background for nested items */
  .file-item[data-depth="1"] {
    background-color: rgba(255, 255, 255, 0.02);
  }
  
  .file-item[data-depth="2"] {
    background-color: rgba(255, 255, 255, 0.04);
  }
  
  .file-item[data-depth="3"] {
    background-color: rgba(255, 255, 255, 0.06);
  }
  
  .current-file-title {
    font-size: 12px;
    color: #cccccc;
    margin-left: auto;
    padding: 4px 8px;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
  
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  
  .toolbar {
    height: 35px;
    background-color: #2d2d30;
    border-bottom: 1px solid #3c3c3c;
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 8px;
  }
  
  .toolbar button {
    background: #0e639c;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 3px;
    font-size: 11px;
    cursor: pointer;
  }
  
  .toolbar button:hover {
    background: #1177bb;
  }
  
  .editor-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  
  .tab-bar {
    background-color: #2d2d30;
    border-bottom: 1px solid #3c3c3c;
    display: none; /* Hidden when no tabs */
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    min-height: 35px;
    align-items: flex-end;
  }
  
  .tab {
    background-color: #2d2d30;
    border-right: 1px solid #3c3c3c;
    min-width: 120px;
    max-width: 200px;
    height: 35px;
    cursor: pointer;
    display: flex;
    align-items: center;
    position: relative;
    flex-shrink: 0;
  }
  
  .tab:hover {
    background-color: #3c3c3c;
  }
  
  .tab.active {
    background-color: #1e1e1e;
    border-bottom: 2px solid #0e639c;
  }
  
  .tab-content {
    display: flex;
    align-items: center;
    padding: 0 8px;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  
  .tab-icon {
    margin-right: 6px;
    font-size: 12px;
    flex-shrink: 0;
  }
  
  .tab-name {
    flex: 1;
    font-size: 13px;
    color: #cccccc;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .tab.active .tab-name {
    color: #ffffff;
  }
  
  .tab-close {
    margin-left: 4px;
    width: 16px;
    height: 16px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    color: #cccccc;
    opacity: 0;
    transition: opacity 0.2s ease;
    flex-shrink: 0;
  }
  
  .tab:hover .tab-close {
    opacity: 1;
  }
  
  .tab-close:hover {
    background-color: #e81123;
    color: #ffffff;
  }
  
  .editor-container {
    flex: 1;
    position: relative;
    min-height: 200px;
  }
  
  .terminal-container {
    background-color: #1e1e1e;
    border-top: 1px solid #3c3c3c;
    display: none;
    flex-direction: column;
    position: relative;
  }
  
  .terminal-container.visible {
    display: flex;
  }
  
  .terminal-resize-handle {
    height: 4px;
    background-color: #3c3c3c;
    cursor: row-resize;
    position: relative;
    border-top: 1px solid #555;
  }
  
  .terminal-resize-handle:hover {
    background-color: #0e639c;
  }
  
  .terminal-resize-handle.dragging {
    background-color: #1177bb;
  }
  
  .terminal-header {
    background-color: #2d2d30;
    padding: 4px 8px;
    font-size: 12px;
    color: #cccccc;
    border-bottom: 1px solid #3c3c3c;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .terminal-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .terminal-header-right {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .terminal-size-indicator {
    font-size: 10px;
    color: #888;
  }
  
  .terminal-output {
    flex: 1;
    padding: 8px;
    overflow-y: auto;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.4;
    white-space: pre-wrap;
    background-color: #1e1e1e;
    color: #d4d4d4;
    user-select: text;
  }
  
  .terminal-input-container {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    background-color: #1e1e1e;
    border-top: 1px solid #3c3c3c;
  }
  
  .terminal-prompt {
    color: #569cd6;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
    margin-right: 4px;
  }
  
  .terminal-input {
    flex: 1;
    background: transparent;
    border: none;
    color: #d4d4d4;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
    outline: none;
  }
  
  .terminal-output::-webkit-scrollbar {
    width: 8px;
  }
  
  .terminal-output::-webkit-scrollbar-track {
    background: #1e1e1e;
  }
  
  .terminal-output::-webkit-scrollbar-thumb {
    background: #424242;
    border-radius: 4px;
  }
  
  .terminal-output::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
  
  .file-tree::-webkit-scrollbar {
    width: 8px;
  }
  
  .file-tree::-webkit-scrollbar-track {
    background: #252526;
  }
  
  .file-tree::-webkit-scrollbar-thumb {
    background: #424242;
    border-radius: 4px;
  }
  
  .file-tree::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
  
  body.resizing {
    cursor: row-resize !important;
  }
  
  body.resizing * {
    user-select: none !important;
  }
  
  /* Scrollbar for tab bar */
  .tab-bar::-webkit-scrollbar {
    height: 3px;
  }
  
  .tab-bar::-webkit-scrollbar-track {
    background: #2d2d30;
  }
  
  .tab-bar::-webkit-scrollbar-thumb {
    background: #424242;
    border-radius: 2px;
  }
  
  .tab-bar::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
  
  .terminal-tabs {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .terminal-tab {
    background-color: #3c3c3c;
    border: 1px solid #555;
    border-radius: 4px 4px 0 0;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    min-width: 80px;
    max-width: 150px;
  }
  
  .terminal-tab:hover {
    background-color: #4c4c4c;
  }
  
  .terminal-tab.active {
    background-color: #1e1e1e;
    border-bottom: 1px solid #1e1e1e;
    color: #ffffff;
  }
  
  .terminal-tab-content {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 4px;
  }
  
  .terminal-tab-icon {
    font-size: 10px;
    flex-shrink: 0;
  }
  
  .terminal-tab-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
  }
  
  .terminal-process-indicator {
    font-size: 8px;
    margin-right: 2px;
  }
  
  .terminal-tab-close {
    width: 14px;
    height: 14px;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: #cccccc;
    opacity: 0;
    transition: opacity 0.2s ease;
    flex-shrink: 0;
  }
  
  .terminal-tab:hover .terminal-tab-close {
    opacity: 1;
  }
  
  .terminal-tab-close:hover {
    background-color: #e81123;
    color: #ffffff;
  }
`;

// DOM content loaded handler
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, initializing Monaco Editor');
  
  // Add styles
const styleElement = document.createElement('style');
styleElement.textContent = globalStyles;
document.head.appendChild(styleElement);

  // Create layout
  createLayout();
  
  // Initialize Monaco Editor
  await initializeMonaco();
  
  // Load file tree
  await renderFileTree();
  
  // Setup resize functionality
  setupTerminalResize();
  
  // Setup streaming output listener
  setupCommandStreaming();
  
  console.log('Application initialized successfully');
});

// Add auto-save functionality
let autoSaveTimeout: NodeJS.Timeout | null = null;
let isAutoSaveEnabled = true;

// Track running processes
let runningProcesses: Map<string, {id: string, command: string}> = new Map();

function createLayout() {
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = `
    <div class="sidebar">
      <div class="sidebar-header">
        Explorer
        <button id="refresh-explorer" style="
          background: transparent;
          border: 1px solid #3c3c3c;
          color: #cccccc;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          margin-left: 8px;
        ">🔄</button>
      </div>
      <div class="file-tree"></div>
    </div>
    <div class="main-content">
      <div class="toolbar">
        <button id="terminal-toggle">Toggle Terminal</button>
        <button id="clear-terminal">Clear Terminal</button>
        <button id="refresh-files">🔄 Refresh Files</button>
        <button id="save-file" style="
          background: #0e639c;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          font-size: 11px;
          cursor: pointer;
          margin-left: 8px;
        ">💾 Save (Ctrl+S)</button>
        <button id="toggle-autosave" style="
          background: #28a745;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          font-size: 11px;
          cursor: pointer;
          margin-left: 4px;
        ">🔄 Auto-Save: ON</button>
        <button id="stop-processes" style="
          background: #dc3545;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          font-size: 11px;
          cursor: pointer;
          margin-left: 8px;
          display: none;
        ">🛑 Stop Server (Ctrl+C)</button>
      </div>
      <div class="editor-area">
        <div class="tab-bar" id="tab-bar"></div>
      <div class="editor-container" id="editor-container"></div>
      </div>
      <div class="terminal-container" id="terminal-container">
        <div class="terminal-resize-handle" id="terminal-resize-handle"></div>
        <div class="terminal-header">
          <div class="terminal-header-left">
            <div class="terminal-tabs" id="terminal-tabs"></div>
            <button id="new-terminal" style="
              background: #0e639c;
              color: white;
              border: none;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 10px;
              cursor: pointer;
              margin-left: 8px;
            ">+ New Terminal</button>
          </div>
          <div class="terminal-header-right">
            <span id="process-indicator" style="
              margin-right: 8px;
              font-size: 11px;
              color: #28a745;
              display: none;
            ">🟢 Server Running</span>
            <span class="terminal-size-indicator" id="terminal-size-indicator">Height: 200px</span>
          </div>
        </div>
        <div class="terminal-output" id="terminal-output"></div>
        <div class="terminal-input-container">
          <span class="terminal-prompt">$</span>
          <input type="text" class="terminal-input" id="terminal-input" placeholder="Type a command..." />
        </div>
      </div>
    </div>
  `;

  // Add event listeners
  document.getElementById('terminal-toggle')?.addEventListener('click', toggleTerminal);
  document.getElementById('clear-terminal')?.addEventListener('click', clearActiveTerminal);
  document.getElementById('refresh-explorer')?.addEventListener('click', refreshCurrentDirectory);
  document.getElementById('refresh-files')?.addEventListener('click', refreshCurrentDirectory);
  document.getElementById('save-file')?.addEventListener('click', saveCurrentFile);
  document.getElementById('toggle-autosave')?.addEventListener('click', toggleAutoSave);
  document.getElementById('stop-processes')?.addEventListener('click', stopAllProcesses);
  document.getElementById('new-terminal')?.addEventListener('click', createNewTerminal);
  
  const terminalInput = document.getElementById('terminal-input') as HTMLInputElement;
  terminalInput?.addEventListener('keydown', handleTerminalInput);
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(event: KeyboardEvent) {
  // Ctrl+S or Cmd+S to save
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    saveCurrentFile();
  }
  
  // Ctrl+C to stop processes (when terminal is focused)
  if (event.ctrlKey && event.key === 'c') {
    const terminalInput = document.getElementById('terminal-input');
    if (document.activeElement === terminalInput || runningProcesses.size > 0) {
      event.preventDefault();
      stopAllProcesses();
    }
  }
}

async function saveCurrentFile() {
  if (!activeTabPath || !monacoEditor) {
    writeToTerminal('❌ No file open to save');
    return;
  }
  
  const currentContent = monacoEditor.getValue();
  const tab = openTabs.get(activeTabPath);
  
  if (!tab) {
    writeToTerminal('❌ No active tab found');
    return;
  }
  
  try {
    const result = await (window as any).electronAPI.writeFile(activeTabPath, currentContent);
    
    if (result.success) {
      // Update tab content and mark as clean
      tab.content = currentContent;
      tab.isDirty = false;
      
      // Update tab display
      renderTabs();
      
      console.log(`✅ Saved: ${tab.name}`);
      writeToTerminal(`💾 Saved: ${tab.name}`);
      
      // Show temporary save indicator
      showSaveIndicator();
      
    } else {
      writeToTerminal(`❌ Failed to save ${tab.name}: ${result.error}`);
    }
  } catch (error) {
    writeToTerminal(`❌ Error saving file: ${error}`);
  }
}

function showSaveIndicator() {
  const saveBtn = document.getElementById('save-file');
  if (saveBtn) {
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '✅ Saved!';
    saveBtn.style.backgroundColor = '#28a745';
    
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.backgroundColor = '#0e639c';
    }, 1000);
  }
}

function toggleAutoSave() {
  isAutoSaveEnabled = !isAutoSaveEnabled;
  const btn = document.getElementById('toggle-autosave');
  
  if (btn) {
    if (isAutoSaveEnabled) {
      btn.textContent = '🔄 Auto-Save: ON';
      btn.style.backgroundColor = '#28a745';
      writeToTerminal('✅ Auto-save enabled');
    } else {
      btn.textContent = '⏸️ Auto-Save: OFF';
      btn.style.backgroundColor = '#6c757d';
      writeToTerminal('⏸️ Auto-save disabled');
      
      // Clear any pending auto-save
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = null;
      }
    }
  }
}

function setupAutoSave() {
  if (!monacoEditor) return;
  
  // Listen for content changes
  monacoEditor.onDidChangeModelContent(() => {
    if (!isAutoSaveEnabled || !activeTabPath) return;
    
    // Mark tab as dirty
    const tab = openTabs.get(activeTabPath);
    if (tab) {
      tab.isDirty = true;
      renderTabs(); // Update tab display to show dirty indicator
    }
    
    // Debounce auto-save (save 2 seconds after last change)
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }
    
    autoSaveTimeout = setTimeout(() => {
      saveCurrentFile();
    }, 2000);
  });
}

function setupTerminalResize() {
  const resizeHandle = document.getElementById('terminal-resize-handle');
  if (!resizeHandle) return;

  let startY = 0;
  let startHeight = 0;

  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isResizing = true;
    startY = e.clientY;
    startHeight = terminalHeight;
    
    document.body.classList.add('resizing');
    resizeHandle!.classList.add('dragging');
    
    // Add global mouse event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });

  function handleMouseMove(e: MouseEvent) {
    if (!isResizing) return;
    
    e.preventDefault();
    const deltaY = startY - e.clientY; // Inverted because we want drag up to increase height
    const newHeight = Math.max(100, Math.min(600, startHeight + deltaY));
    
    setTerminalHeight(newHeight);
  }

  function handleMouseUp(e: MouseEvent) {
    if (!isResizing) return;
    
    e.preventDefault();
    isResizing = false;
    
    document.body.classList.remove('resizing');
    resizeHandle!.classList.remove('dragging');
    
    // Remove global mouse event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Force Monaco to resize after drag is complete
    setTimeout(() => {
      monacoEditor?.layout();
    }, 10);
  }
}

function setTerminalHeight(height: number) {
  terminalHeight = height;
  const terminalContainer = document.getElementById('terminal-container');
  const sizeIndicator = document.getElementById('terminal-size-indicator');
  
  if (terminalContainer) {
    terminalContainer.style.height = `${height}px`;
  }
  
  if (sizeIndicator) {
    sizeIndicator.textContent = `Height: ${height}px`;
  }
  
  // Trigger Monaco layout update
  if (monacoEditor) {
    monacoEditor.layout();
  }
  
  // Resize real terminal to fit new dimensions
  setTimeout(() => {
    resizeTerminalToFit();
  }, 100);
}

function toggleTerminal() {
  terminalVisible = !terminalVisible;
  console.log('Terminal toggle clicked, visible:', terminalVisible);
  
  const terminalContainer = document.getElementById('terminal-container');
  if (!terminalContainer) return;
  
  if (terminalVisible) {
    terminalContainer.classList.add('visible');
    setTerminalHeight(terminalHeight);
    
    // Focus the terminal input
    const terminalInput = document.getElementById('terminal-input') as HTMLInputElement;
    terminalInput?.focus();
    
    // Initialize terminal if first time
    if (!document.getElementById('terminal-output')?.textContent?.trim()) {
      initializeTerminal();
    }
  } else {
    terminalContainer.classList.remove('visible');
  }
  
  // Force Monaco to resize
  setTimeout(() => {
    monacoEditor?.layout();
  }, 100);
}

function initializeTerminal() {
  const output = document.getElementById('terminal-output');
  if (!output) return;
  
  // Clear any existing content
  output.textContent = '';
  
  // Start the real terminal process
  startRealTerminal();
}

async function startRealTerminal() {
  const output = document.getElementById('terminal-output');
  if (!output) return;
  
  console.log('🔧 Starting command-based terminal...');
  writeToTerminal('✅ Terminal ready! Type commands below.');
  writeToTerminal('📁 Directory navigation and file operations supported.');
  
  // Get initial working directory from main process
  try {
    const dirResult = await (window as any).electronAPI.getCurrentDirectory();
    if (dirResult.success) {
      currentWorkingDirectory = dirResult.directory;
      writeToTerminal(`📍 Current directory: ${currentWorkingDirectory}`);
    } else {
      writeToTerminal(`📍 Using default directory: ${currentWorkingDirectory}`);
    }
  } catch (error) {
    console.log('Could not get initial directory');
    writeToTerminal(`📍 Using default directory: ${currentWorkingDirectory}`);
  }
  
  writeToTerminal('');
}

function resizeTerminalToFit() {
  const output = document.getElementById('terminal-output');
  if (!output) return;
  
  // Calculate approximate character dimensions
  const style = window.getComputedStyle(output);
  const fontSize = parseFloat(style.fontSize);
  const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.4;
  
  // Estimate character width (monospace)
  const charWidth = fontSize * 0.6;
  
  // Calculate terminal dimensions
  const containerWidth = output.clientWidth - 16; // Account for padding
  const containerHeight = output.clientHeight - 16;
  
  const cols = Math.floor(containerWidth / charWidth);
  const rows = Math.floor(containerHeight / lineHeight);
  
  console.log(`Would resize terminal to ${cols}x${rows}`);
}

function initializeMockTerminal() {
  writeToTerminal('🔧 Demo Terminal Mode');
  writeToTerminal('Real terminal failed to start. Using mock commands.');
  writeToTerminal('Available commands: help, clear, date, echo, ls, pwd');
  writeToTerminal('');
  
  // Remove real terminal input handling and restore mock handling
  const terminalInput = document.getElementById('terminal-input') as HTMLInputElement;
  if (terminalInput) {
    // Clone the input to remove existing event listeners
    const newInput = terminalInput.cloneNode(true) as HTMLInputElement;
    terminalInput.parentNode?.replaceChild(newInput, terminalInput);
    newInput.addEventListener('keydown', handleTerminalInput);
  }
}

function handleTerminalInput(event: KeyboardEvent) {
  const input = event.target as HTMLInputElement;
  
  if (event.key === 'Enter') {
    const command = input.value;
    console.log('🚀 Command entered:', JSON.stringify(command));
    
    if (command.trim()) {
      // Echo the command
      writeToTerminal(`$ ${command}`);
      
      // Execute command
      executeRealCommand(command.trim());
      
      input.value = '';
    
      // Add to history
      terminalHistory.unshift(command.trim());
      if (terminalHistory.length > 100) {
        terminalHistory.pop();
      }
      historyIndex = -1;
    } else {
      writeToTerminal('$ ');
    }
    
    input.value = '';
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (historyIndex < terminalHistory.length - 1) {
      historyIndex++;
      input.value = terminalHistory[historyIndex] || '';
    }
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (historyIndex > 0) {
      historyIndex--;
      input.value = terminalHistory[historyIndex] || '';
    } else if (historyIndex === 0) {
      historyIndex = -1;
      input.value = '';
    }
  } else if (event.ctrlKey && event.key === 'c') {
    // Handle Ctrl+C in terminal
    event.preventDefault();
    writeToTerminal('^C');
    input.value = '';
    stopAllProcesses();
  }
}

async function executeRealCommand(command: string) {
  const activeTerminal = terminals.get(activeTerminalId);
  if (!activeTerminal) return;
  
  try {
    console.log('Executing command:', command, 'in directory:', activeTerminal.workingDirectory);
    
    // Parse command to get process name
    const args = command.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();
    
    // Handle special commands that affect directory state
    if (cmd === 'cd') {
      await handleCdCommand(args);
      return;
    }
    
    // Handle package manager commands with better feedback
    if (cmd === 'npm' || cmd === 'yarn' || cmd === 'pnpm' || cmd === 'bun') {
      await handlePackageManagerCommand(command);
      return;
    }
    
    // Update terminal name for long-running processes
    const isLongRunning = command.includes('dev') || command.includes('start') || command.includes('serve') || 
                         cmd === 'node' || cmd === 'python' || cmd === 'ruby';
    
    if (isLongRunning) {
      // Extract meaningful process name
      let processName = cmd;
      
      if (cmd === 'npm') {
        const subCmd = args[1];
        if (subCmd === 'run') {
          processName = args[2] || 'npm';
        } else {
          processName = `npm:${subCmd}`;
        }
      } else if (cmd === 'yarn') {
        processName = args[1] ? `yarn:${args[1]}` : 'yarn';
      } else if (cmd === 'node') {
        processName = args[1] ? `node:${args[1].split('/').pop()?.replace('.js', '')}` : 'node';
      }
      
      updateTerminalName(activeTerminalId, processName);
    }
    
    // Show a loading indicator
    const loadingMsg = '⏳ Executing...';
    writeToTerminal(loadingMsg);
    
    const result = await (window as any).electronAPI.executeCommand(command, activeTerminal.workingDirectory);
    console.log('Command result:', result);
    
    // Remove loading message
    if (activeTerminal.output.endsWith(`${loadingMsg}\n`)) {
      activeTerminal.output = activeTerminal.output.slice(0, -loadingMsg.length - 1);
      const output = document.getElementById('terminal-output');
      if (output) {
        output.textContent = activeTerminal.output;
      }
    }
    
    // Show command output
    if (result.output && result.output.trim()) {
      writeToTerminal(result.output.trim());
    }
    
    if (!result.success && result.code !== 0) {
      writeToTerminal(`(Exit code: ${result.code})`);
      
      // Reset terminal name if process failed
      if (isLongRunning) {
        updateTerminalName(activeTerminalId);
      }
    }
    
    // Commands that modify the file system should refresh the explorer
    const fileModifyingCommands = ['mkdir', 'rmdir', 'rm', 'mv', 'cp', 'touch', 'ln', 'git'];
    if (fileModifyingCommands.includes(cmd) && result.success) {
      setTimeout(async () => {
        await refreshCurrentDirectory();
        writeToTerminal(`🔄 File explorer refreshed`);
      }, 100);
    }
    
    writeToTerminal(''); // Empty line for spacing
    
  } catch (error) {
    console.error('Command execution error:', error);
    writeToTerminal(`Error: ${error}`);
    writeToTerminal('');
  }
}

async function handlePackageManagerCommand(command: string) {
  const args = command.split(' ');
  const packageManager = args[0];
  const subCommand = args[1];
  const script = args[2];
  
  writeToTerminal(`🔧 Running ${packageManager} command...`);
  
  // Update terminal name for long-running commands
  let processName = packageManager;
  if (subCommand === 'run' && script) {
    processName = script; // Show the script name (dev, start, build)
    updateTerminalName(activeTerminalId, processName);
  } else if (subCommand === 'start') {
    processName = 'start';
    updateTerminalName(activeTerminalId, processName);
  }
  
  // Provide helpful feedback for common commands
  if (subCommand === 'run' && (script === 'dev' || script === 'start' || script === 'serve')) {
    writeToTerminal(`🏃 Running script: ${script}`);
    writeToTerminal('🌐 Development server starting...');
    writeToTerminal('⏳ Waiting for server to be ready...');
    writeToTerminal('📡 Output will stream below:');
    writeToTerminal('');
  }
  
  try {
    const result = await (window as any).electronAPI.executeCommand(command, currentWorkingDirectory);
    
    // For non-streaming commands, show output normally
    if (!result.isLongRunning && result.output && result.output.trim()) {
      writeToTerminal(result.output.trim());
    }
    
    if (result.success) {
      if (!result.isLongRunning) {
        if (subCommand === 'install' || subCommand === 'i') {
          writeToTerminal('✅ Dependencies installed successfully!');
          setTimeout(async () => {
            await refreshCurrentDirectory();
          }, 1000);
        }
        // Reset name for non-long-running commands
        updateTerminalName(activeTerminalId);
      } else {
        writeToTerminal('✅ Development server started! Output streaming above...');
      }
    } else {
      // Reset name if command failed
      updateTerminalName(activeTerminalId);
      
      writeToTerminal(`❌ ${packageManager} command failed (Exit code: ${result.code})`);
      
      // Provide helpful suggestions for common errors
      if (result.output?.includes('ERESOLVE')) {
        writeToTerminal('💡 Try one of these solutions:');
        writeToTerminal(`   ${packageManager} install --legacy-peer-deps`);
        writeToTerminal(`   ${packageManager} install --force`);
        writeToTerminal('   yarn install  # Often handles conflicts better');
      } else if (result.output?.includes('permission denied') || result.output?.includes('EACCES')) {
        writeToTerminal('💡 Permission issue - try:');
        writeToTerminal('   sudo npm install  # Use with caution');
        writeToTerminal('   npm config set prefix ~/.npm-global');
      } else if (result.output?.includes('not found')) {
        writeToTerminal(`💡 Make sure ${packageManager} is installed globally`);
        writeToTerminal('   Visit: https://nodejs.org to install Node.js and npm');
      }
    }
  } catch (error) {
    writeToTerminal(`❌ Error running ${packageManager}: ${error}`);
    updateTerminalName(activeTerminalId); // Reset name on error
  }
  
  writeToTerminal('');
}

function addClickableLink(url: string) {
  const output = document.getElementById('terminal-output');
  if (!output) return;
  
  // Create a clickable link element
  const linkElement = document.createElement('div');
  linkElement.style.color = '#569cd6';
  linkElement.style.textDecoration = 'underline';
  linkElement.style.cursor = 'pointer';
  linkElement.style.margin = '4px 0';
  linkElement.textContent = `🔗 Open ${url} in browser`;
  
  linkElement.addEventListener('click', () => {
    // Use Electron's shell to open URL in default browser
    (window as any).electronAPI?.openExternal?.(url) || 
    window.open(url, '_blank');
    
    writeToTerminal(`🌐 Opened ${url} in browser`);
  });
  
  output.appendChild(linkElement);
}

function clearTerminal() {
  const output = document.getElementById('terminal-output');
  if (output) {
    output.textContent = '';
  }
}

function writeToTerminal(text: string) {
  const output = document.getElementById('terminal-output');
  const activeTerminal = terminals.get(activeTerminalId);
  
  if (activeTerminal) {
    activeTerminal.output += `${text}\n`;
  }
  
  if (output) {
    output.textContent += `${text}\n`;
    output.scrollTop = output.scrollHeight;
  }
}

async function executeCommand(command: string) {
  const args = command.split(' ');
  const cmd = args[0].toLowerCase();
  
  // Try real command first
  if ((window as any).electronAPI?.executeCommand) {
    if (cmd === 'pwd') {
      writeToTerminal(currentWorkingDirectory);
        writeToTerminal('');
        return;
      }
    
    await executeRealCommand(command);
      return;
  }
  
  // Built-in commands
  switch (cmd) {
    case 'help':
      writeToTerminal('Available commands:');
      writeToTerminal('');
      writeToTerminal('📁 File Operations:');
      writeToTerminal('  pwd          - Show current directory');
      writeToTerminal('  cd <dir>     - Change directory');
      writeToTerminal('  ls           - List files');
      writeToTerminal('  mkdir <dir>  - Create directory');
      writeToTerminal('  touch <file> - Create file');
      writeToTerminal('  rm <file>    - Remove file');
      writeToTerminal('  cp <src> <dest> - Copy file');
      writeToTerminal('  mv <src> <dest> - Move/rename file');
      writeToTerminal('');
      writeToTerminal('📦 Package Management:');
      writeToTerminal('  npm install [package]     - Install dependencies');
      writeToTerminal('  npm install --legacy-peer-deps - Fix dependency conflicts');
      writeToTerminal('  npm init                  - Initialize package.json');
      writeToTerminal('  npm start                 - Start development server');
      writeToTerminal('  npm run <script>          - Run npm script');
      writeToTerminal('  yarn install              - Install with Yarn');
      writeToTerminal('  pnpm install              - Install with pnpm');
      writeToTerminal('');
      writeToTerminal('🔧 Git Commands:');
      writeToTerminal('  git init       - Initialize repository');
      writeToTerminal('  git status     - Check status');
      writeToTerminal('  git add .      - Stage all files');
      writeToTerminal('  git commit -m "message" - Commit changes');
      writeToTerminal('  git push       - Push to remote');
      writeToTerminal('  git pull       - Pull from remote');
      writeToTerminal('');
      writeToTerminal('🖥️ Terminal:');
      writeToTerminal('  clear        - Clear terminal');
      writeToTerminal('  resize <h>   - Set terminal height');
      writeToTerminal('');
      break;
      
    case 'clear':
      clearTerminal();
      return;
      
    case 'date':
      writeToTerminal(new Date().toString());
      break;
      
    case 'echo':
      writeToTerminal(args.slice(1).join(' '));
      break;
      
    case 'pwd':
      writeToTerminal(currentWorkingDirectory);
      break;
      
    case 'resize':
      if (args[1]) {
        const height = parseInt(args[1]);
        if (height >= 100 && height <= 600) {
          setTerminalHeight(height);
          writeToTerminal(`Terminal height set to ${height}px`);
        } else {
          writeToTerminal('Height must be between 100 and 600 pixels');
        }
      } else {
        writeToTerminal(`Current terminal height: ${terminalHeight}px`);
        writeToTerminal('Usage: resize <height> (100-600px)');
      }
      break;
      
    default:
      writeToTerminal(`Command not found: ${cmd}`);
      writeToTerminal('Type "help" for available commands');
  }
  
  writeToTerminal('');
}

async function initializeMonaco() {
  const container = document.getElementById('editor-container');
  if (!container) return;

  console.log('Starting Monaco initialization...');

  return new Promise<void>((resolve) => {
    (window as any).require.config({ 
      paths: { 
        vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs' 
      } 
      });
      
      (window as any).require(['vs/editor/editor.main'], () => {
        console.log('Monaco modules loaded');
        
      monacoEditor = (window as any).monaco.editor.create(container, {
        value: getWelcomeContent(),
        language: 'markdown',
              theme: 'vs-dark',
              automaticLayout: true,
        fontSize: 14,
        lineNumbers: 'on',
        minimap: { enabled: true },
              scrollBeyondLastLine: false,
              wordWrap: 'on'
            });
            
      // Setup auto-save after Monaco is ready
      setupAutoSave();
      
      console.log('Monaco Editor created successfully!');
      resolve();
    });
  });
}

// Enhanced file tree state management with proper typing
let fileTreeState: Map<string, FileItem> = new Map();

async function loadFileSystem(): Promise<FileItem[]> {
  try {
    console.log('Loading file system from:', currentWorkingDirectory);
    
    // Always try to get real files from current working directory
    if ((window as any).electronAPI?.getDirectoryContents) {
      const files = await (window as any).electronAPI.getDirectoryContents(currentWorkingDirectory);
      if (Array.isArray(files)) {
        // Sort: directories first, then files, both alphabetically
        const sortedFiles = files.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        
        // Preserve expansion state for directories
        sortedFiles.forEach(item => {
          const existingItem = fileTreeState.get(item.path);
          if (existingItem && item.type === 'directory') {
            item.isExpanded = existingItem.isExpanded;
            item.children = existingItem.children;
          }
        });
        
        // Update state
        sortedFiles.forEach(item => {
          fileTreeState.set(item.path, item);
        });
        
        console.log(`✅ Loaded ${sortedFiles.length} items from file system`);
        return sortedFiles;
      }
    }
    
    // If we get here, the API failed
    console.error('❌ File system API not available or failed');
    writeToTerminal('❌ Could not load file system - API not available');
    return [];
    
  } catch (error) {
    console.error('❌ Failed to load file system:', error);
    writeToTerminal(`❌ Failed to load file system: ${error}`);
    return [];
  }
}

function createFileElement(item: FileItem, depth: number): HTMLElement {
  const element = document.createElement('div');
  element.className = 'file-item';
  element.style.paddingLeft = `${8 + depth * 16}px`;
  
  // Add data attributes for easier styling and interaction
  element.setAttribute('data-type', item.type);
  element.setAttribute('data-path', item.path);
  element.setAttribute('data-depth', depth.toString());
  
  // Expansion arrow for directories (like VS Code)
  if (item.type === 'directory') {
    const arrow = document.createElement('span');
    arrow.className = 'expansion-arrow';
    arrow.textContent = item.isExpanded ? '▼' : '▶';
    arrow.style.marginRight = '4px';
    arrow.style.fontSize = '10px';
    arrow.style.color = '#cccccc';
    arrow.style.cursor = 'pointer';
    element.appendChild(arrow);
  } else {
    // Add spacing for files to align with directories that have arrows
    const spacer = document.createElement('span');
    spacer.style.width = '14px';
    spacer.style.display = 'inline-block';
    element.appendChild(spacer);
  }
  
  const icon = document.createElement('span');
  icon.className = 'file-icon';
  
  // Better icons based on file type and expansion state
  if (item.type === 'directory') {
    if (item.isExpanded) {
      icon.textContent = '📂'; // Open folder
    } else {
      icon.textContent = '📁'; // Closed folder
    }
  } else {
    // File icons based on extension
    const extension = item.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js':
        icon.textContent = '🟨';
        break;
      case 'ts':
        icon.textContent = '🔷';
        break;
      case 'tsx':
        icon.textContent = '⚛️';
        break;
      case 'json':
        icon.textContent = '📋';
        break;
      case 'css':
        icon.textContent = '🎨';
        break;
      case 'html':
        icon.textContent = '🌐';
        break;
      case 'md':
        icon.textContent = '📝';
        break;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        icon.textContent = '🖼️';
        break;
      case 'pdf':
        icon.textContent = '📕';
        break;
      case 'txt':
        icon.textContent = '📄';
        break;
      default:
        icon.textContent = '📄';
    }
  }
  
  const name = document.createElement('span');
  name.className = 'file-name';
  name.textContent = item.name;
  
  element.appendChild(icon);
  element.appendChild(name);
  
  // Click handlers
  if (item.type === 'file') {
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      selectFileItem(element);
      openFile(item.path);
    });
  } else {
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      selectFileItem(element);
      toggleDirectory(item);
    });
  }
  
  return element;
}

function selectFileItem(element: HTMLElement) {
  // Remove previous selection
  document.querySelectorAll('.file-item.selected').forEach(item => {
    item.classList.remove('selected');
  });
  
  // Add selection to current item
  element.classList.add('selected');
}

async function openFile(filePath: string) {
  try {
    console.log('Opening file:', filePath);
    
    // Check if file is already open
    if (openTabs.has(filePath)) {
      switchToTab(filePath);
      return;
    }
    
    let content = '';
    
    // Try to read real file
    if ((window as any).electronAPI?.readFile) {
      content = await (window as any).electronAPI.readFile(filePath);
      
      if (content === null) {
        writeToTerminal(`❌ Could not read file: ${filePath}`);
        return;
      }
    } else {
      // Mock content for demo based on file type
      const mockFileName = filePath.split('/').pop() || 'file';
      content = `// Mock content for ${mockFileName}
// This is a demo file
// Real file access is not available`;
    }
    
    // Get file name and language
    const fileName = filePath.split('/').pop() || 'untitled';
    const extension = filePath.split('.').pop();
    const language = getLanguageFromExtension(extension || '');
    
    // Create new tab
    const newTab: OpenTab = {
      path: filePath,
      name: fileName,
      content: content,
      language: language,
      isDirty: false
    };
    
    // Add to open tabs
    openTabs.set(filePath, newTab);
    
    // Switch to the new tab
    switchToTab(filePath);
    
    // Render tabs
    renderTabs();
    
    console.log(`✅ Opened file: ${filePath}`);
    
    // Log to terminal if visible
    if (terminalVisible) {
      writeToTerminal(`📄 Opened: ${fileName}`);
    }
    
  } catch (error) {
    console.error('Failed to open file:', error);
    writeToTerminal(`❌ Error opening ${filePath}: ${error}`);
  }
}

function switchToTab(filePath: string) {
  const tab = openTabs.get(filePath);
  if (!tab) return;
  
  activeTabPath = filePath;
  
  // Update Monaco editor content and language
  if (monacoEditor) {
    monacoEditor.setValue(tab.content);
    (window as any).monaco.editor.setModelLanguage(monacoEditor.getModel(), tab.language);
  }
  
  // Update active tab styling
  updateActiveTabStyling();
  
  console.log(`Switched to tab: ${tab.name}`);
}

function closeTab(filePath: string, event?: Event) {
  if (event) {
    event.stopPropagation();
  }
  
  const tab = openTabs.get(filePath);
  if (!tab) return;
  
  // Remove tab
  openTabs.delete(filePath);
  
  // If this was the active tab, switch to another tab
  if (activeTabPath === filePath) {
    const remainingTabs = Array.from(openTabs.keys());
    if (remainingTabs.length > 0) {
      switchToTab(remainingTabs[remainingTabs.length - 1]);
    } else {
      // No tabs left, show welcome message
      activeTabPath = '';
      if (monacoEditor) {
        monacoEditor.setValue(getWelcomeContent());
        (window as any).monaco.editor.setModelLanguage(monacoEditor.getModel(), 'markdown');
      }
    }
  }
  
  // Re-render tabs
  renderTabs();
  
  console.log(`Closed tab: ${tab.name}`);
  
      if (terminalVisible) {
    writeToTerminal(`❌ Closed: ${tab.name}`);
  }
}

function renderTabs() {
  const tabBar = document.getElementById('tab-bar');
  if (!tabBar) return;
  
  tabBar.innerHTML = '';
  
  // Create tabs for each open file
  openTabs.forEach((tab, filePath) => {
    const tabElement = document.createElement('div');
    tabElement.className = `tab ${filePath === activeTabPath ? 'active' : ''}`;
    tabElement.setAttribute('data-path', filePath);
    
    // Tab content
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    
    // File icon
    const icon = document.createElement('span');
    icon.className = 'tab-icon';
    const extension = tab.name.split('.').pop()?.toLowerCase();
    icon.textContent = getFileIcon(extension || '');
    
    // File name with dirty indicator
    const name = document.createElement('span');
    name.className = 'tab-name';
    name.textContent = tab.isDirty ? `● ${tab.name}` : tab.name;
    if (tab.isDirty) {
      name.style.fontStyle = 'italic';
    }
    
    // Close button
    const closeBtn = document.createElement('span');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '×';
    closeBtn.title = 'Close';
    
    tabContent.appendChild(icon);
    tabContent.appendChild(name);
    tabContent.appendChild(closeBtn);
    tabElement.appendChild(tabContent);
    
    // Event listeners
    tabContent.addEventListener('click', (e) => {
      if (e.target !== closeBtn) {
        switchToTab(filePath);
      }
    });
    
    closeBtn.addEventListener('click', (e) => {
      closeTab(filePath, e);
    });
    
    tabBar.appendChild(tabElement);
  });
  
  // Show/hide tab bar based on open tabs
  if (openTabs.size > 0) {
    tabBar.style.display = 'flex';
  } else {
    tabBar.style.display = 'none';
  }
}

function updateActiveTabStyling() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  const activeTab = document.querySelector(`[data-path="${activeTabPath}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  }
}

function getFileIcon(extension: string): string {
  switch (extension) {
    case 'js': return '🟨';
    case 'ts': return '🔷';
    case 'tsx': return '⚛️';
    case 'jsx': return '⚛️';
    case 'json': return '📋';
    case 'css': return '🎨';
    case 'html': return '🌐';
    case 'md': return '📝';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif': return '🖼️';
    case 'pdf': return '📕';
    case 'txt': return '📄';
    default: return '📄';
  }
}

function getWelcomeContent(): string {
  return `# Welcome to VS Code-like IDE!

## Features

- 📁 **File Explorer** - Click folders to expand, files to open
- 📑 **Multiple Tabs** - Open multiple files at once
- 🖥️  **Resizable Terminal** - Drag to resize (100-600px)
- 📝 **Monaco Editor** - Full VS Code editor experience

## Getting Started

1. **Open Files**: Click any file in the explorer to open it in a new tab
2. **Switch Tabs**: Click tab headers to switch between open files
3. **Close Tabs**: Click the × button on any tab to close it
4. **Terminal**: Use the terminal for file operations and commands

## Keyboard Shortcuts (coming soon!)

- \`Ctrl+W\` - Close current tab
- \`Ctrl+T\` - Open new tab
- \`Ctrl+Tab\` - Switch between tabs

Start by opening some files from the explorer! 🎉`;
}

async function toggleDirectory(item: FileItem) {
  console.log('Toggling directory:', item.path, 'currently expanded:', item.isExpanded);
  
  item.isExpanded = !item.isExpanded;
  
  if (item.isExpanded && !item.children) {
    console.log('Loading directory contents for:', item.path);
    
    try {
      if ((window as any).electronAPI?.getDirectoryContents) {
        const children = await (window as any).electronAPI.getDirectoryContents(item.path);
        if (Array.isArray(children)) {
          // Sort: directories first, then files, both alphabetically
          item.children = children.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });
          console.log(`✅ Loaded ${item.children.length} items for ${item.path}`);
        } else {
          item.children = [];
          console.log('No items found in directory');
        }
  } else {
        console.log('File system API not available');
        item.children = [];
      }
    } catch (error) {
      console.error('Failed to load directory contents:', error);
      item.children = [];
      if (terminalVisible) {
        writeToTerminal(`❌ Failed to load directory: ${item.path}`);
      }
    }
  }
  
  // Re-render the entire file tree to show/hide the expanded content
  await renderFileTree();
  
  // Log to terminal for feedback
  if (terminalVisible) {
    if (item.isExpanded) {
      writeToTerminal(`📂 Expanded folder: ${item.name} (${item.children?.length || 0} items)`);
    } else {
      writeToTerminal(`📁 Collapsed folder: ${item.name}`);
    }
  }
}

// Enhanced directory refresh function
async function refreshCurrentDirectory() {
  console.log('🔄 Refreshing current directory:', currentWorkingDirectory);
  
  // Clear the file tree state for current directory to force reload
  fileTreeState.clear();
  
  // Re-render the file tree
  await renderFileTree();
  
  if (terminalVisible) {
    writeToTerminal(`🔄 Refreshed directory: ${currentWorkingDirectory}`);
  }
}

async function renderFileTree() {
  const fileTree = document.querySelector('.file-tree');
  if (!fileTree) return;
  
  console.log('Rendering file tree...');
  fileTree.innerHTML = '';
  
  const files = await loadFileSystem();
  
  function renderItems(items: FileItem[], depth: number = 0) {
    if (!Array.isArray(items)) {
      console.error('renderItems expects an array, got:', typeof items, items);
      return;
    }
    
    items.forEach(item => {
      const element = createFileElement(item, depth);
      if (fileTree) {
        fileTree.appendChild(element);
      }
      
      // Recursively render children if directory is expanded
      if (item.type === 'directory' && item.isExpanded && item.children && item.children.length > 0) {
        renderItems(item.children, depth + 1);
      }
    });
  }
  
  renderItems(files);
  console.log('✅ File tree rendered successfully');
}

function getLanguageFromExtension(extension: string): string {
  const languageMap: { [key: string]: string } = {
    'js': 'javascript',
    'ts': 'typescript',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'py': 'python',
    'txt': 'plaintext'
  };
  return languageMap[extension.toLowerCase()] || 'plaintext';
}

async function handleCdCommand(args: string[]) {
  const activeTerminal = terminals.get(activeTerminalId);
  if (!activeTerminal) return;
  
  try {
    let targetDir = '';
    
    if (args.length === 1) {
      const homeResult = await (window as any).electronAPI.executeCommand('echo $HOME');
      if (homeResult.success && homeResult.output) {
        targetDir = homeResult.output.trim();
      } else {
        targetDir = '/';
      }
    } else {
      targetDir = args.slice(1).join(' ');
      
      if (!targetDir.startsWith('/') && !targetDir.match(/^[A-Za-z]:/)) {
        if (targetDir === '..') {
          const parts = activeTerminal.workingDirectory.split('/');
          parts.pop();
          targetDir = parts.join('/') || '/';
        } else if (targetDir === '.') {
          targetDir = activeTerminal.workingDirectory;
        } else {
          targetDir = `${activeTerminal.workingDirectory}/${targetDir}`;
        }
      }
    }
    
    targetDir = targetDir.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    
    const testResult = await (window as any).electronAPI.executeCommand('ls', targetDir);
    
    if (testResult.success) {
      activeTerminal.workingDirectory = targetDir;
      currentWorkingDirectory = targetDir; // Update global for file explorer
      writeToTerminal(`📁 Changed to: ${targetDir}`);
      
      setTimeout(async () => {
        await refreshCurrentDirectory();
      }, 100);
    } else {
      writeToTerminal(`❌ Directory not found: ${targetDir}`);
    }
    
  } catch (error) {
    writeToTerminal(`❌ cd error: ${error}`);
  }
  
  writeToTerminal('');
}

async function stopAllProcesses() {
  if (runningProcesses.size === 0) {
    writeToTerminal('❌ No running processes to stop');
    return;
  }
  
  writeToTerminal('🛑 Stopping all processes... (Ctrl+C)');
  
  try {
    const result = await (window as any).electronAPI.killProcess();
    
    if (result.success) {
      writeToTerminal(`✅ ${result.message}`);
      runningProcesses.clear();
      updateProcessIndicators();
    } else {
      writeToTerminal(`❌ Failed to stop processes: ${result.error}`);
    }
  } catch (error) {
    writeToTerminal(`❌ Error stopping processes: ${error}`);
  }
  
  writeToTerminal('');
}

function updateProcessIndicators() {
  const stopBtn = document.getElementById('stop-processes');
  const processIndicator = document.getElementById('process-indicator');
  
  if (runningProcesses.size > 0) {
    if (stopBtn) {
      stopBtn.style.display = 'inline-block';
    }
    if (processIndicator) {
      processIndicator.style.display = 'inline-block';
      processIndicator.textContent = `🟢 ${runningProcesses.size} Process${runningProcesses.size > 1 ? 'es' : ''} Running`;
    }
  } else {
    if (stopBtn) {
      stopBtn.style.display = 'none';
    }
    if (processIndicator) {
      processIndicator.style.display = 'none';
    }
  }
}

function setupCommandStreaming() {
  // Listen for streaming command output
  (window as any).electronAPI.onCommandOutputStream((data: string) => {
    console.log('Streaming output received:', data);
    
    writeToTerminal(data.replace(/\n$/, '')); // Remove trailing newline to prevent double spacing
    
    // Check for development server URLs
    const urlRegex = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)/g;
    const urls = data.match(urlRegex);
    
    if (urls) {
      urls.forEach((url: string) => {
        writeToTerminal(`🌐 Server running at: ${url}`);
        writeToTerminal(`💻 Click to open: ${url}`);
        
        setTimeout(() => {
          addClickableLink(url);
        }, 100);
      });
    }
  });
  
  // Listen for process lifecycle events
  (window as any).electronAPI.onProcessStarted((process: {id: string, command: string}) => {
    console.log('Process started:', process);
    
    const activeTerminal = terminals.get(activeTerminalId);
    if (activeTerminal) {
      activeTerminal.runningProcesses.add(process.id);
      
      // Extract process name from command
      const args = process.command.split(' ');
      let processName = args[0];
      
      if (processName === 'npm' && args[1] === 'run' && args[2]) {
        processName = args[2]; // npm run dev -> "dev"
      } else if (processName === 'yarn' && args[1]) {
        processName = args[1]; // yarn dev -> "dev"
      } else if (processName === 'node' && args[1]) {
        processName = `node:${args[1].split('/').pop()?.replace('.js', '')}`;
      }
      
      updateTerminalName(activeTerminalId, processName);
    }
    
    runningProcesses.set(process.id, process);
    updateProcessIndicators();
    renderTerminalTabs(); // Update tab indicators
    writeToTerminal(`🚀 Started: ${process.command}`);
    writeToTerminal('💡 Press Ctrl+C to stop the server');
  });
  
  (window as any).electronAPI.onProcessEnded((process: {id: string}) => {
    console.log('Process ended:', process.id);
    
    // Remove from all terminals and reset names
    terminals.forEach(terminal => {
      if (terminal.runningProcesses.has(process.id)) {
        terminal.runningProcesses.delete(process.id);
        
        // Reset name if no more processes running
        if (terminal.runningProcesses.size === 0) {
          updateTerminalName(terminal.id);
        }
      }
    });
    
    runningProcesses.delete(process.id);
    updateProcessIndicators();
    renderTerminalTabs(); // Update tab indicators
    writeToTerminal('🛑 Process stopped');
  });
}

function createNewTerminal() {
  const terminalId = `terminal-${terminalCounter++}`;
  
  // Detect shell type
  const shellType = detectShell();
  
  const newTerminal: Terminal = {
    id: terminalId,
    name: shellType, // Start with shell name
    workingDirectory: currentWorkingDirectory,
    output: '',
    history: [],
    isActive: false,
    runningProcesses: new Set(),
    currentProcess: '',
    shell: shellType
  };
  
  terminals.set(terminalId, newTerminal);
  
  // Initialize the terminal with welcome message
  const welcomeMessage = `✅ Terminal ready! Type commands below.\n📁 Current directory: ${newTerminal.workingDirectory}\n\n`;
  newTerminal.output = welcomeMessage;
  
  // Switch to the new terminal
  switchToTerminal(terminalId);
  
  // Render terminal tabs
  renderTerminalTabs();
  
  if (terminalVisible) {
    writeToTerminal(`🆕 Created new terminal (${shellType})`);
  }
  
  console.log(`Created new terminal: ${terminalId}`);
}

function detectShell(): string {
  // Try to detect the user's shell
  if (typeof navigator !== 'undefined') {
    if (navigator.platform.includes('Mac')) {
      return 'zsh'; // macOS default
    } else if (navigator.platform.includes('Win')) {
      return 'cmd';
    } else {
      return 'bash'; // Linux default
    }
  }
  return 'zsh'; // fallback
}

function updateTerminalName(terminalId: string, processName?: string) {
  const terminal = terminals.get(terminalId);
  if (!terminal) return;
  
  if (processName) {
    terminal.currentProcess = processName;
    terminal.name = processName;
  } else {
    terminal.currentProcess = '';
    terminal.name = terminal.shell;
  }
  
  renderTerminalTabs();
}

function switchToTerminal(terminalId: string) {
  const terminal = terminals.get(terminalId);
  if (!terminal) return;
  
  // Update active states
  terminals.forEach(t => t.isActive = false);
  terminal.isActive = true;
  activeTerminalId = terminalId;
  
  // Update current working directory
  currentWorkingDirectory = terminal.workingDirectory;
  
  // Update terminal output display
  const outputElement = document.getElementById('terminal-output');
  if (outputElement) {
    outputElement.textContent = terminal.output;
    outputElement.scrollTop = outputElement.scrollHeight;
  }
  
  // Update terminal history
  terminalHistory = [...terminal.history];
  historyIndex = -1;
  
  // Update tab styling
  updateActiveTerminalTab();
  
  // Update process indicators
  updateProcessIndicators();
  
  console.log(`Switched to terminal: ${terminalId}`);
}

function closeTerminal(terminalId: string, event?: Event) {
  if (event) {
    event.stopPropagation();
  }
  
  const terminal = terminals.get(terminalId);
  if (!terminal) return;
  
  // Don't close if there are running processes (ask for confirmation)
  if (terminal.runningProcesses.size > 0) {
    const confirmClose = confirm(`Terminal "${terminal.name}" has running processes. Close anyway?`);
    if (!confirmClose) return;
    
    // Kill processes in this terminal
    terminal.runningProcesses.forEach(processId => {
      (window as any).electronAPI.killProcess(processId);
    });
  }
  
  // Remove terminal
  terminals.delete(terminalId);
  
  // If this was the active terminal, switch to another one
  if (activeTerminalId === terminalId) {
    const remainingTerminals = Array.from(terminals.keys());
    if (remainingTerminals.length > 0) {
      switchToTerminal(remainingTerminals[0]);
    } else {
      // No terminals left, create a new one
      createNewTerminal();
    }
  }
  
  // Re-render terminal tabs
  renderTerminalTabs();
  
  console.log(`Closed terminal: ${terminalId}`);
}

function renderTerminalTabs() {
  const tabsContainer = document.getElementById('terminal-tabs');
  if (!tabsContainer) return;
  
  tabsContainer.innerHTML = '';
  
  terminals.forEach((terminal, terminalId) => {
    const tabElement = document.createElement('div');
    tabElement.className = `terminal-tab ${terminal.isActive ? 'active' : ''}`;
    tabElement.setAttribute('data-terminal-id', terminalId);
    
    // Terminal icon and name
    const tabContent = document.createElement('div');
    tabContent.className = 'terminal-tab-content';
    
    const icon = document.createElement('span');
    icon.className = 'terminal-tab-icon';
    
    // Set icon based on current process
    if (terminal.currentProcess) {
      if (terminal.currentProcess.includes('dev') || terminal.currentProcess.includes('start')) {
        icon.textContent = '🚀'; // Dev server
      } else if (terminal.currentProcess.includes('build')) {
        icon.textContent = '🔨'; // Build process
      } else if (terminal.currentProcess.includes('test')) {
        icon.textContent = '🧪'; // Tests
      } else if (terminal.currentProcess.includes('node')) {
        icon.textContent = '📗'; // Node.js
      } else if (terminal.currentProcess.includes('npm') || terminal.currentProcess.includes('yarn')) {
        icon.textContent = '📦'; // Package manager
      } else {
        icon.textContent = '⚡'; // Generic process
      }
    } else {
      icon.textContent = '🖥️'; // Shell
    }
    
    const name = document.createElement('span');
    name.className = 'terminal-tab-name';
    name.textContent = terminal.name;
    
    // Process indicator
    if (terminal.runningProcesses.size > 0) {
      const processIndicator = document.createElement('span');
      processIndicator.className = 'terminal-process-indicator';
      processIndicator.textContent = '🟢';
      processIndicator.title = `${terminal.runningProcesses.size} running process(es)`;
      tabContent.appendChild(processIndicator);
    }
    
    tabContent.appendChild(icon);
    tabContent.appendChild(name);
    
    // Close button (don't show if it's the only terminal)
    if (terminals.size > 1) {
      const closeBtn = document.createElement('span');
      closeBtn.className = 'terminal-tab-close';
      closeBtn.textContent = '×';
      closeBtn.title = 'Close Terminal';
      tabContent.appendChild(closeBtn);
      
      closeBtn.addEventListener('click', (e) => {
        closeTerminal(terminalId, e);
      });
    }
    
    tabElement.appendChild(tabContent);
    
    // Click to switch terminals
    tabContent.addEventListener('click', (e) => {
      // Only switch if not clicking close button and it exists
      const closeBtn = tabContent.querySelector('.terminal-tab-close');
      if (e.target !== closeBtn) {
        switchToTerminal(terminalId);
      }
    });
    tabsContainer.appendChild(tabElement);
  });
}

function updateActiveTerminalTab() {
  document.querySelectorAll('.terminal-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  const activeTab = document.querySelector(`[data-terminal-id="${activeTerminalId}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  }
}

function clearActiveTerminal() {
  const activeTerminal = terminals.get(activeTerminalId);
  if (activeTerminal) {
    activeTerminal.output = '';
  }
  
  const output = document.getElementById('terminal-output');
  if (output) {
    output.textContent = '';
  }
}
