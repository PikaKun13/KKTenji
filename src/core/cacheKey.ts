// PNG キャッシュキー（設計書 §8）
import type { TenjiNode } from './types';

export function nodeCacheKey(node: TenjiNode, sourceHash: string): string {
  return `${node.id}@${node.contentHash ?? sourceHash.slice(0, 8) + '-p' + node.page}`;
}
