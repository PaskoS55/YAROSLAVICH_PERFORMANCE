import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, shell } from "electron";
import path from "node:path";
import { handleSquirrelStartup } from "./squirrel-startup";
import { startPackagedNext, type PackagedNextRuntime } from "./packaged-next";
import { resolveRuntimeTarget } from "./runtime-paths";
import { classifyNavigation } from "./url-policy";
import { loadProductIdentity } from "./product-identity";
import {
  resolveE2eDataRoot,
  startPackagedDatabase,
  restorePackagedDatabaseSnapshot,
  type PackagedDatabaseRuntime,
} from "./packaged-database";
import {
  PackagedStartupError,
  startPackagedServices,
  stopPackagedServices,
} from "./startup-orchestrator";
import { InstallationSecurityStore } from "./installation-security";
import { APPLICATION_USER, detectClusterState, executeSql, resolvePostgresPaths } from "./postgres";
import { generateInstallationSecurity } from "./installation-security";
import { PhaseFiveCredentialsProvider } from "./database-credentials";
import { appendRedactedRuntimeLog, listSnapshotManifests, resolveRecoveryPaths, verifyLocalPasswordHash } from "./recovery";
import { readFileSync, statSync } from "node:fs";
import { LicenseStore, MAX_LICENSE_BYTES, PRODUCTION_LICENSE_KEYS, type LicenseEvaluation } from "./license";

if (handleSquirrelStartup()) app.quit();
const product = loadProductIdentity({
  isPackaged: app.isPackaged,
  resourcesPath: process.resourcesPath,
});
app.setAppUserModelId(product.appUserModelId);
const isDevelopment = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let nextRuntime: PackagedNextRuntime | null = null;
let demoNextRuntime: PackagedNextRuntime | null = null;
let databaseRuntime: PackagedDatabaseRuntime | null = null;
let quitting = false;
let shutdownStarted = false;
type RecoveryRequest = { snapshotId: string; confirmation: string; password: string; installationConfirmation: string };
let recoveryRestoreAction: ((request: RecoveryRequest) => Promise<void>) | null = null;
let recoverySnapshotOptions: Array<{ id: string; label: string }> = [];
let recoveryInstallationSuffix = '';
let recoveryStoreRoot = '';
let licenseActivationAction: ((password: string) => Promise<LicenseEvaluation>) | null = null;

function errorChain(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  while (current instanceof Error && messages.length < 5) {
    messages.push(current.message);
    current = current.cause;
  }
  return messages.join("; ");
}

function openExternal(target: string): void {
  void shell
    .openExternal(target)
    .catch((error: unknown) =>
      console.error("Unable to open external URL", error),
    );
}

function createWindow(internalUrl: URL, demoUrl?: URL): void {
  mainWindow = new BrowserWindow({
    title: product.display,
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: isDevelopment,
    },
  });
  mainWindow.webContents.on("will-navigate", (event, target) => {
    const parsed = new URL(target);
    if (demoUrl && parsed.origin === internalUrl.origin && parsed.pathname === '/demo-workspace') {
      event.preventDefault(); void mainWindow?.loadURL(demoUrl.toString()); return;
    }
    if (demoUrl && parsed.origin === demoUrl.origin && parsed.pathname === '/club-workspace') {
      event.preventDefault(); void mainWindow?.loadURL(internalUrl.toString()); return;
    }
    const decision = classifyNavigation(target, internalUrl);
    if (demoUrl && parsed.origin === demoUrl.origin) return;
    if (decision === "internal") return;
    event.preventDefault();
    if (decision === "external") openExternal(target);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const parsed = new URL(url);
    if (demoUrl && (parsed.origin === internalUrl.origin || parsed.origin === demoUrl.origin)) return { action: "deny" };
    if (classifyNavigation(url, internalUrl) === "external") openExternal(url);
    return { action: "deny" };
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  void mainWindow.loadURL(internalUrl.toString());
}

function createRecoveryWindow(message: string): void {
  if (recoveryStoreRoot) recoverySnapshotOptions = listSnapshotManifests(resolveRecoveryPaths(recoveryStoreRoot)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => ({ id: item.snapshotId, label: `${new Date(item.createdAt).toLocaleString('ru-RU')} · ${item.reason} · ${(item.sizeBytes / 1024 / 1024).toFixed(1)} MB` }));
  const safeMessage = message.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
  mainWindow = new BrowserWindow({ title: `${product.shortProductName} — Восстановление`, width: 780, height: 620, minWidth: 720, minHeight: 560, show: false, webPreferences: { preload: path.join(__dirname, "../preload/index.js"), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, devTools: false } });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  const options = recoverySnapshotOptions.map((item) => `<option value="${item.id}">${item.label.replace(/[&<>"']/g, '')}</option>`).join('');
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><title>Восстановление</title><style>body{margin:0;background:#f7f7f8;color:#171717;font:15px system-ui}main{max-width:680px;margin:28px auto;padding:30px;background:white;border:1px solid #e5e7eb;border-radius:18px;box-shadow:0 18px 45px #0001}h1{font-size:26px;margin:0 0 8px}.brand{font-size:12px;font-weight:800;letter-spacing:.14em;color:#b91c1c}.notice{margin:18px 0;padding:14px;border-radius:12px;background:#fff7ed;color:#9a3412}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}button{border:1px solid #d1d5db;border-radius:10px;background:white;padding:10px 14px;font-weight:700;cursor:pointer}.primary{background:#b91c1c;color:white;border-color:#b91c1c}label{display:block;margin-top:12px;font-size:13px;font-weight:700}input,select{box-sizing:border-box;width:100%;margin-top:5px;border:1px solid #d1d5db;border-radius:9px;padding:9px}.muted{font-size:12px;color:#6b7280;margin-top:16px}.error{color:#b91c1c;font-weight:700}</style></head><body><main><div class="brand">PASKO PERFORMANCE PLATFORM · VOLLEYBALL</div><h1>Не удалось безопасно открыть локальную базу данных</h1><p>Ваши данные не были автоматически удалены.</p><div class="notice">${safeMessage}</div>${options ? `<form onsubmit="event.preventDefault();restore()"><p><strong>Восстановление заменит текущие локальные данные содержимым выбранной точки восстановления.</strong></p><label>Точка восстановления<select id="snapshot">${options}</select></label><label>Введите ВОССТАНОВИТЬ<input id="confirmation" autocomplete="off"></label><label>Текущий пароль локального администратора<input id="password" type="password" autocomplete="current-password"></label><label>Если база авторизации недоступна — последние 8 символов ID установки (${recoveryInstallationSuffix})<input id="installation" autocomplete="off"></label><div id="result" class="error"></div><div class="actions"><button class="primary" type="submit">Восстановить</button></div></form>` : '<p>Проверенные точки восстановления отсутствуют.</p>'}<div class="actions"><button onclick="window.paskoRecovery.diagnostics()">Диагностика</button><button onclick="window.paskoRecovery.close()">Закрыть программу</button></div><p class="muted">Recovery Key восстанавливает пароль, но не machine secrets. Автоматическое восстановление не выполняется.</p><script>async function restore(){const button=document.querySelector('button[type=submit]');button.disabled=true;document.getElementById('result').textContent='Проверка и восстановление…';const result=await window.paskoRecovery.restore({snapshotId:document.getElementById('snapshot').value,confirmation:document.getElementById('confirmation').value,password:document.getElementById('password').value,installationConfirmation:document.getElementById('installation').value});if(!result.ok){document.getElementById('result').textContent=result.error;button.disabled=false}}</script></main></body></html>`;
  void mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

async function startApplication(): Promise<void> {
  const target = resolveRuntimeTarget({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    developmentUrl: process.env.PASKO_PERFORMANCE_DESKTOP_DEV_URL,
  });
  if (target.kind === "development") {
    createWindow(target.url);
    return;
  }
  try {
    const localAppData = process.env.LOCALAPPDATA ?? app.getPath("appData");
    const dataRoot = resolveE2eDataRoot(process.env);
    const paths = resolvePostgresPaths({
      resourcesPath: process.resourcesPath,
      localAppData,
      dataRoot,
    });
    const storeRoot = dataRoot ?? path.join(localAppData, "PaskoPerformance");
    const store = new InstallationSecurityStore(storeRoot, safeStorage);
    const clusterState = detectClusterState(paths.dataDirectory);
    const legacyMigration = !store.exists() && clusterState === "valid";
    if (legacyMigration && !process.env.AUTH_SESSION_SECRET)
      throw new Error("INSTALLATION_STORE_MISSING_FOR_EXISTING_DATABASE");
    const security = store.exists()
      ? store.load()
      : legacyMigration
        ? generateInstallationSecurity()
        : store.create();
    const licenseKeys = { ...PRODUCTION_LICENSE_KEYS };
    if (process.env.PASKO_E2E_MODE === '1' && dataRoot && path.dirname(path.resolve(dataRoot)) === path.resolve('C:\\Temp') && path.basename(dataRoot).startsWith('pasko_phase7_') && process.env.PASKO_E2E_LICENSE_PUBLIC_KEY) licenseKeys.TEST_ONLY_KEY = process.env.PASKO_E2E_LICENSE_PUBLIC_KEY;
    const licenseStore = new LicenseStore(storeRoot, safeStorage, licenseKeys);
    let license = licenseStore.evaluate(security.installationId);
    licenseActivationAction = async (password) => {
      if (license.state === 'VALID') {
        if (!databaseRuntime || !password) return { state: 'INVALID', payload: null, message: 'Подтвердите текущий пароль администратора.' };
        const passwordHash = await executeSql({ runtime: databaseRuntime.postgres, username: APPLICATION_USER, password: decodeURIComponent(new URL(databaseRuntime.databaseUrl).password), database: 'pasko_performance', sql: `SELECT password_hash FROM local_users WHERE disabled_at IS NULL ORDER BY created_at LIMIT 1;` });
        if (!passwordHash || !(await verifyLocalPasswordHash(password, passwordHash))) return { state: 'INVALID', payload: null, message: 'Текущий пароль администратора не подтверждён.' };
      }
      const result = await dialog.showOpenDialog({ title: 'Выберите лицензию PASKO Performance', properties: ['openFile'], filters: [{ name: 'PASKO License', extensions: ['pasko-license'] }] });
      if (result.canceled || result.filePaths.length !== 1) return license;
      const file = result.filePaths[0];
      if (statSync(file).size > MAX_LICENSE_BYTES) throw new Error('LICENSE_FILE_TOO_LARGE');
      const candidate = licenseStore.activate(readFileSync(file, 'utf8'), security.installationId);
      if (candidate.state === 'VALID') license = candidate;
      return candidate;
    };
    const credentialsProvider = legacyMigration
      ? new PhaseFiveCredentialsProvider(process.env)
      : { getCredentials: async () => ({ bootstrapPassword: security.secrets.databaseBootstrapPassword, applicationPassword: security.secrets.databasePassword }) };
    const runtimeSource = {
      ...process.env,
      AUTH_SESSION_SECRET: security.secrets.authSessionSecret,
      PASKO_INSTALLATION_ID: security.installationId,
      PASKO_PRODUCT_VERSION: app.getVersion(),
      PASKO_RECOVERY_ROOT: path.join(storeRoot, "recovery"),
      PASKO_LOGS_ROOT: app.getPath("logs"),
      PASKO_LICENSE_STATE: license.state,
      PASKO_LICENSE_PAYLOAD: license.payload ? Buffer.from(JSON.stringify({ licenseId: license.payload.licenseId, customerName: license.payload.customerName, plan: license.payload.plan, expiresAt: license.payload.expiresAt, keyId: license.payload.keyId, product: license.payload.product, vertical: license.payload.vertical }), 'utf8').toString('base64url') : '',
    };
    const recoveryPaths = resolveRecoveryPaths(storeRoot);
    recoveryStoreRoot = storeRoot;
    recoverySnapshotOptions = listSnapshotManifests(recoveryPaths).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => ({ id: item.snapshotId, label: `${new Date(item.createdAt).toLocaleString('ru-RU')} · ${item.reason} · ${(item.sizeBytes / 1024 / 1024).toFixed(1)} MB` }));
    recoveryInstallationSuffix = security.installationId.slice(-8);
    recoveryRestoreAction = (request) => restorePackagedDatabaseSnapshot({ resourcesPath: process.resourcesPath, localAppData, dataRoot, credentialsProvider, source: runtimeSource, ...request });
    const services = await startPackagedServices({
      startDatabase: async () => {
        const runtime = await startPackagedDatabase({
          licensingEnforcement: product.licensingEnforcement,
          resourcesPath: process.resourcesPath,
          localAppData,
          dataRoot,
          credentialsProvider,
          rotateTo: legacyMigration
            ? {
                bootstrapPassword: security.secrets.databaseBootstrapPassword,
                applicationPassword: security.secrets.databasePassword,
              }
            : undefined,
          source: runtimeSource,
        });
        if (legacyMigration) {
          try {
            store.create(security);
          } catch (error) {
            await runtime.stop();
            throw error;
          }
        }
        return runtime;
      },
      startWeb: (databaseUrl) =>
        startPackagedNext(target.serverPath, databaseUrl, runtimeSource),
    });
    databaseRuntime = services.database;
    nextRuntime = services.web;
    if (databaseRuntime.demoDatabaseUrl) {
      try { demoNextRuntime = await startPackagedNext(target.serverPath, databaseRuntime.demoDatabaseUrl, { ...runtimeSource, PASKO_WORKSPACE: 'demo', PASKO_DEMO_DATASET_VERSION: '1.0' }); }
      catch (error) { appendRedactedRuntimeLog(app.getPath('logs'), `demo runtime unavailable: ${error instanceof Error ? error.message : 'unknown'}`); }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    if (detail === "SAFE_STORAGE_UNAVAILABLE")
      throw new Error("SECURITY_STORE_UNAVAILABLE", { cause: error });
    if (detail.includes("INSTALLATION_STORE"))
      throw new Error("SECURITY_STORE_UNREADABLE", { cause: error });
    throw new Error(
      error instanceof PackagedStartupError && error.stage === "web"
        ? "WEB_STARTUP_FAILED"
        : "DATABASE_STARTUP_FAILED",
      { cause: error },
    );
  }
  nextRuntime.process.once("exit", () => {
    if (quitting) return;
    mainWindow?.destroy();
    mainWindow = null;
    dialog.showErrorBox(
      product.canonical,
      "Локальный web-runtime неожиданно завершился. Приложение будет закрыто.",
    );
    app.quit();
  });
  createWindow(nextRuntime.origin, demoNextRuntime?.origin);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  ipcMain.handle('recovery:close', () => app.quit());
  ipcMain.handle('license:choose-and-activate', async (_event, request: unknown) => {
    if (!licenseActivationAction || !request || typeof request !== 'object' || typeof (request as { password?: unknown }).password !== 'string') return { state: 'INVALID', message: 'Активация недоступна.' };
    try {
      const result = await licenseActivationAction((request as { password: string }).password);
      if (result.state === 'VALID') { quitting = true; app.relaunch(); app.quit(); }
      return { state: result.state, message: result.message };
    } catch (error) {
      appendRedactedRuntimeLog(app.getPath('logs'), `license activation failed: ${error instanceof Error ? error.message : 'unknown'}`);
      return { state: 'INVALID', message: 'Файл лицензии не прошёл проверку.' };
    }
  });
  ipcMain.handle('recovery:diagnostics', () => shell.openPath(app.getPath('logs')));
  ipcMain.handle('recovery:restore', async (_event, request: unknown) => {
    if (!recoveryRestoreAction || !request || typeof request !== 'object') return { ok: false, error: 'Восстановление недоступно.' };
    const value = request as Partial<RecoveryRequest>;
    if (![value.snapshotId,value.confirmation,value.password,value.installationConfirmation].every((item) => typeof item === 'string')) return { ok: false, error: 'Некорректный запрос восстановления.' };
    try {
      await recoveryRestoreAction(value as RecoveryRequest);
      app.relaunch(); app.exit(0);
      return { ok: true };
    } catch (error) {
      appendRedactedRuntimeLog(app.getPath('logs'), `recovery restore failed: ${error instanceof Error ? error.message : 'unknown'}`);
      const code = error instanceof Error ? error.message : '';
      const errorMessage = code.includes('PASSWORD') ? 'Текущий пароль не подтверждён.' : code.includes('CHECKSUM') || code.includes('FORMAT') || code.includes('INSTALLATION') || code.includes('POSTGRES') ? 'Проверка точки восстановления не пройдена. Текущая база не изменена.' : 'Восстановление не завершено. PRE-RESTORE snapshot и диагностика сохранены.';
      return { ok: false, error: errorMessage };
    }
  });
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.on("before-quit", (event) => {
    if (shutdownStarted) return;
    event.preventDefault();
    shutdownStarted = true;
    quitting = true;
    const web = nextRuntime;
    const demoWeb = demoNextRuntime;
    const database = databaseRuntime;
    nextRuntime = null;
    demoNextRuntime = null;
    databaseRuntime = null;
    demoWeb?.stop();
    void stopPackagedServices({ web, database }).finally(() => app.exit(0));
  });
  app
    .whenReady()
    .then(() => {
      if (!isDevelopment) Menu.setApplicationMenu(null);
      return startApplication();
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown packaged runtime error";
      const cause =
        error instanceof Error && error.cause
          ? errorChain(error.cause)
          : undefined;
      console.error("Packaged runtime startup failed", { message, cause });
      appendRedactedRuntimeLog(app.getPath("logs"), `packaged startup failed: ${message}${cause ? `; ${cause}` : ""}`);
      const userMessage =
        message === "SECURITY_STORE_UNAVAILABLE"
          ? `Не удалось инициализировать защищённое хранилище ${product.shortProductName}.`
          : message === "SECURITY_STORE_UNREADABLE"
            ? "Не удалось открыть защищённые данные этой установки. Возможно, данные были перенесены с другого компьютера или профиль Windows был изменён."
            : message === "DATABASE_STARTUP_FAILED"
              ? "Не удалось обновить локальную базу данных."
              : "Не удалось запустить локальный web-runtime. Приложение будет закрыто.";
      if (message === "DATABASE_STARTUP_FAILED") createRecoveryWindow(userMessage);
      else { dialog.showErrorBox(product.canonical, userMessage); app.quit(); }
    });
  app.on("activate", () => {
    if (
      BrowserWindow.getAllWindows().length === 0 &&
      !quitting &&
      !app.isPackaged
    )
      void startApplication();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
