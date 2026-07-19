# STATUS — 現在地と次の一手

最終更新: 2026-07-19 深夜（Claude 自律作業セッション）

## 現在地

- 設計フェーズ完了・ユーザー承認済み。実装権限（git 含む）委譲済み
- 設計書: `docs/superpowers/specs/2026-07-19-kktenji-design.md`（正）
- UI モックアップ承認済み: `mockup/kktenji-mockup.html`（モーション「ゆったり上質」プリセット確定）
- シェルは v1 = Electron（開発機に Rust 不在のため。設計書 §2 参照）

## 次の一手

1. 実装計画 `docs/superpowers/plans/` を作成
2. 計画に沿って実装（core → ui → shell → sample → dist）
3. `npm run test` 実数と起動確認を STATUS に記録

## 禁区・注意

- sidecar は不可信入力（innerHTML 禁止・sanitize 必須）
- モーション数値は `src/ui/motion.ts` 経由のみ（直書き禁止）
- shell API 直呼び禁止（`src/shell/` 抽象層経由）
- ユーザーは就寝中。破壊的操作（force push・履歴改変）はしない
