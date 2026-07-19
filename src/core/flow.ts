// プレゼン進行順（設計書 §4.4: flow 欠落時は森を roots 順に深さ優先）
import type { ParsedDeck, TenjiNode } from './types';

export function effectiveFlow(deck: ParsedDeck): string[] {
  if (deck.doc.flow && deck.doc.flow.length > 0) return [...deck.doc.flow];
  const out: string[] = [];
  const walk = (n: TenjiNode) => {
    out.push(n.id);
    for (const c of deck.children.get(n.id) ?? []) walk(c);
  };
  for (const r of deck.roots) walk(r);
  return out;
}
