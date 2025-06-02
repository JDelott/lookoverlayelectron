import { app, BrowserWindow, ipcMain, desktopCapturer, screen, NativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null;

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
  });
}

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

// Add this function to main.ts
function getContentBounds(windowBounds: Electron.Rectangle, displayBounds: Electron.Rectangle, scaleFactor: number): Electron.Rectangle {
  // Calculate content area, accounting for any window chrome/decorations
  // This is a simple calculation - adjust if your window has specific padding or borders
  return {
    x: Math.round((windowBounds.x - displayBounds.x) * scaleFactor),
    y: Math.round((windowBounds.y - displayBounds.y) * scaleFactor),
    width: Math.round(windowBounds.width * scaleFactor),
    height: Math.round(windowBounds.height * scaleFactor)
  };
}
