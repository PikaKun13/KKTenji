// SVG キャンバス描画（モックアップの SVG 構築部を deck/layout 駆動に一般化）
import type { ParsedDeck, TenjiLink } from '../core/types';
import type { LayoutResult, NodeBox } from '../core/layout';
import { chooseControl } from '../core/edgeRoute';
import type { CamState } from './camera';

const NS = 'http://www.w3.org/2000/svg';
const LINK_TYPES = ['support', 'echo', 'contrast', 'cause'] as const;
const TYPE_JA: Record<string, string> = {
  support: '支撑', echo: '呼応', contrast: '対比', cause: '因果',
};

export interface CanvasHandlers {
  onNodeClick(id: string): void;
}

export interface CanvasView {
  svg: SVGSVGElement;
  world: SVGGElement;
  setSelection(id: string | null): void;
  setHover(id: string | null): void;
  setFlowGlow(id: string | null): void;
  setSearchHits(hits: Set<string> | null): void;
  addPulse(id: string): void;
  removePulse(): void;
  applyCamera(cam: CamState): void;
  measureLabels(): void;
  destroy(): void;
}

interface EdgeEls {
  link: TenjiLink;
  casing: SVGPathElement;
  glow: SVGPathElement;
  main: SVGPathElement;
  label: SVGGElement;
  labelText: SVGTextElement;
  labelRect: SVGRectElement;
}

function el<K extends keyof SVGElementTagNameMap>(
  tag: K, attrs: Record<string, string | number>, parent: Element,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  parent.appendChild(e);
  return e;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function renderCanvas(
  host: HTMLElement, deck: ParsedDeck, layout: LayoutResult, handlers: CanvasHandlers,
): CanvasView {
  const svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
  svg.setAttribute('class', 'stage');
  host.appendChild(svg);

  // 矢印マーカー（4 種 + 中性）
  const defs = el('defs', {}, svg);
  const markerDefs: Array<[string, string, boolean]> = [
    ['support', 'M0,0.6 L7,4 L0,7.4 Z', true],
    ['contrast', 'M4.5,0.8 L8.2,4.5 L4.5,8.2 L0.8,4.5 Z', true],
    ['cause', 'M0,0.4 L8.4,4.5 L0,8.6 Z', true],
    ['unknown', 'M0,0.6 L7,4 L0,7.4 Z', true],
  ];
  for (const [t, d, fill] of markerDefs) {
    const m = el('marker', {
      id: `arr-${t}`, markerWidth: 10, markerHeight: 10, refX: 7, refY: 4.5,
      orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse',
    }, defs);
    el('path', { d, class: fill ? `m-${t}` : '' }, m);
  }
  { // echo は開き V（線描き）
    const m = el('marker', {
      id: 'arr-echo', markerWidth: 10, markerHeight: 10, refX: 6.5, refY: 4.5,
      orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse',
    }, defs);
    const p = el('path', { d: 'M0.5,1 L7,4.5 L0.5,8', fill: 'none', 'stroke-width': 1.6 }, m);
    p.setAttribute('stroke', 'var(--lk-echo)');
  }

  const world = el('g', {}, svg);
  const gT = el('g', {}, world);
  const gX = el('g', {}, world);
  const gN = el('g', {}, world);
  const gL = el('g', {}, world);

  // ── 樹辺 ──
  const treeEdges: Array<{ a: string; b: string; path: SVGPathElement }> = [];
  for (const n of deck.nodes.values()) {
    if (n.parent === null) continue;
    const pb = layout.boxes.get(n.parent), nb = layout.boxes.get(n.id);
    if (!pb || !nb) continue;
    const x1 = pb.x + pb.w, y1 = pb.y + pb.h / 2;
    const x2 = nb.x, y2 = nb.y + nb.h / 2;
    const dx = Math.max(30, (x2 - x1) * 0.5);
    const path = el('path', {
      d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`,
      class: 't-edge',
    }, gT);
    treeEdges.push({ a: n.parent, b: n.id, path });
  }

  // ── 跨頁リンク（弯弧 + casing + glow + label）──
  const bc = {
    x: layout.bounds.x + layout.bounds.w / 2,
    y: layout.bounds.y + layout.bounds.h / 2,
  };
  const pairCount = new Map<string, number>();
  const edges: EdgeEls[] = [];
  for (const link of deck.links) {
    const ba = layout.boxes.get(link.from), bb = layout.boxes.get(link.to);
    if (!ba || !bb) continue;
    const ca = { x: ba.x + ba.w / 2, y: ba.y + ba.h / 2 };
    const cb2 = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
    const mx = (ca.x + cb2.x) / 2, my = (ca.y + cb2.y) / 2;
    const dx = cb2.x - ca.x, dy = cb2.y - ca.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist, ny = dx / dist;
    // 同一ペア複数本は扇状にずらす。経路はノード回避採点で選ぶ（core/edgeRoute）
    const pairKey = [link.from, link.to].sort().join('|');
    const idx = pairCount.get(pairKey) ?? 0;
    pairCount.set(pairKey, idx + 1);
    const outward: 1 | -1 = (nx * (mx - bc.x) + ny * (my - bc.y)) >= 0 ? 1 : -1;
    const obstacles = [...layout.boxes.entries()]
      .filter(([nid]) => nid !== link.from && nid !== link.to)
      .map(([, b]) => b);
    const route = chooseControl(ba, bb, obstacles, outward, idx);
    const { p1, p2, c } = route;
    const d = `M${p1.x},${p1.y} Q${c.x},${c.y} ${p2.x},${p2.y}`;
    const type = LINK_TYPES.includes(link.type) ? link.type : 'unknown';
    const casing = el('path', { d, class: 'x-casing' }, gX);
    const glow = el('path', { d, class: `x-glow ${type}` }, gX);
    const main = el('path', {
      d, class: `x-edge ${type}`, 'marker-end': `url(#arr-${type})`,
    }, gX);
    if (link.direction === '<->') main.setAttribute('marker-start', `url(#arr-${type})`);
    const label = el('g', { class: 'elabel' }, gL);
    const lt = { x: 0.25 * p1.x + 0.5 * c.x + 0.25 * p2.x, y: 0.25 * p1.y + 0.5 * c.y + 0.25 * p2.y };
    label.setAttribute('transform', `translate(${lt.x},${lt.y})`);
    const labelRect = el('rect', { rx: 8 }, label);
    const labelText = el('text', { x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, label);
    labelText.textContent = `${TYPE_JA[link.type] ?? link.type}${link.label ? '・' + link.label : ''}`;
    const e: EdgeEls = { link, casing, glow, main, label, labelText, labelRect };
    edges.push(e);
    main.addEventListener('pointerenter', () => label.classList.add('show'));
    main.addEventListener('pointerleave', () => {
      if (!currentSel || (link.from !== currentSel && link.to !== currentSel)) label.classList.remove('show');
    });
  }

  // ── ノード ──
  const nodeEls = new Map<string, SVGGElement>();
  for (const n of deck.nodes.values()) {
    const b = layout.boxes.get(n.id);
    if (!b) continue;
    const tier = Math.min(b.depth, 2);
    const g = el('g', { class: `node l${tier}`, transform: `translate(${b.x},${b.y})` }, gN);
    g.dataset.id = n.id;
    el('rect', { class: 'body', width: b.w, height: b.h, rx: tier === 0 ? 10 : 8 }, g);
    if (tier === 1) el('rect', { class: 'bar', x: 0, y: 10, width: 4, height: b.h - 20, rx: 2 }, g);
    if (tier === 2) el('circle', { class: 'dot2', cx: 16, cy: b.h / 2, r: 4 }, g);
    const tx = el('text', {
      class: 'tt', x: tier === 2 ? 30 : 16,
      y: b.h / 2 + (tier === 0 ? -4 : 1), 'dominant-baseline': 'middle',
    }, g);
    tx.textContent = truncate(n.title, tier === 0 ? 14 : tier === 1 ? 13 : 12);
    const tip = document.createElementNS(NS, 'title');
    tip.textContent = n.title;
    g.appendChild(tip);
    if (tier === 0) {
      const pageCount = [...deck.nodes.values()].filter(x => x.page !== null).length;
      const st = el('text', { class: 'pg', x: 16, y: b.h / 2 + 20 }, g);
      st.textContent = `全 ${pageCount} ページ`;
    } else if (n.page !== null) {
      const pt = el('text', { class: 'pg', x: b.w - 12, y: b.h - 10, 'text-anchor': 'end' }, g);
      pt.textContent = 'P' + n.page;
    }
    el('rect', {
      class: 'ring', x: -3, y: -3, width: b.w + 6, height: b.h + 6, rx: tier === 0 ? 12 : 10,
    }, g);
    nodeEls.set(n.id, g);
    g.addEventListener('click', ev => { ev.stopPropagation(); handlers.onNodeClick(n.id); });
  }

  // ── フォーカスエンジン ──
  let currentSel: string | null = null;
  let pulseEl: SVGRectElement | null = null;

  function related(id: string): Set<string> {
    const r = new Set([id]);
    const n = deck.nodes.get(id);
    if (n?.parent) r.add(n.parent);
    for (const c of deck.children.get(id) ?? []) r.add(c.id);
    for (const l of deck.links) {
      if (l.from === id) r.add(l.to);
      if (l.to === id) r.add(l.from);
    }
    return r;
  }

  function setSelection(id: string | null): void {
    currentSel = id;
    const has = id !== null;
    world.classList.toggle('dimmed', has);
    const rel = has ? related(id) : null;
    for (const [nid, g] of nodeEls) {
      g.classList.toggle('sel', nid === id);
      g.classList.toggle('rel', !!rel?.has(nid));
    }
    for (const te of treeEdges) {
      te.path.classList.toggle('rel', has && (te.a === id || te.b === id));
    }
    for (const e of edges) {
      const on = has && (e.link.from === id || e.link.to === id);
      e.casing.classList.toggle('rel', on);
      e.main.classList.toggle('rel', on);
      e.label.classList.toggle('show', on);
    }
  }

  function setHover(id: string | null): void {
    for (const e of edges) {
      const on = id !== null && (e.link.from === id || e.link.to === id);
      e.main.classList.toggle('hov', on && !currentSel);
      if (!currentSel) e.label.classList.toggle('show', on);
    }
  }

  function setFlowGlow(id: string | null): void {
    for (const e of edges) {
      e.glow.classList.toggle('flowing', id !== null && (e.link.from === id || e.link.to === id));
    }
  }

  function addPulse(id: string): void {
    removePulse();
    const b = layout.boxes.get(id);
    if (!b) return;
    pulseEl = el('rect', {
      class: 'pulse', x: b.x - 8, y: b.y - 8, width: b.w + 16, height: b.h + 16, rx: 14,
    }, gN);
  }
  function removePulse(): void { pulseEl?.remove(); pulseEl = null; }

  function measureLabels(): void {
    for (const e of edges) {
      const bb = e.labelText.getBBox();
      e.labelRect.setAttribute('x', String(bb.x - 8));
      e.labelRect.setAttribute('y', String(bb.y - 4));
      e.labelRect.setAttribute('width', String(bb.width + 16));
      e.labelRect.setAttribute('height', String(bb.height + 8));
    }
  }

  function setSearchHits(hits: Set<string> | null): void {
    world.classList.toggle('searching', hits !== null);
    for (const [nid, g] of nodeEls) {
      g.classList.toggle('hit', !!hits?.has(nid));
    }
  }

  return {
    svg, world,
    setSelection, setHover, setFlowGlow, setSearchHits, addPulse, removePulse,
    applyCamera(cam: CamState) {
      world.setAttribute('transform', `translate(${cam.x} ${cam.y}) scale(${cam.s})`);
    },
    measureLabels,
    destroy() { svg.remove(); },
  };
}

export { TYPE_JA };
