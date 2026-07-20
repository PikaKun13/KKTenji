// ローカルパス → file: URL（空白・#・% 等を含むパスでも壊れない encode 付き）
export function toFileUrl(p: string): string {
  const segs = p.replace(/\\/g, '/').replace(/^\/+/, '').split('/');
  return 'file:///' + segs
    .map((s, i) => (i === 0 && /^[A-Za-z]:$/.test(s) ? s : encodeURIComponent(s)))
    .join('/');
}
