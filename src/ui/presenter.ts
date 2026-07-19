// プレゼンモード制御（設計書 §6.7。flow 運鏡 / M 俯瞰 / B 暗転）
import { DUR } from './motion';

export interface PresenterDeps {
  appEl: HTMLElement;
  hudHost: HTMLElement;                 // canvas-wrap
  flow(): string[];
  hasPage(id: string): boolean;
  flyToNode(id: string, scale: number, dur: number, cb?: () => void): void;
  fitAll(dur: number, pad?: number): void;
  select(id: string | null): void;
  openPreview(id: string, presenting: boolean): void;
  closePreview(): void;
  setFlowGlow(id: string | null): void;
  addPulse(id: string): void;
  removePulse(): void;
  pathOf(id: string): string;
  cameraFlying(): boolean;
  finishFlight(): void;
}

export class Presenter {
  active = false;
  private idx = 0;
  private overview = false;
  private pfill: HTMLDivElement;
  private pnum: HTMLDivElement;
  private crumb: HTMLDivElement;
  private blackout: HTMLDivElement;

  constructor(private d: PresenterDeps) {
    const hud = document.createElement('div');
    hud.className = 'hud';
    this.pnum = document.createElement('div');
    this.pnum.className = 'pnum';
    const pline = document.createElement('div');
    pline.className = 'pline';
    this.pfill = document.createElement('div');
    this.pfill.className = 'pfill';
    pline.appendChild(this.pfill);
    hud.append(this.pnum, pline);
    this.crumb = document.createElement('div');
    this.crumb.className = 'crumb';
    this.blackout = document.createElement('div');
    this.blackout.className = 'blackout';
    this.blackout.addEventListener('click', () => this.blackout.classList.remove('on'));
    d.hudHost.append(hud, this.crumb);
    d.appEl.appendChild(this.blackout);
  }

  enter(): void {
    if (this.active || this.d.flow().length === 0) return;
    this.active = true;
    this.d.appEl.classList.add('presenting');
    this.d.select(null);
    this.d.closePreview();
    this.d.fitAll(DUR.chrome, 80);
    setTimeout(() => this.step(0), DUR.chrome / 2);
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    this.d.appEl.classList.remove('presenting');
    this.blackout.classList.remove('on');
    this.d.removePulse();
    this.d.setFlowGlow(null);
    this.d.closePreview();
    this.d.select(null);
    this.d.fitAll(DUR.fit);
  }

  step(i: number): void {
    const flow = this.d.flow();
    this.idx = Math.max(0, Math.min(flow.length - 1, i));
    const id = flow[this.idx];
    this.overview = false;
    this.d.removePulse();
    this.d.closePreview();
    this.d.select(id);
    this.d.setFlowGlow(id);
    this.pnum.textContent = `${this.idx + 1} / ${flow.length}`;
    this.pfill.style.width = `${((this.idx + 1) / flow.length) * 100}%`;
    this.crumb.textContent = this.d.pathOf(id);
    this.d.flyToNode(id, 1.35, DUR.presStep, () => {
      if (this.d.hasPage(id)) this.d.openPreview(id, true);
    });
  }

  next(): void {
    if (this.d.cameraFlying()) { this.d.finishFlight(); return; }  // 再押下 = 瞬達
    this.step(this.idx + 1);
  }
  prev(): void {
    if (this.d.cameraFlying()) { this.d.finishFlight(); return; }
    this.step(this.idx - 1);
  }

  toggleOverview(): void {
    if (this.overview) { this.step(this.idx); return; }
    this.overview = true;
    this.d.closePreview();
    const id = this.d.flow()[this.idx];
    this.d.addPulse(id);
    this.d.fitAll(DUR.overview, 80);
  }

  toggleBlackout(): void { this.blackout.classList.toggle('on'); }

  /** true = キーを消費した */
  handleKey(e: KeyboardEvent): boolean {
    if (!this.active) return false;
    switch (e.key) {
      case 'Escape': this.exit(); return true;
      case 'ArrowRight': case ' ': case 'PageDown': this.next(); return true;
      case 'ArrowLeft': case 'PageUp': this.prev(); return true;
      case 'm': case 'M': this.toggleOverview(); return true;
      case 'b': case 'B': this.toggleBlackout(); return true;
      default: return false;
    }
  }
}
