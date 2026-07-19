// md の切段と sanitize 済み描画（設計書 §10）
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/** md 全文を頁配列へ（pageBy: 'h2' = `##` 見出しごと / 'hr' = `---` ごと） */
export function splitMdPages(md: string, pageBy: 'h2' | 'hr'): string[] {
  if (pageBy === 'hr') {
    return md.split(/\n-{3,}\s*\n/).map(s => s.trim()).filter(s => s.length > 0);
  }
  const lines = md.split(/\r?\n/);
  const pages: string[] = [];
  let cur: string[] = [];
  for (const line of lines) {
    if (/^##\s(?!#)/.test(line) && cur.some(l => l.trim() !== '')) {
      pages.push(cur.join('\n').trim());
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.some(l => l.trim() !== '')) pages.push(cur.join('\n').trim());
  return pages;
}

// file:（electron のローカル画像）と相対パスを許可。http(s) は下の後処理で除去
const URI_ALLOW = /^(?:(?:file|https?):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

/** 1 頁分の md を sanitize 済み DOM に描画する */
export function renderMd(section: string, baseHref?: string): HTMLElement {
  const html = marked.parse(section, { async: false }) as string;
  const clean = DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style', 'form', 'input', 'iframe'],
    ALLOWED_URI_REGEXP: URI_ALLOW,
  });
  const div = document.createElement('div');
  div.className = 'mdpage';
  div.innerHTML = clean;
  // リモート資源は既定で読み込まない（設計書 §10）。file:/相対のみ残す
  div.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') ?? '';
    if (/^https?:/i.test(src)) { img.remove(); return; }
    if (baseHref && !/^[a-z]+:/i.test(src)) img.setAttribute('src', baseHref + src);
  });
  // リンクは新窓遷移させない（プレビュー内は表示専用）
  div.querySelectorAll('a').forEach(a => {
    a.removeAttribute('href');
  });
  return div;
}
