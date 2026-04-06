const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const { createAppServer } = require('./server');

let mainWindow;
let serverPort;
let tray;

async function createWindow() {
  // Start embedded server
  const { port } = await createAppServer();
  serverPort = port;

  // Create browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Ray Seeul',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#020617',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the app from embedded server
  mainWindow.loadURL(`http://localhost:${port}`);

  // Uncomment to debug: mainWindow.webContents.openDevTools({ mode: 'detach' });

  // IPC handlers
  ipcMain.handle('get-server-port', () => serverPort);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Hide to tray on close (macOS)
  if (process.platform === 'darwin') {
    mainWindow.on('close', (event) => {
      if (!app.isQuitting) {
        event.preventDefault();
        mainWindow.hide();
      }
    });
  }
}

function createTray() {
  // Simple tray icon (16x16 data URI)
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMklEQVQ4T2NkYPj/n4EBCBgZGRn+MzAwMILEmBgYGBiRNDCCFKNLMILkUJ2BYcDQNwAAXSoIESFhkKIAAAAASUVORK5CYII='
  );

  tray = new Tray(icon);
  tray.setToolTip('Ray Seeul');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow?.show() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
