import { describe, it, expect } from 'vitest';
import { nodeCacheKey } from './cacheKey';

describe('nodeCacheKey', () => {
  it('contentHash があればそれを使う', () => {
    expect(nodeCacheKey(
      { id: 'market', title: 'm', parent: null, page: 2, contentHash: 'abc12345' },
      'ffffffffffff',
    )).toBe('market@abc12345');
  });
  it('無ければ source hash 先頭8桁 + -p頁番号', () => {
    expect(nodeCacheKey(
      { id: 'market', title: 'm', parent: null, page: 2 },
      'deadbeefcafe',
    )).toBe('market@deadbeef-p2');
  });
  it('空文字 contentHash は回退させる', () => {
    expect(nodeCacheKey(
      { id: 'market', title: 'm', parent: null, page: 2, contentHash: '' },
      'deadbeefcafe',
    )).toBe('market@deadbeef-p2');
  });
  it('構造ノード(page null)は -struct', () => {
    expect(nodeCacheKey(
      { id: 'ch1', title: 'c', parent: null, page: null },
      'deadbeefcafe',
    )).toBe('ch1@deadbeef-struct');
  });
});
