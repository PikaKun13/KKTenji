// シェル抽象層（設計書 §2。UI/core からのシェル機能利用は必ずこのインターフェース経由）
export interface ExportResult { pages?: number; dir?: string; error?: string; }

export interface ShellApi {
  kind: 'browser' | 'electron';
  openFileDialog(): Promise<string | null>;
  openFolderDialog(): Promise<string | null>;
  readTextFile(path: string): Promise<string>;
  listDir(dir: string): Promise<string[]>;
  exportPptx(pptxPath: string): Promise<ExportResult>;
  getCacheDir(): Promise<string>;
  fileUrl(path: string): string;
  hasOffice(): Promise<boolean>;
  dirname(path: string): string;
  join(...parts: string[]): string;
  /** pptx→PNG の増分進捗（electron のみ） */
  onExportProgress?(cb: (p: { i: number; n: number }) => void): void;
  /** 右クリック/関連付け/二重起動から渡されたパス（electron のみ） */
  onOpenPath?(cb: (path: string) => void): void;
}

declare global {
  interface Window { kk?: unknown; }
}

export async function pickShell(): Promise<ShellApi> {
  if (typeof window !== 'undefined' && window.kk) {
    const { electronShell } = await import('./electron');
    return electronShell();
  }
  const { browserShell } = await import('./browser');
  return browserShell();
}
