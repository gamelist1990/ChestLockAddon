import { Module, moduleManager } from '../../module/module';
import { Handler } from '../../module/Handler';
import { registerAllCommands } from './command';

class ScoreModule implements Module {
    name = 'ScoreModule';
    enabledByDefault = true;
    docs = `§lコマンド一覧§r\n
§b- resetScore <スコアボード名|-all>§r: 指定したスコアボード、または全てのスコアボードのスコアをリセットします。\n
  §7<スコアボード名>§r: リセットするスコアボードの名前。\n
  §7-all§r: 全てのスコアボードをリセット。\n
§b- number <数値1>,<数値2>,...§r: 指定された数値の中からランダムに1つを選び、'ws_number' スコアボードに設定します。\n
  §7<数値1>,<数値2>,...§r: カンマ区切りの数値リスト。\n
§b- score=<コピー元スコアボード名>§r: 指定したスコアボードの値を 'ws_<スコアボード名>' にコピー。以下のプレースホルダーが使用可能です:\n
  §7[allPlayer]§r: 全プレイヤー数\n
  §7[uptime]§r: サーバー稼働時間\n
  §7[ver]§r: スクリプトバージョン\n
  §7[time]§r: 現在時刻 (時:分)\n
  §7[tag=<タグ名>]§r: 指定したタグを持つプレイヤー数\n
  §7[score=<スコアボード名>]§r: 指定したスコアボードの最高スコア\n
  §7[score=<スコアボード名>,<プレイヤー名>]§r: 指定したスコアボードの指定したプレイヤーのスコア\n
  §7[scoreN=<スコアボード名>]§r: 指定したスコアボードの最初の参加者の名前（参加者がいない場合は'0'）\n
  §7[scoreN=<スコアボード名>, <プレイヤー名>]§r: 指定したスコアボードの指定したプレイヤーの名前。見つからない場合は'0'\n
§b- team set <チーム数>:<チーム内上限人数> <タグ名> <スコアボード名>§r: 指定した条件でプレイヤーをチーム分けし、スコアボードに記録します。\n
  §7<チーム数>§r: 作成するチームの数。\n
  §7<チーム内上限人数>§r: 各チームの最大人数。\n
  §7<タグ名>§r: チーム分けの対象となるプレイヤーが持つタグ。\n
  §7<スコアボード名>§r: チーム番号を記録するスコアボード名。\n
§b- scoreDelete form§r: スコアボードを削除するためのフォームを表示します。\n
§b- scoreDelete all§r: 'ws_module' 以外の 'ws_' で始まる全てのスコアボードを一括削除します。\n
§b- teamCount <チームタグ1,チームタグ2,...> <JSON> [true]§r: 指定したタグを持つプレイヤー数に基づき、コマンドを実行します。\n
  §7<チームタグ1,チームタグ2,...>§r: カンマ区切りのチームタグ。\n
  §7<JSON>§r: チームタグとコマンドの対応を記述したJSON配列。例: [{"team1":"cmd1"},{"team2":"cmd2"}]\n
  §7[true]§r: (オプション) 最大人数のチームを比較してコマンド実行。指定がない場合は、0人になったチームを検知してコマンド実行。同人数の場合は"same"キーのコマンド実行。\n
§b- closeForm§r: ユーザーが開いているフォームを強制的に閉じます。\n
§b- changeTag <元のタグ>,<新しいタグ>§r: 指定されたタグを持つプレイヤーのタグを別のタグに変更します。\n
  §7<元のタグ>§r: 変更前のタグ。\n
  §7<新しいタグ>§r: 変更後のタグ。\n
§b- cloneBlock <JSON>§r: 指定された座標のブロックを別の座標にクローンします。\n
  §7<JSON>§r: {"form":[{"x":0,"y":64,"z":0},...],"to":[{"x":10,"y":64,"z":10},...]} の形式。\n
§b- chestFill <JSON>§r: 指定座標のコンテナにアイテムを設定。\n
  §7<JSON>§r: 座標とアイテムのデータを定義したJSON。\n
    §8例: {"locations":[{"x":0,"y":64,"z":0}],"items":[{"id":"minecraft:diamond","amount":2,"name":"§bSpecial Diamond","lore":["§7Shiny!"]}],"randomSlot":true}\n
    §8locations: コンテナの座標の配列。\n
    §8items: 格納するアイテムの配列。\n
      §9id: アイテムID。\n
      §9amount: アイテム数 (省略可、デフォルト1)。\n
      §9data: アイテムデータ値 (省略可、デフォルト0)。\n
      §9name: アイテム名 (省略可)。\n
      §9lore: アイテム説明文 (省略可)。\n
      §9lockMode: ロックモード "slot"|"inventory" (省略可)。\n
      §9keepOnDeath: 死んだ時に保持するか (省略可)。\n
      §9enchantments: エンチャントの配列 (省略可)。例: [{"type":"sharpness","level":3}]\n
    §8randomSlot: trueの場合、ランダムなスロットにアイテムを配置 (省略可、デフォルトfalse)。§r\n
§b- randomBlock <JSON>§r: 指定された座標に、指定されたブロックをランダムに設置します。\n
  §7<JSON>§r: 座標とブロックのデータを定義したJSON。\n
    §8例: {"locations":["0 64 0", "1 64 0"],"blocks":[{"id":"minecraft:dirt","weight":3},{"id":"minecraft:stone","weight":1}]}\n
    §8locations: ブロックを設置する座標の配列 (文字列形式)。\n
    §8blocks: 設置するブロックの配列。\n
      §9id: ブロックID。\n
      §9weight: 出現率の重み (数値が大きいほど出現しやすい)。§r\n
§b- randomDrop <JSON>§r: 指定範囲内にアイテムをランダムドロップ。\n
  §7<JSON>§r: 範囲、アイテムのデータを定義したJSON。\n
    §8例: {"start":{"x":0,"y":60,"z":0},"end":{"x":20,"y":65,"z":20},"items":[{"id":"minecraft:diamond","weight":1,"amount":1,"name":"§bLucky Diamond","lore":["§7Found you!"]},{"id":"minecraft:iron_ingot","weight":5, "amount": 3},{"id":"minecraft:dirt","weight":10}],"dropCount": 5}\n
    §8start: 開始座標。\n
    §8end: 終了座標。\n
    §8items: ドロップするアイテムの配列。\n
      §9id: アイテムID。\n
      §9amount: アイテム数 (省略可、デフォルト1)。\n
      §9data: アイテムデータ値 (省略可、デフォルト0)。\n
      §9name: アイテム名 (省略可)。\n
      §9lore: アイテム説明文 (省略可)。\n
      §9lockMode: ロックモード "slot"|"inventory" (省略可)。\n
      §9keepOnDeath: 死んだ時に保持するか (省略可)。\n
      §9enchantments: エンチャント (省略可)。例: [{"type":"sharpness","level":3}]\n
      §9weight: 出現率 (重み)。\n
    §8dropCount: ドロップ数 (省略可、デフォルト1)。§r`;



    registerCommands(handler: Handler): void {
        registerAllCommands(handler, this.name);
    }
}
export const ver = "0.1.0"
const ScoreModules = new ScoreModule();
moduleManager.registerModule(ScoreModules);