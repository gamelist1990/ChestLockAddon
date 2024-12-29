import {
  Player,
  world,
  system,
  DimensionLocation,
} from "@minecraft/server";
import { db_leaderboards } from "../index";
import { Leaderboard } from "./Leaderboard";
import { ModalFormData } from "@minecraft/server-ui";

/**
 * 指定したプレフィックスまたはエイリアスで始まるチャットメッセージをリッスンし、コマンドを実行します。
 * @param name - コマンドのプライマリ名（プレフィックス）
 * @param aliases - コマンドのエイリアス（オプション）
 * @param callback - コマンドが実行されたときに呼び出される関数
 */
function registerCommand(
  name: string,
  aliases: string[] = [],
  callback: (sender: Player, args: string[]) => void
) {
  world.beforeEvents.chatSend.subscribe((event) => {
    if (
      event.message.startsWith(name) ||
      aliases.some((alias) => event.message.startsWith(alias))
    ) {
      event.cancel = true;

      const sender = event.sender;
      //OPタグを持っている場合のみ処理する
      if (!sender.hasTag("op")) {
        sender.sendMessage("§cこのコマンドを実行する権限がありません。");
        return;
      }

      const args = event.message.split(" ").slice(1); // コマンド名を除いた引数を取得
      callback(sender, args);
    }
  });
}

/**
 * リーダーボードの設定を編集するためのモーダルフォームを表示します。
 * @param player - フォームを表示するプレイヤー
 * @param leaderboard - 編集するリーダーボードオブジェクト
 */
function showEditForm(player: Player, leaderboard: Leaderboard) {
  const form = new ModalFormData()
    .title(`リーダーボード編集: ${leaderboard.name}`);

  // 入力フォーム
  form.textField("リーダーボード名 (.lb list等で使用)", "例: my_leaderboard", leaderboard.name); //0
  form.textField("リーダーボードのタイトル (リーダーボード上部に表示)", "例: §l§bキル数", leaderboard.title); //1
  form.textField("データ元", "例: kills", leaderboard.objectiveSource);//2
  form.dropdown("最大表示件数", ["5", "10", "15", "20", "25", "30"], Math.max(Math.min((leaderboard.maxEntries / 5) - 1, 5), 0));//3
  form.toggle("昇順で表示", leaderboard.ascending);//4
  form.textField("表示形式", "例: {player} - {score} : {rank}", leaderboard.format);//5
  form.toggle("レコードがない場合にデフォルトのテキストを表示", leaderboard.showDefault);//6
  form.textField("デフォルトのテキスト", "例: ---", leaderboard.defaultText);//7
  form.toggle("オフラインのプレイヤーも記録", leaderboard.recordOfflinePlayers);//8
  form.toggle("オンラインのプレイヤーに絞る", leaderboard.shouldFilterByWorldPlayers); // 9 オンラインプレイヤー絞り込みのトグルを追加

  form
    //@ts-ignore
    .show(player)
    .then((response) => {
      if (response.canceled) return;

      const [
        name,
        title,
        objectiveSource,
        maxEntries,
        ascending,
        format,
        showDefault,
        defaultText,
        recordOfflinePlayers,
        shouldFilterByWorldPlayers, // フォームからの値を取得
      ] = response.formValues as [
        string,
        string,
        string,
        number,
        boolean,
        string,
        boolean,
        string,
        boolean,
        boolean, // shouldFilterByWorldPlayers の型を追加
      ];
      if (
        !name ||
        !title ||
        !objectiveSource ||
        maxEntries === undefined ||
        ascending === undefined ||
        !format ||
        showDefault === undefined ||
        !defaultText ||
        recordOfflinePlayers === undefined ||
        shouldFilterByWorldPlayers === undefined // shouldFilterByWorldPlayers が undefined でないことを確認
      ) {
        player.sendMessage("§c無効な入力値です。");
        return;
      }
      // リーダーボード名が変更された場合、古いキーのエントリを削除して新しいキーで登録し直す
      if (name !== leaderboard.name) {
        delete db_leaderboards[leaderboard.name];
        db_leaderboards[name] = leaderboard;
      }

      // リーダーボードオブジェクトのプロパティを更新
      leaderboard.name = name;
      leaderboard.title = title;
      leaderboard.objectiveSource = objectiveSource;
      leaderboard.maxEntries = [5, 10, 15, 20, 25, 30][maxEntries];
      leaderboard.ascending = ascending;
      leaderboard.format = format;
      leaderboard.showDefault = showDefault;
      leaderboard.defaultText = defaultText;
      leaderboard.recordOfflinePlayers = recordOfflinePlayers;
      leaderboard.shouldFilterByWorldPlayers = shouldFilterByWorldPlayers; // リーダーボードのプロパティを更新

      // リーダーボードの表示を更新し、変更を保存
      leaderboard.update();
      leaderboard.saveDynamicProperties();

      player.sendMessage(`§aリーダーボード "${name}" を更新しました。`);
      player.playSound("random.orb");
    })
    .catch((error) => console.error(error));
}

// --- コマンド登録 ---

registerCommand(
  ".lb",
  [],
  (sender, args) => {
    if (args.length === 0) {
      // ヘルプを表示
      system.runTimeout(() => {
        sender.sendMessage("§2--- リーダーボード コマンド ヘルプ ---");
        sender.sendMessage("§b.lb create <名前> <x> <y> <z>§r: リーダーボードを作成します。");
        sender.sendMessage("§b.lb remove <名前>§r: リーダーボードを削除します。");
        sender.sendMessage("§b.lb list [ページ]§r: リーダーボードの一覧を表示します。");
        sender.sendMessage("§b.lb edit <名前>§r: 指定されたリーダーボードの設定を編集します。");
        sender.sendMessage("§b.lb edit <名前> <パラメータ> <値>§r: 指定されたリーダーボードの設定を編集します。");
        sender.sendMessage("§b.lb help§r: このヘルプを表示します。");
      }, 20);
      return;
    }

    const subcommand = args[0];
    switch (subcommand) {
      case "create":
        const addLeaderboard = args.length === 5;
        if (args.length !== 5 && args.length !== 6) {
          sender.sendMessage("§c使用法: .lb create <名前> <x> <y> <z> [-false]");
          return;
        }

        const name = args[1];
        const x = parseFloat(args[2]);
        const y = parseFloat(args[3]);
        const z = parseFloat(args[4]);

        if (isNaN(x) || isNaN(y) || isNaN(z)) {
          sender.sendMessage("§c座標は数値でなければなりません。");
          return;
        }

        system.runTimeout(() => {
          //Leaderboard クラス内で処理するので、ここでは場所を特定して、leaderboardに渡すだけで良い。
          const location: DimensionLocation = {
            dimension: sender.dimension,
            x: x + 0.5,
            y: y,
            z: z + 0.5,
          };

          new Leaderboard(name, location, sender, addLeaderboard);
          sender.sendMessage(`§aリーダーボード "${name}" を作成しました。`);
          sender.playSound("random.orb");

        });
        break;

      case "remove":
        if (args.length !== 2) {
          sender.sendMessage("§c使用法: .lb remove <名前>");
          return;
        }

        const nameToRemove = args[1];
        const leaderboardToRemove = db_leaderboards[nameToRemove];

        if (!leaderboardToRemove) {
          sender.sendMessage(
            `§cリーダーボード "${nameToRemove}" が見つかりません。`
          );
          return;
        }

        system.runTimeout(() => {
          if (leaderboardToRemove.delete()) {
            delete db_leaderboards[nameToRemove];
            sender.sendMessage(
              `§aリーダーボード "${nameToRemove}" を削除しました。`
            );
            sender.playSound("random.orb");
          } else {
            sender.sendMessage(
              `§cリーダーボード "${nameToRemove}" の削除に失敗しました。`
            );
          }
        });
        break;

      case "list":
        const page = args.length >= 2 ? parseInt(args[1]) : 1;
        if (isNaN(page) || page < 1) {
          sender.sendMessage("§cページ番号は1以上の数値でなければなりません。");
          return;
        }

        system.runTimeout(() => {
          const leaderboards = Object.values(db_leaderboards);
          const maxPages = Math.ceil(leaderboards.length / 7);
          const currentPage = Math.min(page, maxPages);

          sender.sendMessage(`§2--- リーダーボード一覧 (ページ ${currentPage} / ${maxPages}) ---`);

          for (
            let i = (currentPage - 1) * 7;
            i < Math.min(currentPage * 7, leaderboards.length);
            i++
          ) {
            const leaderboard = leaderboards[i];
            if (leaderboard) {
              sender.sendMessage(
                `§b#${i + 1}§r §g${leaderboard.name}§r §e${Math.floor(
                  leaderboard.entity?.location.x
                )}, ${Math.floor(
                  leaderboard.entity?.location.y
                )}, ${Math.floor(leaderboard.entity?.location.z)}§r §7(${leaderboard.dimension.id
                })`
              );
            }
          }
        });
        break;

      case "help":
        system.runTimeout(() => {
          sender.sendMessage("§2--- リーダーボード コマンド ヘルプ ---");
          sender.sendMessage(
            "§b.lb create <名前> <x> <y> <z>§r: リーダーボードを作成します。"
          );
          sender.sendMessage(
            "§b.lb remove <名前>§r: リーダーボードを削除します。"
          );
          sender.sendMessage(
            "§b.lb list [ページ]§r: リーダーボードの一覧を表示します。"
          );
          sender.sendMessage("§b.lb edit <名前>§r: 指定されたリーダーボードの設定を編集します。");
          sender.sendMessage("§b.lb edit <名前> <パラメータ> <値>§r: 指定されたリーダーボードの設定を編集します。");
          sender.sendMessage("§b.lb help§r: このヘルプを表示します。");
        });
        break;

      case "edit":
        const nameToEdit = args[1];
        const leaderboardToEdit = db_leaderboards[nameToEdit];

        if (!leaderboardToEdit) {
          sender.sendMessage(`§cリーダーボード "${nameToEdit}" が見つかりません。`);
          return;
        }

        // 引数が2つの場合（.lb edit <名前> のみ）、showEditFormを呼び出す
        if (args.length === 2) {
          system.runTimeout(() => {
            showEditForm(sender, leaderboardToEdit);
          }, 20 * 3);
          return;
        }

        // 引数が4つ以上の場合（.lb edit <名前> <パラメータ> <値>）、チャット欄からパラメータを更新
        if (args.length >= 4) {
          const param = args[2];
          const value = args.slice(3).join(" ");

          system.runTimeout(() => {
            switch (param) {
              case "name":
                if (value !== leaderboardToEdit.name) {
                  delete db_leaderboards[leaderboardToEdit.name];
                  leaderboardToEdit.name = value;
                  db_leaderboards[value] = leaderboardToEdit;
                }
                break;
              case "title":
                leaderboardToEdit.title = value;
                break;
              case "objective":
                leaderboardToEdit.objectiveSource = value;
                break;
              case "maxEntries":
                const numValue = parseInt(value);
                if (!isNaN(numValue) && [5, 10, 15, 20, 25, 30].includes(numValue)) {
                  leaderboardToEdit.maxEntries = numValue;
                } else {
                  sender.sendMessage("§cmaxEntriesには5, 10, 15, 20, 25, 30のいずれかを指定してください。");
                  return;
                }
                break;
              case "ascending":
                leaderboardToEdit.ascending = value.toLowerCase() === "true";
                break;
              case "format":
                leaderboardToEdit.format = value;
                break;
              case "showDefault":
                leaderboardToEdit.showDefault = value.toLowerCase() === "true";
                break;
              case "defaultText":
                leaderboardToEdit.defaultText = value;
                break;
              case "recordOfflinePlayers":
                leaderboardToEdit.recordOfflinePlayers = value.toLowerCase() === "true";
                break;
              case "filterOnline":
                leaderboardToEdit.shouldFilterByWorldPlayers = value.toLowerCase() === "true";
                break;
              default:
                sender.sendMessage("§c無効なパラメータです。");
                return;
            }

            leaderboardToEdit.update();
            leaderboardToEdit.saveDynamicProperties();
            sender.sendMessage(`§aリーダーボード "${leaderboardToEdit.name}" のパラメータ "${param}" を "${value}" に更新しました。`);
            sender.playSound("random.orb");
          }, 20 * 3);
        } else {
          sender.sendMessage("§c使用法: .lb edit <名前> <パラメータ> <値>");
          sender.sendMessage("§c<パラメータ>には以下のいずれかを指定してください:");
          sender.sendMessage("§c  - name, title, objective, maxEntries, ascending, format, showDefault, defaultText, recordOfflinePlayers, filterOnline");
        }
        break;


      default:
        sender.sendMessage(
          "§c無効なサブコマンドです。.lb help を使用してヘルプを表示してください。"
        );
        break;
    }
  }
);