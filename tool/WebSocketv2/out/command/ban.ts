import { Player, world } from '../backend';
import * as fs from 'fs';
import { promisify } from 'util';

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

interface BanData {
    uuid: string;
    name: string;
    reason: string;
    bannedBy: string;
    bannedAt: number;
    expiresAt: number | null;
}

const banListPath = './banList.json';
export let banListCache: BanData[] | null = null; // キャッシュ用の変数

// BANリストをファイルから読み込み、キャッシュに格納
export async function loadBanList(): Promise<BanData[]> {
    if (banListCache) {
        return banListCache ?? [];
    }

    try {
        await fs.promises.access(banListPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('banList.json does not exist. Creating...');
            await saveBanList([]); // 空のリストで初期化
            console.log('banList.json created.');
        } else {
            console.error('Error accessing ban list:', error);
        }
    }

    try {
        const data = await readFileAsync(banListPath, 'utf-8');
        banListCache = JSON.parse(data);
        return banListCache ?? [];
    } catch (error) {
        console.error('Error reading ban list:', error);
        banListCache = []; // エラー時は空のリストで初期化
        return banListCache;
    }
}

// BANリストをファイルに保存
async function saveBanList(banList: BanData[]): Promise<void> {
    banListCache = banList; // キャッシュを更新
    try {
        const data = JSON.stringify(banList, null, 2);
        await writeFileAsync(banListPath, data, 'utf-8');
    } catch (error) {
        console.error('Error saving ban list:', error);
    }
}

// BAN期限を計算する関数
function calculateBanExpiration(duration: string): number | null {
    const durationParts = duration.match(/\[(.*?)\]/)?.[1].split(',');
    if (!durationParts) {
        return null;
    }

    let totalMilliseconds = 0;
    for (const part of durationParts) {
        const durationMatch = part.trim().match(/(\d+)([dhm])/);
        if (!durationMatch) {
            return null;
        }

        const durationValue = parseInt(durationMatch[1]);
        const unit = durationMatch[2];
        let multiplier = 1000;
        switch (unit) {
            case 'm': multiplier *= 60; break;
            case 'h': multiplier *= 60 * 60; break;
            case 'd': multiplier *= 60 * 60 * 24; break;
        }
        totalMilliseconds += durationValue * multiplier;
    }

    return Date.now() + totalMilliseconds;
}

// プレイヤーがBANされているかどうかを確認し、必要に応じてキックする関数
async function checkAndKickBannedPlayer(player: Player): Promise<void> {
    const banList = await loadBanList();
    const ban = banList.find(b => b.name === player.name);

    if (ban) {
        if (ban.expiresAt && Date.now() > ban.expiresAt) {
            // BAN期限が過ぎている場合は、BANリストから削除
            const updatedBanList = banList.filter(b => b.name !== player.name);
            await saveBanList(updatedBanList);
            const unbanMessage = `
§b§l========================================
§r§a§l[BAN解除通知]§r
§r§aあなたのBANは期限切れのため解除されました。
§b§l========================================
`;
            setTimeout(() => {
                player.sendMessage(unbanMessage);
            }, 3000);
            return;
        }

        // キックメッセージを構築してプレイヤーをキック
        const kickMessage = `§4[§cBAN通知§4]\n§fあなたはBANされました。\n§f理由: §e${ban.reason}\n§fBANした管理者: §b${ban.bannedBy}\n§f期限: §e${ban.expiresAt ? new Date(ban.expiresAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '永久'}`;
        world.runCommand(`kick "${player.name}" ${kickMessage}`);
        world.sendMessage(`§l§f[Server]§r\n§c X §aユーザー §b${player.name}§a はBANされています。§r\n§c参加を拒否しました。`);
    }
}

// プレイヤーをBANする関数
async function banPlayer(bannedBy: Player | "Server", playerName: string, reason: string, duration?: string): Promise<void> {
    if (bannedBy !== "Server" && !(await world.isPlayer(playerName))) {
        bannedBy.sendMessage(`プレイヤー ${playerName} はオンラインではありません。`);
        return;
    }

    let expiresAt: number | null = null;
    if (duration) {
        expiresAt = calculateBanExpiration(duration);
        if (expiresAt === null && bannedBy !== "Server") {
            bannedBy.sendMessage(`期間の指定が正しくありません。使用例: [1d,6h,30m]`);
            return;
        }
    }

    const targetPlayer = await world.getEntityByName(playerName);
    if (!targetPlayer) {
        if (bannedBy !== "Server") {
            bannedBy.sendMessage(`プレイヤー ${playerName} の情報取得に失敗しました。`);
        }
        return;
    }

    const banList = await loadBanList();
    const newBan: BanData = {
        uuid: targetPlayer.uuid,
        name: playerName,
        reason: reason,
        bannedBy: bannedBy === "Server" ? "Server" : bannedBy.name, // ここを修正
        bannedAt: Date.now(),
        expiresAt: expiresAt,
    };

    banList.push(newBan);
    await saveBanList(banList);

    try {
        const kickMessage = `\n§4[§cBAN通知§4]\n§fあなたはBANされました。\n§f理由: §e${reason}\n§fBANした管理者: §b${newBan.bannedBy}\n§f期限: §e${newBan.expiresAt ? new Date(newBan.expiresAt).toLocaleString() : '永久'}`;
        await world.runCommand(`kick "${playerName}" ${kickMessage}`);
    } catch (error) {
        console.error("キックコマンドの実行エラー:", error);
        if (bannedBy !== "Server") {
            bannedBy.sendMessage("キックコマンドの実行中にエラーが発生しました。");
        }
    }

    const broadcastMessage = `§6===============================\n§a[BAN通知] §e${playerName}§a ユーザーがBANされました！\n§f理由: §e${reason}\n§fBANした管理者: §b${newBan.bannedBy}\n§f期限: §e${newBan.expiresAt ? new Date(newBan.expiresAt).toLocaleString() : '永久'}\n§6===============================`;
    world.sendMessage(broadcastMessage);
}

// プレイヤーのBANを解除する関数
async function unbanPlayer(unbannedBy: Player | "Server", playerName: string): Promise<void> {
    const banList = await loadBanList();
    const targetBanIndex = banList.findIndex(ban => ban.name === playerName);

    if (targetBanIndex === -1) {
        if (unbannedBy !== "Server") {
            unbannedBy.sendMessage(`プレイヤー ${playerName} はBANされていません。`);
        }
        return;
    }

    banList.splice(targetBanIndex, 1);
    await saveBanList(banList);

    if (unbannedBy !== "Server") {
        unbannedBy.sendMessage(`プレイヤー ${playerName} のBANを解除しました。`);
    } else {
        console.log(`プレイヤー ${playerName} のBANを解除しました。`); // Serverからの解除の場合、コンソールにログを出力
    }
}

// コマンド登録
import { registerCommand } from '../backend';

registerCommand({
    name: 'ban',
    description: 'プレイヤーをBANします。',
    usage: 'ban <プレイヤー名> <理由> [期間]',
    maxArgs: Infinity,
    minArgs: 2,
    config: { enabled: true, adminOnly: true, requireTag: [] },
    executor: async (player: Player, args: string[]) => {
        const playerName = args[0];
        const reason = args.slice(1).join(' ').replace(/\[(.*?)\]/, '').trim();
        const duration = args.slice(1).join(' ').match(/\[(.*?)\]/)?.[1];
        await banPlayer(player, playerName, reason, duration ? `[${duration}]` : undefined);
    },
});

registerCommand({
    name: 'unban',
    description: 'プレイヤーのBANを解除します。',
    usage: 'unban <プレイヤー名>',
    maxArgs: 1,
    minArgs: 1,
    config: { enabled: true, adminOnly: true, requireTag: [] },
    executor: async (player: Player, args: string[]) => {
        const playerName = args[0];
        await unbanPlayer(player, playerName);
    },
});

if (world) {
    world.on("playerJoin", async (name: string) => {
        const player = await world.getRealname(name);
        if (player) {
            await checkAndKickBannedPlayer(player);
        }
    });
    //定期的に確認
    setInterval(async () => {
        const player = await world.getPlayers();
        if (player) {
            player.forEach((player) => {
                checkAndKickBannedPlayer(player);
            })
        }
    }, 1000 * 60 * 10)
}

export { banPlayer as PlayerBAN, unbanPlayer as PlayerUNBAN };