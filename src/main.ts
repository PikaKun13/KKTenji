// KKTenji エントリ — 全体組み立て（設計書 §6、挙動の正は mockup/kktenji-mockup.html）
import './ui/theme.css';
import { parseTenji } from './core/parser';
import { layoutDeck, type LayoutResult } from './core/layout';
import { effectiveFlow } from './core/flow';
import type { Diagnostic, ParsedDeck, TenjiDoc } from './core/types';
import { applyMotionVars, DUR, prefersReducedMotion } from './ui/motion';
import { Camera } from './ui/camera';
import { renderCanvas, type CanvasView } from './ui/canvas';
import { renderOutline, type OutlineView } from './ui/outline';
import { Inspector } from './ui/inspector';
import { Preview } from './ui/preview';
import { renderMinimap, type MinimapView } from './ui/minimap';
import { renderWelcome, type WelcomeView } from './ui/welcome';
import { renderDiagnostics, type DiagnosticsView } from './ui/diagnostics';
import { Presenter } from './ui/presenter';
import { splitMdPages, renderMd } from './ui/mdrender';
import { pickShell, type ShellApi } from './shell/api';

const LINK_LEGEND: Array<[string, string]> = [
  ['support', '支撑（実線）'],
  ['echo', '呼応（点線）'],
  ['contrast', '対比（一点鎖線）'],
  ['cause', '因果（太実線）'],
];

class App {
  shell!: ShellApi;
  appEl!: HTMLDivElement;
  canvasWrap!: HTMLDivElement;
  sidebarTree!: HTMLDivElement;
  docTitleEl!: HTMLElement;
  stNodes!: HTMLSpanElement;
  stZoom!: HTMLSpanElement;
  stSource!: HTMLSpanElement;
  stPath!: HTMLSpanElement;
  zPct!: HTMLSpanElement;
  legendEl?: HTMLDivElement;

  camera = new Camera(() => this.viewSize(), prefersReducedMotion());
  deck?: ParsedDeck;
  layout?: LayoutResult;
  view?: CanvasView;
  outline?: OutlineView;
  inspector?: Inspector;
  minimap?: MinimapView;
  preview!: Preview;
  welcome!: WelcomeView;
  diags!: DiagnosticsView;
  presenter!: Presenter;

  selected: string | null = null;
  mdPages: string[] = [];
  deckDir = '';
  pngDir = '';
  officeOk = false;
  themeMode: 'auto' | 'light' | 'dark' = 'auto';

  async init(): Promise<void> {
    this.shell = await pickShell();
    applyMotionVars(document.documentElement);
    this.buildChrome();
    this.preview = new Preview(this.canvasWrap);
    this.preview.onClosed = () => { /* 選択は保持 */ };
    this.diags = renderDiagnostics(this.appEl, id => this.openNode(id));
    this.welcome = renderWelcome(this.canvasWrap, {
      onOpenFile: () => this.openFileFlow(),
      onOpenFolder: () => this.openFolderFlow(),
      onOpenSample: () => this.openByPath('sample/deck.tenji.json'),
      onDropFile: p => this.openByPath(p),
    });
    this.presenter = new Presenter({
      appEl: this.appEl,
      hudHost: this.canvasWrap,
      flow: () => (this.deck ? effectiveFlow(this.deck) : []),
      hasPage: id => this.deck?.nodes.get(id)?.page != null,
      chapterOf: id => {
        let n = this.deck?.nodes.get(id);
        n = n?.parent ? this.deck?.nodes.get(n.parent) : undefined;
        while (n && n.page !== null) {
          n = n.parent ? this.deck?.nodes.get(n.parent) : undefined;
        }
        return n?.id ?? null;
      },
      fitSubtree: (id, dur, cb) => {
        if (!this.layout) return;
        const ids = [id, ...(this.deck?.children.get(id) ?? []).map(c => c.id)];
        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        for (const nid of ids) {
          const b = this.layout.boxes.get(nid);
          if (!b) continue;
          x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
          x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
        }
        if (x1 === Infinity) return;
        this.camera.flyTo(
          this.camera.fitCam({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, 110), dur, cb,
        );
      },
      flyToNode: (id, s, dur, cb) => {
        const b = this.layout?.boxes.get(id);
        if (b) this.camera.centerOn(b, s, dur, cb);
      },
      fitAll: (dur, pad) => this.fitAll(dur, pad),
      select: id => this.setSelection(id, { inspector: false }),
      openPreview: (id, presenting) => this.openPreview(id, presenting),
      closePreview: () => this.preview.close(),
      setFlowGlow: id => this.view?.setFlowGlow(id),
      addPulse: id => this.view?.addPulse(id),
      removePulse: () => this.view?.removePulse(),
      pathOf: id => this.pathOf(id),
      cameraFlying: () => this.camera.flying,
      finishFlight: () => this.camera.finishFlight(),
    });
    this.wireKeyboard();
    this.wireGlobalDrop();
    this.startLoop();
    // 検証用: #sample で起動されたら sample deck を自動で開く（#sample-pres はプレゼンまで進む）
    if (location.hash.startsWith('#sample')) {
      void this.openByPath('sample/deck.tenji.json').then(() => {
        if (location.hash === '#sample-pres') {
          setTimeout(() => this.presenter.enter(), 800);
        } else if (location.hash === '#sample-sel') {
          setTimeout(() => this.openNode('kadai'), 800);
        }
      });
    } else if (location.hash.startsWith('#open=')) {
      // #open=<encodeURIComponent(path)>[&sel=<nodeId>|&pres=1]
      const [openPart, ...rest] = location.hash.slice(6).split('&');
      void this.openByPath(decodeURIComponent(openPart)).then(() => {
        for (const r of rest) {
          if (r.startsWith('sel=')) setTimeout(() => this.openNode(r.slice(4)), 800);
          if (r === 'pres=1') setTimeout(() => this.presenter.enter(), 800);
          if (r === 'pres=auto') { // 検証用: 2.6s ごとに自動步進
            setTimeout(() => {
              this.presenter.enter();
              setInterval(() => { if (this.presenter.active) this.presenter.next(); }, 2600);
            }, 800);
          }
        }
      });
    }
  }

  viewSize(): { w: number; h: number } {
    return { w: this.canvasWrap.clientWidth, h: this.canvasWrap.clientHeight };
  }

  buildChrome(): void {
    const root = document.getElementById('app')!;
    this.appEl = document.createElement('div');
    this.appEl.className = 'app';
    root.appendChild(this.appEl);

    // タイトルバー
    const tb = document.createElement('div');
    tb.className = 'titlebar';
    const logo = document.createElement('div');
    logo.className = 'applogo';
    this.docTitleEl = document.createElement('div');
    this.docTitleEl.className = 'doctitle';
    this.docTitleEl.textContent = 'KKTenji';
    tb.append(logo, this.docTitleEl);
    this.appEl.appendChild(tb);

    // CommandBar
    const cb = document.createElement('div');
    cb.className = 'cmdbar';
    const btn = (label: string, cls: string, fn: () => void) => {
      const b = document.createElement('button');
      b.textContent = label;
      if (cls) b.className = cls;
      b.addEventListener('click', fn);
      cb.appendChild(b);
      return b;
    };
    const sep = () => {
      const s = document.createElement('div');
      s.className = 'sep';
      cb.appendChild(s);
    };
    btn('開く', '', () => this.openFileFlow());
    btn('フォルダ', '', () => this.openFolderFlow());
    sep();
    btn('フィット', '', () => this.fitAll(DUR.fit));
    btn('テーマ', '', () => this.cycleTheme());
    sep();
    btn('▷ プレゼン開始 (F5)', 'primary', () => this.presenter.enter());
    this.appEl.appendChild(cb);

    // 主体行
    const row = document.createElement('div');
    row.className = 'main-row';
    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar';
    const sbHead = document.createElement('div');
    sbHead.className = 'sb-head';
    sbHead.textContent = 'アウトライン';
    this.sidebarTree = document.createElement('div');
    this.sidebarTree.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden';
    sidebar.append(sbHead, this.sidebarTree);
    this.canvasWrap = document.createElement('div');
    this.canvasWrap.className = 'canvas-wrap';
    row.append(sidebar, this.canvasWrap);
    this.appEl.appendChild(row);

    // ステータスバー
    const sb = document.createElement('div');
    sb.className = 'statusbar';
    this.stNodes = document.createElement('span');
    this.stZoom = document.createElement('span');
    this.stSource = document.createElement('span');
    this.stPath = document.createElement('span');
    this.stPath.className = 'right';
    this.stPath.textContent = '選択: なし';
    sb.append(this.stNodes, this.stZoom, this.stSource, this.stPath);
    this.appEl.appendChild(sb);

    // ズームカプセル
    const zp = document.createElement('div');
    zp.className = 'zoompill';
    const zbtn = (label: string, fn: () => void) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', fn);
      zp.appendChild(b);
    };
    const zoomCenter = (f: number) => {
      const v = this.viewSize();
      this.camera.zoomAt(v.w / 2, v.h / 2, f);
    };
    zbtn('−', () => zoomCenter(1 / 1.25));
    this.zPct = document.createElement('span');
    this.zPct.className = 'pct';
    this.zPct.textContent = '100%';
    zp.appendChild(this.zPct);
    zbtn('＋', () => zoomCenter(1.25));
    zbtn('フィット', () => this.fitAll(DUR.fit));
    this.canvasWrap.appendChild(zp);
  }

  buildLegend(): void {
    this.legendEl?.remove();
    const lg = document.createElement('div');
    lg.className = 'legend';
    for (const [t, label] of LINK_LEGEND) {
      const rowEl = document.createElement('div');
      rowEl.className = 'lg';
      rowEl.innerHTML =
        `<svg width="34" height="10"><path d="M1,7 Q17,-3 33,7" class="x-edge ${t}" marker-end="url(#arr-${t})"/></svg>`;
      rowEl.append(label);
      lg.appendChild(rowEl);
    }
    this.canvasWrap.appendChild(lg);
    this.legendEl = lg;
  }

  // ── deck オープン ──
  async openFileFlow(): Promise<void> {
    const p = await this.shell.openFileDialog();
    if (p) await this.openByPath(p);
  }

  async openFolderFlow(): Promise<void> {
    const dir = await this.shell.openFolderDialog();
    if (!dir) return;
    const files = await this.shell.listDir(dir);
    const sidecars = files.filter(f => f.endsWith('.tenji.json'));
    if (sidecars.length === 0) {
      this.diags.set([{ level: 'warn', code: 'no-deck', message: 'フォルダに *.tenji.json が見つかりません' }]);
      return;
    }
    if (sidecars.length === 1) {
      await this.openByPath(this.shell.join(dir, sidecars[0]));
      return;
    }
    // 複数 deck: welcome を簡易一覧に（前回の一覧は除去）
    this.welcome.show();
    this.welcome.el.querySelector('.deck-list')?.remove();
    const list = document.createElement('div');
    list.className = 'actions deck-list';
    list.style.flexDirection = 'column';
    for (const f of sidecars) {
      const b = document.createElement('button');
      b.className = 'wbtn';
      b.textContent = f.replace(/\.tenji\.json$/, '');
      b.addEventListener('click', () => { list.remove(); void this.openByPath(this.shell.join(dir, f)); });
      list.appendChild(b);
    }
    this.welcome.el.appendChild(list);
  }

  async openByPath(path: string): Promise<void> {
    try {
      if (path.endsWith('.tenji.json')) {
        await this.openSidecar(path);
      } else if (path.endsWith('.md')) {
        const sidecar = path.replace(/\.md$/, '.tenji.json');
        try {
          await this.shell.readTextFile(sidecar);
          await this.openSidecar(sidecar);
        } catch {
          await this.openDegradedMd(path);
        }
      } else if (path.endsWith('.pptx')) {
        const sidecar = path.replace(/\.pptx$/, '.tenji.json');
        try {
          await this.shell.readTextFile(sidecar);
          await this.openSidecar(sidecar);
        } catch {
          this.diags.set([{
            level: 'warn', code: 'no-sidecar',
            message: 'この pptx には .tenji.json がありません。Claude との対話で関係図(sidecar)を生成してから開いてください',
          }]);
        }
      } else {
        this.diags.set([{ level: 'warn', code: 'unsupported', message: `対応していないファイルです: ${path}` }]);
      }
    } catch (e) {
      this.diags.set([{ level: 'error', code: 'open-failed', message: `開けませんでした: ${(e as Error).message}` }]);
    }
  }

  async openSidecar(sidecarPath: string): Promise<void> {
    const text = await this.shell.readTextFile(sidecarPath);
    const r = parseTenji(text);
    if (!r.deck) {
      this.diags.set([r.fatal!]);
      return;
    }
    this.deckDir = this.shell.dirname(sidecarPath);
    await this.mountDeck(r.deck, r.deck.diagnostics);
  }

  async openDegradedMd(mdPath: string): Promise<void> {
    const md = await this.shell.readTextFile(mdPath);
    const pages = splitMdPages(md, 'h2');
    const titleOf = (s: string): string => {
      const m = s.match(/^#{1,6}\s+(.+)$/m);
      return (m ? m[1] : s.split('\n')[0] ?? 'ページ').slice(0, 40);
    };
    const base = mdPath.split(/[\\/]/).pop() ?? 'deck.md';
    const doc: TenjiDoc = {
      version: 1,
      title: titleOf(pages[0] ?? base),
      source: { type: 'md', path: base, pageBy: 'h2' },
      nodes: pages.map((p, i) => ({
        id: `p${i + 1}`, title: titleOf(p), parent: i === 0 ? null : 'p1', page: i + 1,
      })),
      links: [],
    };
    const r = parseTenji(JSON.stringify(doc));
    if (!r.deck) return;
    this.deckDir = this.shell.dirname(mdPath);
    const note: Diagnostic = {
      level: 'warn', code: 'degraded',
      message: 'sidecar が無いため仮の関係図を自動生成しました。Claude との対話で精密な .tenji.json を作れます',
    };
    await this.mountDeck(r.deck, [note, ...r.deck.diagnostics]);
  }

  async mountDeck(deck: ParsedDeck, diagnostics: Diagnostic[]): Promise<void> {
    // 旧 deck の後片付け
    this.view?.destroy();
    this.outline?.destroy();
    this.inspector?.hide();
    this.preview.close();
    this.selected = null;
    this.mdPages = [];
    this.pngDir = '';

    this.deck = deck;
    this.layout = layoutDeck(deck);

    // ソース読み込み
    const src = deck.doc.source;
    if (src?.type === 'md') {
      try {
        const md = await this.shell.readTextFile(this.shell.join(this.deckDir, src.path));
        this.mdPages = splitMdPages(md, src.pageBy ?? 'h2');
      } catch {
        diagnostics = [...diagnostics, {
          level: 'warn', code: 'source-missing', message: `ソースが見つかりません: ${src.path}`,
        }];
      }
    } else if (src?.type === 'pptx') {
      this.officeOk = await this.shell.hasOffice();
      if (this.officeOk) {
        const abs = this.shell.join(this.deckDir, src.path);
        const res = await this.shell.exportPptx(abs);
        if (res.dir) this.pngDir = res.dir;
        else if (res.error && res.error !== 'NO_OFFICE') {
          diagnostics = [...diagnostics, {
            level: 'warn', code: 'export-failed', message: `PNG 書き出しに失敗: ${res.error}`,
          }];
        }
      } else {
        diagnostics = [...diagnostics, {
          level: 'warn', code: 'no-office',
          message: 'PowerPoint が見つからないためプレビュー画像を生成できません（関係図は利用できます）',
        }];
      }
    }

    this.view = renderCanvas(this.canvasWrap, deck, this.layout, {
      onNodeClick: id => this.openNode(id),
    });
    // stage は zoompill/legend より下に
    this.canvasWrap.insertBefore(this.view.svg, this.canvasWrap.firstChild);
    requestAnimationFrame(() => this.view?.measureLabels());
    this.wireCanvasPointer(this.view);
    this.buildLegend();

    this.minimap?.el.remove();
    this.minimap = renderMinimap(this.canvasWrap, this.layout, (wx, wy) => {
      const v = this.viewSize();
      const s = this.camera.target.s;
      this.camera.flyTo({ x: v.w / 2 - wx * s, y: v.h / 2 - wy * s, s }, DUR.fit * 0.75);
    });

    this.outline = renderOutline(this.sidebarTree, deck, {
      onRowClick: id => this.openNode(id),
      onHover: id => this.view?.setHover(id),
    });
    this.inspector?.el.remove();
    this.inspector = new Inspector(this.canvasWrap, deck, {
      onJump: id => this.openNode(id),
      onPreview: id => this.openPreview(id, false),
    });

    this.diags.set(diagnostics);
    this.docTitleEl.replaceChildren();
    const b = document.createElement('b');
    b.textContent = String(deck.doc.title ?? 'deck');
    this.docTitleEl.append(b, ' — KKTenji');
    this.stNodes.textContent = `ノード ${deck.nodes.size} ・ リンク ${deck.links.length}`;
    this.stSource.textContent = `ソース: ${src?.type ?? '不明'}`;

    this.welcome.hide();
    this.camera.jump(this.camera.fitCam(this.layout.bounds));
  }

  // ── 操作 ──
  wireCanvasPointer(view: CanvasView): void {
    const svg = view.svg;
    let drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
    svg.addEventListener('pointerdown', e => {
      if ((e.target as Element).closest('.node')) return;
      drag = { x: e.clientX, y: e.clientY, cx: this.camera.cam.x, cy: this.camera.cam.y, moved: false };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      this.camera.panTo(drag.cx + dx, drag.cy + dy);
    });
    svg.addEventListener('pointerup', e => {
      const wasDrag = drag?.moved;
      drag = null;
      if (!wasDrag && !(e.target as Element).closest('.node') && !this.presenter.active) {
        this.clearSelection();
      }
    });
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const r = this.canvasWrap.getBoundingClientRect();
      this.camera.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0014));
    }, { passive: false });
    // ノード hover → 関係線ハイライト
    svg.addEventListener('pointerover', e => {
      const g = (e.target as Element).closest('.node') as SVGGElement | null;
      view.setHover(g?.dataset.id ?? null);
    });
  }

  setSelection(id: string | null, opts: { inspector: boolean } = { inspector: true }): void {
    this.selected = id;
    this.view?.setSelection(id);
    this.outline?.setSelection(id);
    this.stPath.textContent = '選択: ' + (id ? this.pathOf(id) : 'なし');
    if (id && opts.inspector && !this.presenter.active) {
      const n = this.deck?.nodes.get(id);
      const depth = this.layout?.boxes.get(id)?.depth ?? 1;
      if (n) this.inspector?.show(n, depth);
    }
    if (!id) this.inspector?.hide();
  }

  clearSelection(): void {
    this.preview.close();
    this.setSelection(null);
  }

  openNode(id: string): void {
    if (this.presenter.active) return;
    const b = this.layout?.boxes.get(id);
    const n = this.deck?.nodes.get(id);
    if (!b || !n) return;
    this.setSelection(id);
    const s = Math.min(1.4, Math.max(1.1, this.camera.target.s));
    this.camera.centerOn(b, s, DUR.camera, () => {
      if (n.page !== null) this.openPreview(id, false);
    });
  }

  openPreview(id: string, presenting: boolean): void {
    const n = this.deck?.nodes.get(id);
    const b = this.layout?.boxes.get(id);
    if (!n || !b || n.page === null) return;
    const v = this.viewSize();
    const cam = this.camera.cam;
    const from = { x: cam.x + b.x * cam.s, y: cam.y + b.y * cam.s, w: b.w * cam.s, h: b.h * cam.s };

    const srcType = this.deck?.doc.source?.type;
    let el: HTMLElement;
    let sourceLabel: string;
    let note: string;
    if (srcType === 'md') {
      const section = this.mdPages[n.page - 1];
      if (section !== undefined) {
        const dirIsAbs = /^[A-Za-z]:|^[\\/]{2}/.test(this.deckDir);
        const baseHref = this.shell.kind === 'browser'
          ? '/' + this.deckDir.replace(/\\/g, '/') + '/'
          : dirIsAbs ? this.shell.fileUrl(this.deckDir) + '/' : undefined;
        el = renderMd(section, baseHref);
        sourceLabel = 'md レンダリング';
        note = 'ソース md を整形描画しています。Esc で戻る。';
      } else {
        el = this.placeholder('該当区画が見つかりません（md が変更された可能性）');
        sourceLabel = 'md';
        note = 'sidecar の再生成をご検討ください。';
      }
    } else {
      if (this.pngDir) {
        const img = document.createElement('img');
        img.className = 'slide-png';
        img.src = this.shell.fileUrl(this.shell.join(this.pngDir, `p${n.page}.png`));
        const holder = document.createElement('div');
        holder.appendChild(img);
        img.addEventListener('error', () => {
          holder.replaceChildren(this.placeholder('この頁の PNG がありません（再生成をお試しください）'));
        });
        el = holder;
        sourceLabel = 'PowerPoint 書き出し PNG';
        note = 'ローカル PowerPoint で書き出した静的画像です。Esc で戻る。';
      } else {
        el = this.placeholder(this.officeOk
          ? 'プレビュー画像を生成できませんでした（右下の診断を参照）'
          : 'プレビューを生成できません（PowerPoint 未検出）');
        sourceLabel = 'pptx';
        note = '関係図・アウトライン・プレゼン運鏡はそのまま利用できます。';
      }
    }
    this.preview.show(n, { el, sourceLabel, note }, from, v.w, v.h, presenting);
  }

  placeholder(text: string): HTMLElement {
    const d = document.createElement('div');
    d.className = 'pv-placeholder';
    d.textContent = text;
    return d;
  }

  pathOf(id: string): string {
    const parts: string[] = [];
    let n = this.deck?.nodes.get(id) ?? undefined;
    while (n) {
      parts.unshift(n.title);
      n = n.parent ? this.deck?.nodes.get(n.parent) : undefined;
    }
    return parts.join(' › ');
  }

  fitAll(dur: number, pad = 60): void {
    if (!this.layout) return;
    this.camera.flyTo(this.camera.fitCam(this.layout.bounds, pad), dur);
  }

  cycleTheme(): void {
    this.themeMode = this.themeMode === 'auto' ? 'light' : this.themeMode === 'light' ? 'dark' : 'auto';
    const root = document.documentElement;
    if (this.themeMode === 'auto') delete root.dataset.theme;
    else root.dataset.theme = this.themeMode;
  }

  /** 全窓 drag&drop（設計書 §6.9）。既定のファイルナビゲーションも防ぐ */
  wireGlobalDrop(): void {
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0] as (File & { path?: string }) | undefined;
      if (f?.path) void this.openByPath(f.path);
    });
  }

  wireKeyboard(): void {
    document.addEventListener('keydown', e => {
      if (e.key === 'F5') { e.preventDefault(); if (!this.presenter.active) this.presenter.enter(); return; }
      if (this.presenter.handleKey(e)) { e.preventDefault(); return; }
      // プレビュー表示サイズ（+/−。プレゼン中も有効）
      if (this.preview.isOpen && (e.key === '+' || e.key === '=' || e.key === '-')) {
        e.preventDefault();
        this.preview.resize(e.key === '-' ? -1 : 1);
        return;
      }
      if (this.presenter.active) return; // 以下は通常モード専用（設計書 §7）
      if (e.ctrlKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        if (e.shiftKey) this.openFolderFlow(); else this.openFileFlow();
        return;
      }
      if (e.key === 'Escape') {
        if (this.preview.isOpen) this.preview.close();
        else this.clearSelection();
        return;
      }
      if (e.key === 'f' || e.key === 'F') { this.fitAll(DUR.fit); return; }
      if (e.key === 'Enter' && this.selected) { this.openPreview(this.selected, false); }
    });
  }

  startLoop(): void {
    const loop = () => {
      this.camera.tick();
      if (this.view) {
        this.view.applyCamera(this.camera.cam);
        const v = this.viewSize();
        this.minimap?.update(this.camera.cam, v.w, v.h);
        const pct = Math.round(this.camera.cam.s * 100) + '%';
        if (this.zPct.textContent !== pct) {
          this.zPct.textContent = pct;
          this.stZoom.textContent = 'ズーム ' + pct;
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

new App().init();
