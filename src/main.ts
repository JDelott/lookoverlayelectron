import { app, BrowserWindow, ipcMain, desktopCapturer, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null;
let terminalProcess: ChildProcess | null = null;

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

// Execute single commands with working directory support
ipcMain.handle('execute-command', async (event, command: string, workingDir?: string) => {
  try {
    return new Promise((resolve) => {
      const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash';
      const args = os.platform() === 'win32' ? ['/c', command] : ['-c', command];
      
      // Use provided working directory or default to current
      const cwd = workingDir || process.cwd();
      
      console.log(`Executing command: ${command} in directory: ${cwd}`);
      
      const childProcess = spawn(shell, args, {
        cwd: cwd,
        env: process.env,
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
          code,
          workingDir: cwd
        });
      });
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
ipcMain.handle('get-current-directory', async (event) => {
  try {
    return {
      success: true,
      directory: process.cwd()
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
