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

// Global styles for VS Code-like layout
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
  }
  
  #root {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .title-bar {
    height: 35px;
    background-color: #323233;
    display: flex;
    align-items: center;
    padding: 0 15px;
    border-bottom: 1px solid #2d2d30;
    font-size: 13px;
    color: #cccccc;
  }
  
  .main-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
  
  .sidebar {
    width: 250px;
    background-color: #252526;
    border-right: 1px solid #2d2d30;
    display: flex;
    flex-direction: column;
  }
  
  .explorer-header {
    padding: 8px 12px;
    background-color: #2d2d30;
    border-bottom: 1px solid #3e3e42;
    font-size: 11px;
    font-weight: bold;
    color: #cccccc;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .file-tree {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }
  
  .file-item {
    display: flex;
    align-items: center;
    padding: 2px 8px;
    cursor: pointer;
    font-size: 13px;
    color: #cccccc;
    white-space: nowrap;
    user-select: none;
  }
  
  .file-item:hover {
    background-color: #2a2d2e;
  }
  
  .file-item.selected {
    background-color: #37373d;
  }
  
  .file-icon {
    margin-right: 6px;
    font-size: 14px;
    min-width: 16px;
    text-align: center;
  }
  
  .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .resize-handle {
    width: 4px;
    background-color: #2d2d30;
    cursor: col-resize;
  }
  
  .resize-handle:hover {
    background-color: #007acc;
  }
  
  .editor-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: #1e1e1e;
  }
  
  .tab-bar {
    height: 35px;
    background-color: #2d2d30;
    border-bottom: 1px solid #3e3e42;
    display: flex;
    align-items: center;
    padding: 0 8px;
  }
  
  .tab {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    background-color: #1e1e1e;
    border: 1px solid #3e3e42;
    border-bottom: none;
    margin-right: 2px;
    cursor: pointer;
    font-size: 13px;
    color: #cccccc;
    max-width: 200px;
  }
  
  .tab.active {
    background-color: #1e1e1e;
    border-color: #007acc;
    border-bottom: 2px solid #007acc;
  }
  
  .tab-icon {
    margin-right: 6px;
    font-size: 12px;
  }
  
  .tab-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  #editor-container {
    flex: 1;
    background-color: #1e1e1e;
  }
  
  ::-webkit-scrollbar {
    width: 10px;
  }
  
  ::-webkit-scrollbar-track {
    background: #1e1e1e;
  }
  
  ::-webkit-scrollbar-thumb {
    background: #424242;
    border-radius: 5px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: #4f4f4f;
  }
`;

// Inject global styles
const styleElement = document.createElement('style');
styleElement.textContent = globalStyles;
document.head.appendChild(styleElement);

// File explorer functions
function getFileIcon(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js':
    case 'jsx':
      return '📄';
    case 'ts':
    case 'tsx':
      return '🔷';
    case 'css':
      return '🎨';
    case 'html':
      return '🌐';
    case 'json':
      return '📋';
    case 'md':
      return '📝';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
      return '🖼️';
    default:
      return '📄';
  }
}

function createFileElement(item: FileItem, depth: number = 0): HTMLElement {
  const fileElement = document.createElement('div');
  fileElement.className = `file-item ${item.type}`;
  fileElement.style.paddingLeft = `${depth * 20 + 8}px`;
  
  const icon = document.createElement('span');
  icon.className = 'file-icon';
  icon.textContent = item.type === 'directory' ? 
    (item.isExpanded ? '📂' : '📁') : 
    getFileIcon(item.name);
  
  const name = document.createElement('span');
  name.className = 'file-name';
  name.textContent = item.name;
  
  fileElement.appendChild(icon);
  fileElement.appendChild(name);
  
  fileElement.addEventListener('click', () => {
    if (item.type === 'directory') {
      toggleDirectory(item);
    } else {
      selectFile(item.path);
    }
  });
  
  return fileElement;
}

async function loadFileSystem(path?: string): Promise<FileItem[]> {
  try {
    const result = await (window as any).electronAPI?.getDirectoryContents(path);
    return result?.files || [];
  } catch (error) {
    console.error('Failed to load file system:', error);
    return [];
  }
}

async function toggleDirectory(item: FileItem) {
  item.isExpanded = !item.isExpanded;
  
  if (item.isExpanded && !item.children) {
    item.children = await loadFileSystem(item.path);
  }
  
  renderFileTree();
}

function selectFile(filePath: string) {
  currentFile = filePath;
  updateTabBar();
  loadFileContent(filePath);
  
  // Update selection in tree
  document.querySelectorAll('.file-item').forEach(el => {
    el.classList.remove('selected');
  });
  
  const selectedElement = Array.from(document.querySelectorAll('.file-item')).find(el => 
    el.querySelector('.file-name')?.textContent === filePath.split('/').pop()
  );
  selectedElement?.classList.add('selected');
}

async function loadFileContent(filePath: string) {
  try {
    const content = await (window as any).electronAPI?.readFileContents(filePath);
    if (monacoEditor && content !== undefined) {
      monacoEditor.setValue(content);
      
      // Set language based on file extension
      const extension = filePath.split('.').pop()?.toLowerCase();
      let language = 'plaintext';
      
      switch (extension) {
        case 'js':
        case 'jsx':
          language = 'javascript';
          break;
        case 'ts':
        case 'tsx':
          language = 'typescript';
          break;
        case 'css':
          language = 'css';
          break;
        case 'html':
          language = 'html';
          break;
        case 'json':
          language = 'json';
          break;
        case 'md':
          language = 'markdown';
          break;
      }
      
      (window as any).monaco.editor.setModelLanguage(monacoEditor.getModel(), language);
    }
  } catch (error) {
    console.error('Failed to load file content:', error);
  }
}

function updateTabBar() {
  const tabBar = document.querySelector('.tab-bar');
  if (!tabBar) return;
  
  tabBar.innerHTML = '';
  
  if (currentFile) {
    const tab = document.createElement('div');
    tab.className = 'tab active';
    
    const icon = document.createElement('span');
    icon.className = 'tab-icon';
    icon.textContent = getFileIcon(currentFile);
    
    const name = document.createElement('span');
    name.className = 'tab-name';
    name.textContent = currentFile.split('/').pop() || '';
    
    tab.appendChild(icon);
    tab.appendChild(name);
    tabBar.appendChild(tab);
  }
}

async function renderFileTree() {
  const fileTree = document.querySelector('.file-tree');
  if (!fileTree) return;
  
  fileTree.innerHTML = '';
  
  const files = await loadFileSystem();
  
  function renderItems(items: FileItem[], depth: number = 0) {
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

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing IDE');
  
  const container = document.getElementById('root');
  if (container) {
    // Create VS Code-like layout
    container.innerHTML = `
      <div class="title-bar">
        <span>Lightweight IDE</span>
      </div>
      <div class="main-content">
        <div class="sidebar">
          <div class="explorer-header">EXPLORER</div>
          <div class="file-tree"></div>
        </div>
        <div class="resize-handle"></div>
        <div class="editor-area">
          <div class="tab-bar"></div>
          <div id="editor-container">Loading editor...</div>
        </div>
      </div>
    `;
    
    // Initialize file explorer
    renderFileTree();
    
    // Add resize functionality
    const resizeHandle = document.querySelector('.resize-handle') as HTMLElement;
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    let isResizing = false;
    
    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const newWidth = Math.max(200, Math.min(600, e.clientX));
      sidebar.style.width = `${newWidth}px`;
      if (monacoEditor) {
        setTimeout(() => monacoEditor.layout(), 0);
      }
    });
    
    document.addEventListener('mouseup', () => {
      isResizing = false;
    });
    
    // Initialize Monaco Editor
    setTimeout(() => {
      console.log('Starting Monaco initialization...');
      
      (window as any).require.config({ 
        paths: { vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs' } 
      });
      
      (window as any).require(['vs/editor/editor.main'], () => {
        console.log('Monaco modules loaded');
        
        const editorContainer = document.getElementById('editor-container');
        if (editorContainer) {
          try {
            monacoEditor = (window as any).monaco.editor.create(editorContainer, {
              value: `// Welcome to your lightweight IDE with file explorer!
// Click on files in the sidebar to open them

console.log("Hello World!");

function test() {
  return "Monaco Editor is working with file explorer!";
}`,
              language: 'javascript',
              theme: 'vs-dark',
              automaticLayout: true,
              fontSize: 14,
              minimap: {
                enabled: false
              },
              scrollBeyondLastLine: false,
              wordWrap: 'on'
            });
            
            console.log('Monaco Editor created successfully with sidebar!');
            
          } catch (error) {
            console.error('Error creating Monaco Editor:', error);
          }
        }
      });
    }, 500);
  }
});
