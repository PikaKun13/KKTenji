// 左アウトラインツリー（キャンバスとの双方向同期。設計書 §6.8）
import type { ParsedDeck, TenjiNode } from '../core/types';

export interface OutlineHandlers {
  onRowClick(id: string): void;
  onHover(id: string | null): void;
}

export interface OutlineView {
  setSelection(id: string | null): void;
  /** 検索: hits と祖先だけ表示（null = 全表示） */
  filter(visible: Set<string> | null): void;
  destroy(): void;
}

export function renderOutline(host: HTMLElement, deck: ParsedDeck, handlers: OutlineHandlers): OutlineView {
  const wrap = document.createElement('div');
  wrap.className = 'tree';
  const rows = new Map<string, HTMLDivElement>();

  const linkTypesOf = (id: string): string[] => {
    const ts: string[] = [];
    for (const l of deck.links) {
      if (l.from === id || l.to === id) ts.push(l.type);
    }
    return ts;
  };

  const addRow = (n: TenjiNode, depth: number): void => {
    const d = document.createElement('div');
    d.className = 'trow';
    d.style.paddingLeft = 8 + Math.min(depth, 6) * 20 + 'px';
    d.dataset.id = n.id;

    const nd = document.createElement('span');
    nd.className = 'nd d' + Math.min(depth, 2);
    d.appendChild(nd);

    const tt = document.createElement('span');
    tt.className = 'tt';
    tt.textContent = n.title;           // 純テキスト
    tt.title = n.title;
    d.appendChild(tt);

    const ts = linkTypesOf(n.id);
    if (ts.length > 0) {
      const dots = document.createElement('span');
      dots.className = 'lkdots';
      for (const t of ts) {
        const i = document.createElement('i');
        i.style.background = `var(--lk-${['support', 'echo', 'contrast', 'cause'].includes(t) ? t : 'unknown'})`;
        dots.appendChild(i);
      }
      d.appendChild(dots);
    }
    if (n.page !== null) {
      const pg = document.createElement('span');
      pg.className = 'pg';
      pg.textContent = 'P' + n.page;
      d.appendChild(pg);
    }

    d.addEventListener('click', () => handlers.onRowClick(n.id));
    d.addEventListener('pointerenter', () => handlers.onHover(n.id));
    d.addEventListener('pointerleave', () => handlers.onHover(null));
    rows.set(n.id, d);
    wrap.appendChild(d);
    for (const c of deck.children.get(n.id) ?? []) addRow(c, depth + 1);
  };

  for (const r of deck.roots) addRow(r, 0);
  host.appendChild(wrap);

  return {
    setSelection(id: string | null) {
      for (const [nid, el] of rows) {
        const on = nid === id;
        el.classList.toggle('sel', on);
        if (on) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    },
    filter(visible: Set<string> | null) {
      if (visible === null) {
        for (const el of rows.values()) el.style.display = '';
        return;
      }
      // hits + 祖先チェーンを可視に
      const show = new Set<string>();
      for (const id of visible) {
        let n = deck.nodes.get(id);
        while (n) {
          show.add(n.id);
          n = n.parent ? deck.nodes.get(n.parent) : undefined;
        }
      }
      for (const [nid, el] of rows) {
        el.style.display = show.has(nid) ? '' : 'none';
      }
    },
    destroy() { wrap.remove(); },
  };
}
