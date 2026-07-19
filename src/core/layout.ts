// 決定的 tidy tree レイアウト（設計書 §6.1。モックアップ layout() の一般化）
import type { ParsedDeck, TenjiNode } from './types';

export interface NodeBox { x: number; y: number; w: number; h: number; depth: number; }
export interface LayoutResult {
  boxes: Map<string, NodeBox>;
  bounds: { x: number; y: number; w: number; h: number };
}

const SIZE = [
  { w: 250, h: 92 },
  { w: 222, h: 74 },
  { w: 200, h: 58 },
] as const;
const COLX = [70, 440, 830] as const;
const COL_STEP = 390;
const GAP = 26;
const ROOT_GAP = 52;

export function layoutDeck(deck: ParsedDeck): LayoutResult {
  const boxes = new Map<string, NodeBox>();
  let y = 0;

  const place = (n: TenjiNode, depth: number): NodeBox => {
    const tier = Math.min(depth, 2);
    const s = SIZE[tier];
    const x = depth <= 2 ? COLX[depth] : COLX[2] + (depth - 2) * COL_STEP;
    const kids = deck.children.get(n.id) ?? [];
    let box: NodeBox;
    if (kids.length === 0) {
      box = { x, y, w: s.w, h: s.h, depth };
      y += s.h + GAP;
    } else {
      const first = place(kids[0], depth + 1);
      let last = first;
      for (let i = 1; i < kids.length; i++) last = place(kids[i], depth + 1);
      const cy = (first.y + last.y + last.h) / 2 - s.h / 2;
      box = { x, y: cy, w: s.w, h: s.h, depth };
    }
    boxes.set(n.id, box);
    return box;
  };

  for (const r of deck.roots) {
    place(r, 0);
    y += ROOT_GAP;
  }

  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const b of boxes.values()) {
    x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
  }
  if (boxes.size === 0) { x1 = 0; y1 = 0; x2 = 0; y2 = 0; }
  return { boxes, bounds: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } };
}
