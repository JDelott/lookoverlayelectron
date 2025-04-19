import { app, BrowserWindow, ipcMain, desktopCapturer, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { analyzeImageWithClaude } from './anthropic';

let mainWindow: BrowserWindow | null;

function createWindow() {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    transparent: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../index.html'));

  // For development
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle screenshot capture request
ipcMain.handle('capture-screenshot', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });

    // Get the primary display
    const primaryDisplay = screen.getPrimaryDisplay();
    
    // Find the source that corresponds to the primary display
    const primarySource = sources.find(
      source => source.display_id === primaryDisplay.id.toString() || sources.length === 1
    );

    if (!primarySource) {
      throw new Error('Could not find primary display source');
    }

    // Get the thumbnail as base64 data URL
    return primarySource.thumbnail.toDataURL();
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    throw error;
  }
});

// Handle Anthropic API request
ipcMain.handle('call-anthropic-api', async (_, imageData: string, prompt: string) => {
  try {
    return await analyzeImageWithClaude(imageData, prompt);
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    throw error;
  }
});
