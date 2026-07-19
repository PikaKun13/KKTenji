import { describe, it, expect } from 'vitest';
import { splitMdPages, renderMd } from './mdrender';

describe('splitMdPages', () => {
  it('h2: 前文 + ## ごとに切る', () => {
    const md = '# タイトル\n前文\n\n## 第1章\n本文1\n\n## 第2章\n本文2';
    const p = splitMdPages(md, 'h2');
    expect(p).toHaveLength(3);
    expect(p[0]).toContain('# タイトル');
    expect(p[1].startsWith('## 第1章')).toBe(true);
    expect(p[2].startsWith('## 第2章')).toBe(true);
  });
  it('### は切らない', () => {
    const p = splitMdPages('## A\n### 小見出し\n本文', 'h2');
    expect(p).toHaveLength(1);
  });
  it('hr: --- で切る', () => {
    const p = splitMdPages('頁1\n\n---\n\n頁2', 'hr');
    expect(p).toEqual(['頁1', '頁2']);
  });
});

describe('renderMd sanitize', () => {
  it('script は除去される', () => {
    const el = renderMd('こんにちは <script>alert(1)</script>');
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain('こんにちは');
  });
  it('onerror 属性は除去される', () => {
    const el = renderMd('<img src="x.png" onerror="alert(1)">');
    const img = el.querySelector('img');
    expect(img?.getAttribute('onerror')).toBeNull();
  });
  it('http(s) 画像は既定で読み込まない', () => {
    const el = renderMd('![外部](https://example.com/a.png) ![ローカル](img/a.png)');
    const imgs = el.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute('src')).toBe('img/a.png');
  });
  it('video/source などの遠隔 URI も剥がされる', () => {
    const el = renderMd('<video src="https://evil.example/x.mp4" poster="https://evil.example/p.png"></video>');
    const v = el.querySelector('video');
    expect(v?.getAttribute('src')).toBeNull();
    expect(v?.getAttribute('poster')).toBeNull();
  });
  it('GFM 表を描画する', () => {
    const el = renderMd('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(el.querySelector('table')).not.toBeNull();
  });
});
