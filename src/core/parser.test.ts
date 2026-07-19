import { describe, it, expect } from 'vitest';
import { parseTenji } from './parser';

const base = {
  version: 1,
  title: 'テスト',
  source: { type: 'md', path: 'deck.md', pageBy: 'h2' },
};

function make(over: object) {
  return JSON.stringify({ ...base, nodes: [], links: [], ...over });
}

describe('parseTenji 正常系', () => {
  it('roots / children を nodes 配列順で構築する', () => {
    const r = parseTenji(make({
      nodes: [
        { id: 'a', title: 'A', parent: null, page: 1 },
        { id: 'b', title: 'B', parent: 'a', page: 2 },
        { id: 'c', title: 'C', parent: 'a', page: 3 },
      ],
      links: [{ from: 'b', to: 'c', type: 'support', direction: '->' }],
    }));
    expect(r.fatal).toBeUndefined();
    const d = r.deck!;
    expect(d.roots.map(n => n.id)).toEqual(['a']);
    expect(d.children.get('a')!.map(n => n.id)).toEqual(['b', 'c']);
    expect(d.links).toHaveLength(1);
    expect(d.diagnostics).toHaveLength(0);
  });

  it('複数ルート（森）を許可する', () => {
    const r = parseTenji(make({
      nodes: [
        { id: 'a', title: 'A', parent: null, page: 1 },
        { id: 'b', title: 'B', parent: null, page: 2 },
      ],
    }));
    expect(r.deck!.roots.map(n => n.id)).toEqual(['a', 'b']);
    expect(r.deck!.diagnostics).toHaveLength(0);
  });
});

describe('parseTenji 異常系（寛容パース・大声報告）', () => {
  it('JSON 構文エラーは fatal', () => {
    const r = parseTenji('{oops');
    expect(r.deck).toBeUndefined();
    expect(r.fatal!.code).toBe('json-syntax');
  });

  it('nodes 配列なしは fatal', () => {
    const r = parseTenji(JSON.stringify({ version: 1 }));
    expect(r.fatal!.code).toBe('bad-shape');
  });

  it('id 重複は後者無効 + warn dup-id', () => {
    const r = parseTenji(make({
      nodes: [
        { id: 'a', title: 'A1', parent: null, page: 1 },
        { id: 'a', title: 'A2', parent: null, page: 2 },
      ],
    }));
    expect(r.deck!.nodes.get('a')!.title).toBe('A1');
    expect(r.deck!.diagnostics.some(d => d.code === 'dup-id')).toBe(true);
  });

  it('parent 不在はルート化 + warn orphan', () => {
    const r = parseTenji(make({
      nodes: [{ id: 'a', title: 'A', parent: 'ghost', page: 1 }],
    }));
    expect(r.deck!.roots.map(n => n.id)).toEqual(['a']);
    expect(r.deck!.diagnostics.some(d => d.code === 'orphan')).toBe(true);
  });

  it('親子循環は切断してルート化 + warn cycle', () => {
    const r = parseTenji(make({
      nodes: [
        { id: 'a', title: 'A', parent: 'b', page: 1 },
        { id: 'b', title: 'B', parent: 'a', page: 2 },
      ],
    }));
    expect(r.deck!.roots.length).toBeGreaterThanOrEqual(1);
    expect(r.deck!.diagnostics.some(d => d.code === 'cycle')).toBe(true);
    // 切断後は全ノードがいずれかのルートから到達可能
    expect(r.deck!.nodes.size).toBe(2);
  });

  it('link 端点不在は捨てる + warn bad-link', () => {
    const r = parseTenji(make({
      nodes: [{ id: 'a', title: 'A', parent: null, page: 1 }],
      links: [{ from: 'a', to: 'ghost', type: 'support', direction: '->' }],
    }));
    expect(r.deck!.links).toHaveLength(0);
    expect(r.deck!.diagnostics.some(d => d.code === 'bad-link')).toBe(true);
  });

  it('自環 link は捨てる + warn self-loop', () => {
    const r = parseTenji(make({
      nodes: [{ id: 'a', title: 'A', parent: null, page: 1 }],
      links: [{ from: 'a', to: 'a', type: 'echo', direction: '<->' }],
    }));
    expect(r.deck!.links).toHaveLength(0);
    expect(r.deck!.diagnostics.some(d => d.code === 'self-loop')).toBe(true);
  });

  it('完全重複 link は 1 本に + warn dup-link', () => {
    const l = { from: 'a', to: 'b', type: 'cause', direction: '->' };
    const r = parseTenji(make({
      nodes: [
        { id: 'a', title: 'A', parent: null, page: 1 },
        { id: 'b', title: 'B', parent: null, page: 2 },
      ],
      links: [l, l],
    }));
    expect(r.deck!.links).toHaveLength(1);
    expect(r.deck!.diagnostics.some(d => d.code === 'dup-link')).toBe(true);
  });

  it('逆向き -> ペアは <-> 1 本に正規化 + warn two-way-merge', () => {
    const r = parseTenji(make({
      nodes: [
        { id: 'a', title: 'A', parent: null, page: 1 },
        { id: 'b', title: 'B', parent: null, page: 2 },
      ],
      links: [
        { from: 'a', to: 'b', type: 'echo', direction: '->' },
        { from: 'b', to: 'a', type: 'echo', direction: '->' },
      ],
    }));
    expect(r.deck!.links).toHaveLength(1);
    expect(r.deck!.links[0].direction).toBe('<->');
    expect(r.deck!.diagnostics.some(d => d.code === 'two-way-merge')).toBe(true);
  });

  it('未知 link type は保持 + warn unknown-type', () => {
    const r = parseTenji(make({
      nodes: [
        { id: 'a', title: 'A', parent: null, page: 1 },
        { id: 'b', title: 'B', parent: null, page: 2 },
      ],
      links: [{ from: 'a', to: 'b', type: 'mystery', direction: '->' }],
    }));
    expect(r.deck!.links).toHaveLength(1);
    expect(r.deck!.diagnostics.some(d => d.code === 'unknown-type')).toBe(true);
  });

  it('flow の不明 id は除去 + warn bad-flow-ref', () => {
    const r = parseTenji(make({
      nodes: [{ id: 'a', title: 'A', parent: null, page: 1 }],
      flow: ['a', 'ghost'],
    }));
    expect(r.deck!.doc.flow).toEqual(['a']);
    expect(r.deck!.diagnostics.some(d => d.code === 'bad-flow-ref')).toBe(true);
  });

  it('0 ノードでも deck を返す + warn empty', () => {
    const r = parseTenji(make({ nodes: [] }));
    expect(r.deck).toBeDefined();
    expect(r.deck!.diagnostics.some(d => d.code === 'empty')).toBe(true);
  });
});
