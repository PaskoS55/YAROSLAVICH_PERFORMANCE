import { app, BrowserWindow, dialog, shell } from 'electron';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { handleSquirrelStartup } from './squirrel-startup';
import { startPackagedNext, type PackagedNextRuntime } from './packaged-next';
import { resolveRuntimeTarget } from './runtime-paths';
import { classifyNavigation } from './url-policy';
import { loadProductIdentity } from './product-identity';

if (handleSquirrelStartup()) app.quit();
const product = loadProductIdentity({ isPackaged: app.isPackaged, resourcesPath: process.resourcesPath });
app.setAppUserModelId(product.appUserModelId);
const isDevelopment = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let nextRuntime: PackagedNextRuntime | null = null;
let quitting = false;

function openExternal(target: string): void {
  void shell.openExternal(target).catch((error: unknown) => console.error('Unable to open external URL', error));
}

function createWindow(internalUrl: URL): void {
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

async function startApplication(): Promise<void> {
  const target = resolveRuntimeTarget({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    developmentUrl: process.env.PASKO_PERFORMANCE_DESKTOP_DEV_URL,
  });
  if (target.kind === 'development') {
    createWindow(target.url);
    return;
  }
  nextRuntime = await startPackagedNext(target.serverPath);
  nextRuntime.process.once('exit', () => {
    if (quitting) return;
    mainWindow?.destroy();
    mainWindow = null;
    dialog.showErrorBox(product.canonical, 'Локальный web-runtime неожиданно завершился. Приложение будет закрыто.');
    app.quit();
  });
  createWindow(nextRuntime.origin);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show(); mainWindow.focus();
  });
  app.on('before-quit', () => {
    quitting = true;
    nextRuntime?.stop();
    nextRuntime = null;
  });
  app.whenReady().then(startApplication).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown packaged runtime error';
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
    console.error('Packaged runtime startup failed', { message, cause });
    const logsPath = app.getPath('logs');
    mkdirSync(logsPath, { recursive: true });
    appendFileSync(path.join(logsPath, 'runtime.log'), `${new Date().toISOString()} packaged startup failed: ${message}${cause ? `; ${cause}` : ''}\n`);
    dialog.showErrorBox(product.canonical, 'Не удалось запустить локальный web-runtime. Приложение будет закрыто.');
    app.quit();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && !quitting && !app.isPackaged) void startApplication();
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
