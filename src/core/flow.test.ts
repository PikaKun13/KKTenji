import { describe, it, expect } from 'vitest';
import { parseTenji } from './parser';
import { effectiveFlow } from './flow';

function deckOf(nodes: object[], flow?: string[]) {
  const r = parseTenji(JSON.stringify({
    version: 1, title: 't', source: { type: 'md', path: 'd.md', pageBy: 'h2' },
    nodes, links: [], ...(flow ? { flow } : {}),
  }));
  return r.deck!;
}

const NODES = [
  { id: 'r', title: 'R', parent: null, page: 1 },
  { id: 'c1', title: 'C1', parent: 'r', page: null },
  { id: 'p1', title: 'P1', parent: 'c1', page: 2 },
  { id: 'c2', title: 'C2', parent: 'r', page: null },
];

describe('effectiveFlow', () => {
  it('flow があればそれを使う', () => {
    expect(effectiveFlow(deckOf(NODES, ['p1', 'r']))).toEqual(['p1', 'r']);
  });
  it('flow が無ければ森を roots 順に深さ優先', () => {
    expect(effectiveFlow(deckOf(NODES))).toEqual(['r', 'c1', 'p1', 'c2']);
  });
  it('空 flow はフォールバック', () => {
    expect(effectiveFlow(deckOf(NODES, []))).toEqual(['r', 'c1', 'p1', 'c2']);
  });
});
