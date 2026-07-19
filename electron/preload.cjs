// preload: 最小 API のみを contextBridge で公開（設計書 §12）
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kk', {
  openFileDialog: () => ipcRenderer.invoke('open-file'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder'),
  readTextFile: (p) => ipcRenderer.invoke('read-file', p),
  listDir: (d) => ipcRenderer.invoke('list-dir', d),
  exportPptx: (p) => ipcRenderer.invoke('export-pptx', p),
  getCacheDir: () => ipcRenderer.invoke('cache-dir'),
  hasOffice: () => ipcRenderer.invoke('has-office'),
});
