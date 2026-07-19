// 頁プレビュー（FLIP 展開 + 煙幕。モックアップ openPreview/closePreview の移植）
import type { TenjiNode } from '../core/types';

export interface PreviewContent {
  el: HTMLElement;        // 描画済み本文（md ならば sanitize 済み）
  sourceLabel: string;    // 「md レンダリング」「PowerPoint 書き出し PNG」等
  note: string;           // 下部の補足文
}

export interface FromRect { x: number; y: number; w: number; h: number; }

export class Preview {
  readonly smoke: HTMLDivElement;
  readonly pv: HTMLDivElement;
  isOpen = false;
  onClosed?: () => void;
  private presenting = false;

  constructor(host: HTMLElement) {
    this.smoke = document.createElement('div');
    this.smoke.className = 'smoke';
    this.pv = document.createElement('div');
    this.pv.className = 'preview';
    host.appendChild(this.smoke);
    host.appendChild(this.pv);
    this.smoke.addEventListener('click', () => {
      if (!this.presenting) this.close();
    });
  }

  show(node: TenjiNode, content: PreviewContent, from: FromRect, viewW: number, viewH: number, presenting = false): void {
    this.presenting = presenting;
    const pv = this.pv;
    pv.replaceChildren();

    const head = document.createElement('div');
    head.className = 'pv-head';
    const t = document.createElement('span');
    t.className = 'pv-t';
    t.textContent = node.title;                       // 純テキスト描画（不可信入力）
    head.appendChild(t);
    if (node.page !== null) {
      const pg = document.createElement('span');
      pg.className = 'pv-pg';
      pg.textContent = 'P' + node.page;
      head.appendChild(pg);
    }
    const src = document.createElement('span');
    src.className = 'pv-pg';
    src.textContent = content.sourceLabel;
    head.appendChild(src);
    const x = document.createElement('button');
    x.className = 'pv-x';
    x.textContent = '✕';
    x.addEventListener('click', () => this.close());
    head.appendChild(x);
    pv.appendChild(head);

    const body = document.createElement('div');
    body.className = 'pv-body';
    body.appendChild(content.el);
    pv.appendChild(body);

    const note = document.createElement('div');
    note.className = 'pv-note';
    note.textContent = content.note;
    pv.appendChild(note);

    // FLIP: ノード矩形 → 中央シート
    const fw = Math.min(720, viewW * 0.78);
    pv.style.width = fw + 'px';
    pv.classList.remove('anim');
    pv.classList.add('open');
    pv.style.transform = `translate(${from.x}px,${from.y}px) scale(${Math.max(0.05, from.w / fw)})`;
    pv.style.opacity = '0';
    void pv.offsetWidth;
    const fh = pv.offsetHeight;
    const tx = (viewW - fw) / 2;
    const ty = Math.max(16, (viewH - fh) / 2);
    pv.classList.add('anim');
    pv.style.transform = `translate(${tx}px,${ty}px) scale(1)`;
    pv.style.opacity = '1';
    this.smoke.classList.add('on');
    this.isOpen = true;
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.pv.classList.remove('open');
    this.pv.style.opacity = '0';
    this.smoke.classList.remove('on');
    this.onClosed?.();
  }
}
