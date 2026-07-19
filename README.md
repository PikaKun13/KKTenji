# KKTenji

PPT / Markdown の deck を「思維関係図」として描画・プレゼンする Windows 10+ デスクトップツール。

各ページがノードになり、章→節→頁の階層ツリーと、ページ間の関係線 4 種
（**支撑 / 呼応 / 対比 / 因果**、ベジェ弯弧・矢印で方向表示）で deck の論理構造を一望できます。
ノードをクリックするとカメラが滑らかに寄り、そのページのプレビューが展開。
F5 でプレゼンモードに入り、定義した flow 順に運鏡しながら講解できます。

![screenshot](docs/images/screenshot-main.png)

## 使い方

1. **インストール**: `KKTenji-Setup-x.x.x.exe` を実行（per-user、管理者権限不要）
   - 署名なしのため SmartScreen 警告が出ます。「詳細情報」→「実行」で続行してください
2. **起動して「サンプルを開く」** で動作を確認
3. 自分の deck を開くには、コンテンツファイルと同名の sidecar `*.tenji.json` を用意します:
   - `deck.md` + `deck.tenji.json`（md はそのまま描画）
   - `deck.pptx` + `deck.tenji.json`（ページ画像の生成にローカル PowerPoint が必要）
   - sidecar の無い `.md` を開くと、見出しから仮の関係図を自動生成します
4. **sidecar の作り方**: 普通の pptx や散らかった md を Claude との対話に渡し、
   「KKTenji の tenji.json v1 仕様（`docs/superpowers/specs/` 参照）で関係図を生成して」と依頼するのが标准フローです

## キーボード

| 鍵 | 動作 |
|---|---|
| Ctrl+O / Ctrl+Shift+O | ファイル / フォルダを開く |
| F | 全体フィット |
| Enter / Esc | 選択ノードをプレビュー / 戻る |
| F5 | プレゼン開始 |
| →/Space・← | プレゼン進・戻（飛行中の再押下は瞬達） |
| M / B | 俯瞰「今どこ」 / 暗転 |

## 開発

```
npm install
npm run test      # Vitest（core ロジック）
npm run dev       # ブラウザで UI 開発（sample deck）
npm run electron  # Electron で起動
npm run dist      # NSIS インストーラを dist/ に生成
```

設計書: `docs/superpowers/specs/2026-07-19-kktenji-design.md` ／ 開発規約: `CLAUDE.md`

## 既知の制限（v1）

- インストーラは未署名（SmartScreen 警告）。ファイル関連付け・右クリックメニューは未登録
- pptx プレビューは静的 PNG（アニメーション・段階表示は反映されません）
- 検索・複数 flow・プレゼンター用サブ画面・自動更新は未実装（設計書に予約済み）
- Electron ベースのためインストーラ約 95MB（将来 Tauri 移行で軽量化予定）
