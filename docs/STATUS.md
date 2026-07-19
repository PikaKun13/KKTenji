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

## 次の一手（優先順）

1. ユーザーに v1 を触ってもらいフィードバック収集（インストーラは dist/ に。git 追跡外）
2. 繰り越し項目の実装:
   - ファイル関連付け（.tenji.json）+ 右クリック「KKTenji で開く」+ 専用アイコン（設計書 §13）
   - エクスポート進捗の増分中継（spawn + IPC、設計書 §6.9 の進捗バッジ）
   - キャッシュの §8 完全準拠（nodeCacheKey 接続、mtime 快速照合、LRU 上限、設定）
   - IPC パス白名单と CSP（縦深防御）
   - モーション速度スライダー（motion.ts に speedFactor 追加）
   - 検索（§6.8 のリンク一覧/フロー視図タブも「近日」のまま）
3. 実 pptx deck での端到端確認（sidecar を Claude で生成 → 開く → 演示）

## 環境メモ（このマシン固有）

- **Electron 起動時は `ELECTRON_RUN_AS_NODE` を必ず除去**（VS Code が注入し、素の Node として
  起動してしまう）。`npm run electron` を外部ターミナルから叩く分には問題ない
- **.ps1 は ASCII のみで書く**（Windows PowerShell 5.1 は BOM 無し UTF-8 の日本語コメントを誤解釈）
- 検証用スクリーンショット: `KK_SHOT=<png路径> KK_SHOT_MODE=(空|sel|pres) npx electron .`

## 禁区・注意

- sidecar は不可信入力（innerHTML 禁止・sanitize 必須・リモート URI は既定拒否）
- モーション数値は `src/ui/motion.ts` 経由のみ / shell API は `src/shell/api.ts` 経由のみ
- force push・履歴改変はしない
