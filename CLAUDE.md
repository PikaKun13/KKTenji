# KKTenji — 開発ガイド (CLAUDE.md)

## プロジェクト概要

KKTenji は Windows 10+ 向けのデスクトップツール。PPT（.pptx）や Markdown（.md）の deck を
「思維関係図（マインドマップ + 頁間の関係線）」として描画・プレゼンする **ビューア/プレゼンター**。

- deck = コンテンツファイル（`deck.pptx` または `deck.md`）+ 同名 sidecar `deck.tenji.json`
- 普通の pptx / 散らかった md → sidecar 付き「展示可能構造」への変換は **Claude が対話内で行う**
  （本ツールはレンダラーに徹する。変換手順・プロンプト規約は設計書 §5 参照）
- UI 文言は **日本語**。会話・コミットメッセージは自由だが、ドキュメントは日本語 + 英語術語で書く

## 必読ドキュメント（作業開始前に読む順）

1. `docs/STATUS.md` — 現在地・次の一手・禁区（**セッション終了時に必ず更新**）
2. `docs/superpowers/specs/2026-07-19-kktenji-design.md` — 製品/フォーマット/UI 設計書（正）
3. `docs/superpowers/plans/` — 実装計画（チェックボックスを進捗として更新）
4. UI モックアップ（挙動の正）: `mockup/kktenji-mockup.html` をブラウザで開く

## 技術スタック（決定済み・変更時は設計書に理由を追記）

| 層 | 採用 | 備考 |
|---|---|---|
| フロントエンド | TypeScript + Vite、**フレームワーク不使用**（SVG + DOM 直描画） | モックアップで実証済みの方式を移植 |
| シェル | **Electron**（v1。開発機に Rust 未導入のため） | `src/shell/` の抽象層越しにのみ利用。Tauri 2 への移行を妨げる API 直呼びは禁止 |
| テスト | Vitest（ロジック層） | カバレッジ対象: parser / validator / layout / camera / cache-key |
| pptx→PNG | PowerShell COM（ローカル PowerPoint 呼び出し） | Office 不在時は placeholder 表示（設計書 §9） |
| 配布 | electron-builder → NSIS（per-user） | コード署名は未対応（既知の SmartScreen 警告） |

## コマンド

```
npm install          # 依存導入
npm run dev          # Vite dev サーバ（ブラウザで UI 開発・sample deck 自動ロード）
npm run test         # Vitest 全テスト（報告は必ず実数: passed/failed/skipped）
npm run electron     # Electron シェルで起動
npm run dist         # NSIS インストーラをビルド（dist/ に出力）
```

## ディレクトリ構成

```
src/
  core/      # 純ロジック（DOM 非依存・全て Vitest 対象）: types / parser / validator / layout / flow
  ui/        # 描画と操作: canvas(SVG) / motion / preview / presenter / outline / inspector / theme
  shell/     # シェル抽象層: ShellApi インターフェース + electron 実装（将来 tauri 実装を追加）
  assets/    # アイコン等
electron/    # Electron main / preload（shell 実装の実体）
scripts/     # pptx エクスポート用 PowerShell 等
sample/      # サンプル deck（md + tenji.json。初回起動体験・開発用）
schema/      # *.tenji.json の JSON Schema（v1）
mockup/      # 承認済み UI モックアップ（挙動・数値の参照元）
docs/        # STATUS.md / specs / plans
```

## 開発規約

- **sidecar は不可信入力**: title/summary/label は必ず textContent で描画（innerHTML 禁止）。
  md レンダリングは sanitize 必須。
- **寛容パース・大声報告**: tenji.json の壊れは可能な限り部分描画 + 診断パネルに列挙（設計書 §4.7）。
- **モーションは token 経由**: 時長・イージングは `src/ui/motion.ts` の定数のみ使用、直書き禁止。
  現行プリセットは「ゆったり上質」（ユーザー承認済み: カメラ ~880ms、easeInOutCubic）。
- **キャッシュは派生物**: `%LOCALAPPDATA%/KKTenji/cache/<deckFingerprint>/<nodeId>@<contentHash>.png`。
  正データとして扱わない。いつでも消せる。
- コミットは意味単位で小さく。メッセージ末尾に
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` を付ける。

## 検証の定義（この repo での「done」）

- `npm run test` の実数（Tests: N passed, 0 failed, 0 skipped）を添えること
- UI 挙動はモックアップと目視比較（乖離があれば設計書に追記してから変更）
- 「BUILD SUCCESS」やビルド通過だけでは done と言わない
