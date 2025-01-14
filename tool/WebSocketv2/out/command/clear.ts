import { registerCommand, Player, world } from '../backend';

// 自動クリアの設定を保持するオブジェクト
const autoClearSettings = {
    enabled: true, // 全体の設定: これが無効(false)だと、モブの自動削除や /autoClear cc が機能しなくなります
    mobTypes: {
        zombie: { enabled: true, maxCount: 20 },
        skeleton: { enabled: true, maxCount: 20 },
        creeper: { enabled: true, maxCount: 20 },
        slime: { enabled: true, maxCount: 20 },
        // 他のモブタイプもここに追加可能
    },
    maxHostileMobs: 100, // 敵対モブ総数の上限: これを超えると、敵対モブ(設定で個別に無効化されていないもの)が kill されます
    items: {
        enabled: true, // ドロップアイテムの自動削除
        maxCount: 150 // アイテム数がこの数を超えると、ドロップアイテムが kill されます
    },
    restartTime: 60 // 再起動までの時間（分） デフォルト60
};

registerCommand({
    name: 'autoClear',
    description: 'エンティティの自動クリアを設定します。',
    maxArgs: 4,
    minArgs: 1,
    config: { enabled: true, adminOnly: false, requireTag: ['op'] },
    executor: async (player: Player, args: string[]) => {
        const command = args[0].toLowerCase();

        switch (command) {
            case 'toggle': {
                // 全体の有効/無効切り替え
                autoClearSettings.enabled = !autoClearSettings.enabled;
                player.sendMessage(`§a[autoClear]§r 自動クリアを§6${autoClearSettings.enabled ? '有効' : '無効'}§rにしました。(全体設定)`);
                break;
            }
            case 'set': {
                if (args.length < 4) {
                    player.sendMessage("§a[autoClear]§r 使用法: /autoClear set <mobType> <true/false> <maxCount>");
                    player.sendMessage("§a[autoClear]§r <mobType> には mob の種類 (例: zombie, skeleton, creeper, item など) を設定します。");
                    return;
                }
                const mobType = args[1].toLowerCase();
                const toggle = args[2].toLowerCase();
                const maxCount = parseInt(args[3]);

                if (!autoClearSettings.mobTypes[mobType]) {
                    player.sendMessage(`§a[autoClear]§r '§6${mobType}§r' というモブタイプは存在しません。`);
                    return;
                }

                if (isNaN(maxCount)) {
                    player.sendMessage("§a[autoClear]§r maxCount は数値を設定してください。");
                    return;
                }

                autoClearSettings.mobTypes[mobType].enabled = toggle === 'true';
                autoClearSettings.mobTypes[mobType].maxCount = maxCount;

                player.sendMessage(`§a[autoClear]§r §6${mobType}§r の自動クリアを§6${toggle === 'true' ? '有効' : '無効'}§rにし、最大数を §6${maxCount}§r に設定しました。`);
                // }
                break;
            }
            case 'total': {
                // 敵対モブ総数の上限設定
                if (args.length < 2) {
                    player.sendMessage("§a[autoClear]§r 使用法: /autoClear total <maxCount>");
                    player.sendMessage("§a[autoClear]§r 敵対モブ(ゾンビ, スケルトンなど)の総数の上限を設定します。");
                    return;
                }
                const maxCount = parseInt(args[1]);

                if (isNaN(maxCount)) {
                    player.sendMessage("§a[autoClear]§r maxCount は数値を設定してください。");
                    return;
                }

                autoClearSettings.maxHostileMobs = maxCount;
                player.sendMessage(`§a[autoClear]§r 敵対モブの総数の上限を §6${maxCount}§r に設定しました。`);
                break;
            }
            case 'items': {
                // 落ちているアイテムの自動クリア設定
                if (args.length < 2) {
                    player.sendMessage("§a[autoClear]§r 使用法: /autoClear items <true/false> [maxCount]");
                    player.sendMessage("§a[autoClear]§r ドロップアイテムの自動クリアの有効/無効と、(有効の場合の)上限数を設定します。");
                    return;
                }
                const toggle = args[1].toLowerCase();
                autoClearSettings.items.enabled = toggle === 'true';

                if (args.length >= 3) {
                    let maxCount = parseInt(args[2]);
                    if (isNaN(maxCount)) {
                        player.sendMessage("§a[autoClear]§r maxCount は数値を設定してください。");
                        return;
                    }
                    autoClearSettings.items.maxCount = maxCount;
                    player.sendMessage(`§a[autoClear]§r ドロップアイテムの最大数を §6${maxCount}§r に設定しました。`);
                } else {
                    // true だけが設定された場合の案内
                    player.sendMessage(`§a[autoClear]§r ドロップアイテムの自動クリアを§6${autoClearSettings.items.enabled ? '有効' : '無効'}§rに設定しました。`);
                }
                break;
            }
            case 'list': {
                // 現在の設定とエンティティ数を表示
                player.sendMessage("§l§a[autoClear]§r 現在の自動クリア設定:");
                player.sendMessage(`§a全体設定§r: §6${autoClearSettings.enabled ? '有効' : '無効'}§r (無効だとモブの自動削除と /ac cc が実行されません)`);

                // 各モブタイプの数と設定を取得
                player.sendMessage("§l§aモブ個別設定§r:");
                for (const mobType in autoClearSettings.mobTypes) {
                    const entityType = mobType === 'zombie' ? 'minecraft:zombie' : `minecraft:${mobType}`;
                    const mobCountResult = await world.runCommand(`testfor @e[type=${entityType}]`);
                    const mobCount =
                        mobCountResult.statusCode === 0 && mobCountResult.victim
                            ? mobCountResult.victim.length
                            : 0;

                    player.sendMessage(`- §6${mobType}§r: 自動クリア: §6${autoClearSettings.mobTypes[mobType].enabled ? '有効' : '無効'}§r (最大数: §6${autoClearSettings.mobTypes[mobType].maxCount}§r, 現在数: §6${mobCount}§r)`);
                }

                // 敵対モブの総数を取得して表示
                const totalHostileMobsResult = await world.runCommand(`testfor @e[family=monster]`);
                const totalHostileMobs =
                    totalHostileMobsResult.statusCode === 0 && totalHostileMobsResult.victim
                        ? totalHostileMobsResult.victim.length
                        : 0;

                player.sendMessage(`§a敵対モブ総数の上限§r: §6${autoClearSettings.maxHostileMobs}§r, 現在数: §6${totalHostileMobs}§r (この数を超えると敵対モブが削除されます)`);

                // アイテムの数と設定を取得して表示
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
                break;
            case 'help': // ヘルプの表示
            case 'h':
            case '?':
                player.sendMessage("§l§a/autoClear コマンドの使い方§r:");
                player.sendMessage("§a/autoClear toggle§r - 自動クリア機能の全体を有効/無効にします。");
                player.sendMessage("§a/autoClear set <mobType> <true/false> <maxCount>§r - 特定のモブの自動クリアの有効/無効、上限数を設定します。");
                player.sendMessage("§a/autoClear total <maxCount>§r - 敵対モブ(ゾンビ, スケルトンなど)の総数の上限を設定します。");
                player.sendMessage("§a/autoClear items <true/false> [maxCount]§r - ドロップアイテムの自動クリアの有効/無効、上限数(オプション)を設定します。");
                player.sendMessage("§a/autoClear list§r - 現在の自動クリア設定と、各エンティティの数、敵対モブの総数、アイテムの数などを表示します。");
                player.sendMessage("§a/autoClear clear_chat (または /autoClear cc)§r - チャット欄をクリアします。");
                player.sendMessage("§a/autoClear help (または /autoClear h /autoClear ?)§r - このヘルプを表示します。");
                break;
            default:
                player.sendMessage("§a[autoClear]§r 不明なコマンドです。/autoClear help で使い方を確認してください。");
        }
    },
});

// 再起動関連の変数を追加
let restartTimer: NodeJS.Timeout | null = null;
let timeLeft = autoClearSettings.restartTime; // 再起動までの残り時間（分）

function startRestartTimer() {
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

// 再起動タイマー開始
startRestartTimer();

// 5秒間隔でエンティティをチェックして削除
setInterval(async () => {
    if (!autoClearSettings.enabled) return;

    // 各モブタイプの数をチェック
    for (const mobType in autoClearSettings.mobTypes) {
        if (!autoClearSettings.mobTypes[mobType].enabled) continue; // 無効ならスキップ

        const entityType = mobType === 'zombie' ? 'minecraft:zombie' : `minecraft:${mobType}`;
        const mobCountResult = await world.runCommand(`testfor @e[type=${entityType}]`);

        // 失敗したらログを出して次のモブタイプへ
        if (mobCountResult?.statusCode !== 0) {
            //  console.error(`${mobType} の数の取得に失敗しました:`, mobCountResult);
            continue;
        }

        const mobCount = mobCountResult.victim ? mobCountResult.victim.length : 0;

        if (mobCount > autoClearSettings.mobTypes[mobType].maxCount) {
            await world.runCommand(`kill @e[type=${entityType}]`);
            console.log(`[autoClear] ${mobType} の数が ${autoClearSettings.mobTypes[mobType].maxCount} を超えたため削除しました。`);
        }
    }

    // 敵対モブの総数をチェック
    const totalHostileMobsResult = await world.runCommand(`testfor @e[family=monster]`);
    if (totalHostileMobsResult.statusCode !== 0) {
        // console.error("敵対モブの総数の取得に失敗しました:", totalHostileMobsResult);
        return;
    }

    const totalHostileMobs = totalHostileMobsResult.victim ? totalHostileMobsResult.victim.length : 0;
    if (totalHostileMobs > autoClearSettings.maxHostileMobs) {
        // 敵対モブで、かつ個別に無効化されていないものを削除
        for (const entityName of totalHostileMobsResult.victim) {
            const mobType = entityName.replace('minecraft:', ''); // minecraft: を除外して比較
            if (autoClearSettings.mobTypes[mobType] === undefined || autoClearSettings.mobTypes[mobType].enabled) {
                await world.runCommand(`kill ${entityName}`);
            }
        }
        console.log(`[autoClear] 敵対モブの総数が ${autoClearSettings.maxHostileMobs} を超えたため一部を削除しました。`);
    }

    // ドロップアイテムの数をチェック
    if (autoClearSettings.items.enabled) {
        const itemCountResult = await world.runCommand(`testfor @e[type=item]`);
        if (itemCountResult.statusCode !== 0) {
            //   console.error("アイテム数の取得に失敗しました:", itemCountResult);
            return;
        }

        const itemCount = itemCountResult.victim ? itemCountResult.victim.length : 0;
        if (itemCount > autoClearSettings.items.maxCount) {
            await world.runCommand(`kill @e[type=item]`);
            console.log(`[autoClear] アイテム数が ${autoClearSettings.items.maxCount} を超えたため削除しました。`);
        }
    }
}, 5000);