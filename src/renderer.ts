console.log('Renderer loaded');
console.log('Renderer loaded');
console.log('Renderer loaded');
console.log('Renderer loaded');
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
let showProjectSelector: boolean = true; // Add this line

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
  
  /* Layout adjustments for AI chat */
  .main-layout {
    display: flex;
    width: 100%;
    height: 100%;
  }
  
  #ai-chat-panel {
    width: 320px !important;
    min-width: 320px !important;
    max-width: 320px !important;
    height: 100% !important;
    display: none;
    flex-direction: column !important;
    flex-shrink: 0 !important;
    flex-grow: 0 !important;
    background-color: #252526;
    border-left: 1px solid #3c3c3c;
  }
  
  #main-ide {
    flex: 1;
    display: flex;
    min-width: 0;
    transition: margin-right 0.2s ease-in-out; /* Smooth transition */
  }
  
  /* AI Chat Container */
  .ai-chat-container {
    width: 320px !important;
    min-width: 320px !important;
    max-width: 320px !important;
    height: 100% !important;
    background-color: #252526;
    border-left: 1px solid #3c3c3c;
    display: flex;
    flex-direction: column;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    overflow: hidden;
  }

  /* Header - more compact */
  .ai-chat-header {
    background-color: #2d2d30;
    border-bottom: 1px solid #3c3c3c;
    padding: 6px 10px; /* Reduced padding */
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 28px; /* Set minimum height */
  }

  .ai-chat-title {
    display: flex;
    align-items: center;
    gap: 6px; /* Reduced gap */
    font-size: 12px; /* Smaller font */
    font-weight: 600;
    color: #cccccc;
  }

  .ai-icon {
    font-size: 14px; /* Smaller icon */
  }

  .ai-chat-controls {
    display: flex;
    gap: 2px; /* Reduced gap */
  }

  .chat-control-btn {
    background: transparent;
    border: 1px solid #3c3c3c;
    color: #cccccc;
    padding: 2px 6px; /* Smaller padding */
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px; /* Smaller font */
  }

  .chat-control-btn:hover {
    background-color: #3c3c3c;
  }

  /* API Key Setup - more compact */
  .api-key-setup {
    padding: 16px 12px; /* Reduced padding */
    text-align: center;
    color: #cccccc;
  }

  .api-key-setup h3 {
    margin-bottom: 8px; /* Reduced margin */
    color: #ffffff;
    font-size: 14px; /* Smaller font */
  }

  .api-key-setup p {
    margin-bottom: 12px; /* Reduced margin */
    font-size: 12px; /* Smaller font */
  }

  .api-key-input-container {
    display: flex;
    flex-direction: column; /* Stack vertically for narrow space */
    gap: 6px; /* Reduced gap */
    margin-bottom: 10px; /* Reduced margin */
  }

  .api-key-input {
    background-color: #1e1e1e;
    border: 1px solid #3c3c3c;
    color: #cccccc;
    padding: 6px 8px; /* Reduced padding */
    border-radius: 4px;
    font-size: 12px; /* Smaller font */
    width: 100%;
  }

  .api-key-input:focus {
    outline: none;
    border-color: #0e639c;
  }

  .api-key-submit {
    background-color: #0e639c;
    color: white;
    border: none;
    padding: 6px 12px; /* Reduced padding */
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px; /* Smaller font */
    width: 100%;
  }

  .api-key-submit:hover:not(:disabled) {
    background-color: #1177bb;
  }

  .api-key-submit:disabled {
    background-color: #666;
    cursor: not-allowed;
  }

  .api-key-note {
    font-size: 11px; /* Smaller font */
    color: #888;
    line-height: 1.3;
  }

  .api-key-note a {
    color: #569cd6;
    text-decoration: none;
  }

  .api-key-note a:hover {
    text-decoration: underline;
  }

  /* Code Context - more compact */
  .code-context {
    background-color: #2d2d30;
    border-bottom: 1px solid #3c3c3c;
    padding: 6px 10px; /* Reduced padding */
  }

  .context-header {
    margin-bottom: 6px; /* Reduced margin */
  }

  .context-title {
    font-size: 11px; /* Smaller font */
    font-weight: 600;
    color: #cccccc;
  }

  .context-content {
    font-size: 10px; /* Smaller font */
    color: #888;
  }

  .context-item {
    display: flex;
    align-items: flex-start;
    gap: 6px; /* Reduced gap */
    margin-bottom: 3px; /* Reduced margin */
  }

  .context-label {
    font-weight: 600;
    color: #cccccc;
    min-width: 35px; /* Ensure alignment */
  }

  .context-value {
    color: #569cd6;
    word-break: break-all; /* Handle long file names */
  }

  .selected-text-preview {
    background-color: #1e1e1e;
    padding: 3px 4px; /* Reduced padding */
    border-radius: 3px;
    font-family: 'Consolas', monospace;
    white-space: pre-wrap;
    font-size: 10px; /* Smaller font */
    max-width: 100%;
    overflow: hidden;
    word-break: break-all;
  }

  /* Messages - FIXED MESSAGE BUBBLE STYLING */
  .ai-chat-messages {
    flex: 1 !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    padding: 12px !important;
    background-color: #1e1e1e !important;
    scroll-behavior: smooth !important;
    min-height: 0 !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
    gap: 12px !important;
    }

  .message-bubble {
      background-color: #2d2d30;
      border: 1px solid #3c3c3c;
    border-radius: 8px;
    padding: 12px;
      font-size: 13px;
    line-height: 1.4;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
    white-space: pre-wrap !important;
      box-sizing: border-box !important;
    max-width: 80% !important;
    width: fit-content !important;
    min-width: 120px !important;
    align-self: flex-start !important;
    }

    .message-bubble.user {
      background-color: #0e639c;
      color: white;
    align-self: flex-end !important;
    margin-left: auto !important;
    }

    .message-bubble.assistant {
      background-color: #2d2d30;
      color: #cccccc;
    align-self: flex-start !important;
    margin-right: auto !important;
    }

    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 11px;
    flex-shrink: 0;
    }

    .message-role {
      font-weight: 600;
    color: inherit;
    }

    .message-time {
    color: rgba(255, 255, 255, 0.6);
    font-size: 10px;
    }

    .message-content {
    color: inherit !important;
    font-size: 13px !important;
    line-height: 1.5 !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
    white-space: pre-wrap !important;
    width: 100% !important;
  }

  .message-content strong {
    font-weight: 600;
  }

  .message-content em {
    font-style: italic;
    color: #dcdcaa;
  }

  .message-content code {
    background-color: rgba(0, 0, 0, 0.3) !important;
    color: #d7ba7d !important;
    padding: 2px 4px !important;
    border-radius: 3px !important;
    font-family: 'Consolas', monospace !important;
    font-size: 12px !important;
    white-space: nowrap !important;
  }

  /* Code Blocks - FIXED FOR PROPER SIZING */
  .code-block-container {
    margin: 12px 0;
    background-color: #1e1e1e;
    border-radius: 6px;
    border: 1px solid #3c3c3c;
    overflow: hidden;
    width: 100% !important;
    box-sizing: border-box !important;
  }

  .code-block-header {
    background-color: #2d2d30;
    padding: 6px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    white-space: nowrap;
    border-bottom: 1px solid #3c3c3c;
  }

  .code-language {
    color: #569cd6;
    font-weight: 600;
  }

  .insert-code-btn,
  .copy-code-btn {
    background: #0e639c;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 10px;
    margin-left: 4px;
  }

  .insert-code-btn:hover,
  .copy-code-btn:hover {
    background: #1177bb;
  }

  .code-block-container pre {
    margin: 0 !important;
    padding: 12px !important;
    overflow-x: auto !important;
    overflow-y: visible !important;
    background-color: #1e1e1e !important;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
    font-size: 12px !important;
    line-height: 1.4 !important;
    white-space: pre !important;
    word-wrap: normal !important;
    box-sizing: border-box !important;
  }

  .code-block-container code {
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.4;
    color: #d4d4d4;
    background: none;
    padding: 0;
    white-space: pre !important;
    word-wrap: normal !important;
  }

  /* Chat Input */
  .chat-input-container {
    border-top: 1px solid #3c3c3c;
    background-color: #2d2d30;
  }

  .quick-actions {
    background-color: #1e1e1e;
    border-bottom: 1px solid #3c3c3c;
    padding: 12px;
  }

  .quick-actions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 600;
    color: #cccccc;
  }

  .quick-actions-header button {
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 14px;
  }

  .quick-actions-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .quick-action-btn {
    background-color: #3c3c3c;
    color: #cccccc;
    border: 1px solid #555;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    text-align: left;
  }

  .quick-action-btn:hover:not(:disabled) {
    background-color: #4c4c4c;
  }

  .quick-action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chat-input-form {
    padding: 12px;
  }

  .input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .chat-textarea {
    background-color: #1e1e1e;
    border: 1px solid #3c3c3c;
    color: #d4d4d4;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-family: inherit;
    resize: none;
    min-height: 36px;
    max-height: 120px;
  }

  .chat-textarea:focus {
    outline: none;
    border-color: #0e639c;
  }

  .chat-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .input-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .quick-actions-toggle {
    background: transparent;
    border: 1px solid #3c3c3c;
    color: #cccccc;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  }

  .quick-actions-toggle:hover {
    background-color: #3c3c3c;
  }

  .context-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #cccccc;
    cursor: pointer;
  }

  .context-toggle input {
    margin: 0;
  }

  .send-button {
    background-color: #0e639c;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .send-button:hover:not(:disabled) {
    background-color: #1177bb;
  }

  .send-button:disabled {
    background-color: #666;
    cursor: not-allowed;
  }

  /* Scrollbars */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: #1e1e1e;
  }

  ::-webkit-scrollbar-thumb {
    background: #424242;
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  .ai-chat-messages::-webkit-scrollbar {
    width: 8px;
    height: 8px;  /* Add horizontal scrollbar */
  }

  .ai-chat-messages::-webkit-scrollbar-track {
    background: #252526;
  }

  .ai-chat-messages::-webkit-scrollbar-thumb {
    background: #424242;
    border-radius: 4px;
  }

  .ai-chat-messages::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  .ai-chat-messages::-webkit-scrollbar-corner {
    background: #252526;  /* Handle corner where scrollbars meet */
  }

  /* Code block scrollbars */
  .code-block-container pre::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .code-block-container pre::-webkit-scrollbar-track {
    background: #1e1e1e;
  }

  .code-block-container pre::-webkit-scrollbar-thumb {
    background: #424242;
    border-radius: 3px;
  }

  .code-block-container pre::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  /* Utility classes */
  .hidden {
    display: none !important;
  }

  .text-success {
    color: #28a745 !important;
  }

  .text-error {
    color: #dc3545 !important;
  }

  .text-warning {
    color: #ffc107 !important;
  }

  .text-info {
    color: #17a2b8 !important;
  }

  /* Layout adjustments for AI chat */
  #main-ide.ai-chat-open {
    width: calc(100% - 320px);
  }

  #ai-chat-panel.ai-chat-open {
    width: 320px;
    display: flex;
  }

  /* Typing Indicator */
  .typing-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #888;
    font-size: 12px;
    padding: 8px 12px;
  }

  .dots span {
    animation: blink 1.4s infinite both;
  }

  .dots span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .dots span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes blink {
    0%, 80%, 100% {
      opacity: 0;
    }
    40% {
      opacity: 1;
    }
  }
`;

// DOM content loaded handler
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Starting IDE initialization...');
  
  // Show project selector first if needed
  if (showProjectSelector) {
    showProjectSelection();
    return; // Don't initialize anything else until project is selected
  }
  
  // Normal initialization
  await initializeEverything();
});

// Add auto-save functionality
let autoSaveTimeout: NodeJS.Timeout | null = null;
let isAutoSaveEnabled = true;

// Track running processes
let runningProcesses: Map<string, {id: string, command: string}> = new Map();

// Add AI chat state variables after the existing state
let aiChatVisible: boolean = false;
let aiChatMessages: Array<{
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: any;
}> = [];
let aiService: any = null;
let isAILoading: boolean = false;

// Add this after the existing state variables (around line 60):
interface Project {
  path: string;
  name: string;
  lastOpened: string;
}

// Add these variables at the top with other state variables
let aiChatWidth: number = 320; // Default width
let isAIChatResizing: boolean = false;

function createLayout() {
  const root = document.getElementById('root');
  if (!root) return;

  // Keep the full CSS but fix the horizontal scrolling issues
  const style = document.createElement('style');
  style.textContent = `
    /* Main Layout Styles */
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #1e1e1e;
      color: #cccccc;
      overflow: hidden;
      height: 100vh;
    }

    /* Main Layout - ensure proper viewport handling */
    .main-layout {
      display: flex !important;
      height: 100vh !important;
      width: 100vw !important;
      max-width: 100vw !important;
      background-color: #1e1e1e !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
    }

    #main-ide {
      flex: 1 !important;
      display: flex !important;
      min-width: 0 !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
    }
    
    .sidebar {
      width: 250px;
      background-color: #252526;
      border-right: 1px solid #2d2d30;
      display: flex;
      flex-direction: column;
    }

    .sidebar-header {
      padding: 8px 12px;
      background-color: #2d2d30;
      border-bottom: 1px solid #3e3e42;
              font-size: 11px;
      font-weight: bold;
      color: #cccccc;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .file-tree {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
    }

    .file-item {
      display: flex;
      align-items: center;
      padding: 4px 8px;
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

    .expansion-arrow {
      margin-right: 4px;
      font-size: 10px;
      color: #cccccc;
      cursor: pointer;
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

    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      background-color: #1e1e1e;
    }

    .toolbar {
      height: 35px;
      background-color: #2d2d30;
      border-bottom: 1px solid #3e3e42;
      display: flex;
      align-items: center;
      padding: 0 8px;
      gap: 4px;
    }

    .toolbar button {
      background-color: #0e639c;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 11px;
      cursor: pointer;
    }

    .toolbar button:hover {
      background-color: #1177bb;
    }

    .editor-area {
      flex: 1;
      display: flex;
      flex-direction: column;
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

    .tab-close {
      margin-left: 6px;
      padding: 2px 4px;
      border-radius: 2px;
      font-size: 14px;
      line-height: 1;
      opacity: 0.6;
    }

    .tab-close:hover {
      background-color: #3e3e42;
      opacity: 1;
    }

    .editor-container {
      flex: 1;
      background-color: #1e1e1e;
    }

    .terminal-container {
      height: 200px;
      background-color: #0c0c0c;
      border-top: 1px solid #3e3e42;
      display: flex;
      flex-direction: column;
    }

    .terminal-resize-handle {
      height: 4px;
      background-color: #2d2d30;
      cursor: row-resize;
    }

    .terminal-resize-handle:hover {
      background-color: #007acc;
    }

    .terminal-header {
      background-color: #2d2d30;
      border-bottom: 1px solid #3e3e42;
      padding: 4px 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
    }

    .terminal-header-left {
      display: flex;
      align-items: center;
    }

    .terminal-tabs {
      display: flex;
      gap: 2px;
      margin-right: 8px;
    }

    .terminal-tab {
      background-color: #1e1e1e;
      border: 1px solid #3e3e42;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 11px;
      color: #cccccc;
      border-radius: 3px 3px 0 0;
    }

    .terminal-tab.active {
      background-color: #0c0c0c;
      border-bottom-color: #0c0c0c;
    }

    .terminal-output {
      flex: 1;
      background-color: #0c0c0c;
      color: #ffffff;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 12px;
      padding: 8px;
      overflow-y: auto;
      white-space: pre-wrap;
    }

    .terminal-input-container {
      background-color: #1e1e1e;
      border-top: 1px solid #3e3e42;
      display: flex;
      align-items: center;
      padding: 4px 8px;
    }

    .terminal-prompt {
      color: #569cd6;
      margin-right: 8px;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    }

    .terminal-input {
      flex: 1;
      background-color: transparent;
      border: none;
      color: #ffffff;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 12px;
      outline: none;
    }

    /* AI Chat Panel Styles */
    #ai-chat-panel {
      width: 0;
      overflow: hidden;
      transition: width 0.3s ease;
      background-color: #252526;
      border-left: 1px solid #3c3c3c;
      position: relative; /* Add for resize handle positioning */
    }

    /* AI Chat Resize Handle */
    .ai-chat-resize-handle {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background-color: #3c3c3c;
      cursor: col-resize;
      z-index: 1000;
      border-right: 1px solid #555;
    }

    .ai-chat-resize-handle:hover {
      background-color: #0e639c;
    }

    .ai-chat-resize-handle.dragging {
      background-color: #1177bb;
    }

    /* AI Chat Container */
    .ai-chat-container {
      width: 100% !important;
      min-width: 280px !important;
      max-width: none !important;
      height: 100% !important;
      background-color: #252526 !important;
      display: flex !important;
      flex-direction: column !important;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
      padding-left: 4px; /* Space for resize handle */
    }

    /* AI Chat Header */
    .ai-chat-header {
      background-color: #2d2d30;
      border-bottom: 1px solid #3c3c3c;
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .ai-chat-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #cccccc;
    }

    .ai-icon {
      font-size: 16px;
    }

    .ai-chat-controls {
      display: flex;
      gap: 4px;
    }

    .chat-control-btn {
      background: transparent;
      border: 1px solid #3c3c3c;
      color: #cccccc;
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }

    .chat-control-btn:hover {
      background-color: #3c3c3c;
    }

    /* API Key Setup */
    .api-key-setup {
      padding: 20px;
      text-align: center;
      color: #cccccc;
    }

    .api-key-setup h3 {
      margin-bottom: 12px;
      color: #ffffff;
    }

    .api-key-setup p {
      margin-bottom: 16px;
      font-size: 14px;
    }

    .api-key-input-container {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .api-key-input {
      flex: 1;
      background-color: #1e1e1e;
      border: 1px solid #3c3c3c;
      color: #cccccc;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 13px;
    }

    .api-key-input:focus {
      outline: none;
      border-color: #0e639c;
    }

    .api-key-submit {
      background-color: #0e639c;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    .api-key-submit:hover:not(:disabled) {
      background-color: #1177bb;
    }

    .api-key-submit:disabled {
      background-color: #666;
      cursor: not-allowed;
    }

    .api-key-note {
      font-size: 12px;
      color: #888;
    }

    .api-key-note a {
      color: #569cd6;
      text-decoration: none;
    }

    .api-key-note a:hover {
      text-decoration: underline;
    }

    /* Messages - FIXED FOR HORIZONTAL SCROLLING */
    .ai-chat-messages {
      flex: 1 !important;
      overflow-y: auto !important;
      overflow-x: auto !important;
      padding: 8px 10px !important;
      background-color: #1e1e1e !important;
      scroll-behavior: smooth !important;
      min-height: 0 !important;
      box-sizing: border-box !important;
    }

    .message-bubble {
      margin-bottom: 12px;
      padding: 8px 10px;
      border-radius: 8px;
      background-color: #2d2d30;
      border: 1px solid #3c3c3c;
      font-size: 12px;
      line-height: 1.4;
      max-width: none !important;
      min-width: calc(100% - 40px) !important; /* Responsive to container width */
      word-wrap: normal !important;
      white-space: normal !important;
      box-sizing: border-box;
    }

    .message-bubble.user {
      background-color: #0e639c;
      color: white;
      margin-left: 20px;
    }

    .message-bubble.assistant {
      background-color: #2d2d30;
      color: #cccccc;
      margin-right: 20px;
    }

    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 11px;
    }

    .message-role {
      font-weight: 600;
      color: #cccccc;
    }

    .message-time {
      color: #888;
    }

    .message-content {
      color: #d4d4d4;
      font-size: 13px;
      line-height: 1.5;
      word-wrap: normal !important;  /* Don't wrap */
      white-space: pre-wrap !important;  /* Preserve formatting */
      overflow: visible !important;  /* Allow content to expand */
    }

    .message-content strong {
      color: #ffffff;
      font-weight: 600;
    }

    .message-content em {
      color: #dcdcaa;
      font-style: italic;
    }

    .message-content code {
      background-color: #1e1e1e;
      color: #d7ba7d;
      padding: 1px 3px; /* Reduced padding */
      border-radius: 3px;
      font-family: 'Consolas', monospace;
      font-size: 11px; /* Smaller font */
    }

    /* Code Blocks - more compact */
    .code-block-container {
      margin: 8px 0; /* Reduced margin */
      border-radius: 4px;
      overflow: hidden;
      background-color: #1e1e1e;
      border: 1px solid #3c3c3c;
      max-width: 100% !important;
      max-height: 300px !important; /* Limit height */
      overflow-y: auto !important; /* Add scrolling for long code */
    }

    .code-block-header {
      background-color: #3c3c3c;
      padding: 4px 8px; /* Reduced padding */
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px; /* Smaller font */
      border-bottom: 1px solid #555;
    }

    .code-language {
      color: #569cd6;
      font-weight: 600;
    }

    .copy-code-btn, .insert-code-btn {
      background: transparent;
      border: 1px solid #569cd6;
      color: #569cd6;
      padding: 2px 6px; /* Smaller padding */
      border-radius: 3px;
      cursor: pointer;
      font-size: 9px; /* Smaller font */
      margin-left: 4px; /* Reduced margin */
    }

    .copy-code-btn:hover, .insert-code-btn:hover {
      background-color: #569cd6;
      color: white;
    }

    /* Code content - prevent overflow */
    .code-block-container pre {
      margin: 0 !important;
      padding: 8px !important; /* Reduced padding */
      overflow-x: auto !important;
      overflow-y: auto !important;
      max-height: 250px !important; /* Limit code block height */
      background-color: #1e1e1e !important;
      color: #d4d4d4 !important;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
      font-size: 11px !important; /* Smaller code font */
      line-height: 1.3 !important;
      white-space: pre !important;
      word-wrap: normal !important;
    }

    .code-block-container code {
      background-color: transparent !important;
      color: inherit !important;
      padding: 0 !important;
      border-radius: 0 !important;
      font-family: inherit !important;
      font-size: inherit !important;
    }

    /* Inline code */
    code {
      background-color: #3c3c3c !important;
      color: #d7ba7d !important;
      padding: 1px 4px !important; /* Reduced padding */
      border-radius: 3px !important;
      font-family: 'Consolas', monospace !important;
      font-size: 11px !important; /* Smaller font */
    }

    /* Fix scrolling */
    .ai-chat-messages::-webkit-scrollbar {
      width: 8px;
    }

    .ai-chat-messages::-webkit-scrollbar-track {
      background: #1e1e1e;
    }

    .ai-chat-messages::-webkit-scrollbar-thumb {
      background: #3c3c3c;
      border-radius: 4px;
    }

    .ai-chat-messages::-webkit-scrollbar-thumb:hover {
      background: #569cd6;
    }

    /* Chat Input - more compact */
    .chat-input-container {
      border-top: 1px solid #3c3c3c;
      background-color: #2d2d30;
    }

    .quick-actions {
      background-color: #1e1e1e;
      border-bottom: 1px solid #3c3c3c;
      padding: 8px; /* Reduced padding */
    }

    .quick-actions-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px; /* Reduced margin */
      font-size: 11px; /* Smaller font */
      font-weight: 600;
      color: #cccccc;
    }

    .quick-actions-header button {
      background: transparent;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 12px; /* Smaller font */
    }

    .quick-actions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px; /* Reduced gap */
    }

    .quick-action-btn {
      background-color: #3c3c3c;
      color: #cccccc;
      border: 1px solid #555;
      padding: 4px 6px; /* Reduced padding */
      border-radius: 4px;
      cursor: pointer;
      font-size: 10px; /* Smaller font */
      text-align: left;
      line-height: 1.2;
    }

    .quick-action-btn:hover:not(:disabled) {
      background-color: #4c4c4c;
    }

    .chat-input-form {
      padding: 8px; /* Reduced padding */
    }

    .input-wrapper {
      display: flex;
      flex-direction: column;
      gap: 6px; /* Reduced gap */
    }

    .chat-textarea {
      background-color: #1e1e1e;
      border: 1px solid #3c3c3c;
      color: #d4d4d4;
      padding: 6px 8px; /* Reduced padding */
      border-radius: 4px; /* Smaller radius */
      font-size: 12px; /* Smaller font */
      font-family: inherit;
      resize: none;
      min-height: 32px; /* Smaller min height */
      max-height: 100px; /* Smaller max height */
      line-height: 1.3;
    }

    .chat-textarea:focus {
      outline: none;
      border-color: #0e639c;
    }

    .input-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px; /* Add gap */
    }

    .quick-actions-toggle {
      background: transparent;
      border: 1px solid #3c3c3c;
      color: #cccccc;
      padding: 3px 6px; /* Reduced padding */
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px; /* Smaller font */
    }

    .context-toggle {
      display: flex;
      align-items: center;
      gap: 3px; /* Reduced gap */
      font-size: 10px; /* Smaller font */
      color: #cccccc;
      cursor: pointer;
      flex: 1; /* Take available space */
    }

    .context-label {
      white-space: nowrap;
    }

    .send-button {
      background-color: #0e639c;
      color: white;
      border: none;
      padding: 4px 8px; /* Reduced padding */
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px; /* Smaller font */
      min-width: 32px; /* Ensure minimum size */
    }

    .send-button:hover:not(:disabled) {
      background-color: #1177bb;
    }

    .send-button:disabled {
      background-color: #666;
      cursor: not-allowed;
    }

    /* Scrollbars - thinner for narrow space */
    .ai-chat-messages::-webkit-scrollbar {
      width: 6px; /* Thinner scrollbar */
    }

    .ai-chat-messages::-webkit-scrollbar-track {
      background: #252526;
    }

    .ai-chat-messages::-webkit-scrollbar-thumb {
      background: #424242;
      border-radius: 3px; /* Smaller radius */
    }

    .ai-chat-messages::-webkit-scrollbar-thumb:hover {
      background: #555;
    }

    /* Typing Indicator - more compact */
    .typing-indicator {
      display: flex;
      align-items: center;
      gap: 6px; /* Reduced gap */
      color: #888;
      font-size: 11px; /* Smaller font */
      padding: 6px 8px; /* Reduced padding */
    }

    .dots span {
      animation: blink 1.4s infinite both;
    }

    .dots span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .dots span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes blink {
      0%, 80%, 100% {
        opacity: 0;
      }
      40% {
        opacity: 1;
      }
    }

    /* Enhanced scrollbars for better UX */
    .ai-chat-messages::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    .ai-chat-messages::-webkit-scrollbar-track {
      background: #252526;
    }

    .ai-chat-messages::-webkit-scrollbar-thumb {
      background: #424242;
      border-radius: 4px;
    }

    .ai-chat-messages::-webkit-scrollbar-thumb:hover {
      background: #555;
    }

    .ai-chat-messages::-webkit-scrollbar-corner {
      background: #252526;
    }

    /* Code block scrollbars */
    .code-block-container pre::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }

    .code-block-container pre::-webkit-scrollbar-track {
      background: #1e1e1e;
    }

    .code-block-container pre::-webkit-scrollbar-thumb {
      background: #424242;
      border-radius: 3px;
    }

    .code-block-container pre::-webkit-scrollbar-thumb:hover {
      background: #555;
    }
  `;
  
  // Add CSS to head if not already present
  if (!document.head.querySelector('style[data-main-app-styles]')) {
    style.setAttribute('data-main-app-styles', 'true');
    document.head.appendChild(style);
  }

  // Create main layout wrapper
  root.innerHTML = `
    <div class="main-layout">
      <div id="main-ide">
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
            ">🔄</button>
          </div>
          <div class="file-tree"></div>
        </div>
        <div class="main-content">
          <div class="toolbar">
            <button id="terminal-toggle">Toggle Terminal</button>
            <button id="clear-terminal">Clear Terminal</button>
            <button id="refresh-files">🔄 Refresh Files</button>
            <button id="ai-chat-toggle" style="
              background: #7b68ee;
              color: white;
              border: none;
              padding: 4px 8px;
              border-radius: 3px;
              font-size: 11px;
              cursor: pointer;
            ">🤖 AI Assistant</button>
            <button id="save-file" style="
              background: #0e639c;
              color: white;
              border: none;
              padding: 4px 8px;
              border-radius: 3px;
              font-size: 11px;
              cursor: pointer;
            ">💾 Save (Ctrl+S)</button>
            <button id="toggle-autosave" style="
              background: #28a745;
              color: white;
              border: none;
              padding: 4px 8px;
              border-radius: 3px;
              font-size: 11px;
              cursor: pointer;
            ">🔄 Auto-Save: ON</button>
            <button id="stop-processes" style="
              background: #dc3545;
              color: white;
              border: none;
              padding: 4px 8px;
              border-radius: 3px;
              font-size: 11px;
              cursor: pointer;
              display: none;
            ">🛑 Stop Server</button>
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
                ">+ New Terminal</button>
              </div>
              <div class="terminal-header-right">
                <span id="process-indicator" style="
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
      </div>
      <div id="ai-chat-panel">
        <div class="ai-chat-resize-handle" id="ai-chat-resize-handle"></div>
      </div>
    </div>
  `;

  // Add event listeners
  document.getElementById('terminal-toggle')?.addEventListener('click', toggleTerminal);
  document.getElementById('clear-terminal')?.addEventListener('click', clearActiveTerminal);
  document.getElementById('refresh-explorer')?.addEventListener('click', refreshCurrentDirectory);
  document.getElementById('refresh-files')?.addEventListener('click', refreshCurrentDirectory);
  document.getElementById('ai-chat-toggle')?.addEventListener('click', toggleAIChat);
  document.getElementById('save-file')?.addEventListener('click', saveCurrentFile);
  document.getElementById('toggle-autosave')?.addEventListener('click', toggleAutoSave);
  document.getElementById('stop-processes')?.addEventListener('click', stopAllProcesses);
  document.getElementById('new-terminal')?.addEventListener('click', createNewTerminal);
  
  const terminalInput = document.getElementById('terminal-input') as HTMLInputElement;
  terminalInput?.addEventListener('keydown', handleTerminalInput);
  
  document.addEventListener('keydown', handleKeyboardShortcuts);
  
  // Setup AI chat resize
  setupAIChatResize();
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
    'jsx': 'javascriptreact',    // Better JSX support
    'ts': 'typescript',
    'tsx': 'typescriptreact',    // Better TSX support
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

// Add the toggle function for AI chat
function toggleAIChat() {
  aiChatVisible = !aiChatVisible;
  renderAIChat();
  
  // Update button state
  const toggleBtn = document.getElementById('ai-chat-toggle');
  if (toggleBtn) {
    if (aiChatVisible) {
      toggleBtn.style.backgroundColor = '#9370db';
      toggleBtn.textContent = '🤖 Close AI';
      toggleBtn.style.fontWeight = '600';
    } else {
      toggleBtn.style.backgroundColor = '#7b68ee';
      toggleBtn.textContent = '🤖 AI Assistant';
      toggleBtn.style.fontWeight = 'normal';
    }
  }
  
  // Update layout
  updateLayoutForAIChat();
  
  // Force Monaco to resize after transition
  setTimeout(() => {
    monacoEditor?.layout();
  }, 250); // Slightly longer delay for transition
}

function updateLayoutForAIChat() {
  const mainIde = document.getElementById('main-ide');
  const aiChatPanel = document.getElementById('ai-chat-panel');
  
  if (mainIde && aiChatPanel) {
    if (aiChatVisible) {
      // Use stored width
      aiChatPanel.style.width = `${aiChatWidth}px`;
      aiChatPanel.style.minWidth = `${aiChatWidth}px`;
      aiChatPanel.style.maxWidth = `${aiChatWidth}px`;
      aiChatPanel.style.display = 'flex';
      mainIde.style.width = `calc(100% - ${aiChatWidth}px)`;
      
      // Update container width
      const container = aiChatPanel.querySelector('.ai-chat-container') as HTMLElement;
      if (container) {
        container.style.width = `${aiChatWidth}px`;
      }
      
      console.log(`AI Chat panel shown with width: ${aiChatWidth}px`);
    } else {
      aiChatPanel.style.width = '0';
      aiChatPanel.style.display = 'none';
      mainIde.style.width = '100%';
    }
  }
}

// Replace the renderAIChat function with this improved version:
function renderAIChat() {
  const aiChatPanel = document.getElementById('ai-chat-panel');
  if (!aiChatPanel) return;

  if (aiChatVisible) {
    // Find or create resize handle
    let resizeHandle = document.getElementById('ai-chat-resize-handle');
    if (!resizeHandle) {
      resizeHandle = document.createElement('div');
      resizeHandle.id = 'ai-chat-resize-handle';
      resizeHandle.className = 'ai-chat-resize-handle';
      aiChatPanel.appendChild(resizeHandle);
      setupAIChatResize(); // Setup events if handle was just created
    }
    
    // Clear existing content except resize handle
    const existingContainer = aiChatPanel.querySelector('.ai-chat-container');
    if (existingContainer) {
      existingContainer.remove();
    }
    
    // Create the container structure
    const container = document.createElement('div');
    container.className = 'ai-chat-container';
    container.style.width = `${aiChatWidth}px`;
    
    // Add header
    container.innerHTML = `
      <div class="ai-chat-header">
        <div class="ai-chat-title">
          <span class="ai-icon">🤖</span>
          <span>AI Assistant</span>
        </div>
        <div class="ai-chat-controls">
          <button onclick="clearAIChat()" class="chat-control-btn" title="Clear Chat">🗑️</button>
          <button onclick="toggleAIChat()" class="chat-control-btn" title="Close">✕</button>
        </div>
      </div>
    `;
    
    // Add content based on AI service status
    if (!aiService) {
      container.innerHTML += renderAPIKeySetup();
    } else {
      container.innerHTML += renderChatInterface();
    }
    
    // Append the container to the panel
    aiChatPanel.appendChild(container);
    
    // Add event listeners after rendering
    setupAIChatEventListeners();
  }
  
  updateLayoutForAIChat();
}

// Also, let's create a separate function to update just the messages
function updateChatMessages() {
  const messagesContainer = document.getElementById('ai-chat-messages');
  if (!messagesContainer) return;
  
  // Clear and re-render messages
  messagesContainer.innerHTML = '';
  
  aiChatMessages.forEach(msg => {
    const messageElement = document.createElement('div');
    messageElement.innerHTML = renderMessage(msg);
    messagesContainer.appendChild(messageElement.firstElementChild as HTMLElement);
  });
  
  // Add loading indicator if needed
  if (isAILoading) {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'typing-indicator';
    loadingElement.innerHTML = '<span>AI is thinking</span><span class="dots"><span>.</span><span>.</span><span>.</span></span>';
    messagesContainer.appendChild(loadingElement);
  }
  
  // Scroll to bottom
  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 50);
}

function renderAPIKeySetup(): string {
  return `
    <div class="api-key-setup">
      <h3>🔧 Setup Required</h3>
      <p>Please add your Anthropic API key to the <code>.env</code> file:</p>
      <div class="code-block-container">
        <pre><code>ANTHROPIC_API_KEY=sk-ant-api03-your-key-here</code></pre>
      </div>
      <p>Then restart the application.</p>
      <p class="api-key-note">
        Get your API key from 
        <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">
          Anthropic Console
        </a>
      </p>
      <button onclick="initializeAIService()" class="api-key-submit">🔄 Retry Connection</button>
    </div>
  `;
}

function renderChatInterface(): string {
  return `
    ${renderCodeContext()}
    
    <div class="ai-chat-messages" id="ai-chat-messages">
      ${aiChatMessages.map(msg => renderMessage(msg)).join('')}
      ${isAILoading ? '<div class="typing-indicator"><span>AI is thinking</span><span class="dots"><span>.</span><span>.</span><span>.</span></span></div>' : ''}
    </div>

    ${renderChatInput()}
    
    <!-- Width indicator -->
    <div style="
      position: absolute;
      bottom: 4px;
      left: 8px;
      font-size: 10px;
      color: #666;
      pointer-events: none;
    ">
      Width: ${aiChatWidth}px
    </div>
  `;
}

function renderCodeContext(): string {
  const currentFileName = activeTabPath ? activeTabPath.split('/').pop() : null;
  const selectedText = monacoEditor ? monacoEditor.getModel()?.getValueInRange(monacoEditor.getSelection()) : null;
  
  if (!currentFileName && !selectedText) {
    return '';
  }
  
  return `
    <div class="code-context">
      <div class="context-header">
        <span class="context-title">📁 Current Context</span>
      </div>
      <div class="context-content">
        ${currentFileName ? `
          <div class="context-item">
            <span class="context-label">File:</span>
            <span class="context-value">${currentFileName}</span>
          </div>
        ` : ''}
        ${selectedText ? `
          <div class="context-item">
            <span class="context-label">Selected:</span>
            <div class="selected-text-preview">${selectedText.length > 100 ? selectedText.substring(0, 100) + '...' : selectedText}</div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function renderMessage(message: any): string {
  const formattedContent = formatMessageContent(message.content);
  const timeStr = message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Use simplified structure that works with external CSS
  return `
    <div class="message-bubble ${message.role}">
      <div class="message-header">
        <span class="message-role">
          ${message.role === 'user' ? '👤' : '🤖'} ${message.role}
        </span>
        <span class="message-time">${timeStr}</span>
      </div>
      <div class="message-content">${formattedContent}</div>
    </div>
  `;
}

function formatMessageContent(content: string): string {
  // Handle code blocks with proper horizontal scrolling
  content = content.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'text';
    const cleanCode = code.trim();
    const escapedCode = escapeHtml(cleanCode);
    const encodedCode = encodeURIComponent(cleanCode).replace(/'/g, '\\\'');
    
    return `
      <div class="code-block-container">
        <div class="code-block-header">
          <span class="code-language">${language}</span>
          <div>
            <button class="copy-code-btn" onclick="copyCodeToClipboard('${encodedCode}')">Copy</button>
            <button class="insert-code-btn" onclick="insertCodeIntoEditor('${encodedCode}')">Insert</button>
          </div>
        </div>
        <pre><code>${escapedCode}</code></pre>
      </div>
    `;
  });
  
  // Handle inline code
  content = content.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  
  // Handle bold and italic
  content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Handle bullet points
  content = content.replace(/^• (.*$)/gm, '<div style="margin: 2px 0;">• $1</div>');
  
  // Handle line breaks
  content = content.replace(/\n/g, '<br>');
  
  return content;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderChatInput(): string {
  const hasContext = !!(activeTabPath || (monacoEditor && monacoEditor.getModel()?.getValueInRange(monacoEditor.getSelection())));
  
  return `
    <div class="chat-input-container">
      <div id="quick-actions" class="quick-actions" style="display: none;">
        <div class="quick-actions-header">
          <span>Quick Actions</span>
          <button onclick="toggleQuickActions()">✕</button>
        </div>
        <div class="quick-actions-grid">
          <button class="quick-action-btn" onclick="sendQuickAction('explain')">Explain this code</button>
          <button class="quick-action-btn" onclick="sendQuickAction('bugs')">Find bugs</button>
          <button class="quick-action-btn" onclick="sendQuickAction('optimize')">Optimize code</button>
          <button class="quick-action-btn" onclick="sendQuickAction('comments')">Add comments</button>
          <button class="quick-action-btn" onclick="sendQuickAction('tests')">Write tests</button>
          <button class="quick-action-btn" onclick="sendQuickAction('component')">Generate component</button>
        </div>
      </div>

      <form class="chat-input-form" onsubmit="sendChatMessage(event)">
        <div class="input-wrapper">
          <textarea
            id="chat-textarea"
            placeholder="Ask about your code or request new functionality..."
            class="chat-textarea"
            rows="1"
            ${isAILoading ? 'disabled' : ''}
          ></textarea>
          
          <div class="input-controls">
            <button type="button" class="quick-actions-toggle" onclick="toggleQuickActions()" title="Quick Actions">⚡</button>
            
            ${hasContext ? `
              <label class="context-toggle">
                <input type="checkbox" id="include-context" />
                <span class="context-label">Include Context</span>
              </label>
            ` : ''}
            
            <button type="submit" class="send-button" ${isAILoading ? 'disabled' : ''}>
              ${isAILoading ? '⏳' : '📤'}
            </button>
          </div>
        </div>
      </form>
    </div>
  `;
}

function setupAIChatEventListeners() {
  // API Key setup
  const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
  const apiKeySubmit = document.getElementById('api-key-submit');
  
  if (apiKeyInput && apiKeySubmit) {
    apiKeyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && apiKeyInput.value.trim()) {
        initializeAIService();
      }
    });
    
    apiKeySubmit.addEventListener('click', () => {
      if (apiKeyInput.value.trim()) {
        initializeAIService();
      }
    });
  }
  
  // Chat textarea auto-resize
  const textarea = document.getElementById('chat-textarea') as HTMLTextAreaElement;
  if (textarea) {
    textarea.addEventListener('input', adjustTextareaHeight);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage(e);
      }
    });
  }
}

function adjustTextareaHeight() {
  const textarea = document.getElementById('chat-textarea') as HTMLTextAreaElement;
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    
    // Ensure parent container stays properly sized
    const chatPanel = document.getElementById('ai-chat-panel');
    if (chatPanel) {
      chatPanel.style.width = '320px';
      chatPanel.style.minWidth = '320px';
      chatPanel.style.maxWidth = '320px';
    }
  }
}

async function initializeAIService() {
  try {
    // Test if API key is available by making a test call
    const testMessage = {
      id: 'test',
      role: 'user',
      content: 'Hello'
    };
    
    await (window as any).electronAPI.callAnthropicAPI([testMessage], 'You are a helpful assistant.');
    
    // Create AI service that uses IPC
    aiService = {
      async sendMessage(messages: any[], systemPrompt?: string) {
        return await (window as any).electronAPI.callAnthropicAPI(messages, systemPrompt);
      }
    };
    
    // Add welcome message
    const welcomeMessage = {
      id: Date.now().toString(),
      role: 'assistant' as const,  // Add 'as const'
      content: `Hello! I'm your AI coding assistant. I can help you with:

• **Code Analysis** - Explain and review your code
• **Code Generation** - Create new components, functions, or files  
• **Debugging** - Find and fix issues
• **Refactoring** - Improve code quality
• **Documentation** - Generate comments and docs

Feel free to ask questions about your code or request new functionality!`,
      timestamp: new Date()
    };
    
    aiChatMessages = [welcomeMessage];
    renderAIChat();
    writeToTerminal('✅ AI Assistant connected successfully!');
    
  } catch (error) {
    console.error('AI Service initialization failed:', error);
    
    // Show error message in chat
    const errorMessage = {
      id: Date.now().toString(),
      role: 'assistant' as const,  // Add 'as const'
      content: `❌ **Setup Required**

Please add your Anthropic API key to the \`.env\` file:

\`\`\`env
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
\`\`\`

Then restart the application.

Get your API key from [Anthropic Console](https://console.anthropic.com/)`,
      timestamp: new Date()
    };
    
    aiChatMessages = [errorMessage];
    renderAIChat();
  }
}

function getSystemPrompt(): string {
  return `You are an AI coding assistant integrated into a VS Code-like IDE. You help users with:

1. **Code Analysis**: Analyze and explain code snippets, functions, and files
2. **Code Generation**: Create new code based on requirements
3. **Debugging**: Help identify and fix issues in code
4. **Refactoring**: Suggest improvements and optimizations
5. **Documentation**: Generate comments and documentation
6. **Learning**: Explain programming concepts and best practices

When responding:
- Be concise but thorough
- Provide working code examples when appropriate
- Consider the context of the current file/project
- Suggest file paths and names for new components
- Use markdown formatting for better readability
- If suggesting code changes, be specific about where they should go

The user can share their current file content, selected text, or ask general programming questions.`;
}

async function sendChatMessage(event?: Event) {
  if (event) {
    event.preventDefault();
  }
  
  const textarea = document.getElementById('chat-textarea') as HTMLTextAreaElement;
  const includeContextCheckbox = document.getElementById('include-context') as HTMLInputElement;
  
  if (!textarea || !aiService || !textarea.value.trim() || isAILoading) {
    return;
  }
  
  const message = textarea.value.trim();
  const includeContext = includeContextCheckbox?.checked || false;
  
  // Character limit check (Claude has ~200k token limit, roughly 150k characters)
  const MAX_MESSAGE_LENGTH = 100000;
  if (message.length > MAX_MESSAGE_LENGTH) {
    writeToTerminal(`❌ Message too long! Maximum ${MAX_MESSAGE_LENGTH} characters. Current: ${message.length}`);
    return;
  }
  
  // Sanitize message to prevent JSON parsing issues
  const sanitizedMessage = message
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\u0000/g, ''); // Remove null characters
  
  // Add user message
  const userMessage = {
    id: Date.now().toString(),
    role: 'user' as const,
    content: sanitizedMessage,
    timestamp: new Date()
  };
  
  aiChatMessages.push(userMessage);
  textarea.value = '';
  adjustTextareaHeight();
  
  // Set loading state
  isAILoading = true;
  
  // Update messages and maintain layout
  updateChatMessages();
  updateLayoutForAIChat(); // Ensure layout stays consistent
  
  try {
    // Build context-aware message if needed
    let enhancedMessage = sanitizedMessage;
    if (includeContext) {
      const currentFile = monacoEditor?.getValue();
      const selectedText = monacoEditor?.getModel()?.getValueInRange(monacoEditor.getSelection());
      
      if (currentFile || selectedText || currentWorkingDirectory) {
        enhancedMessage += '\n\n**Context:**\n';
        if (currentWorkingDirectory) {
          enhancedMessage += `Project: ${currentWorkingDirectory}\n`;
        }
        if (activeTabPath) {
          enhancedMessage += `Current file: ${activeTabPath}\n`;
        }
        if (selectedText) {
          enhancedMessage += `Selected text:\n\`\`\`\n${selectedText.substring(0, 5000)}\n\`\`\`\n`; // Limit selected text
        }
        if (currentFile && !selectedText && currentFile.length < 10000) { // Only include full file if it's small
          enhancedMessage += `Full file content:\n\`\`\`\n${currentFile}\n\`\`\`\n`;
        } else if (currentFile && !selectedText) {
          enhancedMessage += `File is too large to include in full (${currentFile.length} characters). Please select specific code sections.\n`;
        }
      }
    }
    
    // Limit enhanced message size
    if (enhancedMessage.length > MAX_MESSAGE_LENGTH) {
      enhancedMessage = enhancedMessage.substring(0, MAX_MESSAGE_LENGTH - 100) + '\n\n[Message truncated due to length]';
    }
    
    // Send to AI service via IPC - limit message history to prevent overflow
    const messageForAI = { ...userMessage, content: enhancedMessage };
    const recentMessages = [...aiChatMessages.slice(-5), messageForAI]; // Keep only last 5 messages for context
    
    const response = await aiService.sendMessage(recentMessages, getSystemPrompt());
    
    // Convert timestamp string back to Date object
    response.timestamp = new Date(response.timestamp);
    aiChatMessages.push(response);
    
  } catch (error) {
    console.error('AI chat error:', error);
    
    let errorContent = 'Failed to get response';
    if (error instanceof Error) {
      if (error.message.includes('529') || error.message.includes('overloaded_error') || error.message.includes('Overloaded')) {
        errorContent = '🔄 Anthropic API is temporarily overloaded. Please try again in a few minutes.';
      } else if (error.message.includes('JSON') || error.message.includes('parse') || error.message.includes('Invalid')) {
        errorContent = '❌ Code contains characters that break the API. Try simplifying or removing special characters.';
      } else if (error.message.includes('too large') || error.message.includes('token')) {
        errorContent = 'Message too large for AI processing. Try a shorter message or break it into parts.';
      } else if (error.message.includes('rate limit')) {
        errorContent = 'Rate limit reached. Please wait before sending another message.';
      } else {
        errorContent = `Error: ${error.message}`;
      }
    }
    
    const errorMessage = {
      id: Date.now().toString(),
      role: 'assistant' as const,
      content: `❌ ${errorContent}`,
      timestamp: new Date()
    };
    aiChatMessages.push(errorMessage);
    writeToTerminal(`❌ AI Chat Error: ${errorContent}`);
    
  } finally {
    isAILoading = false;
    updateChatMessages();
    updateLayoutForAIChat(); // Ensure layout stays consistent after response
    
    // Scroll to bottom
    setTimeout(() => {
      const messagesContainer = document.getElementById('ai-chat-messages');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 100);
  }
}

function toggleQuickActions() {
  const quickActions = document.getElementById('quick-actions');
  if (quickActions) {
    quickActions.style.display = quickActions.style.display === 'none' ? 'block' : 'none';
  }
}

function sendQuickAction(action: string) {
  const actions: { [key: string]: string | (() => string | null) } = {
    explain: 'Please explain the current code and what it does.',
    bugs: 'Please review this code for potential bugs or issues.',
    optimize: 'Please suggest optimizations for this code.',
    comments: 'Please add appropriate comments to this code.',
    tests: 'Please create unit tests for this code.',
    component: () => {
      const componentName = prompt('What component would you like to create?');
      return componentName ? `Create a React component called ${componentName}` : null;
    }
  };
  
  const actionValue = actions[action];
  let message: string | null = null;
  
  if (typeof actionValue === 'function') {
    message = actionValue();
  } else {
    message = actionValue;
  }
  
  if (message) {
    const textarea = document.getElementById('chat-textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = message;
      
      // Check include context
      const includeContextCheckbox = document.getElementById('include-context') as HTMLInputElement;
      if (includeContextCheckbox) {
        includeContextCheckbox.checked = true;
      }
      
      // Hide quick actions
      toggleQuickActions();
      
      // Send message
      sendChatMessage();
    }
  }
}

function clearAIChat() {
  aiChatMessages = [];
  renderAIChat();
  writeToTerminal('🗑️ AI chat cleared');
}

function copyCodeToClipboard(encodedCode: string) {
  const code = decodeURIComponent(encodedCode);
  navigator.clipboard.writeText(code).then(() => {
    writeToTerminal('📋 Code copied to clipboard');
  });
}

function insertCodeIntoEditor(encodedCode: string) {
  const code = decodeURIComponent(encodedCode);
  if (monacoEditor) {
    const selection = monacoEditor.getSelection();
    const id = { major: 1, minor: 1 };
    const op = {
      identifier: id,
      range: selection,
      text: code,
      forceMoveMarkers: true
    };
    monacoEditor.executeEdits('ai-assistant', [op]);
    monacoEditor.focus();
    writeToTerminal('✅ Code inserted into editor');
  }
}

// Make functions globally available
(window as any).toggleAIChat = toggleAIChat;
(window as any).clearAIChat = clearAIChat;
(window as any).sendChatMessage = sendChatMessage;
(window as any).toggleQuickActions = toggleQuickActions;
(window as any).sendQuickAction = sendQuickAction;
(window as any).copyCodeToClipboard = copyCodeToClipboard;
(window as any).insertCodeIntoEditor = insertCodeIntoEditor;

// Project interface - only define once
interface Project {
  path: string;
  name: string;
  lastOpened: string;
}

// Simple project selection
function showProjectSelection() {
  const style = document.createElement('style');
  style.textContent = `
    .project-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background: rgba(0, 0, 0, 0.9) !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      z-index: 10000 !important;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
    }
    .project-modal {
      background: #252526 !important;
      border-radius: 8px !important;
      width: 500px !important;
      max-width: 90vw !important;
      border: 1px solid #3c3c3c !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
    }
    .project-header {
      background: #2d2d30 !important;
      padding: 20px !important;
      border-bottom: 1px solid #3c3c3c !important;
    }
    .project-header h2 { 
      margin: 0 !important; 
      color: #cccccc !important; 
      font-size: 18px !important;
      font-weight: 600 !important;
    }
    .project-content { 
      padding: 20px !important; 
    }
    .project-buttons { 
      display: flex !important; 
      gap: 10px !important; 
      margin-bottom: 20px !important; 
    }
    .project-btn {
      flex: 1 !important;
      padding: 12px 16px !important;
      border: none !important;
      border-radius: 4px !important;
      cursor: pointer !important;
      font-size: 14px !important;
      font-family: inherit !important;
      transition: background-color 0.2s !important;
    }
    .project-btn.primary { 
      background: #0e639c !important; 
      color: white !important; 
    }
    .project-btn.primary:hover { 
      background: #1177bb !important; 
    }
    .project-btn.secondary { 
      background: #3c3c3c !important; 
      color: #cccccc !important; 
      border: 1px solid #555 !important; 
    }
    .project-btn.secondary:hover { 
      background: #4c4c4c !important; 
    }
    .project-info { 
      color: #888 !important; 
      text-align: center !important; 
      font-size: 14px !important; 
      line-height: 1.4 !important;
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'project-overlay';
  overlay.innerHTML = `
    <div class="project-modal">
      <div class="project-header">
        <h2>🚀 Select Project Directory</h2>
      </div>
      <div class="project-content">
        <div class="project-buttons">
          <button id="browse-btn" class="project-btn primary">📁 Browse for Project</button>
          <button id="current-btn" class="project-btn secondary">📂 Use Current Directory</button>
        </div>
        <div class="project-info">Choose a directory to work with. This will be your project root for the AI assistant context.</div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);

  document.getElementById('browse-btn')?.addEventListener('click', async () => {
    try {
      const path = await (window as any).electronAPI?.selectProjectDirectory?.();
      if (path) await setProject(path);
    } catch (error) {
      console.error('Browse error:', error);
      await setProject(currentWorkingDirectory);
    }
  });

  document.getElementById('current-btn')?.addEventListener('click', async () => {
    try {
      const path = await (window as any).electronAPI?.getCurrentDirectory?.() || currentWorkingDirectory;
      await setProject(path);
    } catch (error) {
      console.error('Current dir error:', error);
      await setProject(currentWorkingDirectory);
    }
  });
}

async function setProject(projectPath: string) {
  try {
    // Save to recent projects
    if ((window as any).electronAPI?.saveRecentProject) {
      await (window as any).electronAPI.saveRecentProject(projectPath);
    }
    
    // Set working directory
    if ((window as any).electronAPI?.setCurrentDirectory) {
      const result = await (window as any).electronAPI.setCurrentDirectory(projectPath);
      if (result?.success) {
        currentWorkingDirectory = projectPath;
      }
    } else {
      currentWorkingDirectory = projectPath;
    }
    
    console.log(`📁 Project set to: ${projectPath}`);
    
    // Remove overlay
    const overlay = document.querySelector('.project-overlay');
    if (overlay) {
      overlay.remove();
    }
    
    showProjectSelector = false;
    
    // Continue with normal initialization
    await initializeEverything();
    
  } catch (error) {
    console.error('Project setup error:', error);
    // Remove overlay and continue anyway
    const overlay = document.querySelector('.project-overlay');
    if (overlay) {
      overlay.remove();
    }
    showProjectSelector = false;
    await initializeEverything();
  }
}

async function initializeEverything() {
  createLayout();
  setupCommandStreaming();
  await initializeMonaco();
  await renderFileTree();
  setupTerminalResize();
  initializeTerminal();
  setupAutoSave();
  await initializeAIService();
  renderAIChat(); // Add this line
  
  console.log('✅ IDE initialization complete');
}

console.log('aiChatVisible:', aiChatVisible);
console.log('aiChatPanel:', document.getElementById('ai-chat-panel'));
console.log('aiChatPanel style:', document.getElementById('ai-chat-panel')?.style.display);

function setupAIChatResize() {
  const resizeHandle = document.getElementById('ai-chat-resize-handle');
  if (!resizeHandle) return;

  let startX = 0;
  let startWidth = 0;

  resizeHandle.addEventListener('mousedown', (e) => {
    if (!resizeHandle) return; // Add this null check
    
    e.preventDefault();
    isAIChatResizing = true;
    startX = e.clientX;
    startWidth = aiChatWidth;
    
    document.body.classList.add('ai-chat-resizing');
    resizeHandle.classList.add('dragging');
    
    // Add global mouse event listeners
    document.addEventListener('mousemove', handleAIChatMouseMove);
    document.addEventListener('mouseup', handleAIChatMouseUp);
  });

  function handleAIChatMouseMove(e: MouseEvent) {
    if (!isAIChatResizing) return;
    
    e.preventDefault();
    const deltaX = startX - e.clientX; // Inverted because we want drag left to increase width
    const newWidth = Math.max(280, Math.min(800, startWidth + deltaX)); // Min 280px, max 800px
    
    setAIChatWidth(newWidth);
  }

  function handleAIChatMouseUp(e: MouseEvent) {
    if (!isAIChatResizing || !resizeHandle) return; // Add null check here too
    
    e.preventDefault();
    isAIChatResizing = false;
    
    document.body.classList.remove('ai-chat-resizing');
    resizeHandle.classList.remove('dragging');
    
    // Remove global mouse event listeners
    document.removeEventListener('mousemove', handleAIChatMouseMove);
    document.removeEventListener('mouseup', handleAIChatMouseUp);
    
    // Force Monaco to resize after drag is complete
    setTimeout(() => {
      monacoEditor?.layout();
    }, 10);
  }
}

function setAIChatWidth(width: number) {
  aiChatWidth = width;
  const aiChatPanel = document.getElementById('ai-chat-panel');
  const mainIde = document.getElementById('main-ide');
  
  if (aiChatPanel && mainIde && aiChatVisible) {
    aiChatPanel.style.width = `${width}px`;
    aiChatPanel.style.minWidth = `${width}px`;
    aiChatPanel.style.maxWidth = `${width}px`;
    
    mainIde.style.width = `calc(100% - ${width}px)`;
    
    // Update any width-dependent elements
    const container = aiChatPanel.querySelector('.ai-chat-container') as HTMLElement;
    if (container) {
      container.style.width = `${width}px`;
    }
  }
  
  // Trigger Monaco layout update
  if (monacoEditor) {
    monacoEditor.layout();
  }
  
  console.log(`AI Chat width set to: ${width}px`);
}
