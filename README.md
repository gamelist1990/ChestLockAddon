## ChestLockAddon Latest Version 1.6

Last Release : [![GitHub Release](https://img.shields.io/github/v/release/gamelist1990/ChestLockAddon?include_prereleases&sort=date&style=social)](https://github.com/gamelist1990/ChestLockAddon/releases)

Total Download: [![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/gamelist1990/ChestLockAddon/total?style=flat-square&logo=https%3A%2F%2Fgithub.com%2Fgamelist1990%2FChestLockAddon%2Fblob%2Fmain%2FAllAddon%2Fpack_icon.png%3Fraw%3Dtrue)](https://github.com/gamelist1990/ChestLockAddon/releases)


[English/Readme](./EN_README.md)

ダウンロード方法は下にある使用方法を見てください

現バージョンは**1.6**が最新です(1.5-beta~1.5.5-beta)はGithubでは
ダウンロードできません





### 更新履歴 (バージョン 1.4 から 1.6)

#### Version 1.6 (最新)

[ChangeLog](https://github.com/gamelist1990/ChestLockAddon/compare/1.4...1.6)

- **新機能:**
  - `transfer` コマンド: サーバー間データ転送機能。
  - UI に関連ボタンアイコンを追加。
- **改善:**
  - バージョンを 1.6 に更新。
  - Loader にデータ転送機能を追加。
  - `transfer` コマンドをインポート。
  - 翻訳を更新。
  - `package.json` に依存関係を追加。

#### Version 1.5.5

[ChangeLog](https://github.com/gamelist1990/ChestLockAddon/compare/1.4...1.6)

- **新機能:**
  - 中国語/フィンランド語のフルサポート。
  - 安定版スコアリングシステム。
  - ロックダウンモード (lockDown Mode)。
  - 新しい BAN システム。
- **改善:**
  - BAN 処理:
    - `op` と `staff` タグは BAN 除外。
    - 期間メッセージを修正、プレイヤー情報を追加。
    - `player.json` がない場合のエラー対応。
  - 報告機能: タイムスタンプを追加し強化。
  - `formatTimestamp` 関数: タイムゾーンオフセットを追加。
  - `suggestCommand` 関数: 引数を追加。
  - UI: ボタンアイコンを変更。
  - ハブでの正常座標 TP と `invsee` のコード整理。
  - ツール実行後の処理を改善。

#### Version 1.5.3-Beta

[ChangeLog](https://github.com/gamelist1990/ChestLockAddon/compare/1.4...1.6)

- **新機能:**
  - 新アンチチートシステム (v0.2)。
  - ServerStatus (サーバステータス表示)。
  - 最高 ping 値プレイヤー表示機能。
- **改善:**
  - 警告 (warn) 機能更新。
  - エラーチェック機能更新。

#### Version 1.5-Beta

[ChangeLog](https://github.com/gamelist1990/ChestLockAddon/compare/1.4...1.6)

- **新機能:**
  - `ping` コマンド。
  - 投票機能 (Vote)。
  - `getPlayersByName` コマンド。
  - WebSocket イベント収集機能。
- **改善:**
  - ChestLockAddon 更新、バグ修正。
  - ハブの Y 座標バグ修正。
  - `sample.ts`, `test.ts` 更新。
- **削除:**
  - ショップ機能 (Shop)。

#### Version 1.4 (以前のバージョン)

- ファイル整理、翻訳キー変更。
- その他バグ修正。

### 概要

このアドオンは、`!` で始まるコマンドで操作します。UI 対応 (`!item`, `!ui` コマンド)。プレフィックス `!` は `handler.ts` で変更可能。多言語対応。バグや問題は、Discord または Issue へご連絡ください。

### コマンドリスト

- オーナー: `op` タグが必要 (`/tag @s add op`)。
- スタッフ: `staff` タグが必要。

| コマンド            | 説明                                                                 | 権限    | 備考                                         |
| :------------------ | :------------------------------------------------------------------- | :------ | :------------------------------------------- |
| `!help`             | 利用可能なコマンド一覧を表示。                                       | 誰でも  |                                              |
| `!chest`            | チェストコマンドを開く。                                             | 誰でも  |                                              |
| `!lang`             | 言語設定を変更。                                                     | 誰でも  |                                              |
| `!dev`              | デベロッパー専用コマンド。                                           | `op`    |                                              |
| `!ui`               | UI を開く (PS4/5 用)。                                               | 誰でも  |                                              |
| `!jpch`             | LunaChat 再現機能 (実験中)。                                         | 誰でも  |                                              |
| `!item`             | UI を開くアイテムを取得。                                            | 誰でも  |                                              |
| `!tpa`              | TP リクエストを送信。                                                | 誰でも  |                                              |
| `!list`             | プレイヤー情報を表示。                                               | `op`    |                                              |
| `!antichat`         | アンチチャット制御 (on/off/freeze/unfreeze)。                        | `op`    | 例: `!antichat on`                           |
| `!lore`             | アイテムの説明や名前を設定。                                         | 誰でも  | 例: `!lore -set apple`, `!lore -rename test` |
| `!join`             | サブコマンド `-settings` でルール設定、`-true`/`-false` で表示切替。 | `op`    |                                              |
| `!warpgate`         | ワープゲート作成/削除/一覧表示。                                     | `op`    | 例: `!warpgate -create`, `-delete`, `-list`  |
| `!about`            | アドオン概要を表示。                                                 | 誰でも  |                                              |
| `!staff`            | スタッフ専用コマンド。                                               | `staff` |                                              |
| `!report`           | 不正プレイヤーを報告。                                               | 誰でも  |                                              |
| `!ping`             | 自身の ping 値を表示。                                               | 誰でも  |                                              |
| `!vote`             | 投票開始。                                                           | `op`    | (開始は管理者のみ、参加は全員可能)           |
| `!getPlayersByName` | プレイヤー名から情報を取得。                                         | 誰でも  |                                              |
| `!lockDown`         | ロックダウンモードを有効化/無効化。                                  | `op`    |                                              |
| `!ban`              | プレイヤーを BAN。                                                   | `op`    | `op` と `staff` タグは除外                   |
| `!transfer`         | サーバー間データ転送                                                 | `op`    |                                              |

- バージョン 1.6 のコマンドリストです。

### その他の情報

- **プレフィックス変更:** `handler.ts` で変更可能。
- **多言語対応:** 日本語 (ja_JP), 英語 (en_US), 中国語 (zh_CN), ロシア語 (ru_RU), 韓国語 (ko_KR), フィンランド語 (fi_FI)
  - 完全対応: `ja_JP`, `en_US`, `zh_CN`, `fi_FI`
  - 一部未対応: `ru_RU`, `ko_KR`
  - `!lang` コマンドで言語変更可能。
- **使用方法:**
  1. [リリース](https://github.com/gamelist1990/ChestLockAddon/releases) から最新版をダウンロード。
  2. マインクラフトの実験機能で[Beta-API]を有効化にしてください
  3. ワールド参加後、`!help` でコマンド確認。
  4. 管理者: `op` タグを自身に付与推奨。
- **言語ファイル:** `src/command/langs/list` (JSON 形式)。
- **サポート:** [Discord](https://discord.com/invite/GJyqBm7Pyd)
- **ダウンロード:** [GitHub Releases](https://github.com/gamelist1990/ChestLockAddon/releases)

