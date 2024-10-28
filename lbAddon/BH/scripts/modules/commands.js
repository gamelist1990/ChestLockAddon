import { world, system } from "@minecraft/server";
import { db_leaderboards } from "../index";
import { Leaderboard } from "./Leaderboard";


function registerCommand(name, aliases = [], callback) {
    world.beforeEvents.chatSend.subscribe((event) => {
        if (event.message.startsWith(name) || aliases.some((alias) => event.message.startsWith(alias))) {
            event.cancel = true; 
            const sender = event.sender;
            // タグ "op" を持っているかどうかで権限を確認するんで opタグ付けてね
            if (!sender.hasTag("op")) {
                sender.sendMessage("§cこのコマンドを実行する権限がありません。");
                return;
            }
            const args = event.message.split(" ").slice(1); 
            callback(sender, args);
        }
    });
}
// leaderboard コマンド
registerCommand("-lb", 
[], (sender, args) => {
    if (args.length === 0) {
        sender.sendMessage("§c使用方法: -lb <create|remove|list|help>"); // help サブコマンドを追加
        return;
    }
    const subcommand = args[0];
    switch (subcommand) {
        case "create":
            if (args.length !== 5) {
                sender.sendMessage("§c使用方法: -lb create <objective> <x> <y> <z>");
                return;
            }
            const objective = args[1];
            const x = parseInt(args[2]);
            const y = parseInt(args[3]);
            const z = parseInt(args[4]);
            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                sender.sendMessage("§c座標は数値で指定してください。");
                return;
            }
            system.runTimeout(() => {
                const entity = sender.dimension.spawnEntity("mcbehub:floating_text", sender.location);
                if (!entity) {
                    sender.sendMessage("§cリーダーボードの作成に失敗しました。");
                    return;
                }
                new Leaderboard(objective, entity, sender.dimension);
                sender.sendMessage(`§aリーダーボード "${objective}" を作成しました。`);
                sender.playSound("random.orb");
            });
            break;
        case "remove":
            if (args.length !== 2) {
                sender.sendMessage("§c使用方法: -lb remove <objective>");
                return;
            }
            const objectiveToRemove = args[1];
            const leaderboardToRemove = db_leaderboards[objectiveToRemove];
            if (!leaderboardToRemove) {
                sender.sendMessage(`§c"${objectiveToRemove}" という名前のリーダーボードが見つかりません。`);
                return;
            }
            system.runTimeout(() => {
                if (leaderboardToRemove.delete()) {
                    delete db_leaderboards[objectiveToRemove]; 
                    sender.sendMessage(`§aリーダーボード "${objectiveToRemove}" を削除しました。`);
                    sender.playSound("random.orb");
                }
                else {
                    sender.sendMessage(`§cリーダーボード "${objectiveToRemove}" の削除に失敗しました。`);
                }
            });
            break;
        case "list":
            const page = args.length >= 2 ? parseInt(args[1]) : 1;
            if (isNaN(page) || page < 1) {
                sender.sendMessage("§cページ番号は1以上の数値で指定してください。");
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
                        sender.sendMessage(`§b#${i + 1}§r §g${leaderboard.objective}§r §e${Math.floor(leaderboard.entity?.location.x)}, ${Math.floor(leaderboard.entity?.location.y)}, ${Math.floor(leaderboard.entity?.location.z)}§r §7(${leaderboard.dimension.id})`);
                    }
                }
            });
            break;
        case "help": 
            system.runTimeout(() => {
                sender.sendMessage("§2--- リーダーボードコマンドヘルプ ---");
                sender.sendMessage("§b-lb create <objective> <x> <y> <z>§r: リーダーボードを作成します。");
                sender.sendMessage("§b-lb remove <x> <y> <z>§r: リーダーボードを削除します。");
                sender.sendMessage("§b-lb list [ページ番号]§r: リーダーボードの一覧を表示します。");
                sender.sendMessage("§b-lb help§r: このヘルプを表示します。");
            });
            break;
        default:
            sender.sendMessage("§c無効なサブコマンドです。 -lb help でヘルプを表示します。");
            break;
    }
});
