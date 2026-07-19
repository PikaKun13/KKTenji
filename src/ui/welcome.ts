// Welcome / 空状態（設計書 §6.9）
export interface WelcomeHandlers {
  onOpenFile(): void;
  onOpenFolder(): void;
  onOpenSample(): void;
  onDropFile(path: string): void;
}

export interface WelcomeView {
  el: HTMLDivElement;
  hide(): void;
  show(): void;
}

export function renderWelcome(host: HTMLElement, handlers: WelcomeHandlers): WelcomeView {
  const w = document.createElement('div');
  w.className = 'welcome';

  const h1 = document.createElement('h1');
  h1.textContent = 'KKTenji';
  const sub = document.createElement('div');
  sub.className = 'sub';
  sub.textContent = 'deck を思維関係図として展示するツール';
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

  const drop = document.createElement('div');
  drop.className = 'drop';
  drop.textContent = 'ここに .tenji.json / .md をドロップしても開けます';

  w.append(h1, sub, actions, drop);
  host.appendChild(w);

  w.addEventListener('dragover', e => { e.preventDefault(); w.classList.add('dragover'); });
  w.addEventListener('dragleave', () => w.classList.remove('dragover'));
  w.addEventListener('drop', e => {
    e.preventDefault();
    w.classList.remove('dragover');
    const f = e.dataTransfer?.files?.[0] as (File & { path?: string }) | undefined;
    if (f?.path) handlers.onDropFile(f.path);
  });

  return {
    el: w,
    hide() { w.classList.add('hidden'); },
    show() { w.classList.remove('hidden'); },
  };
}
