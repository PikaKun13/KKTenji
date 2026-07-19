// 関係インスペクター（選択時のみスライドイン。設計書 §6.1-3）
import type { ParsedDeck, TenjiNode } from '../core/types';
import { TYPE_JA } from './canvas';

export interface InspectorHandlers {
  onJump(id: string): void;
  onPreview(id: string): void;
}

export class Inspector {
  readonly el: HTMLDivElement;

  constructor(host: HTMLElement, private deck: ParsedDeck, private handlers: InspectorHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'inspector';
    host.appendChild(this.el);
  }

  show(n: TenjiNode, depth: number): void {
    const el = this.el;
    el.replaceChildren();

    const close = document.createElement('button');
    close.className = 'ins-close';
    close.textContent = '✕';
    close.addEventListener('click', () => this.hide());
    el.appendChild(close);

    const kind = document.createElement('div');
    kind.className = 'ins-k';
    kind.textContent = depth === 0 ? 'ルート' : n.page === null ? '章・構造' : 'ページ';
    if (n.page !== null) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = 'P' + n.page;
      kind.append(' ', chip);
    }
    el.appendChild(kind);

    const title = document.createElement('div');
    title.className = 'ins-t';
    title.textContent = n.title;
    el.appendChild(title);

    if (n.summary) {
      const k = document.createElement('div');
      k.className = 'ins-k';
      k.textContent = '要約';
      el.appendChild(k);
      const s = document.createElement('div');
      s.className = 'ins-sum';
      s.textContent = n.summary;
      el.appendChild(s);
    }

    const lks = this.deck.links.filter(l => l.from === n.id || l.to === n.id);
    const lk = document.createElement('div');
    lk.className = 'ins-k';
    lk.textContent = `関係リンク（${lks.length}）`;
    el.appendChild(lk);
    if (lks.length === 0) {
      const none = document.createElement('div');
      none.className = 'ins-sum';
      none.textContent = 'なし';
      el.appendChild(none);
    }
    for (const l of lks) {
      const other = l.from === n.id ? l.to : l.from;
      const otherNode = this.deck.nodes.get(other);
      const row = document.createElement('div');
      row.className = 'ins-lk';
      const dot = document.createElement('i');
      dot.style.background = `var(--lk-${['support', 'echo', 'contrast', 'cause'].includes(l.type) ? l.type : 'unknown'})`;
      row.appendChild(dot);
      const arrow = l.direction === '<->' ? '⟷' : l.from === n.id ? '→' : '←';
      const txt = document.createElement('span');
      txt.textContent = `${TYPE_JA[l.type] ?? l.type} ${arrow} ${otherNode?.title ?? other}`;
      row.appendChild(txt);
      if (l.label) {
        const lbl = document.createElement('span');
        lbl.className = 'lbl';
        lbl.textContent = l.label;
        row.appendChild(lbl);
      }
      row.addEventListener('click', () => this.handlers.onJump(other));
      el.appendChild(row);
    }

    if (n.page !== null) {
      const btn = document.createElement('button');
      btn.className = 'ins-btn';
      btn.textContent = 'この頁をプレビュー';
      btn.addEventListener('click', () => this.handlers.onPreview(n.id));
      el.appendChild(btn);
    }

    el.classList.add('open');
  }

  hide(): void { this.el.classList.remove('open'); }
}
