// 診断トースト + パネル（「寛容パース・大声報告」の報告側。設計書 §4.7）
import type { Diagnostic } from '../core/types';

export interface DiagnosticsView {
  set(diags: Diagnostic[]): void;
  destroy(): void;
}

export function renderDiagnostics(
  host: HTMLElement, onJumpNode: (id: string) => void,
): DiagnosticsView {
  const toast = document.createElement('div');
  toast.className = 'toast hidden';
  const ball = document.createElement('span');
  ball.className = 'warnball';
  const msg = document.createElement('span');
  toast.append(ball, msg);

  const panel = document.createElement('div');
  panel.className = 'diagpanel hidden';

  toast.addEventListener('click', () => panel.classList.toggle('hidden'));
  host.append(toast, panel);

  return {
    set(diags: Diagnostic[]) {
      panel.replaceChildren();
      if (diags.length === 0) {
        toast.classList.add('hidden');
        panel.classList.add('hidden');
        return;
      }
      ball.textContent = String(diags.length);
      msg.textContent = `${diags.length} 件の問題`;
      toast.classList.remove('hidden');
      const h3 = document.createElement('h3');
      h3.textContent = '診断（クリックで該当ノードへ）';
      panel.appendChild(h3);
      for (const d of diags) {
        const row = document.createElement('div');
        row.className = 'diagrow';
        const code = document.createElement('span');
        code.className = 'code';
        code.textContent = d.code;
        row.appendChild(code);
        row.append(d.message);
        if (d.nodeId) {
          const id = d.nodeId;
          row.addEventListener('click', () => onJumpNode(id));
        }
        panel.appendChild(row);
      }
    },
    destroy() { toast.remove(); panel.remove(); },
  };
}
