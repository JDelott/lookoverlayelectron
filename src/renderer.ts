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
  }
  
  .file-item:hover {
    background-color: #2a2d2e;
  }
  
  .file-item.selected {
    background-color: #094771;
  }
  
  .file-icon {
    width: 16px;
    height: 16px;
    margin-right: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
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
  
  writeToTerminal('🎉 Terminal initialized successfully!');
  writeToTerminal('Welcome to the integrated terminal');
  writeToTerminal('💡 Tip: Drag the top border to resize the terminal height');
  writeToTerminal('Available commands: help, clear, date, echo, ls, pwd, cat');
  writeToTerminal('Type "help" for more information');
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

function handleTerminalInput(event: KeyboardEvent) {
  const input = event.target as HTMLInputElement;
  
  if (event.key === 'Enter') {
    const command = input.value.trim();
    if (command) {
      // Add to history
      terminalHistory.unshift(command);
      if (terminalHistory.length > 100) {
        terminalHistory.pop();
      }
      historyIndex = -1;
      
      // Echo the command
      writeToTerminal(`$ ${command}`);
      
      // Execute command
      executeCommand(command);
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
  }
}

async function executeCommand(command: string) {
  const args = command.split(' ');
  const cmd = args[0].toLowerCase();
  
  switch (cmd) {
    case 'help':
      writeToTerminal('Available commands:');
      writeToTerminal('  help         - Show this help message');
      writeToTerminal('  clear        - Clear the terminal');
      writeToTerminal('  date         - Show current date and time');
      writeToTerminal('  echo <text>  - Echo text back');
      writeToTerminal('  ls           - List files (mock)');
      writeToTerminal('  pwd          - Show current directory');
      writeToTerminal('  cat <file>   - Show file contents (mock)');
      writeToTerminal('  history      - Show command history');
      writeToTerminal('  resize <h>   - Set terminal height (100-600px)');
      break;
      
    case 'clear':
      clearTerminal();
      return; // Don't add extra newline
      
    case 'date':
      writeToTerminal(new Date().toString());
      break;
      
    case 'echo':
      writeToTerminal(args.slice(1).join(' '));
      break;
      
    case 'ls':
      writeToTerminal('📁 src/');
      writeToTerminal('📄 package.json');
      writeToTerminal('📄 README.md');
      writeToTerminal('📄 index.html');
      writeToTerminal('📄 tsconfig.json');
      break;
      
    case 'pwd':
      writeToTerminal('/workspace/lookoverlayelectron-main');
      break;
      
    case 'cat':
      if (args[1]) {
        writeToTerminal(`Contents of ${args[1]}:`);
        writeToTerminal(`// This is mock content for ${args[1]}`);
        writeToTerminal('// In a real implementation, this would show actual file contents');
      } else {
        writeToTerminal('Usage: cat <filename>');
      }
      break;
      
    case 'history':
      writeToTerminal('Command history:');
      terminalHistory.slice(0, 10).forEach((cmd, i) => {
        writeToTerminal(`  ${i + 1}: ${cmd}`);
      });
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
      // Try to execute with real terminal if available
      if (await tryExecuteRealCommand(command)) {
        return;
      }
      
      writeToTerminal(`Command not found: ${cmd}`);
      writeToTerminal('Type "help" for available commands');
  }
  
  writeToTerminal('');
}

async function tryExecuteRealCommand(command: string): Promise<boolean> {
  try {
    if ((window as any).electronAPI?.executeCommand) {
      const result = await (window as any).electronAPI.executeCommand(command);
      if (result && result.output) {
        writeToTerminal(result.output);
        return true;
      }
    }
  } catch (error) {
    console.log('Real command execution not available');
  }
  return false;
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
    // Try to get real files
    if ((window as any).electronAPI?.getDirectoryContents) {
      const files = await (window as any).electronAPI.getDirectoryContents();
      if (Array.isArray(files)) {
        return files;
      }
    }
  } catch (error) {
    console.error('Failed to load file system:', error);
  }
  
  // Return mock data if API fails
  return [
    { name: 'src', path: './src', type: 'directory', children: [
      { name: 'main.ts', path: './src/main.ts', type: 'file' },
      { name: 'renderer.ts', path: './src/renderer.ts', type: 'file' },
      { name: 'preload.ts', path: './src/preload.ts', type: 'file' },
      { name: 'styles.css', path: './src/styles.css', type: 'file' }
    ]},
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
  
  const icon = document.createElement('span');
  icon.className = 'file-icon';
  icon.textContent = item.type === 'directory' ? '📁' : '📄';
  
  const name = document.createElement('span');
  name.textContent = item.name;
  
  element.appendChild(icon);
  element.appendChild(name);
  
  if (item.type === 'file') {
    element.addEventListener('click', () => openFile(item.path));
  } else {
    element.addEventListener('click', () => toggleDirectory(item));
  }
  
  return element;
}

async function openFile(filePath: string) {
  try {
    let content = '';
    
    // Try to read real file
    if ((window as any).electronAPI?.readFile) {
      content = await (window as any).electronAPI.readFile(filePath);
    } else {
      // Mock content for demo based on file type
      const fileName = filePath.split('/').pop() || 'file';
      if (fileName.endsWith('.json')) {
        content = `{
  "name": "lookoverlayelectron",
  "version": "1.0.0",
  "description": "VS Code-like IDE with resizable terminal",
  "main": "dist/main.js",
  "scripts": {
    "build": "npm run build:main && npm run build:renderer",
    "start": "npm run build && electron ./dist/main.js",
    "dev": "npm run watch"
  },
  "devDependencies": {
    "electron": "^latest",
    "typescript": "^latest"
  }
}`;
      } else if (fileName.endsWith('.md')) {
        content = `# ${fileName}

This is a **VS Code-like IDE** built with Electron!

## Features

- 📁 **File Explorer** - Browse and open files
- 🖥️  **Resizable Terminal** - Drag to resize height (100-600px)
- 📝 **Monaco Editor** - Full VS Code editor experience  
- 🎨 **Dark Theme** - Professional look and feel

## Terminal Commands

- \`help\` - Show all available commands
- \`resize <height>\` - Set terminal height
- \`clear\` - Clear terminal output
- \`ls\` - List directory contents
- \`date\` - Show current date/time

## Usage

1. Click files in the explorer to open them
2. Use the terminal with drag-to-resize functionality
3. Edit code with full syntax highlighting

Enjoy coding! 🎉`;
      } else if (fileName.endsWith('.html')) {
        content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
</head>
<body>
  <h1>VS Code-like IDE</h1>
  <p>Resizable terminal content for ${fileName}</p>
  <script>
    console.log('Hello from ${fileName}');
  </script>
</body>
</html>`;
      } else {
        content = `// File: ${filePath}
// This is mock content with resizable terminal support

console.log('Hello from ${fileName}');

/**
 * Demo function for ${fileName}
 * Try resizing the terminal by dragging its top border!
 */
function demo() {
  console.log('This is a demo function');
  console.log('Terminal can be resized from 100px to 600px');
  return 'VS Code-like experience with resizable terminal!';
}

// You can edit this content in Monaco Editor
const message = "Welcome to your resizable terminal IDE!";
console.log(message);

export default demo;`;
      }
    }
    
    if (monacoEditor && content !== null) {
      monacoEditor.setValue(content);
      currentFile = filePath;
      
      // Set language based on file extension
      const extension = filePath.split('.').pop();
      const language = getLanguageFromExtension(extension || '');
      (window as any).monaco.editor.setModelLanguage(monacoEditor.getModel(), language);
      
      console.log(`Opened file: ${filePath}`);
      
      // Also log to terminal if visible
      if (terminalVisible) {
        writeToTerminal(`📄 Opened file: ${filePath}`);
      }
    }
  } catch (error) {
    console.error('Failed to open file:', error);
  }
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

async function toggleDirectory(item: FileItem) {
  item.isExpanded = !item.isExpanded;
  
  if (item.isExpanded && !item.children) {
    try {
      if ((window as any).electronAPI?.getDirectoryContents) {
        const children = await (window as any).electronAPI.getDirectoryContents(item.path);
        if (Array.isArray(children)) {
          item.children = children;
        } else {
          item.children = [];
        }
      } else {
        // Mock children for demo
        item.children = [
          { name: 'example.js', path: `${item.path}/example.js`, type: 'file' },
          { name: 'styles.css', path: `${item.path}/styles.css`, type: 'file' },
          { name: 'utils.ts', path: `${item.path}/utils.ts`, type: 'file' }
        ];
      }
    } catch (error) {
      console.error('Failed to load directory contents:', error);
      item.children = [];
    }
  }
  
  await renderFileTree();
}

async function renderFileTree() {
  const fileTree = document.querySelector('.file-tree');
  if (!fileTree) return;
  
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
}
