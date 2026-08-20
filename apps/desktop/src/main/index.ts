import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { classifyNavigation, getInternalUrl } from './url-policy';

if (started) app.quit();
const internalUrl = getInternalUrl();
const isDevelopment = process.env.YAROSLAVICH_DESKTOP_DEV === '1';
let mainWindow: BrowserWindow | null = null;

function openExternal(target: string): void {
  void shell.openExternal(target).catch((error: unknown) => console.error('Unable to open external URL', error));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 700, show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
      devTools: isDevelopment,
    },
  });
  mainWindow.webContents.on('will-navigate', (event, target) => {
    const decision = classifyNavigation(target, internalUrl);
    if (decision === 'internal') return;
    event.preventDefault();
    if (decision === 'external') openExternal(target);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (classifyNavigation(url, internalUrl) === 'external') openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  void mainWindow.loadURL(internalUrl.toString());
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show(); mainWindow.focus();
  });
  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
