// 診断トースト + パネル（「寛容パース・大声報告」の報告側。設計書 §4.7）
import type { Diagnostic } from '../core/types';

// 内部コード → 日本語チップ（未知コードはそのまま表示）
const CODE_LABEL: Record<string, string> = {
  'json-syntax': 'JSON 構文', 'bad-shape': '形式不正', 'bad-node': 'ノード不正', 'dup-id': 'id 重複',
  'orphan': '親不明', 'cycle': '循環', 'too-deep': '階層超過', 'bad-link': 'リンク不正',
  'self-loop': '自環', 'unknown-type': '未知種別', 'dup-link': 'リンク重複', 'two-way-merge': '双方向統合',
  'bad-flow-ref': 'flow 不正', 'empty': '空 deck', 'no-title': '題名なし', 'bad-source': 'ソース不正',
  'no-deck': 'deck なし', 'no-sidecar': 'sidecar なし', 'degraded': '簡易表示',
  'no-office': 'PowerPoint 未検出', 'export-failed': '画像生成失敗', 'source-missing': 'ソース欠落',
  'open-failed': '開けません', 'unsupported': '未対応形式', 'drop-failed': 'ドロップ失敗',
};

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
      // 件数だけでは中身に気付けないため、先頭メッセージの要点も見せる
      const first = diags[0].message;
      const head = first.length > 46 ? first.slice(0, 45) + '…' : first;
      msg.textContent = diags.length === 1 ? head : `${head} ほか ${diags.length - 1} 件`;
      toast.classList.remove('hidden');
      const h3 = document.createElement('h3');
      h3.textContent = '診断（クリックで該当ノードへ）';
      panel.appendChild(h3);
      for (const d of diags) {
        const row = document.createElement('div');
        row.className = 'diagrow';
        const code = document.createElement('span');
        code.className = 'code';
        code.textContent = CODE_LABEL[d.code] ?? d.code;
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
