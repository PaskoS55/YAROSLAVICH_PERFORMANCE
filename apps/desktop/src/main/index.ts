import { app, BrowserWindow, dialog, Menu, safeStorage, shell } from "electron";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { handleSquirrelStartup } from "./squirrel-startup";
import { startPackagedNext, type PackagedNextRuntime } from "./packaged-next";
import { resolveRuntimeTarget } from "./runtime-paths";
import { classifyNavigation } from "./url-policy";
import { loadProductIdentity } from "./product-identity";
import {
  resolveE2eDataRoot,
  startPackagedDatabase,
  type PackagedDatabaseRuntime,
} from "./packaged-database";
import {
  PackagedStartupError,
  startPackagedServices,
  stopPackagedServices,
} from "./startup-orchestrator";
import { InstallationSecurityStore } from "./installation-security";
import { detectClusterState, resolvePostgresPaths } from "./postgres";
import { generateInstallationSecurity } from "./installation-security";
import { PhaseFiveCredentialsProvider } from "./database-credentials";

if (handleSquirrelStartup()) app.quit();
const product = loadProductIdentity({
  isPackaged: app.isPackaged,
  resourcesPath: process.resourcesPath,
});
app.setAppUserModelId(product.appUserModelId);
const isDevelopment = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let nextRuntime: PackagedNextRuntime | null = null;
let databaseRuntime: PackagedDatabaseRuntime | null = null;
let quitting = false;
let shutdownStarted = false;

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

function createWindow(internalUrl: URL): void {
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
    const decision = classifyNavigation(target, internalUrl);
    if (decision === "internal") return;
    event.preventDefault();
    if (decision === "external") openExternal(target);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (classifyNavigation(url, internalUrl) === "external") openExternal(url);
    return { action: "deny" };
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  void mainWindow.loadURL(internalUrl.toString());
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
    const runtimeSource = {
      ...process.env,
      AUTH_SESSION_SECRET: security.secrets.authSessionSecret,
      PASKO_INSTALLATION_ID: security.installationId,
    };
    const services = await startPackagedServices({
      startDatabase: async () => {
        const runtime = await startPackagedDatabase({
          resourcesPath: process.resourcesPath,
          localAppData,
          dataRoot,
          credentialsProvider: legacyMigration
            ? new PhaseFiveCredentialsProvider(process.env)
            : {
                getCredentials: async () => ({
                  bootstrapPassword: security.secrets.databaseBootstrapPassword,
                  applicationPassword: security.secrets.databasePassword,
                }),
              },
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
  createWindow(nextRuntime.origin);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
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
    const database = databaseRuntime;
    nextRuntime = null;
    databaseRuntime = null;
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
      const logsPath = app.getPath("logs");
      mkdirSync(logsPath, { recursive: true });
      appendFileSync(
        path.join(logsPath, "runtime.log"),
        `${new Date().toISOString()} packaged startup failed: ${message}${cause ? `; ${cause}` : ""}\n`,
      );
      const userMessage =
        message === "SECURITY_STORE_UNAVAILABLE"
          ? `Не удалось инициализировать защищённое хранилище ${product.shortProductName}.`
          : message === "SECURITY_STORE_UNREADABLE"
            ? "Не удалось открыть защищённые данные этой установки. Возможно, данные были перенесены с другого компьютера или профиль Windows был изменён."
            : message === "DATABASE_STARTUP_FAILED"
              ? "Не удалось обновить локальную базу данных."
              : "Не удалось запустить локальный web-runtime. Приложение будет закрыто.";
      dialog.showErrorBox(product.canonical, userMessage);
      app.quit();
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
