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

  // links
  const links: TenjiLink[] = [];
  const seen = new Set<string>();
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
    const key = `${l.from}|${l.to}|${l.type}|${direction}`;
    if (seen.has(key)) {
      warn('dup-link', `重複 link を除去: ${l.from} → ${l.to}`);
      continue;
    }
    if (direction === '->') {
      // 逆向き -> ペアは 1 本の <-> に正規化（設計書 §4.3）
      const prev = links.find(
        x => x.from === l.to && x.to === l.from && x.type === l.type && x.direction === '->',
      );
      if (prev) {
        prev.direction = '<->';
        warn('two-way-merge', `逆向きペアを <-> に統合: ${l.from} ⇄ ${l.to}`);
        seen.add(key);
        continue;
      }
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
