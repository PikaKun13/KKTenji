// Electron レンダラ側シェル（preload の window.kk ブリッジを ShellApi に適合させる）
import type { ExportResult, RecentEntry, ShellApi } from './api';
import { toFileUrl } from '../core/fileUrl';

interface KkBridge {
  openFileDialog(): Promise<string | null>;
  openFolderDialog(): Promise<string | null>;
  readTextFile(path: string): Promise<string>;
  listDir(dir: string): Promise<string[]>;
  exportPptx(pptxPath: string): Promise<ExportResult>;
  getCacheDir(): Promise<string>;
  hasOffice(): Promise<boolean>;
  onExportProgress(cb: (p: { i: number; n: number }) => void): void;
  onOpenPath(cb: (path: string) => void): void;
  pathForFile(f: File): Promise<string | null>;
  listRecent(): Promise<RecentEntry[]>;
  addRecent(path: string, title: string): Promise<void>;
  removeRecent(path: string): Promise<void>;
  appVersion(): Promise<string>;
  cacheStats(): Promise<{ bytes: number; decks: number }>;
  clearCache(): Promise<void>;
}

export function electronShell(): ShellApi {
  const kk = (window as unknown as { kk: KkBridge }).kk;
  return {
    kind: 'electron',
    openFileDialog: () => kk.openFileDialog(),
    openFolderDialog: () => kk.openFolderDialog(),
    readTextFile: p => kk.readTextFile(p),
    listDir: d => kk.listDir(d),
    exportPptx: p => kk.exportPptx(p),
    getCacheDir: () => kk.getCacheDir(),
    hasOffice: () => kk.hasOffice(),
    fileUrl: (path: string) => toFileUrl(path),
    dirname(path: string) {
      const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
      return i < 0 ? '' : path.slice(0, i);
    },
    join(...parts: string[]) {
      return parts.filter(Boolean).join('\\');
    },
    onExportProgress: cb => kk.onExportProgress(cb),
    onOpenPath: cb => kk.onOpenPath(cb),
    pathForFile: f => kk.pathForFile(f),
    listRecent: () => kk.listRecent(),
    addRecent: (p, t) => kk.addRecent(p, t),
    removeRecent: p => kk.removeRecent(p),
    appVersion: () => kk.appVersion(),
    cacheStats: () => kk.cacheStats(),
    clearCache: () => kk.clearCache(),
  };
}
