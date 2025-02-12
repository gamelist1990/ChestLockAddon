import { world, system, } from "@minecraft/server";
import { db_leaderboards } from "../index";
import { Leaderboard } from "./Leaderboard";
import { ModalFormData } from "@minecraft/server-ui";
function registerCommand(name, aliases = [], callback) {
    world.beforeEvents.chatSend.subscribe((event) => {
        if (event.message.startsWith(name) ||
            aliases.some((alias) => event.message.startsWith(alias))) {
            event.cancel = true;
            const sender = event.sender;
            if (!sender.hasTag("op")) {
                sender.sendMessage("§cこのコマンドを実行する権限がありません。");
                return;
            }
            const args = event.message.split(" ").slice(1);
            callback(sender, args);
        }
    });
}
function showEditForm(player, leaderboard) {
    const form = new ModalFormData()
        .title(`リーダーボード編集: ${leaderboard.name}`);
    form.textField("リーダーボード名 (.lb list等で使用)", "例: my_leaderboard", leaderboard.name);
    form.textField("リーダーボードのタイトル (リーダーボード上部に表示)", "例: §l§bキル数", leaderboard.title);
    form.textField("データ元", "例: kills", leaderboard.objectiveSource);
    form.dropdown("最大表示件数", ["5", "10", "15", "20", "25", "30"], Math.max(Math.min((leaderboard.maxEntries / 5) - 1, 5), 0));
    form.toggle("昇順で表示", leaderboard.ascending);
    form.textField("表示形式", "例: {player} - {score} : {rank}", leaderboard.format);
    form.toggle("レコードがない場合にデフォルトのテキストを表示", leaderboard.showDefault);
    form.textField("デフォルトのテキスト", "例: ---", leaderboard.defaultText);
    form.toggle("オフラインのプレイヤーも記録", leaderboard.recordOfflinePlayers);
    form.toggle("オンラインのプレイヤーに絞る", leaderboard.shouldFilterByWorldPlayers);
    form
        .show(player)
        .then((response) => {
        if (response.canceled)
            return;
        const [name, title, objectiveSource, maxEntries, ascending, format, showDefault, defaultText, recordOfflinePlayers, shouldFilterByWorldPlayers,] = response.formValues;
        if (!name ||
            !title ||
            !objectiveSource ||
            maxEntries === undefined ||
            ascending === undefined ||
            !format ||
            showDefault === undefined ||
            !defaultText ||
            recordOfflinePlayers === undefined ||
            shouldFilterByWorldPlayers === undefined) {
            player.sendMessage("§c無効な入力値です。");
            return;
        }
        if (name !== leaderboard.name) {
            delete db_leaderboards[leaderboard.name];
            db_leaderboards[name] = leaderboard;
        }
        leaderboard.name = name;
        leaderboard.title = title;
        leaderboard.objectiveSource = objectiveSource;
        leaderboard.maxEntries = [5, 10, 15, 20, 25, 30][maxEntries];
        leaderboard.ascending = ascending;
        leaderboard.format = format;
        leaderboard.showDefault = showDefault;
        leaderboard.defaultText = defaultText;
        leaderboard.recordOfflinePlayers = recordOfflinePlayers;
        leaderboard.shouldFilterByWorldPlayers = shouldFilterByWorldPlayers;
        leaderboard.update();
        leaderboard.saveDynamicProperties();
        player.sendMessage(`§aリーダーボード "${name}" を更新しました。`);
        player.playSound("random.orb");
    })
        .catch((error) => console.error(error));
}
registerCommand(".lb", [], (sender, args) => {
    if (args.length === 0) {
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
                const location = {
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
                sender.sendMessage(`§cリーダーボード "${nameToRemove}" が見つかりません。`);
                return;
            }
            system.runTimeout(() => {
                if (leaderboardToRemove.delete()) {
                    delete db_leaderboards[nameToRemove];
                    sender.sendMessage(`§aリーダーボード "${nameToRemove}" を削除しました。`);
                    sender.playSound("random.orb");
                }
                else {
                    sender.sendMessage(`§cリーダーボード "${nameToRemove}" の削除に失敗しました。`);
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
                for (let i = (currentPage - 1) * 7; i < Math.min(currentPage * 7, leaderboards.length); i++) {
                    const leaderboard = leaderboards[i];
                    if (leaderboard) {
                        sender.sendMessage(`§b#${i + 1}§r §g${leaderboard.name}§r §e${Math.floor(leaderboard.entity?.location.x)}, ${Math.floor(leaderboard.entity?.location.y)}, ${Math.floor(leaderboard.entity?.location.z)}§r §7(${leaderboard.dimension.id})`);
                    }
                }
            });
            break;
        case "help":
            system.runTimeout(() => {
                sender.sendMessage("§2--- リーダーボード コマンド ヘルプ ---");
                sender.sendMessage("§b.lb create <名前> <x> <y> <z>§r: リーダーボードを作成します。");
                sender.sendMessage("§b.lb remove <名前>§r: リーダーボードを削除します。");
                sender.sendMessage("§b.lb list [ページ]§r: リーダーボードの一覧を表示します。");
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
            if (args.length === 2) {
                system.runTimeout(() => {
                    showEditForm(sender, leaderboardToEdit);
                }, 20 * 3);
                return;
            }
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
                            }
                            else {
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
            }
            else {
                sender.sendMessage("§c使用法: .lb edit <名前> <パラメータ> <値>");
                sender.sendMessage("§c<パラメータ>には以下のいずれかを指定してください:");
                sender.sendMessage("§c  - name, title, objective, maxEntries, ascending, format, showDefault, defaultText, recordOfflinePlayers, filterOnline");
            }
            break;
        default:
            sender.sendMessage("§c無効なサブコマンドです。.lb help を使用してヘルプを表示してください。");
            break;
    }
});
