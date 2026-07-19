// PNG キャッシュキー（設計書 §8）
import type { TenjiNode } from './types';

export function nodeCacheKey(node: TenjiNode, sourceHash: string): string {
  const ch = node.contentHash?.trim();
  if (ch) return `${node.id}@${ch}`;
  const page = node.page === null ? 'struct' : 'p' + node.page;
  return `${node.id}@${sourceHash.slice(0, 8)}-${page}`;
}
