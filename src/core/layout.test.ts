import { describe, it, expect } from 'vitest';
import { parseTenji } from './parser';
import { layoutDeck } from './layout';

function deckOf(nodes: object[]) {
  return parseTenji(JSON.stringify({
    version: 1, title: 't', source: { type: 'md', path: 'd.md', pageBy: 'h2' },
    nodes, links: [],
  })).deck!;
}

const TREE = [
  { id: 'r', title: 'R', parent: null, page: 1 },
  { id: 'a', title: 'A', parent: 'r', page: null },
  { id: 'a1', title: 'A1', parent: 'a', page: 2 },
  { id: 'a2', title: 'A2', parent: 'a', page: 3 },
  { id: 'b', title: 'B', parent: 'r', page: null },
];

describe('layoutDeck', () => {
  it('決定性: 同一入力 → 同一結果', () => {
    const d = deckOf(TREE);
    const l1 = layoutDeck(d), l2 = layoutDeck(d);
    for (const [id, b] of l1.boxes) expect(l2.boxes.get(id)).toEqual(b);
  });

  it('親は子範囲の縦中央に置かれる', () => {
    const l = layoutDeck(deckOf(TREE));
    const a = l.boxes.get('a')!, a1 = l.boxes.get('a1')!, a2 = l.boxes.get('a2')!;
    const center = (a1.y + a2.y + a2.h) / 2;
    expect(a.y + a.h / 2).toBeCloseTo(center, 5);
  });

  it('深さで列が進む', () => {
    const l = layoutDeck(deckOf(TREE));
    expect(l.boxes.get('r')!.x).toBeLessThan(l.boxes.get('a')!.x);
    expect(l.boxes.get('a')!.x).toBeLessThan(l.boxes.get('a1')!.x);
  });

  it('森: 2 本目のルートは 1 本目の下に重ならず置かれる', () => {
    const l = layoutDeck(deckOf([
      { id: 'r1', title: 'R1', parent: null, page: 1 },
      { id: 'r2', title: 'R2', parent: null, page: 2 },
    ]));
    const r1 = l.boxes.get('r1')!, r2 = l.boxes.get('r2')!;
    expect(r2.y).toBeGreaterThanOrEqual(r1.y + r1.h);
  });

  it('bounds が全 box を包含する', () => {
    const l = layoutDeck(deckOf(TREE));
    for (const b of l.boxes.values()) {
      expect(b.x).toBeGreaterThanOrEqual(l.bounds.x);
      expect(b.y).toBeGreaterThanOrEqual(l.bounds.y);
      expect(b.x + b.w).toBeLessThanOrEqual(l.bounds.x + l.bounds.w);
      expect(b.y + b.h).toBeLessThanOrEqual(l.bounds.y + l.bounds.h);
    }
  });
});
