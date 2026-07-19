// モーショントークン（設計書 §6.5 プリセット「ゆったり上質」— 直書き禁止、必ずここを経由）
export const DUR = {
  camera: 880,      // click 寄せ
  presStep: 1100,   // プレゼン步進
  overview: 1100,   // M 俯瞰 / 復帰
  fit: 850,         // フィット
  preview: 720,     // プレビュー FLIP
  smoke: 650,       // 煙幕
  focusDim: 500,    // フォーカス減光
  inspector: 550,   // インスペクター滑入
  chrome: 650,      // chrome 退場
  glowCycle: 2300,  // 流光循環
  pulse: 2400,      // 呼吸リング
} as const;

export const WHEEL_LERP = 0.12; // ホイールズーム追随係数 /frame

export const PREVIEW_BEZIER = 'cubic-bezier(.22,.94,.3,1)';
export const INSPECTOR_BEZIER = 'cubic-bezier(.16,1,.3,1)';

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** CSS 側が参照する --dur-* 変数を注入する（CSS への直書き重複を防ぐ） */
export function applyMotionVars(root: HTMLElement): void {
  root.style.setProperty('--dur-preview', `${DUR.preview}ms`);
  root.style.setProperty('--dur-smoke', `${DUR.smoke}ms`);
  root.style.setProperty('--dur-focus', `${DUR.focusDim}ms`);
  root.style.setProperty('--dur-inspector', `${DUR.inspector}ms`);
  root.style.setProperty('--dur-chrome', `${DUR.chrome}ms`);
  root.style.setProperty('--dur-glow', `${DUR.glowCycle}ms`);
  root.style.setProperty('--dur-pulse', `${DUR.pulse}ms`);
  root.style.setProperty('--bezier-preview', PREVIEW_BEZIER);
  root.style.setProperty('--bezier-inspector', INSPECTOR_BEZIER);
}
