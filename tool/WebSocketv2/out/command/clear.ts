import { registerCommand, world } from '../backend';
import { Player } from '../module/player';


// 自動クリアの設定を保持するオブジェクト
const autoClearSettings = {
    enabled: false, // 全体の設定: これが無効(false)だと、チャットクリア、再起動、自動モブキルが機能しなくなります
    restartTime: 60, // 再起動までの時間（分） デフォルト60
    maxHostileMobs: 50, // 敵対モブ総数の上限 デフォルト50から100に変更
    items: { enabled: true, maxCount: 200 }, // アイテムの設定
    mobKill: {
        enabled: false, // 自動モブキルの有効/無効
        interval: 10,  // 確認間隔（秒） デフォルト5
    }
};

registerCommand({
    name: 'autoClear',
    description: 'チャットクリア、再起動、自動モブキルの設定を行います。',
    maxArgs: 3,
    minArgs: 1,
    config: { enabled: true, adminOnly: false, requireTag: ['op'] },
    executor: async (player: Player, args: string[]) => {
        const command = args[0].toLowerCase();

        switch (command) {
            case 'toggle': {
                // 全体の有効/無効切り替え
                autoClearSettings.enabled = !autoClearSettings.enabled;
                player.sendMessage(`§a[autoClear]§r チャットクリア、再起動、自動モブキルを§6${autoClearSettings.enabled ? '有効' : '無効'}§rにしました。(全体設定)`);
                // 全体を切り替えた際にタイマーを再起動する
                if (autoClearSettings.enabled) {
                    startRestartTimer();
                } else {
                    if (restartTimer) {
                        clearInterval(restartTimer);
                        restartTimer = null;
                    }
                }
                break;
            }
            case 'total': {
                if (args.length < 2) {
                    player.sendMessage("§a[autoClear]§r 使用法: /autoClear total <maxCount>");
                    player.sendMessage("§a[autoClear]§r 敵対モブ(ゾンビ, スケルトンなど)の総数の上限を設定します。");
                    return;
                }
                const maxCount = parseInt(args[1]);
                if (isNaN(maxCount) || maxCount <= 0) {
                    player.sendMessage("§a[autoClear]§r maxCount には 1 以上の数値を指定してください。");
                    return;
                }
                autoClearSettings.maxHostileMobs = maxCount;
                player.sendMessage(`§a[autoClear]§r 敵対モブの総数の上限を §6${maxCount}§r に設定しました。`);
                break;
            }
            case 'items': {
                if (args.length < 2) {
                    player.sendMessage("§a[autoClear]§r 使用法: /autoClear items <true/false> [maxCount]");
                    player.sendMessage("§a[autoClear]§r ドロップアイテムの自動クリアの有効/無効、上限数(オプション)を設定します。");
                    return;
                }
                const enabled = args[1].toLowerCase() === 'true';
                autoClearSettings.items.enabled = enabled;
                if (args.length >= 3) {
                    const maxCount = parseInt(args[2]);
                    if (isNaN(maxCount) || maxCount <= 0) {
                        player.sendMessage("§a[autoClear]§r maxCount には 1 以上の数値を指定してください。");
                        return;
                    }
                    autoClearSettings.items.maxCount = maxCount;
                }
                player.sendMessage(`§a[autoClear]§r アイテムの自動クリアを §6${enabled ? '有効' : '無効'}§r${args.length >= 3 ? `、上限数を §6${autoClearSettings.items.maxCount}§r` : ''} に設定しました。`);
                break;
            }
            case 'list': {
                player.sendMessage("§l§a現在の自動クリア設定§r:");

                // 全体の設定を表示
                player.sendMessage(`§a全体設定§r: §6${autoClearSettings.enabled ? '有効' : '無効'}§r`);

                // 敵対モブ総数の上限を表示
                const totalHostileMobsResult = await world.runCommand(`testfor @e[family=monster]`);
                const totalHostileMobs =
                    totalHostileMobsResult.statusCode === 0 && totalHostileMobsResult.victim
                        ? totalHostileMobsResult.victim.length
                        : 0;

                player.sendMessage(`§a敵対モブ総数の上限§r: §6${autoClearSettings.maxHostileMobs}§r, 現在数: §6${totalHostileMobs}§r (この数を超えると敵対モブが削除されます)`);

                // アイテムの数と設定を表示
                const itemCountResult = await world.runCommand(`testfor @e[type=item]`);
                const itemCount =
                    itemCountResult.statusCode === 0 && itemCountResult.victim
                        ? itemCountResult.victim.length
                        : 0;

                player.sendMessage(`§aアイテムの自動クリア§r: §6${autoClearSettings.items.enabled ? '有効' : '無効'}§r (最大数: §6${autoClearSettings.items.maxCount}§r, 現在数: §6${itemCount}§r)`);

                const testAllResult = await world.runCommand(`testfor @e[type=!player]`);
                if (testAllResult.statusCode === 0 && testAllResult.victim) {
                    const entityCounts: { [type: string]: number } = {};
                    for (const entityName of testAllResult.victim) {
                        entityCounts[entityName] = (entityCounts[entityName] || 0) + 1;
                    }

                    const sortedEntityCounts = Object.entries(entityCounts).sort(([, countA], [, countB]) => countB - countA);

                    player.sendMessage("§l§aエンティティ数 Top 3§r:");
                    for (let i = 0; i < 3 && i < sortedEntityCounts.length; i++) {
                        const [entityName, count] = sortedEntityCounts[i];
                        player.sendMessage(`§6${i + 1}. ${entityName}§r: ${count}体`);
                    }
                } else {
                    player.sendMessage("§aエンティティ数の取得に失敗しました。§r");
                }

                break;
            }
            case 'clear_chat':
            case 'cc':

                for (let i = 0; i < 100; i++) {
                    world.sendMessage("");
                }
                world.sendMessage("§a[autoClear]§r チャットをクリアしました。");

                break;
            case 'restart':
                if (args.length < 2) {
                    player.sendMessage("§a[autoClear]§r 使用法: /autoClear restart <time>");
                    player.sendMessage("§a[autoClear]§r <time> 自動で再起動を有効にします　分を入力してください デフォルトでは60(分)となっています");
                    player.sendMessage("§a[autoClear]§r 再起動時間の再設定をすることが出来ます 例: /autoClear restart 30 で 30分事に再起動を行います");

                    return;
                }
                if (args[1] == "toggle") {
                    autoClearSettings.enabled = !autoClearSettings.enabled;
                    player.sendMessage(`§a[autoClear]§r 自動再起動を§6${autoClearSettings.enabled ? '有効' : '無効'}§rにしました。`);
                    // 再起動の有効無効を切り替えた際にタイマーを再起動する
                    if (autoClearSettings.enabled) {
                        startRestartTimer();
                    } else {
                        if (restartTimer) {
                            clearInterval(restartTimer);
                            restartTimer = null;
                        }
                    }
                    break;
                }
                const time = parseInt(args[1]);
                if (isNaN(time)) {
                    player.sendMessage(`§a[autoClear]§r 自動再起動の時間には数値を入れてください`);
                    return;
                }
                if (time <= 0) {
                    player.sendMessage(`§a[autoClear]§r 時間には 1 以上の数値を設定してください`)
                    return;
                }
                autoClearSettings.restartTime = time;
                player.sendMessage(`§a[autoClear]§r 自動再起動時間を §6${time}分§rにしました`);
                // 時間を変更した際にタイマーを再起動する
                startRestartTimer();
                break;
            case 'help': // ヘルプの表示
            case 'h':
            case '?':
                player.sendMessage("§l§a/autoClear コマンドの使い方§r:");
                player.sendMessage("§a/autoClear toggle§r - 自動クリア機能の全体を有効/無効にします。");
                player.sendMessage("§a/autoClear total <maxCount>§r - 敵対モブ(ゾンビ, スケルトンなど)の総数の上限を設定します。");
                player.sendMessage("§a/autoClear items <true/false> [maxCount]§r - ドロップアイテムの自動クリアの有効/無効、上限数(オプション)を設定します。");
                player.sendMessage("§a/autoClear list§r - 現在の自動クリア設定と、各エンティティの数、敵対モブの総数、アイテムの数などを表示します。");
                player.sendMessage("§a/autoClear clear_chat (または /autoClear cc)§r - チャット欄をクリアします。");
                player.sendMessage("§a/autoClear restart <time>§r - 自動再起動を有効にし、<time> 分後に再起動します (デフォルト: 60分)");
                player.sendMessage("§a/autoClear restart toggle§r - 自動再起動の有効/無効を切り替えます");
                player.sendMessage("§a/autoClear help (または /autoClear h /autoClear ?)§r - このヘルプを表示します。");
                break;
            default:
                player.sendMessage("§a[autoClear]§r 不明なコマンドです。/autoClear help で使い方を確認してください。");
        }
    },
});

// 再起動関連の変数を追加
let restartTimer: NodeJS.Timer | null = null;
let timeLeft = autoClearSettings.restartTime; // 再起動までの残り時間（分）

function startRestartTimer() {
    if (!autoClearSettings.enabled) return;

    if (restartTimer) {
        clearInterval(restartTimer);
        restartTimer = null;
    }

    // 初回のタイマー設定
    timeLeft = autoClearSettings.restartTime;
    restartTimer = setInterval(() => {
        timeLeft--;

        if (timeLeft <= 0) {
            // 再起動実行
            world.sendMessage("§l§4[autoClear]§r 10秒後に再起動を実行します。");
            setTimeout(() => {
                world.runCommand('reload all');
            }, 10000);

            // タイマーリセット
            clearInterval(restartTimer!);
            restartTimer = null;
            timeLeft = autoClearSettings.restartTime;

            // 再起動通知後、再起動タイマーを開始する
            setTimeout(() => {
                startRestartTimer();
            }, 15000);

        } else if (timeLeft === 60 || timeLeft === 30 || timeLeft === 15 || timeLeft === 10 || timeLeft === 5) {
            // 残り時間通知
            world.sendMessage(`§l§a[autoClear]§r ${timeLeft}分後に再起動を実行します。`);
        }
    }, 60000); // 1分ごとに実行
}

// 再起動タイマー開始（初期状態では無効）
// startRestartTimer();

// 5秒間隔でエンティティをチェックして削除
setInterval(async () => {
    if (!autoClearSettings.enabled) return;

    // 敵対モブの総数をチェック
    const totalHostileMobsResult = await world.runCommand(`testfor @e[family=monster]`);
    if (totalHostileMobsResult.statusCode !== 0) {
        console.error("敵対モブの総数の取得に失敗しました:", totalHostileMobsResult);
        return;
    }

    const totalHostileMobs = totalHostileMobsResult.victim ? totalHostileMobsResult.victim.length : 0;
    if (totalHostileMobs > autoClearSettings.maxHostileMobs) {
        await world.runCommand(`kill @e[family=monster]`);
        world.sendMessage(`[autoClear] 敵対モブの総数が ${autoClearSettings.maxHostileMobs} を超えたため削除しました。`);
    }

    // ドロップアイテムの数をチェック
    if (autoClearSettings.items.enabled) {
        const itemCountResult = await world.runCommand(`testfor @e[type=item]`);
        if (itemCountResult.statusCode !== 0) {
            console.error("アイテム数の取得に失敗しました:", itemCountResult);
            return;
        }

        const itemCount = itemCountResult.victim ? itemCountResult.victim.length : 0;
        if (itemCount > autoClearSettings.items.maxCount) {
            await world.runCommand(`kill @e[type=item]`);
            world.sendMessage(`[autoClear] アイテム数が ${autoClearSettings.items.maxCount} を超えたため削除しました。`);
        }
    }
}, autoClearSettings.mobKill.interval * 1000);