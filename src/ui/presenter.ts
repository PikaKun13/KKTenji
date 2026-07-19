// プレゼンモード制御（設計書 §6.7）
// flow のうちページを持つノードだけが「停止する步」。構造（章）ノードは停止せず、
// 章が変わる瞬間の「章転場」アニメーション拍点として使う（俯瞰 → 俯冲）。
import { DUR } from './motion';

export interface PresenterDeps {
  appEl: HTMLElement;
  hudHost: HTMLElement;                 // canvas-wrap
  flow(): string[];
  hasPage(id: string): boolean;
  chapterOf(id: string): string | null; // 最寄りの構造（page なし）祖先
  flyToNode(id: string, scale: number, dur: number, cb?: () => void): void;
  fitAll(dur: number, pad?: number): void;
  fitSubtree(id: string, dur: number, cb?: () => void): void;
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
  private lastChapter: string | null = null;
  private chapterTimer: ReturnType<typeof setTimeout> | null = null;
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

  /** 停止する步 = ページを持つノードのみ（頁順再生。設計判断 2026-07-20） */
  private steps(): string[] {
    return this.d.flow().filter(id => this.d.hasPage(id));
  }

  enter(): void {
    if (this.active || this.steps().length === 0) return;
    this.active = true;
    this.lastChapter = null;
    this.d.appEl.classList.add('presenting');
    this.d.select(null);
    this.d.closePreview();
    this.d.fitAll(DUR.chrome, 80);
    setTimeout(() => this.step(0), DUR.chrome / 2);
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    this.clearChapterTimer();
    this.d.appEl.classList.remove('presenting');
    this.blackout.classList.remove('on');
    this.d.removePulse();
    this.d.setFlowGlow(null);
    this.d.closePreview();
    this.d.select(null);
    this.d.fitAll(DUR.fit);
  }

  private clearChapterTimer(): void {
    if (this.chapterTimer !== null) {
      clearTimeout(this.chapterTimer);
      this.chapterTimer = null;
    }
  }

  step(i: number): void {
    const steps = this.steps();
    this.idx = Math.max(0, Math.min(steps.length - 1, i));
    const id = steps[this.idx];
    this.overview = false;
    this.clearChapterTimer();
    this.d.removePulse();
    this.d.closePreview();

    this.pnum.textContent = `${this.idx + 1} / ${steps.length}`;
    this.pfill.style.width = `${((this.idx + 1) / steps.length) * 100}%`;
    this.crumb.textContent = this.d.pathOf(id);

    const goPage = () => {
      this.chapterTimer = null;
      this.d.select(id);
      this.d.setFlowGlow(id);
      this.d.flyToNode(id, 1.35, DUR.presStep, () => {
        this.d.openPreview(id, true);
      });
    };

    const ch = this.d.chapterOf(id);
    if (ch !== null && ch !== this.lastChapter) {
      // 章転場: 章の枝を俯瞰で点灯 → 一拍おいてページへ俯冲（停止しない）
      this.lastChapter = ch;
      this.d.select(ch);
      this.d.setFlowGlow(null);
      this.d.fitSubtree(ch, DUR.presStep * 0.75, () => {
        this.chapterTimer = setTimeout(goPage, 340);
      });
    } else {
      this.lastChapter = ch;
      goPage();
    }
  }

  next(): void {
    if (this.chapterTimer !== null) { this.clearChapterTimer(); this.d.finishFlight(); this.step(this.idx); return; }
    if (this.d.cameraFlying()) { this.d.finishFlight(); return; }  // 再押下 = 瞬達
    this.step(this.idx + 1);
  }
  prev(): void {
    if (this.chapterTimer !== null) { this.clearChapterTimer(); }
    if (this.d.cameraFlying()) { this.d.finishFlight(); return; }
    this.step(this.idx - 1);
  }

  toggleOverview(): void {
    if (this.overview) { this.lastChapter = null; this.step(this.idx); return; }
    this.overview = true;
    this.clearChapterTimer();
    this.d.closePreview();
    const id = this.steps()[this.idx];
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
