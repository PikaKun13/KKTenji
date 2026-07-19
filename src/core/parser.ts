// 寛容パース・大声報告（設計書 §4.7）
import type { Diagnostic, LinkType, ParsedDeck, TenjiDoc, TenjiLink, TenjiNode } from './types';

const LINK_TYPES: readonly string[] = ['support', 'echo', 'contrast', 'cause'];

export function parseTenji(jsonText: string): { deck?: ParsedDeck; fatal?: Diagnostic } {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch (e) {
    return { fatal: { level: 'error', code: 'json-syntax', message: `JSON 構文エラー: ${(e as Error).message}` } };
  }
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as { nodes?: unknown }).nodes)) {
    return { fatal: { level: 'error', code: 'bad-shape', message: 'nodes 配列がありません' } };
  }
  const doc = raw as TenjiDoc;
  const diagnostics: Diagnostic[] = [];
  const warn = (code: string, message: string, nodeId?: string) =>
    diagnostics.push({ level: 'warn', code, message, nodeId });

  // ノード取り込み: id 重複は後者無効
  const nodes = new Map<string, TenjiNode>();
  for (const n of doc.nodes) {
    if (!n || typeof n.id !== 'string' || n.id === '') {
      warn('bad-node', 'id の無いノードを無視しました');
      continue;
    }
    if (nodes.has(n.id)) {
      warn('dup-id', `id 重複: ${n.id}（後者を無視）`, n.id);
      continue;
    }
    nodes.set(n.id, { ...n, parent: n.parent ?? null, page: n.page ?? null });
  }

  // parent 不在 → ルート化
  for (const n of nodes.values()) {
    if (n.parent !== null && !nodes.has(n.parent)) {
      warn('orphan', `親 ${n.parent} が見つからないためルート化: ${n.id}`, n.id);
      n.parent = null;
    }
  }

  // 親子循環: 親鏈を辿り、訪問中集合への再入で検出 → その辺を切断
  {
    const state = new Map<string, 1 | 2>(); // 1=訪問中 2=確定
    for (const start of nodes.values()) {
      const chain: TenjiNode[] = [];
      let cur: TenjiNode | undefined = start;
      while (cur && !state.has(cur.id)) {
        state.set(cur.id, 1);
        chain.push(cur);
        cur = cur.parent !== null ? nodes.get(cur.parent) : undefined;
      }
      if (cur && state.get(cur.id) === 1) {
        warn('cycle', `親子循環を検出、${cur.id} をルート化`, cur.id);
        cur.parent = null;
      }
      for (const n of chain) state.set(n.id, 2);
    }
  }

  // 深さ上限（不可信入力の一本鎖による再帰スタック溢れ防止。超過分はルート直下へ）
  {
    const MAX_DEPTH = 64;
    const depth = new Map<string, number>();
    for (const n of nodes.values()) {
      const chain: TenjiNode[] = [];
      let cur: TenjiNode | undefined = n;
      while (cur && !depth.has(cur.id)) {
        chain.push(cur);
        cur = cur.parent !== null ? nodes.get(cur.parent) : undefined;
      }
      let d = cur ? depth.get(cur.id)! : -1;
      for (let i = chain.length - 1; i >= 0; i--) {
        d += 1;
        depth.set(chain[i].id, d);
      }
    }
    let tooDeep = 0;
    for (const n of nodes.values()) {
      if ((depth.get(n.id) ?? 0) > MAX_DEPTH) {
        n.parent = null;
        tooDeep++;
      }
    }
    if (tooDeep > 0) warn('too-deep', `階層が深すぎる ${tooDeep} 件のノードをルート直下へ移動しました`);
  }

  // links（双方向は無向キーで正規化。設計書 §4.3）
  const links: TenjiLink[] = [];
  const seen = new Set<string>();
  const undirKey = (a: string, b: string, type: string) => {
    const [x, y] = a < b ? [a, b] : [b, a];
    return `${x}|${y}|${type}|<->`;
  };
  const rawLinks = Array.isArray(doc.links) ? doc.links : [];
  for (const l of rawLinks) {
    if (!l || !nodes.has(l.from) || !nodes.has(l.to)) {
      warn('bad-link', `端点不明の link を無視: ${l?.from} → ${l?.to}`);
      continue;
    }
    if (l.from === l.to) {
      warn('self-loop', `自環 link を無視: ${l.from}`, l.from);
      continue;
    }
    const direction: '->' | '<->' = l.direction === '<->' ? '<->' : '->';
    if (!LINK_TYPES.includes(l.type)) {
      warn('unknown-type', `未知の関係種別 ${String(l.type)}（中性描画します）`);
    }
    const key = direction === '<->'
      ? undirKey(l.from, l.to, l.type)
      : `${l.from}|${l.to}|${l.type}|->`;
    if (seen.has(key)) {
      warn('dup-link', `重複 link を除去: ${l.from} → ${l.to}`);
      continue;
    }
    const prev = links.find(
      x => x.type === l.type && x.direction === '->' &&
        ((x.from === l.to && x.to === l.from) || (direction === '<->' && x.from === l.from && x.to === l.to)),
    );
    if (direction === '->' && seen.has(undirKey(l.from, l.to, l.type))) {
      // 既存の <-> がこのペアを既に覆っている
      warn('dup-link', `既存の <-> と重複: ${l.from} → ${l.to}`);
      continue;
    }
    if (prev) {
      // 逆向き -> ペア、または -> と明示 <-> の混在は 1 本の <-> に統合
      prev.direction = '<->';
      seen.add(undirKey(l.from, l.to, l.type));
      warn('two-way-merge', `双方向関係を <-> に統合: ${l.from} ⇄ ${l.to}`);
      continue;
    }
    seen.add(key);
    links.push({ ...l, direction });
  }

  // children / roots（nodes 配列順 = 兄弟順。設計書 §4.2）
  const children = new Map<string, TenjiNode[]>();
  const roots: TenjiNode[] = [];
  for (const n of nodes.values()) {
    if (n.parent === null) {
      roots.push(n);
    } else {
      const arr = children.get(n.parent) ?? [];
      arr.push(n);
      children.set(n.parent, arr);
    }
  }

  // flow: 不明 id を除去
  let flow: string[] | undefined;
  if (Array.isArray(doc.flow)) {
    flow = doc.flow.filter(id => {
      const ok = nodes.has(id);
      if (!ok) warn('bad-flow-ref', `flow の不明 id を除去: ${id}`);
      return ok;
    });
  }

  if (nodes.size === 0) warn('empty', 'ノードが 0 件です');

  return { deck: { doc: { ...doc, flow }, nodes, children, roots, links, diagnostics } };
}
