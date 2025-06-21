import { app, BrowserWindow, ipcMain, desktopCapturer, screen, shell, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Add interface for Anthropic API response
interface AnthropicResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  id: string;
  model: string;
  role: string;
  stop_reason: string;
  stop_sequence: null;
  type: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Add this interface near the top of the file, after the AnthropicResponse interface
interface Project {
  path: string;
  name: string;
  lastOpened: string;
}

// Add streaming interface for tokens
interface StreamingToken {
  type: 'content_block_delta' | 'content_block_start' | 'content_block_stop' | 'message_start' | 'message_delta' | 'message_stop' | 'ping';
  index?: number;
  delta?: {
    type: 'text_delta';
    text: string;
  };
  content_block?: {
    type: 'text';
    text: string;
  };
}

// Add this new interface for enhanced file operations
interface FileCreationRequest {
  path: string;
  content: string;
  createDirectories?: boolean;
  overwrite?: boolean;
}

interface FileCreationResponse {
  success: boolean;
  path?: string;
  created?: boolean;
  error?: string;
  parentDirectories?: string[];
}

let mainWindow: BrowserWindow | null;
let terminalProcess: ChildProcess | null = null;
let runningProcesses: Map<string, ChildProcess> = new Map(); // Track running processes

// Global working directory tracking for terminal sessions
let terminalWorkingDirectories = new Map<string, string>();

// Add these new imports for speech recognition
let isRecording = false;
let audioProcess: ChildProcess | null = null;
let currentRecordingPath: string | null = null;

// Add this near the top with other Maps
const interactiveProcesses = new Map<string, ChildProcess>();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (terminalProcess) {
      terminalProcess.kill();
      terminalProcess = null;
    }
  });
}

// File system operations
ipcMain.handle('get-directory-contents', async (event, directoryPath?: string) => {
  try {
    const targetPath = directoryPath || process.cwd();
    const items = await fs.promises.readdir(targetPath, { withFileTypes: true });
    const files = await Promise.all(
      items.map(async (item) => {
        const fullPath = path.join(targetPath, item.name);
        return {
          name: item.name,
          path: fullPath,
          type: item.isDirectory() ? 'directory' : 'file'
        };
      })
    );
    return files;
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
});

ipcMain.handle('read-file', async (event, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading file:', error);
    return null;
  }
});

// Execute single commands with enhanced cd and file operations support
ipcMain.handle('execute-command', async (event, command: string, workingDir?: string, terminalId?: string) => {
  try {
    return new Promise((resolve) => {
      let currentWorkingDir = workingDir || process.cwd();
      
      console.log(`🔧 Executing command: "${command}"`);
      console.log(`🔧 Working dir passed: ${workingDir}`);
      console.log(`🔧 Terminal ID: ${terminalId}`);
      console.log(`🔧 Current working dir: ${currentWorkingDir}`);
      
      // Use terminal-specific working directory if available
      if (terminalId && terminalWorkingDirectories.has(terminalId)) {
        currentWorkingDir = terminalWorkingDirectories.get(terminalId)!;
        console.log(`🔧 Using terminal-specific working dir: ${currentWorkingDir}`);
      }

      const trimmedCommand = command.trim();

      // Handle cd command specially for proper directory navigation
      if (trimmedCommand.startsWith('cd ')) {
        const cdPath = trimmedCommand.substring(3).trim();
        let targetPath: string;
        
        console.log(`🔧 CD command detected, path: "${cdPath}"`);
        
        if (path.isAbsolute(cdPath)) {
          targetPath = cdPath;
        } else if (cdPath === '..') {
          targetPath = path.dirname(currentWorkingDir);
        } else if (cdPath === '~' || cdPath === '') {
          targetPath = os.homedir();
        } else {
          targetPath = path.resolve(currentWorkingDir, cdPath);
        }
        
        console.log(`🔧 Target path resolved to: ${targetPath}`);
        
        // Validate directory exists and is accessible
        try {
          const stats = fs.statSync(targetPath);
          if (!stats.isDirectory()) {
            resolve({
              success: false,
              output: `cd: not a directory: ${cdPath}`,
              code: 1,
              workingDir: currentWorkingDir
            });
            return;
          }
          
          // Update working directory for this terminal
          if (terminalId) {
            terminalWorkingDirectories.set(terminalId, targetPath);
            console.log(`🔧 Updated terminal ${terminalId} working dir to: ${targetPath}`);
          }
          
          resolve({
            success: true,
            output: `Changed directory to ${targetPath}`,
            code: 0,
            workingDir: targetPath
          });
        } catch (err) {
          resolve({
            success: false,
            output: `cd: no such file or directory: ${cdPath}`,
            code: 1,
            workingDir: currentWorkingDir
          });
        }
        return;
      }

      // Handle pwd command
      if (trimmedCommand === 'pwd') {
        resolve({
          success: true,
          output: currentWorkingDir,
          code: 0,
          workingDir: currentWorkingDir
        });
        return;
      }

      // Handle mkdir command for directory creation
      if (trimmedCommand.startsWith('mkdir ')) {
        const dirName = trimmedCommand.substring(6).trim();
        const targetPath = path.resolve(currentWorkingDir, dirName);
        
        try {
          fs.mkdirSync(targetPath, { recursive: true });
          // Notify renderer to refresh file tree
          mainWindow?.webContents.send('file-system-changed', { 
            type: 'mkdir', 
            path: targetPath,
            parentPath: currentWorkingDir
          });
          resolve({
            success: true,
            output: `Directory created: ${dirName}`,
            code: 0,
            workingDir: currentWorkingDir
          });
        } catch (err: any) {
          resolve({
            success: false,
            output: `mkdir: ${err.message}`,
            code: 1,
            workingDir: currentWorkingDir
          });
        }
        return;
      }

      // Handle touch command for file creation
      if (trimmedCommand.startsWith('touch ')) {
        const fileName = trimmedCommand.substring(6).trim();
        const targetPath = path.resolve(currentWorkingDir, fileName);
        
        try {
          fs.writeFileSync(targetPath, '');
          // Notify renderer to refresh file tree
          mainWindow?.webContents.send('file-system-changed', { 
            type: 'touch', 
            path: targetPath,
            parentPath: currentWorkingDir
          });
          resolve({
            success: true,
            output: `File created: ${fileName}`,
            code: 0,
            workingDir: currentWorkingDir
          });
        } catch (err: any) {
          resolve({
            success: false,
            output: `touch: ${err.message}`,
            code: 1,
            workingDir: currentWorkingDir
          });
        }
        return;
      }

      // Enhanced ls command with proper formatting
      if (trimmedCommand === 'ls' || trimmedCommand.startsWith('ls ')) {
        const args = trimmedCommand.split(' ').slice(1);
        const showHidden = args.includes('-a') || args.includes('-la') || args.includes('-al');
        const longFormat = args.includes('-l') || args.includes('-la') || args.includes('-al');
        
        try {
          const files = fs.readdirSync(currentWorkingDir);
          let output = '';
          let filteredFiles = showHidden ? files : files.filter(f => !f.startsWith('.'));
          
          if (longFormat) {
            for (const file of filteredFiles) {
              const filePath = path.join(currentWorkingDir, file);
              try {
                const stats = fs.statSync(filePath);
                const isDir = stats.isDirectory();
                const size = stats.size;
                const modified = stats.mtime.toLocaleDateString();
                const permissions = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
                output += `${permissions}  1 user user ${size.toString().padStart(8)} ${modified} ${file}\n`;
              } catch (e) {
                output += `?????????? ?? ???? ???? ???????? ???????? ${file}\n`;
              }
            }
          } else {
            output = filteredFiles.join('  ') + '\n';
          }

          resolve({
            success: true,
            output: output,
            code: 0,
            workingDir: currentWorkingDir
          });
        } catch (err) {
          resolve({
            success: false,
            output: `ls: ${(err as Error).message}`,
            code: 1,
            workingDir: currentWorkingDir
          });
        }
        return;
      }

      // For all other commands, execute in the current working directory
      const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash';
      const args = os.platform() === 'win32' ? ['/c', command] : ['-c', command];
      
      console.log(`Executing command: ${command} in directory: ${currentWorkingDir}`);
      
      const childProcess = spawn(shell, args, {
        cwd: currentWorkingDir,
        env: {
          ...process.env,
          FORCE_COLOR: '1',
          NODE_ENV: process.env.NODE_ENV || 'development',
          // Add npm/yarn specific environment variables
          npm_config_progress: 'true',
          npm_config_color: 'always',
          CI: 'false', // Disable CI mode to ensure interactive behavior
          NO_UPDATE_NOTIFIER: 'true', // Disable update notifications that can interfere
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Check if this is a long-running process
      const isLongRunning = command.includes('dev') || command.includes('start') || command.includes('serve') ||
                           command.includes('watch') || command.startsWith('node ') ||
                           // Add package installation commands
                           command.startsWith('npm install') || command.startsWith('npm i ') ||
                           command.startsWith('yarn install') || command.startsWith('yarn add') ||
                           command.startsWith('pnpm install') || command.startsWith('pnpm add') ||
                           command.startsWith('npx create-') || command.includes('create-next-app') ||
                           command.includes('create-react-app') || command.includes('create-vite');
      
      // Track long-running processes
      if (isLongRunning) {
        const processId = `${Date.now()}-${Math.random()}`;
        runningProcesses.set(processId, childProcess);
        interactiveProcesses.set(processId, childProcess);
        
        // Send process ID to renderer for tracking
        mainWindow?.webContents.send('process-started', { 
          id: processId, 
          command: command,
          isInteractive: true
        });
        
        // Clean up when process ends
        childProcess.on('close', (code) => {
          runningProcesses.delete(processId);
          interactiveProcesses.delete(processId);
          mainWindow?.webContents.send('process-ended', { id: processId });
        });
        
        childProcess.on('error', (error) => {
          console.error('Process error:', error);
          runningProcesses.delete(processId);
          interactiveProcesses.delete(processId);
          mainWindow?.webContents.send('process-ended', { id: processId });
        });
      }

      let output = '';
      let error = '';
      let hasInitialOutput = false;

      // Handle stdout
      childProcess.stdout?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        hasInitialOutput = true;
        
        // For long-running processes, stream output immediately
        if (isLongRunning) {
          mainWindow?.webContents.send('command-output-stream', chunk);
        }
      });

      // Handle stderr
      childProcess.stderr?.on('data', (data) => {
        const chunk = data.toString();
        error += chunk;
        hasInitialOutput = true;
        
        // For long-running processes, stream error output too
        if (isLongRunning) {
          mainWindow?.webContents.send('command-output-stream', chunk);
        }
      });

      // Handle process completion
      childProcess.on('close', (code) => {
        console.log(`Command completed with code: ${code}`);
        resolve({
          success: code === 0,
          output: output + error,
          code,
          workingDir: currentWorkingDir,
          isLongRunning: false // Mark as completed
        });
      });

      // Handle process errors
      childProcess.on('error', (err) => {
        console.error('Process spawn error:', err);
        resolve({
          success: false,
          output: `Error: ${err.message}`,
          code: -1,
          workingDir: currentWorkingDir
        });
      });

      // For long-running processes, resolve early with partial success
      if (isLongRunning) {
        setTimeout(() => {
          if (hasInitialOutput || childProcess.pid) {
            // Don't resolve here for long-running processes - let them continue
            console.log(`Long-running process started: ${command}`);
          } else {
            // If no output after 5 seconds, might be an error
            resolve({
              success: false,
              output: 'Process started but no output received',
              code: -1,
              workingDir: currentWorkingDir
            });
          }
        }, 5000);
      }
    });
  } catch (error) {
    return {
      success: false,
      output: `Error: ${(error as Error).message}`,
      code: -1,
      workingDir: workingDir || process.cwd()
    };
  }
});

// Add this new IPC handler after the existing execute-command handler
ipcMain.handle('execute-git-command', async (event, command: string) => {
  try {
    return new Promise((resolve) => {
      const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash';
      const args = os.platform() === 'win32' ? ['/c', `git ${command}`] : ['-c', `git ${command}`];
      
      console.log(`Executing git command: git ${command}`);
      
      const childProcess = spawn(shell, args, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          FORCE_COLOR: '0' // Disable colors for cleaner parsing
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let error = '';

      childProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      childProcess.stderr?.on('data', (data) => {
        error += data.toString();
      });

      childProcess.on('close', (code) => {
        resolve({
          success: code === 0,
          output: output + error,
          code
        });
      });

      childProcess.on('error', (err) => {
        resolve({
          success: false,
          output: `Error: ${err.message}`,
          code: -1
        });
      });
    });
  } catch (error) {
    return {
      success: false,
      output: `Error: ${(error as Error).message}`,
      code: -1
    };
  }
});

// Initialize terminal working directory
ipcMain.handle('init-terminal-working-dir', async (event, terminalId: string, workingDir: string) => {
  console.log(`Initializing terminal ${terminalId} working directory to: ${workingDir}`);
  terminalWorkingDirectories.set(terminalId, workingDir);
  return { success: true };
});

// Get terminal working directory
ipcMain.handle('get-terminal-working-dir', async (event, terminalId: string) => {
  return terminalWorkingDirectories.get(terminalId) || process.cwd();
});

// Persistent terminal operations
ipcMain.handle('create-terminal', async (event) => {
  try {
    console.log('Creating terminal process...');
    
    if (terminalProcess) {
      console.log('Killing existing terminal process');
      terminalProcess.kill();
    }

    // Determine the correct shell
    let shell: string;
    let args: string[] = [];
    
    if (os.platform() === 'win32') {
      shell = 'cmd.exe';
    } else {
      // Try to find the user's shell
      shell = process.env.SHELL || '/bin/zsh';
      args = ['-i']; // Interactive shell
    }
    
    console.log(`Starting shell: ${shell} with args:`, args);
    
    terminalProcess = spawn(shell, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        SHELL: shell
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    console.log('Terminal process spawned, PID:', terminalProcess.pid);

    // Send terminal output to renderer
    terminalProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('Terminal stdout:', output);
      mainWindow?.webContents.send('terminal-output', output);
    });

    terminalProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      console.log('Terminal stderr:', output);
      mainWindow?.webContents.send('terminal-output', output);
    });

    terminalProcess.on('close', (code) => {
      console.log('Terminal process closed with code:', code);
      mainWindow?.webContents.send('terminal-closed', code);
      terminalProcess = null;
    });

    terminalProcess.on('error', (error) => {
      console.error('Terminal process error:', error);
      mainWindow?.webContents.send('terminal-output', `Error: ${error.message}\n`);
    });

    // Send a welcome message
    setTimeout(() => {
      mainWindow?.webContents.send('terminal-output', `Welcome to terminal! (PID: ${terminalProcess?.pid})\n`);
    }, 100);

    return { success: true };
  } catch (error) {
    console.error('Failed to create terminal:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('write-terminal', async (event, data: string) => {
  console.log('Writing to terminal:', JSON.stringify(data));
  
  if (terminalProcess && terminalProcess.stdin) {
    try {
      terminalProcess.stdin.write(data);
      console.log('Successfully wrote to terminal');
      return { success: true };
    } catch (error) {
      console.error('Error writing to terminal:', error);
      return { success: false, error: (error as Error).message };
    }
  }
  
  console.log('Terminal not available for writing');
  return { success: false, error: 'Terminal not available' };
});

ipcMain.handle('kill-terminal', async (event) => {
  if (terminalProcess) {
    terminalProcess.kill();
    terminalProcess = null;
    return { success: true };
  }
  return { success: false };
});

// Screen capture operations
ipcMain.handle('get-sources', async () => {
  try {
    const inputSources = await desktopCapturer.getSources({
      types: ['window', 'screen']
    });
    return inputSources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }));
  } catch (error) {
    console.error('Error getting sources:', error);
    return [];
  }
});

ipcMain.handle('get-screen-info', async () => {
  try {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    
    return {
      displays: displays.map(display => ({
        id: display.id,
        bounds: display.bounds,
        workArea: display.workArea,
        scaleFactor: display.scaleFactor,
        isPrimary: display.id === primaryDisplay.id
      })),
      primaryDisplay: {
        id: primaryDisplay.id,
        bounds: primaryDisplay.bounds,
        workArea: primaryDisplay.workArea,
        scaleFactor: primaryDisplay.scaleFactor
      }
    };
  } catch (error) {
    console.error('Error getting screen info:', error);
    return null;
  }
});

// Get current working directory
ipcMain.handle('get-current-directory', async () => {
  try {
    return process.cwd();
  } catch (error) {
    console.error('Error getting current directory:', error);
    return null;
  }
});

// Open external URLs
ipcMain.handle('open-external', async (event, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open external URL:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Write file operation
ipcMain.handle('write-file', async (event, filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    console.log(`File saved: ${filePath}`);
    return { success: true };
  } catch (error) {
    console.error('Error writing file:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Kill running process
ipcMain.handle('kill-process', async (event, processId?: string) => {
  try {
    if (processId) {
      // Kill specific process
      const process = runningProcesses.get(processId);
      if (process) {
        process.kill('SIGINT'); // Send Ctrl+C signal
        runningProcesses.delete(processId);
        console.log(`Killed process: ${processId}`);
        return { success: true, message: `Process ${processId} terminated` };
      } else {
        return { success: false, error: 'Process not found' };
      }
    } else {
      // Kill all running processes
      let killed = 0;
      runningProcesses.forEach((process, id) => {
        process.kill('SIGINT');
        killed++;
      });
      runningProcesses.clear();
      console.log(`Killed ${killed} processes`);
      return { success: true, message: `Terminated ${killed} processes` };
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// Update the complex query detection to be more conservative
function isComplexQuery(messages: any[]): boolean {
  const lastMessage = messages[messages.length - 1]?.content || '';
  const totalContextLength = messages.reduce((total, msg) => total + (msg.content?.length || 0), 0);
  
  // Only use chunking for really complex scenarios
  const isVeryLongContext = totalContextLength > 25000; // Increased threshold
  const isVeryDetailedQuery = lastMessage.length > 5000; // Increased threshold
  const hasManyCodeBlocks = (lastMessage.match(/```/g) || []).length > 6; // Increased threshold
  const hasVeryComplexPatterns = /comprehensive|detailed analysis|full review|complete explanation|step by step|thoroughly|in depth/i.test(lastMessage);
  
  // Be more selective about when to chunk
  return isVeryLongContext || isVeryDetailedQuery || (hasManyCodeBlocks && hasVeryComplexPatterns);
}

function prepareChunkedContext(messages: any[], isFollowup: boolean = false): any[] {
  if (isFollowup) {
    // For follow-up requests, keep more recent context
    return messages.slice(-3); // Increased from -2 to -3
  }
  
  // For initial complex queries, keep more context but still truncate very long messages
  const recent = messages.slice(-6); // Increased from -4 to -6
  return recent.map(msg => ({
    ...msg,
    content: msg.content.length > 4000 ? // Increased from 2000 to 4000
      msg.content.substring(0, 4000) + '...\n[Content truncated for processing]' : 
      msg.content
  }));
}

// Update the callAnthropicAPI function to handle much longer responses
async function callAnthropicAPI(messages: any[], systemPrompt: string, options: any = {}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not found in environment variables');
  }

  const {
    maxTokens = 16384, // Increased from 8192 to 16384
    timeout = 120000   // Increased from 60000 to 120000 (2 minutes)
  } = options;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages.filter((m: any) => m.role !== 'system').map((m: any) => ({
        role: m.role,
        content: m.content
      })),
      temperature: 0.7,
      top_p: 0.9,
    }),
    signal: AbortSignal.timeout(timeout)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const data = await response.json() as AnthropicResponse;
  
  if (!data.content || !data.content[0] || !data.content[0].text) {
    throw new Error('Incomplete response from Anthropic API');
  }
  
  return data.content[0].text;
}

// Update the main anthropic-api-call handler with much larger token limits
ipcMain.handle('anthropic-api-call', async (event, messages, systemPrompt) => {
  try {
    console.log(`Anthropic API call - ${messages.length} messages`);
    
    // Check if this query needs chunking - make the threshold higher
    if (isComplexQuery(messages)) {
      console.log('Complex query detected, using chunked approach with high token limits');
      
      // Notify renderer about chunked processing
      mainWindow?.webContents.send('ai-chunked-start', { totalChunks: 3 });
      
      let fullResponse = '';
      let chunkNumber = 1;
      const maxChunks = 4; // Increased from 3 to 4
      
      while (chunkNumber <= maxChunks) {
        console.log(`Processing chunk ${chunkNumber}/${maxChunks}`);
        
        // Notify renderer of progress
        mainWindow?.webContents.send('ai-chunked-progress', { 
          currentChunk: chunkNumber, 
          totalChunks: maxChunks 
        });
        
        // Prepare context for this chunk
        let processedMessages;
        let chunkSystemPrompt = systemPrompt;
        
        if (chunkNumber === 1) {
          // First chunk: use prepared context with larger token limit
          processedMessages = prepareChunkedContext(messages, false);
          chunkSystemPrompt += '\n\nIMPORTANT: This is a complex query that may require multiple parts. Provide a comprehensive response. If you need to continue, end with an incomplete thought that can be naturally continued.';
        } else {
          // Follow-up chunks: use minimal context + continuation
          processedMessages = prepareChunkedContext(messages, true);
          const continuationPrompt = `Continue your previous response. You were in the middle of: "${fullResponse.slice(-500)}"`;
          processedMessages.push({
            role: 'user',
            content: continuationPrompt
          });
          chunkSystemPrompt += '\n\nIMPORTANT: Continue seamlessly from where your previous response ended. Pick up the exact thread of thought and continue naturally.';
        }
        
        try {
          const chunkResponse = await callAnthropicAPI(processedMessages, chunkSystemPrompt, {
            maxTokens: chunkNumber === 1 ? 16384 : 12288, // Very large for first chunk, large for subsequent
            timeout: 180000 // 3 minutes per chunk
          });
          
          fullResponse += (chunkNumber > 1 ? '\n\n' : '') + chunkResponse;
          
          // More sophisticated completion detection
          const responseLength = chunkResponse.length;
          const seemsComplete = 
            responseLength < 8000 || // Much higher threshold
            (chunkResponse.endsWith('.') && responseLength < 12000) ||
            chunkResponse.endsWith('```') ||
            chunkResponse.includes('In summary') ||
            chunkResponse.includes('In conclusion') ||
            chunkResponse.includes('To summarize') ||
            chunkResponse.includes('That covers') ||
            chunkResponse.includes('These are the main') ||
            (chunkNumber >= 3 && responseLength < 10000); // Force completion after 3 chunks if reasonably sized
          
          if (seemsComplete) {
            console.log(`Response complete at chunk ${chunkNumber} (${responseLength} chars)`);
            break;
          }
          
          // Add delay between chunks to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
          chunkNumber++;
          
        } catch (chunkError) {
          console.error(`Error in chunk ${chunkNumber}:`, chunkError);
          const errorMessage = chunkError instanceof Error ? chunkError.message : 'Unknown error';
          
          if (chunkNumber === 1) {
            mainWindow?.webContents.send('ai-chunked-error', { error: errorMessage });
            throw chunkError; // If first chunk fails, propagate the error
          }
          // If later chunk fails, return what we have
          fullResponse += '\n\n*[Response continues but additional content unavailable due to processing constraints]*';
          break;
        }
      }
      
      // Notify renderer that chunked processing is complete
      mainWindow?.webContents.send('ai-chunked-complete', { 
        totalChunks: chunkNumber,
        wasCompleted: chunkNumber <= maxChunks
      });
      
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date().toISOString(),
        metadata: {
          wasChunked: true,
          totalChunks: chunkNumber,
          isComplete: true,
          totalLength: fullResponse.length
        }
      };
    }
    
    // For simple queries, use much larger token limits
    console.log('Simple query, using direct approach with high token limit');
    const responseText = await callAnthropicAPI(messages, systemPrompt, {
      maxTokens: 16384, // Much higher for simple queries too
      timeout: 120000   // 2 minutes
    });
    
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Anthropic API Error:', error);
    throw error;
  }
});

// Also update the streaming API handler with higher token limits
ipcMain.handle('anthropic-api-call-stream', async (event, messages, systemPrompt) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not found in environment variables');
  }
  
  try {
    console.log(`Anthropic Streaming API call - ${messages.length} messages`);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16384, // Increased from 8192
        system: systemPrompt,
        messages: messages.filter((m: any) => m.role !== 'system').map((m: any) => ({
          role: m.role,
          content: m.content
        })),
        temperature: 0.7,
        top_p: 0.9,
        stream: true,
      }),
      signal: AbortSignal.timeout(180000) // Increased from 60000 to 180000 (3 minutes)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    if (!response.body) {
      throw new Error('No response body for streaming');
    }
    
    // Generate unique session ID for this stream
    const sessionId = Date.now().toString();
    
    // Send stream start event
    mainWindow?.webContents.send('ai-stream-start', { sessionId });
    
    // Process the streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Send stream end event
          mainWindow?.webContents.send('ai-stream-end', { sessionId });
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove 'data: ' prefix
            
            if (data === '[DONE]') {
              mainWindow?.webContents.send('ai-stream-end', { sessionId });
              return { success: true, sessionId };
            }
            
            try {
              const parsed: StreamingToken = JSON.parse(data);
              
              // Handle different event types
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                // Send token to renderer
                mainWindow?.webContents.send('ai-stream-token', {
                  sessionId,
                  token: parsed.delta.text,
                  type: 'text'
                });
              } else if (parsed.type === 'content_block_start' && parsed.content_block?.text) {
                // Initial content block
                mainWindow?.webContents.send('ai-stream-token', {
                  sessionId,
                  token: parsed.content_block.text,
                  type: 'text'
                });
              }
            } catch (parseError) {
              console.log('Failed to parse streaming data:', data);
              // Continue processing other lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    
    return { success: true, sessionId };
    
  } catch (error) {
    console.error('Anthropic Streaming API Error:', error);
    // Send error to renderer
    mainWindow?.webContents.send('ai-stream-error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
});

// Project management handlers
ipcMain.handle('set-current-directory', async (event, directoryPath: string) => {
  try {
    process.chdir(directoryPath);
    return { success: true, currentDirectory: process.cwd() };
  } catch (error) {
    console.error('Error setting current directory:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('select-project-directory', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Select Project Directory'
    }) as { canceled: boolean; filePaths: string[] };
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  } catch (error) {
    console.error('Error selecting project directory:', error);
    return null;
  }
});

ipcMain.handle('get-recent-projects', async (): Promise<Project[]> => {
  try {
    const userDataPath = app.getPath('userData');
    const recentProjectsPath = path.join(userDataPath, 'recent-projects.json');
    
    const data = await fs.promises.readFile(recentProjectsPath, 'utf-8');
    return JSON.parse(data) as Project[];
  } catch (error) {
    // File doesn't exist or error reading, return empty array
    return [];
  }
});

ipcMain.handle('save-recent-project', async (event, projectPath: string) => {
  try {
    const userDataPath = app.getPath('userData');
    const recentProjectsPath = path.join(userDataPath, 'recent-projects.json');
    
    let recentProjects: Project[] = [];
    try {
      const data = await fs.promises.readFile(recentProjectsPath, 'utf-8');
      recentProjects = JSON.parse(data) as Project[];
    } catch (error) {
      // File doesn't exist, start with empty array
    }
    
    // Remove if already exists
    recentProjects = recentProjects.filter((p: Project) => p.path !== projectPath);
    
    // Add to beginning
    recentProjects.unshift({
      path: projectPath,
      name: path.basename(projectPath),
      lastOpened: new Date().toISOString()
    });
    
    // Keep only last 10 projects
    recentProjects = recentProjects.slice(0, 10);
    
    await fs.promises.writeFile(recentProjectsPath, JSON.stringify(recentProjects, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving recent project:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Start audio recording
ipcMain.handle('start-recording', async (event) => {
  try {
    if (isRecording) {
      return { success: false, error: 'Already recording' };
    }

    console.log('🎤 Starting audio recording...');
    
    // Create temp directory for recordings
    const tempDir = path.join(os.tmpdir(), 'whisper-recordings');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `recording-${timestamp}.wav`;
    currentRecordingPath = path.join(tempDir, filename);
    
    // Use different recording commands based on platform
    let recordCommand: string;
    let recordArgs: string[];
    
    if (os.platform() === 'darwin') {
      // macOS - use sox (you might need to install with: brew install sox)
      recordCommand = 'sox';
      recordArgs = [
        '-t', 'coreaudio', 'default', // Input from default audio device
        '-r', '16000', // Sample rate 16kHz (required by Whisper)
        '-c', '1', // Mono
        '-b', '16', // 16-bit
        currentRecordingPath
      ];
    } else if (os.platform() === 'linux') {
      // Linux - use arecord
      recordCommand = 'arecord';
      recordArgs = [
        '-f', 'S16_LE', // 16-bit little-endian
        '-r', '16000', // Sample rate 16kHz
        '-c', '1', // Mono
        '-t', 'wav', // WAV format
        currentRecordingPath
      ];
    } else {
      // Windows - use SoX or fallback
      recordCommand = 'sox';
      recordArgs = [
        '-t', 'waveaudio', 'default',
        '-r', '16000',
        '-c', '1',
        '-b', '16',
        currentRecordingPath
      ];
    }
    
    console.log(`🎤 Recording command: ${recordCommand} ${recordArgs.join(' ')}`);
    
    audioProcess = spawn(recordCommand, recordArgs);
    
    audioProcess.on('error', (error) => {
      console.error('🎤 Recording error:', error);
      isRecording = false;
      audioProcess = null;
      mainWindow?.webContents.send('recording-state-changed', { 
        isRecording: false, 
        error: `Recording failed: ${error.message}. Make sure audio recording tools are installed.` 
      });
    });
    
    audioProcess.on('close', (code) => {
      console.log(`🎤 Recording process closed with code: ${code}`);
      isRecording = false;
      audioProcess = null;
      mainWindow?.webContents.send('recording-state-changed', { isRecording: false });
    });
    
    isRecording = true;
    mainWindow?.webContents.send('recording-state-changed', { isRecording: true });
    
    console.log('✅ Recording started successfully');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Failed to start recording:', error);
    isRecording = false;
    audioProcess = null;
    return { success: false, error: (error as Error).message };
  }
});

// Stop audio recording
ipcMain.handle('stop-recording', async (event) => {
  try {
    if (!isRecording || !audioProcess) {
      return { success: false, error: 'Not currently recording' };
    }
    
    console.log('🎤 Stopping audio recording...');
    
    // Send SIGINT to gracefully stop recording
    audioProcess.kill('SIGINT');
    
    // Wait a moment for the process to close
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Recording stopped');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Failed to stop recording:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Transcribe audio using Whisper
ipcMain.handle('transcribe-audio', async (event, audioFilePath?: string) => {
  try {
    const targetPath = audioFilePath || currentRecordingPath;
    
    if (!targetPath || !fs.existsSync(targetPath)) {
      return { success: false, error: 'No audio file found to transcribe' };
    }
    
    console.log('🎤 Transcribing audio file:', targetPath);
    
    // Dynamically import nodejs-whisper
    const { nodewhisper } = await import('nodejs-whisper');
    
    const result = await nodewhisper(targetPath, {
      modelName: 'base.en', // Fast, good quality model
      whisperOptions: {
        outputInJson: false,
        outputInText: true,
        wordTimestamps: false, // Disable word timestamps
        translateToEnglish: false,
        language: 'auto'
      }
    });
    
    // Extract text from result with proper typing and timestamp cleaning
    let transcription = '';
    if (Array.isArray(result)) {
      transcription = result.map((segment: any) => {
        if (typeof segment === 'string') return segment;
        if (segment && typeof segment === 'object') {
          return segment.speech || segment.text || segment.transcript || '';
        }
        return '';
      }).join(' ');
    } else if (typeof result === 'string') {
      transcription = result;
    } else if (result && typeof result === 'object') {
      // Handle object result with multiple possible properties
      const resultObj = result as any;
      transcription = resultObj.text || resultObj.transcript || resultObj.speech || '';
    }
    
    // Clean up timestamps and formatting
    transcription = cleanTranscriptionText(transcription);
    
    // Clean up the recording file
    if (targetPath === currentRecordingPath) {
      try {
        fs.unlinkSync(targetPath);
        currentRecordingPath = null;
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup recording file:', cleanupError);
      }
    }
    
    console.log('✅ Transcription completed:', transcription.substring(0, 100) + '...');
    
    if (!transcription) {
      return { success: false, error: 'No speech detected in the recording' };
    }
    
    return { success: true, text: transcription };
    
  } catch (error) {
    console.error('❌ Transcription failed:', error);
    
    // Clean up on error
    if (currentRecordingPath && fs.existsSync(currentRecordingPath)) {
      try {
        fs.unlinkSync(currentRecordingPath);
        currentRecordingPath = null;
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup recording file on error:', cleanupError);
      }
    }
    
    return { success: false, error: `Transcription failed: ${(error as Error).message}` };
  }
});

// Add this helper function to clean up transcription text
function cleanTranscriptionText(text: string): string {
  if (!text) return '';
  
  // Remove SRT-style timestamps: [00:00:00.000 --> 00:00:01.000]
  let cleaned = text.replace(/\[[\d:.,\s\->&]+\]/g, '');
  
  // Remove VTT-style timestamps: 00:00:00.000 --> 00:00:01.000
  cleaned = cleaned.replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g, '');
  
  // Remove standalone timestamps: 00:00:00.000
  cleaned = cleaned.replace(/\d{2}:\d{2}:\d{2}\.\d{3}/g, '');
  
  // Remove multiple spaces and newlines
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();
  
  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  
  // Ensure proper sentence ending
  if (cleaned.length > 0 && !cleaned.match(/[.!?]$/)) {
    // Only add period if it doesn't end with punctuation and is substantial text
    if (cleaned.length > 5) {
      cleaned += '.';
    }
  }
  
  return cleaned;
}

// Add these new IPC handlers for file/folder creation
ipcMain.handle('create-file', async (event, filePath: string) => {
  try {
    await fs.promises.writeFile(filePath, '', 'utf-8');
    
    // Notify renderer to refresh file tree
    mainWindow?.webContents.send('file-system-changed', { 
      type: 'create-file', 
      path: filePath,
      parentPath: path.dirname(filePath)
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error creating file:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('create-folder', async (event, folderPath: string) => {
  try {
    await fs.promises.mkdir(folderPath, { recursive: true });
    
    // Notify renderer to refresh file tree
    mainWindow?.webContents.send('file-system-changed', { 
      type: 'create-folder', 
      path: folderPath,
      parentPath: path.dirname(folderPath)
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error creating folder:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('delete-file', async (event, filePath: string) => {
  try {
    const stats = await fs.promises.stat(filePath);
    if (stats.isDirectory()) {
      await fs.promises.rmdir(filePath, { recursive: true });
    } else {
      await fs.promises.unlink(filePath);
    }
    
    // Notify renderer to refresh file tree
    mainWindow?.webContents.send('file-system-changed', { 
      type: 'delete', 
      path: filePath,
      parentPath: path.dirname(filePath)
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting file/folder:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('rename-file', async (event, oldPath: string, newPath: string) => {
  try {
    await fs.promises.rename(oldPath, newPath);
    
    // Notify renderer to refresh file tree
    mainWindow?.webContents.send('file-system-changed', { 
      type: 'rename', 
      path: newPath,
      oldPath: oldPath,
      parentPath: path.dirname(newPath)
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error renaming file/folder:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Copy external file to project directory
ipcMain.handle('copy-external-file', async (event, sourcePath: string, targetDir: string, fileName?: string) => {
  try {
    // Use the original filename if no custom name provided
    const finalFileName = fileName || path.basename(sourcePath);
    const targetPath = path.join(targetDir, finalFileName);
    
    console.log(`Copying file from ${sourcePath} to ${targetPath}`);
    
    // Check if source file exists
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: 'Source file does not exist' };
    }
    
    // Create target directory if it doesn't exist
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    
    // Copy the file
    await fs.promises.copyFile(sourcePath, targetPath);
    
    console.log(`✅ File copied successfully: ${targetPath}`);
    
    // Notify renderer to refresh file tree
    mainWindow?.webContents.send('file-system-changed', { 
      type: 'copy-external', 
      path: targetPath,
      parentPath: targetDir
    });
    
    return { success: true, targetPath };
  } catch (error) {
    console.error('Error copying external file:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Handle file drop with base64 data (for when file paths aren't available)
ipcMain.handle('save-dropped-file', async (event, targetDir: string, fileName: string, fileData: string, isBase64: boolean = false) => {
  try {
    const targetPath = path.join(targetDir, fileName);
    
    console.log(`Saving dropped file to ${targetPath}`);
    
    // Create target directory if it doesn't exist
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    
    if (isBase64) {
      // Handle binary files (images, etc.)
      const buffer = Buffer.from(fileData, 'base64');
      await fs.promises.writeFile(targetPath, buffer);
    } else {
      // Handle text files
      await fs.promises.writeFile(targetPath, fileData, 'utf-8');
    }
    
    console.log(`✅ Dropped file saved successfully: ${targetPath}`);
    
    // Notify renderer to refresh file tree
    mainWindow?.webContents.send('file-system-changed', { 
      type: 'save-dropped', 
      path: targetPath,
      parentPath: targetDir
    });
    
    return { success: true, targetPath };
  } catch (error) {
    console.error('Error saving dropped file:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Write binary file operation (for drag and drop)
ipcMain.handle('write-binary-file', async (event, filePath: string, base64Data: string) => {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(filePath, buffer);
    console.log(`Binary file saved: ${filePath}`);
    return { success: true };
  } catch (error) {
    console.error('Error writing binary file:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Add this new IPC handler for sending input to processes
ipcMain.handle('send-process-input', async (event, processId: string, input: string) => {
  try {
    const process = interactiveProcesses.get(processId);
    if (process && process.stdin) {
      process.stdin.write(input + '\n');
      return { success: true };
    }
    return { success: false, error: 'Process not found or stdin not available' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// Batch file creation for multiple files
ipcMain.handle('create-files-batch', async (event, requests: FileCreationRequest[]) => {
  try {
    const results: FileCreationResponse[] = [];
    const allCreatedDirectories = new Set<string>();
    
    for (const request of requests) {
      const result = await createFileWithContent(request);
      results.push(result);
      
      if (result.parentDirectories) {
        result.parentDirectories.forEach(dir => allCreatedDirectories.add(dir));
      }
    }
    
    // Send batch notification
    mainWindow?.webContents.send('file-system-changed', { 
      type: 'batch-create', 
      results,
      createdDirectories: Array.from(allCreatedDirectories)
    });
    
    return {
      success: results.every(r => r.success),
      results,
      createdDirectories: Array.from(allCreatedDirectories)
    };
    
  } catch (error) {
    console.error('Error in batch file creation:', error);
    return {
      success: false,
      error: (error as Error).message,
      results: []
    };
  }
});

// Extract the file creation logic into a separate function
async function createFileWithContent(request: FileCreationRequest): Promise<FileCreationResponse> {
  try {
    const { path: filePath, content, createDirectories = true, overwrite = false } = request;
    const currentDir = process.cwd();
    
    // Resolve the full path
    const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(currentDir, filePath);
    const dirPath = path.dirname(fullPath);
    
    console.log(`Creating file: ${fullPath}`);
    console.log(`Directory: ${dirPath}`);
    
    // Check if file already exists
    if (fs.existsSync(fullPath) && !overwrite) {
      return {
        success: false,
        error: `File already exists: ${filePath}`,
        path: fullPath
      };
    }
    
    const createdDirectories: string[] = [];
    
    // Create directories if they don't exist
    if (createDirectories && !fs.existsSync(dirPath)) {
      console.log(`Creating directories: ${dirPath}`);
      await fs.promises.mkdir(dirPath, { recursive: true });
      
      // Track which directories were created
      let currentPath = dirPath;
      while (currentPath !== path.dirname(currentPath)) {
        if (!fs.existsSync(currentPath)) {
          createdDirectories.push(currentPath);
        }
        currentPath = path.dirname(currentPath);
      }
    }
    
    // Write the file
    await fs.promises.writeFile(fullPath, content, 'utf-8');
    
    console.log(`✅ File created successfully: ${fullPath}`);
    
    // Notify renderer to refresh file tree
    mainWindow?.webContents.send('file-system-changed', { 
      type: 'create-file-enhanced', 
      path: fullPath,
      parentPath: dirPath,
      createdDirectories
    });
    
    return {
      success: true,
      path: fullPath,
      created: true,
      parentDirectories: createdDirectories
    };
    
  } catch (error) {
    console.error('Error creating file with content:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

// Update the original handler to use the extracted function
ipcMain.handle('create-file-with-content', async (event, request: FileCreationRequest) => {
  return await createFileWithContent(request);
});

// Enhanced file validation and path resolution
ipcMain.handle('validate-file-path', async (event, filePath: string) => {
  try {
    const currentDir = process.cwd();
    const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(currentDir, filePath);
    const dirPath = path.dirname(fullPath);
    
    return {
      success: true,
      fullPath,
      dirPath,
      fileName: path.basename(fullPath),
      exists: fs.existsSync(fullPath),
      dirExists: fs.existsSync(dirPath),
      isValidPath: true,
      extension: path.extname(fullPath)
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      isValidPath: false
    };
  }
});

// Get file suggestions based on project structure
ipcMain.handle('get-file-suggestions', async (event, basePath?: string) => {
  try {
    const currentDir = basePath || process.cwd();
    const suggestions: any[] = [];
    
    // Get common project patterns
    const commonFiles = [
      'package.json',
      'tsconfig.json',
      'webpack.config.js',
      'vite.config.js',
      '.gitignore',
      'README.md'
    ];
    
    const commonDirs = [
      'src',
      'components',
      'utils',
      'types',
      'styles',
      'assets',
      'public',
      'dist',
      'build'
    ];
    
    // Check existing structure
    const items = await fs.promises.readdir(currentDir, { withFileTypes: true });
    
    commonFiles.forEach(file => {
      const exists = items.some(item => item.name === file && item.isFile());
      suggestions.push({
        type: 'file',
        name: file,
        path: file,
        exists,
        common: true
      });
    });
    
    commonDirs.forEach(dir => {
      const exists = items.some(item => item.name === dir && item.isDirectory());
      suggestions.push({
        type: 'directory',
        name: dir,
        path: dir,
        exists,
        common: true
      });
    });
    
    return suggestions;
  } catch (error) {
    console.error('Error getting file suggestions:', error);
    return [];
  }
});

// Enhanced directory creation with better error handling
ipcMain.handle('create-directories', async (event, directories: string[]) => {
  try {
    const results: any[] = [];
    const currentDir = process.cwd();
    
    for (const dir of directories) {
      const fullPath = path.isAbsolute(dir) ? dir : path.resolve(currentDir, dir);
      
      try {
        if (!fs.existsSync(fullPath)) {
          await fs.promises.mkdir(fullPath, { recursive: true });
          results.push({
            path: fullPath,
            success: true,
            created: true
          });
          
          console.log(`✅ Directory created: ${fullPath}`);
        } else {
          results.push({
            path: fullPath,
            success: true,
            created: false,
            message: 'Directory already exists'
          });
        }
      } catch (dirError) {
        results.push({
          path: fullPath,
          success: false,
          error: (dirError as Error).message
        });
      }
    }
    
    // Notify renderer
    mainWindow?.webContents.send('file-system-changed', { 
      type: 'directories-created', 
      results
    });
    
    return {
      success: results.every(r => r.success),
      results
    };
    
  } catch (error) {
    console.error('Error creating directories:', error);
    return {
      success: false,
      error: (error as Error).message,
      results: []
    };
  }
});

// File template system
ipcMain.handle('get-file-template', async (event, fileType: string, fileName?: string) => {
  try {
    const templates: { [key: string]: string } = {
      'javascript': `// ${fileName || 'index.js'}
export default function() {
  // Your code here
}
`,
      'typescript': `// ${fileName || 'index.ts'}
export interface ${fileName?.replace(/\.[^/.]+$/, "").replace(/^\w/, c => c.toUpperCase()) || 'MyInterface'} {
  // Define your interface here
}

export default function ${fileName?.replace(/\.[^/.]+$/, "").replace(/^\w/, c => c.toUpperCase()) || 'myFunction'}(): void {
  // Your code here
}
`,
      'react-component': `import React from 'react';

interface ${fileName?.replace(/\.[^/.]+$/, "").replace(/^\w/, c => c.toUpperCase()) || 'Component'}Props {
  // Define props here
}

const ${fileName?.replace(/\.[^/.]+$/, "").replace(/^\w/, c => c.toUpperCase()) || 'Component'}: React.FC<${fileName?.replace(/\.[^/.]+$/, "").replace(/^\w/, c => c.toUpperCase()) || 'Component'}Props> = () => {
  return (
    <div>
      {/* Your component JSX here */}
    </div>
  );
};

export default ${fileName?.replace(/\.[^/.]+$/, "").replace(/^\w/, c => c.toUpperCase()) || 'Component'};
`,
      'css': `/* ${fileName || 'styles.css'} */

.container {
  /* Your styles here */
}
`,
      'html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName?.replace(/\.[^/.]+$/, "") || 'Document'}</title>
</head>
<body>
  <!-- Your content here -->
</body>
</html>
`,
      'json': `{
  "name": "${fileName?.replace(/\.[^/.]+$/, "") || 'project'}",
  "version": "1.0.0"
}
`,
      'markdown': `# ${fileName?.replace(/\.[^/.]+$/, "").replace(/^\w/, c => c.toUpperCase()) || 'Title'}

## Overview

<!-- Your content here -->
`
    };
    
    return {
      success: true,
      template: templates[fileType] || `// ${fileName || 'file'}\n\n// Your code here\n`,
      fileType
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
});

// Enhanced project structure analysis
ipcMain.handle('analyze-project-structure', async (event, projectPath?: string) => {
  try {
    const targetPath = projectPath || process.cwd();
    const analysis: any = {
      path: targetPath,
      type: 'unknown',
      framework: 'none',
      structure: {},
      suggestions: []
    };
    
    // Check for common project files
    const packageJsonPath = path.join(targetPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));
        analysis.type = 'node';
        analysis.name = packageJson.name;
        analysis.version = packageJson.version;
        
        // Detect framework
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        if (dependencies.react) analysis.framework = 'react';
        if (dependencies.vue) analysis.framework = 'vue';
        if (dependencies.angular) analysis.framework = 'angular';
        if (dependencies.next) analysis.framework = 'nextjs';
        if (dependencies.nuxt) analysis.framework = 'nuxtjs';
        if (dependencies.vite) analysis.buildTool = 'vite';
        if (dependencies.webpack) analysis.buildTool = 'webpack';
        
      } catch (parseError) {
        console.warn('Failed to parse package.json:', parseError);
      }
    }
    
    // Analyze directory structure
    const items = await fs.promises.readdir(targetPath, { withFileTypes: true });
    const dirs = items.filter(item => item.isDirectory()).map(item => item.name);
    const files = items.filter(item => item.isFile()).map(item => item.name);
    
    analysis.structure = {
      directories: dirs,
      files: files,
      hasSource: dirs.includes('src'),
      hasComponents: dirs.includes('components'),
      hasUtils: dirs.includes('utils'),
      hasStyles: dirs.includes('styles'),
      hasPublic: dirs.includes('public'),
      hasTests: dirs.some(dir => dir.includes('test') || dir.includes('spec'))
    };
    
    // Generate suggestions based on analysis
    if (analysis.framework === 'react' && !analysis.structure.hasComponents) {
      analysis.suggestions.push({
        type: 'directory',
        path: 'src/components',
        reason: 'React projects typically have a components directory'
      });
    }
    
    if (!analysis.structure.hasUtils) {
      analysis.suggestions.push({
        type: 'directory',
        path: 'src/utils',
        reason: 'Utils directory for helper functions'
      });
    }
    
    return {
      success: true,
      analysis
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
