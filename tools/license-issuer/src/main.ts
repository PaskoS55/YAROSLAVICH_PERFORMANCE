import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { generateEncryptedAuthority, issueLicense, readKeyMetadata, verifyLicenseFile, type IssueRequest } from './authority';

const repositoryRoot = path.resolve(__dirname, '../../..');
const ledgerPath = () => path.join(app.getPath('userData'), 'issuance-ledger.jsonl');
let mainWindow: BrowserWindow | null = null;
function userError(error: unknown): string {
  const code = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  const messages: Record<string, string> = {
    INVALID_INSTALLATION_ID: 'Некорректный Installation ID.', INVALID_LICENSE_DATES: 'Некорректный срок действия.',
    TRIAL_MUST_EXPIRE: 'TRIAL должен иметь срок окончания.', PASSPHRASE_TOO_SHORT: 'Пароль ключа должен содержать не менее 20 символов.',
    KEY_DOES_NOT_MATCH_METADATA: 'Ключ не соответствует Key ID.', PRIVATE_KEY_PATH_INSIDE_REPOSITORY: 'Ключ нельзя хранить внутри репозитория.',
    CLOUD_SYNC_KEY_PATH_REJECTED: 'Выберите защищённое расположение вне синхронизируемой папки.', OUTPUT_ALREADY_EXISTS: 'Файл уже существует. Выберите другое имя или папку.',
  };
  if (/bad decrypt|pkcs12 cipherfinal error/i.test(code)) return 'Неверный пароль ключа.';
  return messages[code] ?? 'Операция не выполнена. Проверьте выбранные файлы и введённые данные.';
}
function safe<T>(handler: () => T): { ok: true; value: T } | { ok: false; error: string } { try { return { ok: true, value: handler() }; } catch (error) { return { ok: false, error: userError(error) }; } }

function registerIpc(): void {
  ipcMain.handle('issuer:select-key', async () => (await dialog.showOpenDialog(mainWindow!, { title: 'Зашифрованный private key', properties: ['openFile'], filters: [{ name: 'Encrypted private key', extensions: ['pem', 'key'] }] })).filePaths[0] ?? null);
  ipcMain.handle('issuer:select-metadata', async () => (await dialog.showOpenDialog(mainWindow!, { title: 'Public key metadata', properties: ['openFile'], filters: [{ name: 'Public metadata', extensions: ['json'] }] })).filePaths[0] ?? null);
  ipcMain.handle('issuer:select-folder', async () => (await dialog.showOpenDialog(mainWindow!, { title: 'Папка назначения', properties: ['openDirectory', 'createDirectory'] })).filePaths[0] ?? null);
  ipcMain.handle('issuer:key-status', (_event, file: string) => safe(() => { const metadata = readKeyMetadata(file); return { keyId: metadata.keyId, algorithm: metadata.algorithm, fingerprint: metadata.publicKeyFingerprintSha256 }; }));
  ipcMain.handle('issuer:issue', (_event, request: IssueRequest) => safe(() => { const result = issueLicense(repositoryRoot, ledgerPath(), request); return { file: result.file, sha256: result.sha256, licenseId: result.envelope.payload.licenseId, duplicateWarning: result.duplicateWarning }; }));
  ipcMain.handle('issuer:verify', (_event, file: string, metadata: string, installationId?: string) => safe(() => { const result = verifyLicenseFile(file, metadata, installationId); return { signatureValid: result.signatureValid, installationMatch: result.installationMatch, payload: result.envelope.payload }; }));
  ipcMain.handle('issuer:select-license', async () => (await dialog.showOpenDialog(mainWindow!, { title: 'Проверить лицензию', properties: ['openFile'], filters: [{ name: 'PASKO License', extensions: ['pasko-license'] }] })).filePaths[0] ?? null);
  ipcMain.handle('issuer:ledger', () => safe(() => existsSync(ledgerPath()) ? readFileSync(ledgerPath(), 'utf8').trim().split(/\r?\n/).filter(Boolean).slice(-100).reverse().map((line) => JSON.parse(line)) : []));
  ipcMain.handle('issuer:open-folder', (_event, folder: string) => shell.openPath(path.dirname(folder)));
  ipcMain.handle('issuer:generate-key', (_event, input: { destinationFolder: string; keyId: string; passphrase: string }) => safe(() => { const result = generateEncryptedAuthority({ repositoryRoot, ...input }); return { privateKeyPath: result.privateKeyPath, metadataPath: result.metadataPath, metadata: result.metadata }; }));
}
function createWindow(): void {
  mainWindow = new BrowserWindow({ width: 1366, height: 820, minWidth: 1100, minHeight: 700, title: 'PASKO License Issuer — PRIVATE OPERATOR TOOL', webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, devTools: !app.isPackaged } });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => { if (url !== mainWindow?.webContents.getURL()) event.preventDefault(); });
  void mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(() => { registerIpc(); createWindow(); });
  app.on('window-all-closed', () => app.quit());
}
