# STATUS — 現在地と次の一手

最終更新: 2026-07-20 昼（製品化バッチ完了時）

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
- **リンク経路回避** (10:20): `src/core/edgeRoute.ts` — 左右×曲率5段の候補弧を採点し
  ノード矩形と衝突しない最小曲率を選ぶ（テスト 3 本付き）。建樹ガイドラインも
  平坦2層禁止に改定し、実 deck sidecar を立体構造で再生成済み

## 2026-07-20 昼: 製品化バッチ（4 視点監査 → P0/P1 全対応。Vitest 53 green）

- **安全加固**: 本番ビルドに CSP meta 注入（vite plugin、dev は対象外）/ IPC read-file・
  list-dir・export-pptx にパス白名单（`electron/main.cjs` grantedRoots/guardPath。ダイアログ・
  argv・KK_OPEN・二重起動・drop・履歴経由のみ許可、悪意 sidecar の `../` 遡上を遮断）/
  powershell はフルパス起動 / `setWindowOpenHandler` deny / `source.path` のパス区切り・`..` 拒否
- **ドロップ修復**: Electron 32+ の File.path 廃止に対応（preload で `webUtils.getPathForFile`
  → grant-path → renderer へ。welcome 側は stopPropagation で二重発火防止）
- **初回体験**: Welcome に 最近開いた deck（main 側 userData/recent.json、白名单通過パスのみ）/
  エラー大表示 notice / 「deck の作り方」按钮。ヘルプ浮層（?・F1・コマンドバー）に
  ショートカット表 + AI 用プロンプト雛形コピー。`schema/tenji-v1.schema.json` 新設
- **UX**: pptx の Office 検出を背景化（図の描画を阻塞しない）/ sidecar 無し pptx は
  書き出しで頁数を得て仮関係図（スター型）/ フォルダは md/pptx へフォールバック /
  Node エラー日本語化 / テーマ持久化 / deck 未ロード時のボタン disabled /
  診断チップ日本語化 + トーストに先頭メッセージ / fileUrl の URL エンコード（空白・#・% 対応）
- **配布**: installer.nsh の .json 全域右クリック除去（uninstall は旧版分も掃除）/ README 刷新
- 対抗レビュー（3 視点 → 逐条検証、agent 13 体）: 確認 5 件（pill 残留 medium 等）全修正、
  誤報 5 件棄却。検証: スクリーンショット 4 枚（sample/実 deck/エラー画面/ヘルプ）

## 2026-07-20 昼②: 運用品質バッチ（Vitest 53 green・インストーラ 11:55 再ビルド）

- **障害ログ**: `%LOCALAPPDATA%/KKTenji/logs/error.log`（main の uncaught/unhandled、
  renderer の error 級 console、render-process-gone。512KB 超で後半のみ残す）
- **キャッシュ治理**: LRU 掃除（合計 1.5GB 超を古い順削除。起動 8 秒後 + export 完了後、
  manifest ヒット時 utimes で使用印、進行中 outDir は対象外）/ ヘルプ「バージョン情報」に
  使用量表示 + クリア按钮（`cache-stats` / `clear-cache` IPC）
- **バージョン表示**: Welcome 副題と ヘルプ に v 表示（`app-version` IPC）。`help.open('sys')` 深リンク
- **export 加固**: 自分が起動した PowerPoint のみ AutomationSecurity=3 / DisplayAlerts=1 で
  モーダル抑止 / タイムアウトは TIMEOUT として区別し利用者向け文言化 / 失敗を障害ログへ
- **uninstall 清掃**: `$LOCALAPPDATA\KKTenji` と `$APPDATA\KKTenji` を削除。
  **`${ifNot} ${isUpdated}` ガード必須**（無いと更新のたびに recent/キャッシュ/ログが消える。
  対抗レビューで検出済み・修正済み）
- 対抗レビュー（2 視点 → 逐条検証、agent 13 体）: 確認 3 件（更新時データ消去 high /
  clear-cache と進行中 export の競合 low）全修正、誤報 8 件棄却

## 次の一手（優先順）

1. 機能繰り越し: モーション速度スライダー + 設定画面 / 演讲者ダブルスクリーン /
   関係図の PNG/PDF 書き出し / アウトラインの リンク一覧・フロー 視図タブ /
   キャッシュ mtime 快速照合・「内容が変わった」バッジ（contentHash 運用が前提）
2. 起動時の新版チェック（GitHub Releases を作ってから。現状は手渡し配布のため保留）
3. コード署名（ユーザー判断: 当面買わない = SmartScreen は README の手順で回避）
4. Tauri 移行（Rust 導入後。インストーラ 95MB → 約10MB）

## 環境メモ（このマシン固有）

- **Electron 起動時は `ELECTRON_RUN_AS_NODE` を必ず除去**（VS Code が注入し、素の Node として
  起動してしまう）。`npm run electron` を外部ターミナルから叩く分には問題ない
- **.ps1 は ASCII のみで書く**（Windows PowerShell 5.1 は BOM 無し UTF-8 の日本語コメントを誤解釈）
- 検証用スクリーンショット: `KK_SHOT=<png路径> KK_SHOT_MODE=(空|sel|pres) npx electron .`

## 禁区・注意

- sidecar は不可信入力（innerHTML 禁止・sanitize 必須・リモート URI は既定拒否）
- モーション数値は `src/ui/motion.ts` 経由のみ / shell API は `src/shell/api.ts` 経由のみ
- force push・履歴改変はしない
