// ヘルプ浮層: ショートカット一覧 + deck の作り方（プロンプト雛形コピー）。設計書 §6.1 の「ヘルプ」実装
import { PROMPT_TEMPLATE } from './promptTemplate';

const KEYS_NORMAL: Array<[string, string]> = [
  ['Ctrl+O / Ctrl+Shift+O', 'ファイル / フォルダを開く'],
  ['Ctrl+F ・ Enter/F3', '検索 ・ 次のヒットへ（Shift で逆）'],
  ['F', '全体フィット'],
  ['Enter', '選択ノードのプレビュー'],
  ['+ / −', 'プレビュー表示サイズ'],
  ['Esc', 'プレビュー / 検索 / 選択を閉じる'],
  ['F5', 'プレゼン開始'],
  ['? / F1', 'このヘルプ'],
];
const KEYS_PRESENT: Array<[string, string]> = [
  ['→ / Space ・ ←', '次へ ・ 前へ（飛行中の再押下は瞬達）'],
  ['M', '俯瞰「今どこ」'],
  ['B', '暗転'],
  ['Esc', 'プレゼン終了'],
];

export interface HelpView {
  open(section?: 'keys' | 'guide'): void;
  close(): void;
  readonly isOpen: boolean;
}

export function createHelp(host: HTMLElement): HelpView {
  const ov = document.createElement('div');
  ov.className = 'helpov hidden';
  const card = document.createElement('div');
  card.className = 'helpcard';
  ov.appendChild(card);

  const h2 = (t: string) => {
    const e = document.createElement('h2');
    e.textContent = t;
    return e;
  };
  const keyTable = (rows: Array<[string, string]>) => {
    const tb = document.createElement('table');
    tb.className = 'keytable';
    for (const [k, d] of rows) {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      const kbd = document.createElement('kbd');
      kbd.textContent = k;
      td1.appendChild(kbd);
      const td2 = document.createElement('td');
      td2.textContent = d;
      tr.append(td1, td2);
      tb.appendChild(tr);
    }
    return tb;
  };

  const close = document.createElement('button');
  close.className = 'helpclose';
  close.textContent = '×';
  close.setAttribute('aria-label', '閉じる');
  card.appendChild(close);

  card.appendChild(h2('キーボード'));
  card.appendChild(keyTable(KEYS_NORMAL));
  card.appendChild(h2('プレゼン中'));
  card.appendChild(keyTable(KEYS_PRESENT));

  const guideAnchor = h2('deck の作り方');
  card.appendChild(guideAnchor);
  const guide = document.createElement('div');
  guide.className = 'guide';
  const p1 = document.createElement('p');
  p1.textContent =
    '普通の PowerPoint や Markdown を関係図として展示するには、同じフォルダに sidecar「〈ファイル名〉.tenji.json」を置きます。' +
    '作成は AI との対話が最短です: 下のボタンで指示文をコピーし、Claude などの AI に貼ってから資料の内容を渡してください。';
  const p2 = document.createElement('p');
  p2.textContent =
    'できた JSON を deck.pptx なら deck.tenji.json という名前で保存し、KKTenji で開けば完成です。' +
    '壊れていても開けます（問題は右下の診断に列挙されます）。書式の正式定義はリポジトリの schema/tenji-v1.schema.json にあります。';
  const copy = document.createElement('button');
  copy.className = 'wbtn primary';
  copy.textContent = 'AI 用プロンプト雛形をコピー';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(PROMPT_TEMPLATE);
      copy.textContent = 'コピーしました ✓';
    } catch {
      // clipboard API が使えない環境向けの退路
      const ta = document.createElement('textarea');
      ta.value = PROMPT_TEMPLATE;
      card.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      copy.textContent = 'コピーしました ✓';
    }
    setTimeout(() => { copy.textContent = 'AI 用プロンプト雛形をコピー'; }, 2200);
  });
  guide.append(p1, copy, p2);
  card.appendChild(guide);

  host.appendChild(ov);

  const api = {
    open(section: 'keys' | 'guide' = 'keys') {
      ov.classList.remove('hidden');
      if (section === 'guide') guideAnchor.scrollIntoView({ block: 'start' });
      else card.scrollTop = 0;
    },
    close() { ov.classList.add('hidden'); },
    get isOpen() { return !ov.classList.contains('hidden'); },
  };
  close.addEventListener('click', () => api.close());
  ov.addEventListener('click', e => { if (e.target === ov) api.close(); });
  return api;
}
