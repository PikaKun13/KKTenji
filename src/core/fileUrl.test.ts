import { describe, it, expect } from 'vitest';
import { toFileUrl } from './fileUrl';

describe('toFileUrl', () => {
  it('ドライブレターの : は温存し、区切りは / に統一する', () => {
    expect(toFileUrl('C:\\Users\\a\\deck.png')).toBe('file:///C:/Users/a/deck.png');
  });

  it('空白・#・% を含むセグメントを encode する', () => {
    expect(toFileUrl('C:\\My Docs\\v#2\\10%引き.png'))
      .toBe('file:///C:/My%20Docs/v%232/10%25%E5%BC%95%E3%81%8D.png');
  });

  it('日本語ファイル名も URL として妥当になる', () => {
    const u = toFileUrl('C:\\資料\\p1.png');
    expect(u.startsWith('file:///C:/')).toBe(true);
    expect(decodeURIComponent(u)).toBe('file:///C:/資料/p1.png');
  });
});
