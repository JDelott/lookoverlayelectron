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

let mainWindow: BrowserWindow | null;
let terminalProcess: ChildProcess | null = null;
let runningProcesses: Map<string, ChildProcess> = new Map(); // Track running processes

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

// Execute single commands with better long-running process support
ipcMain.handle('execute-command', async (event, command: string, workingDir?: string) => {
  try {
    return new Promise((resolve) => {
      const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash';
      const args = os.platform() === 'win32' ? ['/c', command] : ['-c', command];
      
      const cwd = workingDir || process.cwd();
      
      console.log(`Executing command: ${command} in directory: ${cwd}`);
      
      const childProcess = spawn(shell, args, {
        cwd: cwd,
        env: {
          ...process.env,
          FORCE_COLOR: '1', // Enable colors for better output
          NODE_ENV: process.env.NODE_ENV || 'development'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Check if this is a long-running process
      const isLongRunning = command.includes('dev') || command.includes('start') || command.includes('serve') ||
                           command.includes('watch') || command.startsWith('node ');
      
      // Track long-running processes
      if (isLongRunning) {
        const processId = `${Date.now()}-${Math.random()}`;
        runningProcesses.set(processId, childProcess);
        
        // Send process ID to renderer for tracking
        mainWindow?.webContents.send('process-started', { 
          id: processId, 
          command: command 
        });
        
        // Clean up when process ends
        childProcess.on('close', (code) => {
          runningProcesses.delete(processId);
          mainWindow?.webContents.send('process-ended', { id: processId });
        });
        
        childProcess.on('error', (error) => {
          console.error('Process error:', error);
          runningProcesses.delete(processId);
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
          workingDir: cwd,
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
          workingDir: cwd
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
              workingDir: cwd
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

// Update the IPC handler with proper typing
ipcMain.handle('anthropic-api-call', async (event, messages, systemPrompt) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not found in environment variables');
  }
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022', // Upgraded to Claude 3.5 Sonnet
        max_tokens: 8192, // Increased token limit
        system: systemPrompt,
        messages: messages.filter((m: any) => m.role !== 'system').map((m: any) => ({
          role: m.role,
          content: m.content
        }))
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json() as AnthropicResponse;
    
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: data.content[0].text,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Anthropic API Error:', error);
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
