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
  }
  
  .file-item {
    display: flex;
    align-items: center;
    padding: 2px 8px;
    cursor: pointer;
    font-size: 13px;
    line-height: 20px;
    user-select: none;
    border-radius: 3px;
    margin: 1px 4px;
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
  
  console.log('Application initialized successfully');
});

function createLayout() {
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = `
    <div class="sidebar">
      <div class="sidebar-header">Explorer</div>
      <div class="file-tree"></div>
    </div>
    <div class="main-content">
      <div class="toolbar">
        <button id="terminal-toggle">Toggle Terminal</button>
        <button id="clear-terminal">Clear Terminal</button>
      </div>
      <div class="editor-container" id="editor-container"></div>
      <div class="terminal-container" id="terminal-container">
        <div class="terminal-resize-handle" id="terminal-resize-handle"></div>
        <div class="terminal-header">
          <div class="terminal-header-left">
            <span>Terminal</span>
          </div>
          <div class="terminal-header-right">
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
  document.getElementById('clear-terminal')?.addEventListener('click', clearTerminal);
  
  const terminalInput = document.getElementById('terminal-input') as HTMLInputElement;
  terminalInput?.addEventListener('keydown', handleTerminalInput);
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
      
      // Execute command using the working executeCommand API
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
  } else if (event.key === 'Tab') {
    event.preventDefault();
    // Tab completion could be implemented here
  } else if (event.ctrlKey && event.key === 'c') {
    event.preventDefault();
    writeToTerminal('^C');
  }
}

async function executeRealCommand(command: string) {
  try {
    console.log('Executing command:', command, 'in directory:', currentWorkingDirectory);
    
    // Parse command
    const args = command.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();
    
    // Handle special commands that affect directory state
    if (cmd === 'cd') {
      await handleCdCommand(args);
      return;
    }
    
    // Show a loading indicator
    const loadingMsg = '⏳ Executing...';
    writeToTerminal(loadingMsg);
    
    const result = await (window as any).electronAPI.executeCommand(command, currentWorkingDirectory);
    console.log('Command result:', result);
    
    // Remove loading message
    const output = document.getElementById('terminal-output');
    if (output) {
      const text = output.textContent || '';
      const lines = text.split('\n');
      if (lines[lines.length - 2] === loadingMsg) {
        lines.splice(-2, 1);
        output.textContent = lines.join('\n');
      }
    }
    
    // Show command output
    if (result.output && result.output.trim()) {
      writeToTerminal(result.output.trim());
    }
    
    if (!result.success && result.code !== 0) {
      writeToTerminal(`(Exit code: ${result.code})`);
    }
    
    // If this was mkdir, refresh the file tree
    if (cmd === 'mkdir' && result.success) {
      setTimeout(() => {
        renderFileTree();
      }, 100);
    }
    
    writeToTerminal(''); // Empty line for spacing
    
  } catch (error) {
    console.error('Command execution error:', error);
    writeToTerminal(`Error: ${error}`);
    writeToTerminal('');
  }
}

async function handleCdCommand(args: string[]) {
  try {
    let targetDir = '';
    
    if (args.length === 1) {
      // cd with no arguments - go to home directory
      // Get home directory from environment
      const homeResult = await (window as any).electronAPI.executeCommand('echo $HOME');
      if (homeResult.success && homeResult.output) {
        targetDir = homeResult.output.trim();
      } else {
        targetDir = '/'; // Fallback
      }
    } else {
      targetDir = args.slice(1).join(' ');
      
      // Handle relative paths
      if (!targetDir.startsWith('/') && !targetDir.match(/^[A-Za-z]:/)) {
        // Relative path
        if (targetDir === '..') {
          const parts = currentWorkingDirectory.split('/');
          parts.pop(); // Remove last directory
          targetDir = parts.join('/') || '/';
        } else if (targetDir === '.') {
          targetDir = currentWorkingDirectory;
        } else {
          targetDir = `${currentWorkingDirectory}/${targetDir}`;
        }
      }
    }
    
    // Clean up the path (remove double slashes, etc.)
    targetDir = targetDir.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    
    // Test if directory exists by trying to list it
    const testResult = await (window as any).electronAPI.executeCommand('ls', targetDir);
    
    if (testResult.success) {
      currentWorkingDirectory = targetDir;
      writeToTerminal(`📁 Changed to: ${currentWorkingDirectory}`);
      
      // Refresh file tree to show new location
      setTimeout(() => {
        renderFileTree();
      }, 100);
    } else {
      writeToTerminal(`❌ Directory not found: ${targetDir}`);
    }
    
  } catch (error) {
    writeToTerminal(`❌ cd error: ${error}`);
  }
  
  writeToTerminal('');
}

function clearTerminal() {
  const output = document.getElementById('terminal-output');
  if (output) {
    output.textContent = '';
  }
}

function writeToTerminal(text: string) {
  const output = document.getElementById('terminal-output');
  if (!output) return;
  
  const timestamp = new Date().toLocaleTimeString();
  output.textContent += `${text}\n`;
  
  // Auto-scroll to bottom
  output.scrollTop = output.scrollHeight;
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
  
  // Fall back to built-in commands
  switch (cmd) {
    case 'help':
      writeToTerminal('Available commands:');
      writeToTerminal('  help         - Show this help message');
      writeToTerminal('  clear        - Clear the terminal');
      writeToTerminal('  date         - Show current date and time');
      writeToTerminal('  echo <text>  - Echo text back');
      writeToTerminal('  resize <h>   - Set terminal height (100-600px)');
      writeToTerminal('  pwd          - Show current directory');
      writeToTerminal('  cd <dir>     - Change directory');
      writeToTerminal('  mkdir <dir>  - Create directory');
      writeToTerminal('');
      writeToTerminal('Real commands: ls, pwd, cd, git, npm, node, etc.');
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
        value: `// Welcome to your VS Code-like IDE!
// 
// Features:
// 📁 File Explorer - Click files to open them
// 🖥️  Resizable Terminal - Drag the terminal border to resize
// 📝 Monaco Editor - Full VS Code editor experience
//
// Try these terminal commands:
// - help (show all commands)
// - resize 300 (set terminal to 300px height)
// - ls (list files)
// - date (show current time)

console.log("Hello from Monaco Editor!");

function demo() {
  console.log("This is a demo function");
  return "VS Code-like experience in Electron!";
}

demo();`,
              language: 'javascript',
              theme: 'vs-dark',
              automaticLayout: true,
        fontSize: 14,
        lineNumbers: 'on',
        minimap: { enabled: true },
              scrollBeyondLastLine: false,
              wordWrap: 'on'
            });
            
      console.log('Monaco Editor created successfully!');
      resolve();
    });
  });
}

// File system functions with mock data for testing
async function loadFileSystem(): Promise<FileItem[]> {
  try {
    console.log('Loading file system from:', currentWorkingDirectory);
    
    // Try to get real files from current working directory
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
        
        console.log(`Loaded ${sortedFiles.length} items from file system`);
        return sortedFiles;
      }
    }
  } catch (error) {
    console.error('Failed to load file system:', error);
  }
  
  // Return mock data if API fails
  console.log('Using mock file system data');
  return [
    { name: 'src', path: './src', type: 'directory', children: undefined },
    { name: 'dist', path: './dist', type: 'directory', children: undefined },
    { name: 'node_modules', path: './node_modules', type: 'directory', children: undefined },
    { name: 'package.json', path: './package.json', type: 'file' },
    { name: 'README.md', path: './README.md', type: 'file' },
    { name: 'index.html', path: './index.html', type: 'file' },
    { name: 'tsconfig.json', path: './tsconfig.json', type: 'file' }
  ];
}

function createFileElement(item: FileItem, depth: number): HTMLElement {
  const element = document.createElement('div');
  element.className = 'file-item';
  element.style.paddingLeft = `${8 + depth * 16}px`;
  
  // Add data attributes for easier styling and interaction
  element.setAttribute('data-type', item.type);
  element.setAttribute('data-path', item.path);
  
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
      case 'ts':
        icon.textContent = '📄';
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
      const fileName = filePath.split('/').pop() || 'file';
      content = generateMockContent(fileName, filePath);
    }
    
    if (monacoEditor && content !== null) {
      monacoEditor.setValue(content);
      currentFile = filePath;
      
      // Set language based on file extension
      const extension = filePath.split('.').pop();
      const language = getLanguageFromExtension(extension || '');
      (window as any).monaco.editor.setModelLanguage(monacoEditor.getModel(), language);
      
      console.log(`✅ Opened file: ${filePath}`);
      
      // Update window title or add a tab indicator
      updateEditorTitle(filePath);
      
      // Also log to terminal if visible
      if (terminalVisible) {
        writeToTerminal(`📄 Opened: ${filePath}`);
      }
    }
  } catch (error) {
    console.error('Failed to open file:', error);
    writeToTerminal(`❌ Error opening ${filePath}: ${error}`);
  }
}

function updateEditorTitle(filePath: string) {
  // Update the toolbar to show current file
  const toolbar = document.querySelector('.toolbar');
  if (toolbar) {
    let titleElement = toolbar.querySelector('.current-file-title') as HTMLElement;
    if (!titleElement) {
      titleElement = document.createElement('span');
      titleElement.className = 'current-file-title';
      titleElement.style.marginLeft = 'auto';
      titleElement.style.fontSize = '12px';
      titleElement.style.color = '#cccccc';
      toolbar.appendChild(titleElement);
    }
    
    const fileName = filePath.split('/').pop() || filePath;
    titleElement.textContent = `📄 ${fileName}`;
    titleElement.title = filePath; // Full path on hover
  }
}

function generateMockContent(fileName: string, filePath: string): string {
  if (fileName.endsWith('.json')) {
    return `{
  "name": "lookoverlayelectron",
  "version": "1.0.0",
  "description": "VS Code-like IDE with file explorer",
  "main": "dist/main.js",
  "scripts": {
    "build": "npm run build:main && npm run build:renderer",
    "start": "npm run build && electron ./dist/main.js"
  },
  "dependencies": {
    "electron": "^latest",
    "monaco-editor": "^0.44.0"
  }
}`;
  } else if (fileName.endsWith('.md')) {
    return `# ${fileName}

This file was opened from the **VS Code-like file explorer**!

## Path
\`${filePath}\`

## Features

- ✅ **Click folders** to expand/collapse
- ✅ **Click files** to open them
- ✅ **Proper file icons** based on file type
- ✅ **Selection highlighting**
- ✅ **Real file reading** when available

## File Types Supported

- 📄 JavaScript/TypeScript (\`.js\`, \`.ts\`)
- 📋 JSON files (\`.json\`)
- 🎨 CSS files (\`.css\`)
- 🌐 HTML files (\`.html\`)
- 📝 Markdown files (\`.md\`)
- 🖼️ Images (\`.png\`, \`.jpg\`, etc.)

Enjoy browsing your files! 🎉`;
  } else if (fileName.endsWith('.html')) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <style>
    body {
      font-family: 'Segoe UI', sans-serif;
      background: #1e1e1e;
      color: #cccccc;
      padding: 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>File Explorer Demo</h1>
    <p>This file was opened from: <code>${filePath}</code></p>
    <p>Click folders in the explorer to expand them!</p>
  </div>
  
  <script>
    console.log('File opened from VS Code-like explorer!');
    console.log('Path: ${filePath}');
  </script>
</body>
</html>`;
  } else {
    return `// File: ${filePath}
// Opened from VS Code-like file explorer

console.log('Hello from ${fileName}!');

/**
 * This file was opened by clicking it in the file explorer
 * Path: ${filePath}
 */
function demo() {
  console.log('File explorer features:');
  console.log('- Click folders to expand/collapse');
  console.log('- Click files to open them');
  console.log('- Proper file type icons');
  console.log('- Selection highlighting');
  
  return 'VS Code-like file browsing experience!';
}

// Export the demo function
export default demo;

// Try the demo
demo();`;
  }
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
          console.log(`Loaded ${item.children.length} items for ${item.path}`);
        } else {
          item.children = [];
        }
      } else {
        // Mock children for demo
        const mockChildren = [
          { name: 'components', path: `${item.path}/components`, type: 'directory' as const },
          { name: 'utils', path: `${item.path}/utils`, type: 'directory' as const },
          { name: 'example.js', path: `${item.path}/example.js`, type: 'file' as const },
          { name: 'styles.css', path: `${item.path}/styles.css`, type: 'file' as const },
          { name: 'README.md', path: `${item.path}/README.md`, type: 'file' as const }
        ];
        item.children = mockChildren;
      }
    } catch (error) {
      console.error('Failed to load directory contents:', error);
      item.children = [];
      if (terminalVisible) {
        writeToTerminal(`❌ Failed to load directory: ${item.path}`);
      }
    }
  }
  
  await renderFileTree();
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
      
      if (item.type === 'directory' && item.isExpanded && item.children) {
        renderItems(item.children, depth + 1);
      }
    });
  }
  
  renderItems(files);
  console.log('File tree rendered successfully');
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
