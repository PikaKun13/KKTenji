// Electron レンダラ側シェル（preload の window.kk ブリッジを ShellApi に適合させる）
import type { ExportResult, ShellApi } from './api';

interface KkBridge {
  openFileDialog(): Promise<string | null>;
  openFolderDialog(): Promise<string | null>;
  readTextFile(path: string): Promise<string>;
  listDir(dir: string): Promise<string[]>;
  exportPptx(pptxPath: string): Promise<ExportResult>;
  getCacheDir(): Promise<string>;
  hasOffice(): Promise<boolean>;
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
    fileUrl(path: string) {
      return 'file:///' + path.replace(/\\/g, '/').replace(/^\/+/, '');
    },
    dirname(path: string) {
      const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
      return i < 0 ? '' : path.slice(0, i);
    },
    join(...parts: string[]) {
      return parts.filter(Boolean).join('\\');
    },
  };
}
