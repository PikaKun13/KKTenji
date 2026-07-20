import { defineConfig, type Plugin } from 'vitest/config';

// 本番ビルドのみ CSP を注入する（dev は Vite の HMR/inline style が必要なため対象外）。
// DOMPurify が破られても外部送信・外部スクリプトを遮断する二重防御（設計書 §12）。
const CSP = [
  "default-src 'none'",
  "script-src 'self' file:",
  "style-src 'self' file: 'unsafe-inline'",
  "img-src 'self' file: data:",
  "font-src 'self' file: data:",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  "frame-src 'none'",
].join('; ');

const injectCsp: Plugin = {
  name: 'kk-inject-csp',
  apply: 'build',
  transformIndexHtml() {
    return [{
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
      injectTo: 'head-prepend' as const,
    }];
  },
};

export default defineConfig({
  base: './',
  build: { outDir: 'dist-web' },
  test: { environment: 'jsdom' },
  plugins: [injectCsp],
});
