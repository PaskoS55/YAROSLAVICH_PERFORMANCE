import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('paskoRecovery', Object.freeze({
  close: () => ipcRenderer.invoke('recovery:close'),
  diagnostics: () => ipcRenderer.invoke('recovery:diagnostics'),
  restore: (request: { snapshotId: string; confirmation: string; password: string; installationConfirmation: string }) => ipcRenderer.invoke('recovery:restore', request),
}));
