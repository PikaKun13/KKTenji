// ミニマップ（全図縮約 + 視野枠。設計書 §6.1-5）
import type { LayoutResult } from '../core/layout';
import type { CamState } from './camera';

const NS = 'http://www.w3.org/2000/svg';
const MW = 172, MH = 112, PAD = 8;

export interface MinimapView {
  update(cam: CamState, viewW: number, viewH: number): void;
  el: HTMLDivElement;
}

export function renderMinimap(
  host: HTMLElement, layout: LayoutResult, onJump: (wx: number, wy: number) => void,
): MinimapView {
  const div = document.createElement('div');
  div.className = 'minimap';
  const svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
  svg.setAttribute('viewBox', `0 0 ${MW} ${MH}`);
  div.appendChild(svg);
  host.appendChild(div);

  const b = layout.bounds;
  const sc = Math.min((MW - PAD * 2) / Math.max(1, b.w), (MH - PAD * 2) / Math.max(1, b.h));
  const ox = (MW - b.w * sc) / 2 - b.x * sc;
  const oy = (MH - b.h * sc) / 2 - b.y * sc;

  for (const box of layout.boxes.values()) {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', String(box.x * sc + ox));
    r.setAttribute('y', String(box.y * sc + oy));
    r.setAttribute('width', String(box.w * sc));
    r.setAttribute('height', String(box.h * sc));
    r.setAttribute('rx', '1.5');
    r.setAttribute('class', 'mm-n' + (box.depth === 0 ? ' m0' : ''));
    svg.appendChild(r);
  }
  const vp = document.createElementNS(NS, 'rect');
  vp.setAttribute('class', 'mm-vp');
  vp.setAttribute('rx', '2');
  svg.appendChild(vp);

  div.addEventListener('click', e => {
    const r = div.getBoundingClientRect();
    const wx = (e.clientX - r.left - ox) / sc;
    const wy = (e.clientY - r.top - oy) / sc;
    onJump(wx, wy);
  });

  return {
    el: div,
    update(cam, viewW, viewH) {
      vp.setAttribute('x', String((-cam.x / cam.s) * sc + ox));
      vp.setAttribute('y', String((-cam.y / cam.s) * sc + oy));
      vp.setAttribute('width', String((viewW / cam.s) * sc));
      vp.setAttribute('height', String((viewH / cam.s) * sc));
    },
  };
}
