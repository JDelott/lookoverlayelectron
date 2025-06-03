import { app, BrowserWindow, ipcMain, desktopCapturer, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import * as os from 'os';

let mainWindow: BrowserWindow | null;
let terminalProcess: any = null;

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

  // Always open dev tools to see any errors
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Clean up terminal process
    if (terminalProcess) {
      terminalProcess.kill();
      terminalProcess = null;
    }
  });
}

// Terminal operations
ipcMain.handle('terminal-start', async () => {
  try {
    const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
    const cwd = process.cwd();
    
    terminalProcess = spawn(shell, [], {
      cwd,
      env: process.env,
    });

    terminalProcess.stdout.on('data', (data: Buffer) => {
      if (mainWindow) {
        mainWindow.webContents.send('terminal-data', data.toString());
      }
    });

    terminalProcess.stderr.on('data', (data: Buffer) => {
      if (mainWindow) {
        mainWindow.webContents.send('terminal-data', data.toString());
      }
    });

    terminalProcess.on('exit', (code: number) => {
      if (mainWindow) {
        mainWindow.webContents.send('terminal-exit', code);
      }
      terminalProcess = null;
    });

    return { success: true, shell };
  } catch (error: unknown) {
    console.error('Failed to start terminal:', error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unknown error occurred' };
  }
});

ipcMain.handle('terminal-write', async (event, data: string) => {
  if (terminalProcess && terminalProcess.stdin) {
    terminalProcess.stdin.write(data);
    return true;
  }
  return false;
});

ipcMain.handle('terminal-resize', async (event, cols: number, rows: number) => {
  if (terminalProcess && terminalProcess.resize) {
    terminalProcess.resize(cols, rows);
    return true;
  }
  return false;
});

ipcMain.handle('terminal-kill', async () => {
  if (terminalProcess) {
    terminalProcess.kill();
    terminalProcess = null;
    return true;
  }
  return false;
});

// Handle file system operations
ipcMain.handle('get-directory-contents', async (event, directoryPath?: string) => {
  try {
    const targetPath = directoryPath || process.cwd();
    
    const items = await fs.promises.readdir(targetPath, { withFileTypes: true });
    const files = await Promise.all(
      items
        .filter(item => !item.name.startsWith('.')) // Hide hidden files
        .map(async (item) => {
          const fullPath = path.join(targetPath, item.name);
          const stats = await fs.promises.stat(fullPath);
          
          return {
            name: item.name,
            path: fullPath,
            type: item.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime
          };
        })
    );
    
    // Sort: directories first, then files, both alphabetically
    files.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    
    return {
      files,
      rootPath: targetPath
    };
  } catch (error) {
    console.error('Error reading directory:', error);
    throw error;
  }
});

// Handle reading file contents
ipcMain.handle('read-file-contents', async (event, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
});

// Handle writing file contents
ipcMain.handle('write-file-contents', async (event, filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
});

// Handle screenshot capture request - capturing only what's visible through the window
ipcMain.handle('capture-screenshot', async () => {
  try {
    if (!mainWindow) {
      throw new Error('Main window is not available');
    }
    
    // Get the window bounds
    const bounds = mainWindow.getBounds();
    
    // Make window transparent but keep it visible
    const originalOpacity = mainWindow.getOpacity();
    mainWindow.setOpacity(0);
    
    // Wait for the UI to update
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Get primary display information
    const primaryDisplay = screen.getPrimaryDisplay();
    const scaleFactor = primaryDisplay.scaleFactor;
    
    // Capture the entire screen
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: primaryDisplay.size.width * scaleFactor,
        height: primaryDisplay.size.height * scaleFactor
      }
    });
    
    // Find the main screen source
    const mainSource = sources.find(source => 
      source.name === 'Entire Screen' || 
      source.name.includes('Display') || 
      source.id.includes('screen:')
    );
    
    if (!mainSource) {
      throw new Error('Failed to find the main screen source');
    }
    
    // Calculate the region to crop - accounting for display scaling
    const region = {
      x: Math.round((bounds.x - primaryDisplay.bounds.x) * scaleFactor),
      y: Math.round((bounds.y - primaryDisplay.bounds.y) * scaleFactor),
      width: Math.round(bounds.width * scaleFactor),
      height: Math.round(bounds.height * scaleFactor)
    };
    
    // Ensure coordinates are valid
    region.x = Math.max(0, region.x);
    region.y = Math.max(0, region.y);
    region.width = Math.min(region.width, primaryDisplay.size.width * scaleFactor - region.x);
    region.height = Math.min(region.height, primaryDisplay.size.height * scaleFactor - region.y);
    
    // Crop the image to just the portion under the window
    const croppedImage = mainSource.thumbnail.crop(region);
    
    // Restore window opacity
    mainWindow.setOpacity(originalOpacity);
    
    // Convert to data URL in memory (no file saving)
    const dataURL = croppedImage.toDataURL();
    
    // Clean up memory
    sources.forEach(source => {
      if (source !== mainSource) {
        // @ts-ignore - force cleanup
        source.thumbnail = null;
      }
    });
    
    return dataURL;
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    
    // Restore window in case of error
    if (mainWindow) {
      mainWindow.setOpacity(1);
    }
    
    throw error;
  }
});

// Add minimize handler for the window controls
ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
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
