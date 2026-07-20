# STATUS — 現在地と次の一手

最終更新: 2026-07-20 未明（Claude 深夜自律セッション完了時）

## 現在地: v1 MVP 完成・検証済み

- **検証実数**: Vitest **45 passed / 0 failed / 0 skipped**、`tsc --noEmit` エラー 0
- **成果物**: `dist/KKTenji-Setup-0.1.0.exe`（NSIS per-user、約 95MB、未署名）
- **実機確認済み**: sample deck の関係図描画 / ノード click → 運鏡 + md プレビュー /
  プレゼンモード（flow 運鏡・M 俯瞰・B 暗転・進度 HUD）/ アウトライン双方向同期 /
  ミニマップ / 凡例 / テーマ（スクリーンショット: `docs/images/`）
- **pptx→PNG**: 実 PowerPoint COM で 3 頁書き出しを実測（`scripts/export-pptx.ps1`）。
  ユーザーが PowerPoint を開いている場合に Quit しない保護実装済み
- 対抗レビュー（3 視点）で挙がった medium 8 件は全修正、テスト 8 本追加
- **実 pptx で端到端確認済み**（2026-07-20 朝）: 実務 deck 25 頁 → sidecar 生成（35 ノード・8 リンク）→
  関係図・実スライド PNG プレビュー・プレゼン運鏡まで動作。実データは `test/`（git 対象外・公開リポジトリのため）

## 2026-07-20 午前の追加実装（ユーザー承認済みバッチ）

- **プレゼン改善**: 頁順再生（1/25 計数）+ 章転場アニメーション / プレビュー光学配置 +
  表示サイズ 4 段階（−/＋ボタン・キー +/-・localStorage 記憶、既定 85%）
- **検索**: サイドバー検索欄（Ctrl+F、Enter/F3 で巡回、Esc 解除）。title/summary/link label を
  NFKC 正規化で照合。アウトラインは hits+祖先に絞り、キャンバスは非該当を減光
- **エクスポート進捗**: spawn + IPC 増分中継「ページ画像を生成中… i / N」ピル。
  書き出しはバックグラウンド化（図の表示を阻断しない）
- **配布体験**: 専用アイコン（build/icon.ico、生成スクリプト由来）/ .tenji 拡張子の関連付け /
  右クリック「KKTenji で開く」（pptx・md・json・フォルダ、HKCU per-user）/
  単一インスタンス + argv 経由オープン（second-instance は open-path IPC）
- installer.nsh は **UTF-8 BOM 必須**（編集後は BOM 再付与）

## 次の一手（優先順）

1. 繰り越し: キャッシュ §8 完全準拠（mtime 快速照合、LRU 上限、更新バッジ）/
   IPC パス白名单と CSP / モーション速度スライダー + 設定画面 /
   演讲者ダブルスクリーン / 関係図の PNG/PDF 書き出し /
   アウトラインの リンク一覧・フロー 視図タブ / 自動更新・コード署名
2. Tauri 移行（Rust 導入後。インストーラ 95MB → 約10MB）

## 環境メモ（このマシン固有）

- **Electron 起動時は `ELECTRON_RUN_AS_NODE` を必ず除去**（VS Code が注入し、素の Node として
  起動してしまう）。`npm run electron` を外部ターミナルから叩く分には問題ない
- **.ps1 は ASCII のみで書く**（Windows PowerShell 5.1 は BOM 無し UTF-8 の日本語コメントを誤解釈）
- 検証用スクリーンショット: `KK_SHOT=<png路径> KK_SHOT_MODE=(空|sel|pres) npx electron .`

## 禁区・注意

- sidecar は不可信入力（innerHTML 禁止・sanitize 必須・リモート URI は既定拒否）
- モーション数値は `src/ui/motion.ts` 経由のみ / shell API は `src/shell/api.ts` 経由のみ
- force push・履歴改変はしない
