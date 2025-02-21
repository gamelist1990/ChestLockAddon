import { registerCommand, world } from '../backend';
import { PlayerBAN } from './ban';
import { Player } from '../module/player';

// スパム検知用のデータ
interface SpamPlayerData {
    recentMessages: { time: number }[];
    warningCount: number;
}
const spamLog: Map<string, SpamPlayerData> = new Map();


// スパム検知関数 (detectSpam)
function detectSpam(player: Player, message: string): void {
    const timeWindow: number = 2000;  // 3秒
    const spamThreshold: number = 3;   // 3秒間に4メッセージ以上でスパム
    const maxWarnings: number = 3;     // 3回警告でBAN

    // スパム時のアクション (警告、ミュート、BAN)
    const spamAction = async (player: Player, level: number) => {
        const playerName = player.name;
        switch (level) {
            case 1:
                player.sendMessage("§c[警告] スパム行為はやめてください。");
                console.warn(`[AntiCheat] ${playerName} - Spam warning (Level 1).`);
                break;
            case 2:
                player.sendMessage("§c[警告] スパム行為を繰り返したため、1分間ミュートします。");
                console.warn(`[AntiCheat] ${playerName} - Spam warning (Level 2). Muted for 1 minute.`);
                player.runCommand(`ability @s mute true`);  // ミュートにする
                setTimeout(() => {
                    player.runCommand(`ability @s mute false`); // ミュート解除
                    player.sendMessage("§c[警告] この次またスパムした場合はServerによりBAN処理が行われます");
                }, 60000); // 60秒後
                break;
            case 3:
                try {
                    await PlayerBAN("Server", player.name, "スパム行為(1day)", "[1d]");  // BAN
                    console.warn(`[AntiCheat] ${playerName} was banned for spamming.`);
                } catch (error) {
                    console.error(`[AntiCheat] Error banning player ${playerName}:`, error);
                }
                break;
        }

        // レベル3 (BAN) の場合は、スパムデータをリセット
        if (level === 3) {
            resetSpamData(playerName);
        }
    };

    // スパムデータのリセット
    const resetSpamData = (playerName: string) => {
        spamLog.set(playerName, { recentMessages: [], warningCount: 0 });
    };

    const playerName = player.name;
    const now = Date.now();

    // プレイヤーのデータがなければ初期化
    if (!spamLog.has(playerName)) {
        resetSpamData(playerName);
    }

    const playerData = spamLog.get(playerName)!;

    // timeWindow より古いメッセージは除外
    playerData.recentMessages = playerData.recentMessages.filter(msg => now - msg.time <= timeWindow);

    // 新しいメッセージを追加
    playerData.recentMessages.push({ time: now });

    // スパム判定
    if (playerData.recentMessages.length >= spamThreshold) {
        playerData.warningCount++;

        if (playerData.warningCount >= maxWarnings) {
            spamAction(player, 3);
        } else {
            spamAction(player, playerData.warningCount);
        }
    }
}


// --- メッセージイベントハンドラ ---
if (world) {
    world.on('playerChat', async (sender: string, message: string, type: string) => {
        const player = await world.getEntityByName(sender);

        if (player) {
            if (type === "chat" || type === "scoreboard") {
                onPlayerMessage(player, message);
            }
        }
    });
}

// --- メッセージ処理関数 ---
function onPlayerMessage(player: Player, message: string): void {
    detectSpam(player, message);
}


// --- コマンド登録 (miniAC コマンド) ---
registerCommand({
    name: 'miniAC',
    description: 'アンチチート機能の設定を変更します。',
    minArgs: 2,
    config: { enabled: true, adminOnly: true, requireTag: [] },
    executor: async (player: Player, args: string[]) => {
        player.sendMessage("§c[AntiCheat] このコマンドは現在使用できません。");
    },
});