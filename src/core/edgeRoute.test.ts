import { describe, it, expect } from 'vitest';
import { chooseControl, quadPoint, type RBox } from './edgeRoute';

const box = (x: number, y: number, w = 200, h = 58): RBox => ({ x, y, w, h });

function hitsObstacle(r: ReturnType<typeof chooseControl>, obstacles: RBox[]): boolean {
  for (let s = 1; s < 24; s++) {
    const p = quadPoint(r.p1, r.c, r.p2, s / 24);
    for (const b of obstacles) {
      if (p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h) return true;
    }
  }
  return false;
}

describe('chooseControl', () => {
  it('障害物なし: 最小曲率・好み側を選ぶ', () => {
    const a = box(0, 0), b = box(0, 400);
    // a→b は下向き(dy>0)なので法線は (-1,0)。sign=+1 は左側に張る
    const r = chooseControl(a, b, [], 1);
    expect(r.c.x).toBeLessThan(100);
    expect(Math.abs(r.c.x - 100)).toBeCloseTo(400 * 0.16, 0); // 最小曲率
  });

  it('同列間に障害物: 避けた弧を選ぶ', () => {
    const a = box(0, 0), b = box(0, 600);
    // a と b の間に縦に並ぶ障害物（同列）
    const obstacles = [box(0, 100), box(0, 200), box(0, 300), box(0, 400), box(0, 500)];
    const r = chooseControl(a, b, obstacles, 1);
    expect(hitsObstacle(r, obstacles)).toBe(false);
  });

  it('好み側が塞がれていれば反対側へ張る', () => {
    const a = box(0, 0), b = box(0, 400);
    // 好み側（左）の弓なり回廊を大きな障害物で塞ぐ
    const wall = [box(-300, 60, 400, 340)];
    const r = chooseControl(a, b, wall, 1);
    expect(hitsObstacle(r, wall)).toBe(false);
    expect(r.c.x).toBeGreaterThan(100); // 右（反対側）に張った
  });
});
