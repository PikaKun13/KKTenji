// preload: 最小 API のみを contextBridge で公開（設計書 §12）
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('kk', {
  openFileDialog: () => ipcRenderer.invoke('open-file'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder'),
  readTextFile: (p) => ipcRenderer.invoke('read-file', p),
  listDir: (d) => ipcRenderer.invoke('list-dir', d),
  exportPptx: (p) => ipcRenderer.invoke('export-pptx', p),
  getCacheDir: () => ipcRenderer.invoke('cache-dir'),
  hasOffice: () => ipcRenderer.invoke('has-office'),
  onExportProgress: (cb) => ipcRenderer.on('export-progress', (_e, p) => cb(p)),
  onOpenPath: (cb) => ipcRenderer.on('open-path', (_e, p) => cb(p)),
  // ドロップされた File → 実パス（Electron 32+ は File.path 廃止のため webUtils 経由）。
  // 実在の File からしかパスを得られないので、そのまま白名单へ登録してよい。
  pathForFile: async (f) => {
    let p = '';
    try { p = webUtils.getPathForFile(f); } catch { /* File 以外は無視 */ }
    if (!p) return null;
    await ipcRenderer.invoke('grant-path', p);
    return p;
  },
  listRecent: () => ipcRenderer.invoke('recent-list'),
  addRecent: (p, title) => ipcRenderer.invoke('recent-add', p, title),
  removeRecent: (p) => ipcRenderer.invoke('recent-remove', p),
});
