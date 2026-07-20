// Welcome / 空状態（設計書 §6.9）
import type { RecentEntry } from '../shell/api';

export interface WelcomeHandlers {
  onOpenFile(): void;
  onOpenFolder(): void;
  onOpenSample(): void;
  onOpenGuide(): void;
  /** パス解決はシェル層の仕事なので File のまま渡す（Electron 32+ は File.path 廃止） */
  onDropFile(f: File): void;
  onOpenRecent(path: string): void;
}

export interface WelcomeView {
  el: HTMLDivElement;
  hide(): void;
  show(): void;
  /** 起動失敗などの要点を Welcome 上に大きく表示する（null で消す） */
  setNotice(text: string | null): void;
  setRecent(items: RecentEntry[]): void;
  setVersion(v: string): void;
}

export function renderWelcome(host: HTMLElement, handlers: WelcomeHandlers): WelcomeView {
  const w = document.createElement('div');
  w.className = 'welcome';

  const h1 = document.createElement('h1');
  h1.textContent = 'KKTenji';
  const sub = document.createElement('div');
  sub.className = 'sub';
  sub.textContent = 'deck を思維関係図として展示するツール';
  const notice = document.createElement('div');
  notice.className = 'notice hidden';
  const actions = document.createElement('div');
  actions.className = 'actions';

  const mk = (label: string, primary: boolean, fn: () => void) => {
    const b = document.createElement('button');
    b.className = 'wbtn' + (primary ? ' primary' : '');
    b.textContent = label;
    b.addEventListener('click', fn);
    actions.appendChild(b);
  };
  mk('ファイルを開く', false, handlers.onOpenFile);
  mk('フォルダを開く', false, handlers.onOpenFolder);
  mk('サンプルを開く', true, handlers.onOpenSample);
  mk('deck の作り方', false, handlers.onOpenGuide);

  const recent = document.createElement('div');
  recent.className = 'recent hidden';

  const drop = document.createElement('div');
  drop.className = 'drop';
  drop.textContent = 'ここに .tenji.json / .md / .pptx をドロップしても開けます';

  w.append(h1, sub, notice, actions, recent, drop);
  host.appendChild(w);

  w.addEventListener('dragover', e => { e.preventDefault(); w.classList.add('dragover'); });
  w.addEventListener('dragleave', () => w.classList.remove('dragover'));
  w.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation(); // window 側のグローバル drop と二重発火させない
    w.classList.remove('dragover');
    const f = e.dataTransfer?.files?.[0];
    if (f) handlers.onDropFile(f);
  });

  return {
    el: w,
    hide() { w.classList.add('hidden'); },
    show() { w.classList.remove('hidden'); },
    setNotice(text: string | null) {
      if (text === null) {
        notice.classList.add('hidden');
        notice.textContent = '';
      } else {
        notice.textContent = text;
        notice.classList.remove('hidden');
      }
    },
    setVersion(v: string) {
      sub.textContent = `deck を思維関係図として展示するツール ・ v${v}`;
    },
    setRecent(items: RecentEntry[]) {
      recent.replaceChildren();
      if (items.length === 0) { recent.classList.add('hidden'); return; }
      const h = document.createElement('div');
      h.className = 'recent-head';
      h.textContent = '最近開いた deck';
      recent.appendChild(h);
      for (const it of items) {
        const b = document.createElement('button');
        b.className = 'recent-item';
        const t = document.createElement('span');
        t.className = 't';
        t.textContent = it.title || it.path.split(/[\\/]/).pop() || it.path;
        const p = document.createElement('span');
        p.className = 'p';
        p.textContent = it.path;
        b.append(t, p);
        b.title = it.path;
        b.addEventListener('click', () => handlers.onOpenRecent(it.path));
        recent.appendChild(b);
      }
      recent.classList.remove('hidden');
    },
  };
}
