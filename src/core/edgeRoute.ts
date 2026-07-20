// 跨頁リンクの経路選択（ノード回避。設計書 §6.4 補遺 2026-07-20）
// 二次ベジェの制御点候補（左右 × 曲率数段）を採点し、
// ノード矩形との衝突が最少・曲率が最小の弧を選ぶ。
export interface Pt { x: number; y: number; }
export interface RBox { x: number; y: number; w: number; h: number; }

const CURVATURES = [0.16, 0.26, 0.38, 0.52, 0.72];
const SAMPLES = 24;
const PAD = 8;

export function quadPoint(p1: Pt, c: Pt, p2: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * p1.x + 2 * u * t * c.x + t * t * p2.x,
    y: u * u * p1.y + 2 * u * t * c.y + t * t * p2.y,
  };
}

function center(b: RBox): Pt { return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }

/** 矩形枠上の接続点（中心→target 方向で枠+7px を切る） */
export function edgePoint(b: RBox, target: Pt): Pt {
  const c = center(b);
  const dx = target.x - c.x, dy = target.y - c.y;
  const hw = b.w / 2 + 7, hh = b.h / 2 + 7;
  const s = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh, 1e-6);
  return { x: c.x + dx * Math.min(s, 1), y: c.y + dy * Math.min(s, 1) };
}

function collisionScore(p1: Pt, c: Pt, p2: Pt, obstacles: RBox[]): number {
  let score = 0;
  for (let s = 1; s < SAMPLES; s++) {
    const p = quadPoint(p1, c, p2, s / SAMPLES);
    for (const b of obstacles) {
      if (p.x > b.x - PAD && p.x < b.x + b.w + PAD && p.y > b.y - PAD && p.y < b.y + b.h + PAD) {
        score++;
        break;
      }
    }
  }
  return score;
}

export interface RouteResult { p1: Pt; p2: Pt; c: Pt; }

/**
 * a→b の弧を選ぶ。obstacles は両端ノードを除いた矩形群。
 * outwardSign は「図の中心から外へ」の既定方向（同点時の好み）。
 * fanIdx は同一ペア複数本の扇状ずらし。
 */
export function chooseControl(a: RBox, b: RBox, obstacles: RBox[], outwardSign: 1 | -1, fanIdx = 0): RouteResult {
  const ca = center(a), cb = center(b);
  const mx = (ca.x + cb.x) / 2, my = (ca.y + cb.y) / 2;
  const dx = cb.x - ca.x, dy = cb.y - ca.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist, ny = dx / dist;

  let best: RouteResult | null = null;
  let bestPenalty = Infinity;
  for (const sign of [outwardSign, -outwardSign] as const) {
    for (const k of CURVATURES) {
      const kk = k + fanIdx * 0.14;
      const c = { x: mx + nx * dist * kk * sign, y: my + ny * dist * kk * sign };
      const p1 = edgePoint(a, c);
      const p2 = edgePoint(b, c);
      const hits = collisionScore(p1, c, p2, obstacles);
      // 衝突が最優先、次に曲率小、最後に外側好み
      const penalty = hits * 1000 + kk * 10 + (sign === outwardSign ? 0 : 1);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = { p1, p2, c };
      }
      if (hits === 0 && sign === outwardSign && k === CURVATURES[0]) {
        return best!; // 最小曲率・外側・無衝突なら即決
      }
    }
  }
  return best!;
}
