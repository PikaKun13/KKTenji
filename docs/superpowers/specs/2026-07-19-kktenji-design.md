# KKTenji 設計書 v1

作成: 2026-07-19 ／ ステータス: **承認済み**（モックアップ含めユーザー承認、実装権限委譲済み）
モックアップ（挙動の正）: `mockup/kktenji-mockup.html`（公開版: claude.ai artifact「KKTenji — UIモックアップ」）

---

## 1. 目的とスコープ

PPT / Markdown の deck を「思維関係図」として描画・プレゼンする Windows 10+ デスクトップツール。

- 各頁 = ノード。主骨格は階層ツリー（章→節→頁）、加えて頁間の**有向関係線 4 種**
  （support 支撑 / echo 呼応 / contrast 対比 / cause 因果、`->` または `<->`）
- 関係線はすべて **ベジェ弯弧**（直線禁止）
- キャンバスはドラッグでパン、ホイールでズーム。ノード click でカメラが滑らかに寄り、
  該当頁のプレビューがアニメーションで展開（md は整形描画、pptx はローカル PowerPoint で書き出した PNG）
- プレゼンモード: 全画面、sidecar の `flow` 順にカメラ運鏡で進行、M で俯瞰、B で暗転
- 普通の pptx / 散らかった md → sidecar 生成は **Claude が対話内で実施**（本ツールはレンダラー）
- UI 文言は日本語。テーマは ライト/ダーク/システム追随 を設定で切替

**v1 スコープ外**（設計だけ予約）: プレゼンター用サブ画面、named 複数 flow、deck 内全文検索、
自動更新、タッチ/ペン最適化、コード署名、LibreOffice フォールバック書き出し。

## 2. アーキテクチャ

```
┌ UI 層 (TypeScript + Vite, フレームワーク不使用) ─────────────┐
│ canvas(SVG) / motion / preview / presenter / outline /        │
│ inspector / theme / diagnostics                               │
├ core 層 (純ロジック・DOM 非依存・Vitest 対象) ────────────────┤
│ types / parser / validator / layout / flow / cacheKey         │
├ shell 抽象層 (ShellApi インターフェース) ─────────────────────┤
│ readFile / openDialog / listDir / exportPptx / cacheDir /     │
│ watchFile / appVersion                                        │
└ 実装: electron/ (v1) ── 将来 tauri 実装を追加可 ──────────────┘
```

- **シェル決定の経緯**: 当初 Tauri 2 を推奨としたが、開発機に Rust toolchain 不在のため
  v1 は Electron を採用（納期・確実性優先）。UI/core は shell 非依存に保ち、
  Tauri 移行時は shell 実装の差し替えのみで済む構造とする。
- pptx→PNG は shell 経由で PowerShell スクリプト（COM）を起動。

## 3. 用語

| 用語 | 意味 |
|---|---|
| deck | コンテンツファイル + sidecar の組 |
| sidecar | `<basename>.tenji.json`。構造・関係・flow を定義 |
| ノード | 図上の 1 要素。頁ノード（page あり）と構造ノード（page なし、章など） |
| flow | プレゼンの進行順（node id の配列。頁順・樹順から独立） |

## 4. フォーマット仕様 — `*.tenji.json` (schema v1)

### 4.1 例

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/PikaKun13/KKTenji/main/schema/tenji-v1.schema.json",
  "version": 1,
  "deckId": "senryaku-2026-a7f3",          // 生成時に確定、以後不変。キャッシュ/深リンクの名前空間
  "title": "2026年度事業戦略",
  "generator": "claude/2026-07-19",
  "source": { "type": "pptx", "path": "deck.pptx" },
  // md の場合: { "type": "md", "path": "deck.md", "pageBy": "h2" | "hr" }
  "nodes": [
    { "id": "cover",      "title": "表紙",       "parent": null,  "page": 1,
      "summary": "全体像", "notes": "登壇者メモ（任意）", "anchor": null, "contentHash": "sha1-8桁" },
    { "id": "ch-genjo",   "title": "第1章 現状分析", "parent": "cover", "page": null },
    { "id": "market",     "title": "市場動向",   "parent": "ch-genjo", "page": 2 }
  ],
  "links": [
    { "from": "toshi", "to": "p1", "type": "support", "direction": "->", "label": "投資の裏付け" }
  ],
  "flow": ["cover", "market", "..."]
}
```

### 4.2 node

- `id`: **文字列・deck 内一意・再生成しても不変**。charset `[A-Za-z0-9_-]`、内容由来の可読 slug 推奨
  （例 `sec-market-01`）。再生成時は contentHash で旧ノードと照合し id を継承する。
- `parent`: 親 id または null。**複数ルート（森）を許可**。0..N ルート。
- `page`: pptx の 1-based 頁番号 / md の第 N 区画。**null = 構造ノード**（click で寄るのみ、プレビュー無し）。
- `anchor`（md のみ任意）: 見出し slug。位置決めは anchor 優先 → 失敗時 page 序数フォールバック + 警告。
- `contentHash`（任意）: 該当頁テキストの sha1 先頭 8 桁。開時に照合し、不一致は「内容が変わった可能性」バッジ。
- `summary` / `notes` / `title`: **純テキスト**として描画（innerHTML 禁止）。title≦120 / summary≦500 目安。
- 兄弟順 = `nodes` 配列内の出現順（レイアウト安定性はこの規則に依存。仕様として明文化）。

### 4.3 link

- `type`: 閉じた列挙 `support | echo | contrast | cause`。未知値は中性色描画 + 警告。
- `direction`: `"->" | "<->"`。**双方向は 1 本の `<->` で表す**（逆向き 2 本での表現は禁止・検出時警告）。
- `from == to`（自環）は無効 + 警告。完全重複 link は重複排除。
- 同一ペア間の複数 link は弧の張りを交互にずらして扇状に描き分ける。

### 4.4 flow

- 任意。**欠落時は樹の深さ優先順**をデフォルト進行とする。
- 構造ノードを含めてよい（その步はプレビュー無しの「俯瞰寄せ」）。重複（回訪）可。全頁網羅は不要。
- 不明 id は skip + 警告。

### 4.5 source

- type で判別する discriminated union。`pageBy` は md のみ（pptx に付いていたら無視 + 警告）。
- `path` は **sidecar からの相対パス・POSIX スラッシュ**。主バインドは同名規約（同 basename）、path は回退。
- 参照先不在時: 「ファイルが見つかりません → 場所を指定」の再リンク UI（§7.4）。

### 4.6 バージョニングと往復保真

- `version` 整数。ツールは対応範囲を宣言し、**上位バージョンは読み取り専用で開く**（クラッシュ禁止）。
- **未知フィールドは保存時に必ず温存**（前方互換）。拡張は `x-` 名前空間を予約。
- 文字コード UTF-8（BOM 無し）・厳密 JSON。正式 JSON Schema を `schema/tenji-v1.schema.json` として同梱・公開し、
  Claude 生成時とツール読込時で同一契約を共有する。

### 4.7 検証と容错 — 「寛容パース・大声報告」

| 状況 | 挙動 |
|---|---|
| JSON 構文エラー | 開けない。行・列付きの読める報告 |
| id 重複 | 後勝ちで無効化 + 警告 |
| parent 不在 / 循環 | ルート化 / 循環辺を切断してルート化 + 警告 |
| link 端点不在・自環 | その link を捨てる + 警告 |
| flow の不明 id | skip + 警告 |
| page 範囲外 | プレビューを placeholder + 警告 |
| 0 ノード | 空状態画面（クラッシュ禁止） |

警告は右下トースト「N 件の問題」→ click で診断パネル（各項目から該当ノードへジャンプ可）。

### 4.8 フォルダモード

- フォルダを開く → `*.tenji.json` を走査（非再帰、ファイル名昇順）→ deck 一覧（カード）表示。
- 任意の `folder.tenji.json`（順序・表示名・グループ）があれば優先。
- sidecar の無い pptx/md 単体を開いた場合: **退化 sidecar を自動生成**して即描画
  （pptx=頁の線形リスト、md=pageBy 推定で切段）。上部に非阻断バナー
  「これは自動生成された仮の関係図です。精密な関係図の作り方 →」+ Claude 用プロンプト雛形のコピー按钮。

## 5. 変換ワークフロー（Claude 側の標準工程）

1. **抽出**: pptx はテキスト+ノート、md は全文を読み、各頁の title / summary / notes を起こす
2. **建樹**: 章→節→頁 の階層に整理（章構造が無ければ主題クラスタリング）。
   **平坦な「章→頁」2 層に固定しない**（2026-07-20 フィードバック）: 各章の「リード頁」と
   その「深掘り頁」を主従にして 3〜4 層へ立体化する。判断基準は図の可読性——
   同一列に頁が並びすぎない（目安: 1 列 15 頁以下）、跨頁リンクの両端ができるだけ近くなる、
   長距離リンクが多いなら構造を再考する
3. **接線**: 頁間関係を 4 種で認定し方向を付す（乱用しない。1 deck 目安 3〜8 本）
4. **flow 決定**: 講解順。**頁ノードのみを頁順で並べるのが既定**（構造ノードはツールが
   自動で章転場にするため flow に入れる必要はない）
5. **産出**: `*.tenji.json`（id は可読 slug、contentHash 付与、schema でセルフバリデーション）。
   md の場合は必要に応じ整形済み `deck.md` も併産
6. PNG 書き出しはツール側が初回オープン時に自動実行（§9）

## 6. UI 仕様 — 「Mica Flow+」

3 方向（工作台/劇場/Fluent）の合成案。**Fluent/Win11 基調 + 精読フォーカスエンジン + 演出レイヤー**。

### 6.1 レイアウト（上→下）

1. 自製タイトルバー 48px: app アイコン +「deck名 — KKTenji」/ 右端 Win11 規格キャプションボタン
   （閉じる hover `#C42B1C` 白字）
2. CommandBar 40px: 開く / フォルダ / 検索 / フィット / **▷ プレゼン開始 (F5)** / 設定 / ヘルプ
3. 主体行: 左 アウトラインツリー 280px（220–360 可変、48px rail に折畳可）/ 中央キャンバス /
   右 **関係インスペクター 300px**（選択時のみスライドイン。title・summary・page・関係リンク一覧・
   「この頁をプレビュー」。頁全文は持たない）
4. ステータスバー 26px: ノード数・リンク数・ズーム%・source 種別・選択パス「章›節›頁」
5. キャンバス右下: ズームカプセル（− / % / ＋ / フィット）+ **ミニマップ 172×112**（視野枠、click で移動）
6. 太いスクロールバーは廃止（パン+ズーム+ミニマップで代替）

### 6.2 カラートークン

ブランド錨 = teal 階調 `900 #123C50 / 700 #1D5B79 / 500 #2B7CA3 / 300 #5AA9CB / 100 #C7E4F0`。

- **ライト**: 基底 #F3F3F3 / キャンバス radial #F2F5F6→#E9EDEF + ドット格子 / カード rgba(255,255,255,.72) /
  文字 rgba(0,0,0,.9)/.58/.38 / accent #005FB8
- **ダーク**: 基底 #202020 / キャンバス radial #1E2529→#171B1E / カード rgba(255,255,255,.055)
  （上縁 1px ハイライト）/ 文字 #FFF・.72・.42 / accent #60CDFF
- リンク色 — ライト: support #1F9E6E / echo #5B6AD0 / contrast #C4761B / cause #C4384A
  ダーク: #4CC38A / #7E8CE0 / #F5B451 / #F06E77
- フォント: `Segoe UI Variable Text, Segoe UI, Yu Gothic UI, Meiryo, Noto Sans JP, system-ui`
- 角丸: 窗体/カード/ノード 8px（章 10px）、按钮 4px、カプセル 16px
- Mica/Acrylic 相当は半透明 + backdrop-blur で表現（Electron）。Win10 では自動で不透明フォールバック

### 6.3 ノード 3 階級

| 階級 | 造形 |
|---|---|
| 章 (L0/L1 実心) | teal-700 実心 + 白字 + 内頂ハイライト、最大 |
| 節 (L1 半透) | 半透カード + 左 4px teal バー + teal 見出し |
| 頁 (L2) | subtle カード + 細枠 + teal-500 圆点 + 右下 `P{n}` チップ |

選択 = accent 2px リング。hover = 枠発光 + 微浮上。

### 6.4 関係線

- 全て二次/三次ベジェ。制御点 = 中点 + 法線方向 × 距離 × 曲率（0.2〜0.55、link ごとに調整可）
- **三重符号化**: 色 + 線種（support 実線 / echo 点線 / contrast 一点鎖線 / cause 太実線）+ 矢印形状
  （実心三角 / 開き V / 菱形 / 大実心）→ 色弱でも判別可
- 下に 1px casing（背景色系）を敷き格子上でも可読に
- ラベル = 弧中点の小ピル「種別・ラベル」。既定は hover/選択時のみ表示
- **フォーカスエンジン**（精読の要）: ノード選択時、無関係な線を opacity 0.15〜0.25 へ減光、
  関係線 100% + ラベル表示 + 最前面。無関係ノードは 0.32。解除は Esc / 空白 click

### 6.5 モーショントークン（プリセット「ゆったり上質」— ユーザー承認値）

`src/ui/motion.ts` に定数化。直書き禁止。設定に 速度スライダー（きびきび/標準/ゆったり/切）を用意し、
「ゆったり」= 下表 ×1.0、「標準」= ×0.7、「きびきび」= ×0.5、「切」= reduce-motion 相当。

| 動作 | 時長 | イージング |
|---|---|---|
| カメラ飛行（click 寄せ） | 880ms | easeInOutCubic |
| プレゼン步進飛行 | 1100ms | easeInOutCubic |
| M 俯瞰 / 復帰 | 1100ms | easeInOutCubic |
| フィット | 850ms | easeInOutCubic |
| プレビュー展開 (FLIP) | 720ms | cubic-bezier(.22,.94,.3,1) |
| 煙幕/背景ぼかし | 650ms | ease |
| フォーカス減光 | 500ms | ease |
| インスペクター滑入 | 550ms | cubic-bezier(.16,1,.3,1) |
| chrome 退場（プレゼン入） | 650ms | ease |
| 流光ダッシュ循環 | 2.3s | linear |
| 現在ノード呼吸リング | 2.4s | ease-in-out |
| ホイールズーム追随 | lerp 係数 0.12/frame | — |

`prefers-reduced-motion` / 設定「切」時: 飛行→瞬移 + 200ms 交差フェード、呼吸/流光停止。

### 6.6 プレビュー

- click → カメラ寄せ完了後、ノード矩形から FLIP でシートが成長（幅 min(720px, 78%)）
- 内容: md = 整形描画（§10）/ pptx = キャッシュ済み PNG（§9）。ヘッダに頁チップ + 出所表示
- 背景は煙幕（半透明 + blur）。Esc / 背景 click / ✕ で収回

### 6.7 プレゼンモード

- F5 開始（PowerPoint と同じ直感）/ Esc 終了。chrome 全退場 + キャンバス周辺暗角
- →/Space/PageDown 進、←/PageUp 戻。各步: 前プレビュー収回 → カメラ飛行 → プレビュー自動展開
- **停止する步はページを持つノードのみ**（既定 = 頁順再生。2026-07-20 ユーザーフィードバックで確定）。
  flow 内の構造ノードは停止せず、章が変わる瞬間の自動「章転場」拍点になる:
  章の枝を俯瞰（fitSubtree ~825ms、フォーカスエンジンで枝を点灯）→ 340ms 保持 → ページへ俯冲。
  HUD の「i / N」はページ步のみを数える
- **M = 俯瞰**「今どこ」: fit-all + 現在ノードに呼吸リング、ツリー側も祖先鏈点灯。再押下/矢印で復帰
- **B = 暗転**（黒場）。飛行中の再押下は即着（現場のテンポ保護）
- 現在頁に関係線があれば該当弧が**流光**（ダッシュ行進 + 発光）、相手ノード微パルス
- 下部: 極細 accent 進度線 +「i / N」。左上: 面包屑「章 › 節」。数秒無操作で HUD 自動隠し

### 6.8 アウトライン連動

- 章→節→頁 の縮進ツリー。行 = 階級色ドット + タイトル + 関係線 4 色ミニドット + `P{n}` チップ
- hover 双方向強調、click = ノード click と等価、選択は常時双方向同期
- ヘッダに 構造 / リンク一覧 / フロー の視図切替（リンク一覧 = 4 種グループの全 link、
  フロー = flow 順リスト。**v1 は構造視図のみ実装、他 2 つはタブだけ用意し「近日」表示**）

### 6.9 空状態・ロード・エラー態

- 初回起動: Welcome 画面（開く / フォルダ / サンプルを開く / 最近使った deck、全窓 drag&drop 対応）
- 解析中: スケルトン + 「N/M ページを解析中」。PNG 書き出し中: ノードに進捗バッジ（キャンバス操作は可）
- Office 不在で pptx: 図と関係線は通常表示、プレビューのみ placeholder
  「プレビューを生成できません（PowerPoint 未検出）」
- 診断パネル: §4.7 の警告一覧

## 7. キーボードマップ（v1）

| 鍵 | 通常 | プレゼン |
|---|---|---|
| Ctrl+O / Ctrl+Shift+O | ファイル / フォルダを開く | — |
| F | フィット | — |
| Enter | 選択ノードをプレビュー | — |
| Esc | プレビュー収回 → 選択解除 | 終了 |
| F5 | プレゼン開始 | — |
| →/Space/PgDn ・ ←/PgUp | — | 進・戻 |
| M / B | — | 俯瞰 / 暗転 |
| Ctrl+, | 設定 | — |

## 8. キャッシュ設計

- 位置: `%LOCALAPPDATA%/KKTenji/cache/<deckFingerprint>/`（deck 側に書かない。OneDrive/git 汚染防止）
- ファイル名: `<nodeId>@<contentHash>.png` — 内容が変われば天然にミス、旧像を誤表示しない。
  node に contentHash が無い場合の回退キー = `source の sha1 先頭8桁 + "-p" + page`（source が変われば全体無効化）
- `manifest.json`: schema 版 + source の hash/mtime/size + 頁対応表
- 開時に source の mtime+size を快速照合 → 不一致は該当ノードに「プレビュー更新可」バッジ + 再生成按钮
- LRU 上限（既定 2GB）。設定から位置変更・全消去可

## 9. pptx → PNG パイプライン

1. deck 初回オープン時、Office (PowerPoint) の COM 起動を試行
2. `scripts/export-pptx.ps1`: `Presentation.Slides[i].Export(path, "PNG", w, h)` を全頁実行
   （幅 1920px、元アスペクト比維持）。進捗を stdout で shell → UI に中継
3. 失敗/不在: プレビュー placeholder + 図は通常動作（コア体験を阻断しない）
4. 書き出しは静的最終フレーム（アニメ/段階表示は落ちる旨をヘルプに明記）

## 10. md レンダリング仕様

- GFM（表・タスクリスト）+ コードハイライト。数式・mermaid は v1 対象外（そのままコード表示）
- 画像: md ファイル基準の相対パスのみ。**リモート資源は既定で読み込まない**（設定で許可可）
- sanitize 必須（raw HTML は削除）。`pageBy: h2` は `##` 区切り、`hr` は `---` 区切り

## 11. 性能方針（大型 deck）

- 単一 world-layer transform でカメラ（GPU 合成）。ノードは SVG/DOM
- 200 ノード超で: ラベル LOD（低倍率で頁ラベル非表示）+ 視口外の関係線ラベル省略
- プレビュー PNG はメモリ LRU（上限 30 枚）で保持
- 性能予算: 15〜100 ノードで 60fps パン/ズーム（開発機実測で確認）

## 12. セキュリティ

- sidecar・md は不可信入力。全テキスト textContent 描画、md は sanitize
- Electron: `contextIsolation: true` / `nodeIntegration: false`、preload 経由の最小 API のみ公開
- ネットワーク接続なし（完全ローカル動作）

## 13. 配布

- electron-builder → **NSIS per-user**（管理者権限不要）
- 右クリック「KKTenji で開く」を pptx / md / フォルダに登録（既定アプリは奪わない）
- `.tenji.json` をダブルクリック関連付け（専用アイコン）
- コード署名なし（SmartScreen 警告は README に手順記載）。自動更新は v1 なし

## 14. アクセシビリティ

- 関係線の三重符号化（§6.4）/ reduce-motion 対応（§6.5）/ キーボードのみで主要操作可（§7）
- 両テーマで文字コントラスト AA を目標

## 15. テスト方針

- core 層は Vitest で網羅: parser（正常系 + §4.7 全異常系）/ validator / layout（決定性・森・
  兄弟順）/ flow フォールバック / cacheKey
- UI は smoke（起動・sample deck 描画）+ モックアップとの目視比較
- 報告は常に実数（passed/failed/skipped）

## 16. リスク（既知）

- Electron 配布サイズ ~100MB（Tauri 移行で将来解消可。shell 抽象で吸収済み）
- COM 書き出しは Office のバージョン/ライセンス状態に敏感 → 失敗時も体験を阻断しない設計で緩和
- 未署名インストーラの SmartScreen 警告
- backdrop-blur の GPU 負荷 → 設定で透明効果 off を用意
