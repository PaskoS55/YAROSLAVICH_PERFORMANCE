import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('paskoIssuer', {
  selectKey: () => ipcRenderer.invoke('issuer:select-key'), selectMetadata: () => ipcRenderer.invoke('issuer:select-metadata'), selectFolder: () => ipcRenderer.invoke('issuer:select-folder'), selectLicense: () => ipcRenderer.invoke('issuer:select-license'),
  keyStatus: (file: string) => ipcRenderer.invoke('issuer:key-status', file), issue: (request: unknown) => ipcRenderer.invoke('issuer:issue', request), verify: (file: string, metadata: string, installationId?: string) => ipcRenderer.invoke('issuer:verify', file, metadata, installationId), ledger: () => ipcRenderer.invoke('issuer:ledger'), openFolder: (file: string) => ipcRenderer.invoke('issuer:open-folder', file), generateKey: (input: unknown) => ipcRenderer.invoke('issuer:generate-key', input),
});
