import { describe, it, expect } from 'vitest';
import { Camera } from './camera';
import { easeInOutCubic } from './motion';

describe('easeInOutCubic', () => {
  it('端点と中点', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 8);
  });
  it('単調増加', () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = easeInOutCubic(Math.min(t, 1));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('Camera.fitCam', () => {
  const cam = new Camera(() => ({ w: 1000, h: 800 }));
  it('bounds 全体が pad 内に収まる', () => {
    const b = { x: 0, y: 0, w: 2000, h: 800 };
    const c = cam.fitCam(b, 60);
    // 4 隅がビューポート内
    const sx = c.x + b.x * c.s, sy = c.y + b.y * c.s;
    const ex = c.x + (b.x + b.w) * c.s, ey = c.y + (b.y + b.h) * c.s;
    expect(sx).toBeGreaterThanOrEqual(0);
    expect(sy).toBeGreaterThanOrEqual(0);
    expect(ex).toBeLessThanOrEqual(1000);
    expect(ey).toBeLessThanOrEqual(800);
  });
  it('小さい bounds は 1.15 倍を上限に', () => {
    expect(cam.fitCam({ x: 0, y: 0, w: 100, h: 100 }, 60).s).toBe(1.15);
  });
});

describe('Camera 飛行', () => {
  it('flyTo は dur 経過で to に到達し cb を呼ぶ', () => {
    const cam = new Camera(() => ({ w: 1000, h: 800 }));
    let done = false;
    cam.flyTo({ x: 100, y: 50, s: 2 }, 1000, () => { done = true; }, 0);
    cam.tick(500);
    expect(cam.cam.x).toBeGreaterThan(0);
    expect(cam.cam.x).toBeLessThan(100);
    cam.tick(1000);
    expect(cam.cam).toEqual({ x: 100, y: 50, s: 2 });
    expect(done).toBe(true);
  });
  it('zoomAt はカーソル位置を固定点にする', () => {
    const cam = new Camera(() => ({ w: 1000, h: 800 }));
    cam.jump({ x: 0, y: 0, s: 1 });
    // (500,400) のワールド座標は (500,400)
    cam.zoomAt(500, 400, 2);
    const t = cam.target;
    // ズーム後も同じワールド点が (500,400) に映る
    expect(t.x + 500 * t.s).toBeCloseTo(500 + 500 * (t.s - 1) + t.x, 5);
    expect(500 * t.s + t.x).toBeCloseTo(500, 5);
  });
});
