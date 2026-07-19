// ブラウザ開発用シェル（npm run dev。sample deck のみ扱える）
import type { ShellApi } from './api';

export function browserShell(): ShellApi {
  return {
    kind: 'browser',
    async openFileDialog() {
      // 開発用: ダイアログの代わりに sample を返す
      return 'sample/deck.tenji.json';
    },
    async openFolderDialog() {
      return 'sample';
    },
    async readTextFile(path: string) {
      const res = await fetch('/' + path.replace(/\\/g, '/'));
      if (!res.ok) throw new Error(`読み込み失敗: ${path} (${res.status})`);
      return res.text();
    },
    async listDir(dir: string) {
      return dir === 'sample' ? ['deck.md', 'deck.tenji.json'] : [];
    },
    async exportPptx() {
      return { error: 'NO_OFFICE' };
    },
    async getCacheDir() {
      return '';
    },
    fileUrl(path: string) {
      return '/' + path.replace(/\\/g, '/');
    },
    async hasOffice() {
      return false;
    },
    dirname(path: string) {
      const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
      return i < 0 ? '' : path.slice(0, i);
    },
    join(...parts: string[]) {
      return parts.filter(Boolean).join('/');
    },
  };
}
