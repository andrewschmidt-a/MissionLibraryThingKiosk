// Electron main process — boots the SvelteKit Node server in-process and opens a window.
const { app, BrowserWindow, dialog, Menu } = require('electron');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

// Persist data under the OS-standard userData dir so it survives upgrades/uninstalls cleanly.
const userData = app.getPath('userData');
const dataDir = path.join(userData, 'data');
fs.mkdirSync(dataDir, { recursive: true });
process.env.LIBRARY_DB_PATH = process.env.LIBRARY_DB_PATH || path.join(dataDir, 'library.db');

// Server env for SvelteKit's Node adapter
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '127.0.0.1';
const ORIGIN = `http://${HOST}:${PORT}`;
process.env.ORIGIN = ORIGIN;
process.env.BODY_SIZE_LIMIT = process.env.BODY_SIZE_LIMIT || '52428800';

const KIOSK_MODE = process.env.MLC_KIOSK === '1';
let mainWindow = null;

async function startServer() {
  const buildDir = path.join(__dirname, '..', 'build');
  const handlerPath = path.join(buildDir, 'handler.js');
  if (!fs.existsSync(handlerPath)) {
    throw new Error(`SvelteKit build not found at ${handlerPath}. Run "npm run build" first.`);
  }
  const { handler } = await import(pathToFileURL(handlerPath).href);
  await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => handler(req, res));
    server.once('error', reject);
    server.listen(PORT, HOST, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
}

function createWindow() {
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const iconPath = path.join(__dirname, '..', 'resources', iconFile);
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    fullscreen: KIOSK_MODE,
    kiosk: KIOSK_MODE,
    backgroundColor: '#f8fafc',
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  if (KIOSK_MODE) Menu.setApplicationMenu(null);
  mainWindow.loadURL(ORIGIN + '/');
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single-instance lock so two icons can't fight over the port.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      await startServer();
    } catch (e) {
      dialog.showErrorBox(
        'Mission Library could not start',
        String((e && e.stack) || e)
      );
      app.quit();
      return;
    }
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
