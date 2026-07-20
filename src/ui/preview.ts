// 頁プレビュー（FLIP 展開 + 煙幕。モックアップ openPreview/closePreview の移植）
import type { TenjiNode } from '../core/types';

export interface PreviewContent {
  el: HTMLElement;        // 描画済み本文（md ならば sanitize 済み）
  sourceLabel: string;    // 「md レンダリング」「PowerPoint 書き出し PNG」等
  note: string;           // 下部の補足文
}

export interface FromRect { x: number; y: number; w: number; h: number; }

// 表示サイズ 4 段階（利用可能領域に対する比率）。既定は 85%
const SCALES = [0.55, 0.7, 0.85, 1.0] as const;
const SCALE_KEY = 'kk.previewScale';

export class Preview {
  readonly smoke: HTMLDivElement;
  readonly pv: HTMLDivElement;
  isOpen = false;
  onClosed?: () => void;
  private presenting = false;
  private scaleIdx = 2;
  private lastViewW = 0;
  private lastViewH = 0;
  private isMd = false;

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
    const saved = localStorage.getItem(SCALE_KEY);
    if (saved !== null) {
      const n = Number(saved);
      if (Number.isInteger(n) && n >= 0 && n < SCALES.length) this.scaleIdx = n;
    }
  }

  /** 利用可能領域と現在の段階から幅を決める（16:9 の高さ制約も考慮） */
  private calcWidth(): number {
    const s = SCALES[this.scaleIdx];
    const maxW = this.lastViewW * 0.94 - 24;
    const maxByH = (this.lastViewH - 32 - 118) * (16 / 9); // ヘッダ+補足+余白 ≈118px
    let w = Math.max(320, Math.min(maxW, maxByH) * s);
    if (this.isMd) w = Math.min(w, 900); // md は行長を読める幅に抑える
    return w;
  }

  /** 表示サイズを 1 段階変える（+1 / -1）。設定は記憶される */
  resize(delta: number): void {
    const next = Math.max(0, Math.min(SCALES.length - 1, this.scaleIdx + delta));
    if (next === this.scaleIdx) return;
    this.scaleIdx = next;
    localStorage.setItem(SCALE_KEY, String(next));
    if (!this.isOpen) return;
    this.pv.style.width = this.calcWidth() + 'px';
    requestAnimationFrame(() => this.place(this.lastViewW, this.lastViewH));
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
    const szMinus = document.createElement('button');
    szMinus.className = 'pv-sz';
    szMinus.textContent = '−';
    szMinus.title = '表示を小さく（-）';
    szMinus.addEventListener('click', () => this.resize(-1));
    const szPlus = document.createElement('button');
    szPlus.className = 'pv-sz';
    szPlus.textContent = '＋';
    szPlus.title = '表示を大きく（+）';
    szPlus.addEventListener('click', () => this.resize(1));
    head.append(szMinus, szPlus);
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
    this.lastViewW = viewW;
    this.lastViewH = viewH;
    this.presenting = presenting;
    this.isMd = !!content.el.querySelector('.mdpage') || content.el.classList.contains('mdpage');
    const fw = this.calcWidth();
    pv.style.width = fw + 'px';
    pv.classList.remove('anim');
    pv.classList.add('open');
    pv.style.transform = `translate(${from.x}px,${from.y}px) scale(${Math.max(0.05, from.w / fw)})`;
    pv.style.opacity = '0';
    void pv.offsetWidth;
    pv.classList.add('anim');
    this.place(viewW, viewH);
    pv.style.opacity = '1';
    this.smoke.classList.add('on');
    this.isOpen = true;
    // 画像の読み込みで高さが変わったら再配置（低すぎ/はみ出し防止）
    content.el.querySelectorAll('img').forEach(img => {
      img.addEventListener('load', () => { if (this.isOpen) this.place(viewW, viewH); });
    });
  }

  /** 光学中心（上から42%）に置き、上下 16px を必ず確保する */
  private place(viewW: number, viewH: number): void {
    const fh = this.pv.offsetHeight;
    const fw = this.pv.offsetWidth;
    const tx = (viewW - fw) / 2;
    const ty = Math.max(16, Math.min((viewH - fh) * 0.42, viewH - fh - 16));
    this.pv.style.transform = `translate(${tx}px,${ty}px) scale(1)`;
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
