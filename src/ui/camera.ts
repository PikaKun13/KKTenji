// ワールド変換カメラ（モックアップの cam/camT/flight/tick を class 化。DOM 非依存で test 可）
import { easeInOutCubic, WHEEL_LERP } from './motion';

export interface CamState { x: number; y: number; s: number; }
export interface Bounds { x: number; y: number; w: number; h: number; }

interface Flight {
  t0: number; dur: number; from: CamState; to: CamState; cb?: () => void;
}

export class Camera {
  cam: CamState = { x: 0, y: 0, s: 1 };
  target: CamState = { x: 0, y: 0, s: 1 };
  private flight: Flight | null = null;

  constructor(
    private viewSize: () => { w: number; h: number },
    public reduced = false,
  ) {}

  fitCam(bounds: Bounds, pad = 60): CamState {
    const v = this.viewSize();
    const s = Math.min((v.w - pad * 2) / bounds.w, (v.h - pad * 2) / bounds.h, 1.15);
    return {
      x: (v.w - bounds.w * s) / 2 - bounds.x * s,
      y: (v.h - bounds.h * s) / 2 - bounds.y * s,
      s,
    };
  }

  jump(t: CamState): void {
    this.flight = null;
    this.cam = { ...t };
    this.target = { ...t };
  }

  flyTo(t: CamState, dur: number, cb?: () => void, now = performance.now()): void {
    if (this.reduced || dur <= 0) {
      this.jump(t);
      cb?.();
      return;
    }
    this.flight = { t0: now, dur, from: { ...this.cam }, to: { ...t }, cb };
    this.target = { ...t };
  }

  centerOn(box: { x: number; y: number; w: number; h: number }, s: number, dur: number, cb?: () => void): void {
    const v = this.viewSize();
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    this.flyTo({ x: v.w / 2 - cx * s, y: v.h / 2 - cy * s, s }, dur, cb);
  }

  /** ドラッグパン: 1:1 追従（飛行を打ち切る） */
  panTo(x: number, y: number): void {
    this.flight = null;
    this.cam.x = x; this.cam.y = y;
    this.target.x = x; this.target.y = y;
  }

  /** ホイールズーム: カーソル基点で target を更新（tick が lerp 追随） */
  zoomAt(px: number, py: number, factor: number, min = 0.15, max = 3): void {
    this.flight = null;
    const t = this.target;
    const ns = Math.min(max, Math.max(min, t.s * factor));
    t.x = px - (px - t.x) * (ns / t.s);
    t.y = py - (py - t.y) * (ns / t.s);
    t.s = ns;
  }

  /** 毎フレーム呼ぶ。true = まだ動いている */
  tick(now = performance.now()): boolean {
    if (this.flight) {
      const f = this.flight;
      const t = Math.min(1, (now - f.t0) / f.dur);
      const e = easeInOutCubic(t);
      this.cam.x = f.from.x + (f.to.x - f.from.x) * e;
      this.cam.y = f.from.y + (f.to.y - f.from.y) * e;
      this.cam.s = f.from.s + (f.to.s - f.from.s) * e;
      if (t >= 1) {
        this.flight = null;
        f.cb?.();
      }
      return true;
    }
    const dx = this.target.x - this.cam.x;
    const dy = this.target.y - this.cam.y;
    const ds = this.target.s - this.cam.s;
    if (Math.abs(dx) + Math.abs(dy) < 0.05 && Math.abs(ds) < 0.0005) return false;
    this.cam.x += dx * WHEEL_LERP;
    this.cam.y += dy * WHEEL_LERP;
    this.cam.s += ds * WHEEL_LERP;
    return true;
  }

  get flying(): boolean { return this.flight !== null; }

  /** 飛行を即着させる（プレゼン中の「再押下で瞬達」用） */
  finishFlight(): void {
    if (!this.flight) return;
    const f = this.flight;
    this.flight = null;
    this.cam = { ...f.to };
    this.target = { ...f.to };
    f.cb?.();
  }
}
