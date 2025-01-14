import { PlatformType } from '@minecraft/server';
import { registerCommand, Player, wsserver, world } from '../backend';
import * as fs from 'fs';
import { promisify } from 'util';
import { World } from '../module/world';

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

async function ensureBanListExists(): Promise<void> {
    try {
        await fs.promises.access(banListPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('banList.json does not exist. Creating...');
            await saveBanList([]);
            console.log('banList.json created.');
        } else {
            console.error('Error accessing ban list:', error);
        }
    }
}

async function getBanList(): Promise<BanData[]> {
    await ensureBanListExists(); // ファイルの存在確認と必要に応じた作成

    try {
        const data = await readFileAsync(banListPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading ban list:', error);
        return [];
    }
}

async function saveBanList(banList: BanData[]): Promise<void> {
    try {
        const data = JSON.stringify(banList, null, 2);
        await writeFileAsync(banListPath, data, 'utf-8');
    } catch (error) {
        console.error('Error saving ban list:', error);
    }
}

if (world) {
    world.on('playerJoin', async (event: any) => {
        const player = event;
        if (player) {
            const banList = await getBanList();
            const ban = banList.find(b => b.name === player.name);

            if (ban) {
                // BAN期限のチェック
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
                    const user = await world.getEntityByName(player.name);
                    user?.sendMessage(unbanMessage);

                    return;
                }

                // キックメッセージを構築してプレイヤーをキック
                const kickMessage = `§4[§cBAN通知§4]\n§fあなたはBANされました。\n§f理由: §e${ban.reason}\n§fBANした管理者: §b${ban.bannedBy}\n§f期限: §e${ban.expiresAt ? new Date(ban.expiresAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '永久'}`;
                world.runCommand(`kick "${player.name}" ${kickMessage}`)
                world.sendMessage(`§l§f[Server]§r\n§c X §aユーザー §b${player.name}§a はBANされています。§r\n§c参加を拒否しました。`);
            }
        }

    });

}

// Banコマンド
registerCommand({
    name: 'ban',
    description: 'プレイヤーをBANします。',
    usage: 'ban <プレイヤー名> <理由> [期間]',
    maxArgs: Infinity,
    minArgs: 2,
    config: { enabled: true, adminOnly: true, requireTag: [] },
    executor: async (player: Player, args: string[]) => {
        // 引数が不足している場合の処理を強化
        if (args.length < 2) {
            player.sendMessage("引数が不足しています。使用法: /ban <プレイヤー名> <理由> [期間]");
            return;
        }

        const playerName = args[0];

        // world.isPlayer でオンラインであることを確認
        if (!(await world.isPlayer(playerName))) {
            player.sendMessage(`プレイヤー ${playerName} はオンラインではありません。`);
            return;
        }

        let expiresAt: number | null = null;
        let banList = await getBanList();
        let reason = '';

        const durationArg = args.slice(1).join(' ').match(/\[(.*?)\]/);

        if (durationArg) {
            reason = args.slice(1).join(' ').replace(/\[(.*?)\]/, '').trim(); // []と[]の中身を削除し、前後の空白も削除
            if (reason.length == 0) {
                player.sendMessage("期間が設定されましたが理由が入力されていません 使用法: /ban <プレイヤー名> <理由> [期間]");
                return;
            }
            const durationParts = durationArg[1].split(',');
            let totalMilliseconds = 0;
            let invalidDuration = false;
            for (const part of durationParts) {
                const durationMatch = part.trim().match(/(\d+)([dhm])/);
                if (durationMatch) {
                    const duration = parseInt(durationMatch[1]);
                    const unit = durationMatch[2];
                    let multiplier = 1000;
                    switch (unit) {
                        case 'm': multiplier *= 60; break;
                        case 'h': multiplier *= 60 * 60; break;
                        case 'd': multiplier *= 60 * 60 * 24; break;
                    }
                    totalMilliseconds += duration * multiplier;
                } else {
                    invalidDuration = true;
                    break;
                }
            }
            if (invalidDuration) {
                player.sendMessage(`期間の指定が正しくありません。使用例: [1d,6h,30m]`);
                return;
            }
            expiresAt = Date.now() + totalMilliseconds;
        } else {
            reason = args.slice(1).join(' ').trim(); // 前後の空白を削除
            if (reason.length == 0) {
                player.sendMessage("理由が入力されていません 使用法: /ban <プレイヤー名> <理由> [期間]");
                return;
            }
        }


        const targetPlayer = await world.getEntityByName(playerName);

        if (!targetPlayer) {
            player.sendMessage(`プレイヤー ${playerName} の情報取得に失敗しました。`);
            return;
        }


        const newBan: BanData = {
            uuid: targetPlayer.uuid, // オンラインプレイヤーから取得したUUIDを使用
            name: playerName,
            reason: reason,
            bannedBy: player.name,
            bannedAt: Date.now(),
            expiresAt: expiresAt,
        };

        banList.push(newBan);
        await saveBanList(banList);

        try {
            const kickMessage = `\n§4[§cBAN通知§4]\n§fあなたはBANされました。\n§f理由: §e${reason}\n§fBANした管理者: §b${player.name}\n§f期限: §e${newBan.expiresAt ? new Date(newBan.expiresAt).toLocaleString() : '永久'}`;
            await player.runCommand(`kick "${playerName}" ${kickMessage}`);
        } catch (error) {
            console.error("キックコマンドの実行エラー:", error);
            player.sendMessage("キックコマンドの実行中にエラーが発生しました。");
        }

        const broadcastMessage = `§6===============================\n§a[BAN通知] §e${playerName}§a ユーザーがBANされました！\n§f理由: §e${reason}\n§fBANした管理者: §b${player.name}\n§f期限: §e${newBan.expiresAt ? new Date(newBan.expiresAt).toLocaleString() : '永久'}\n§6===============================`;
        player.runCommand(`tellraw @a {"rawtext":[{"text":"${broadcastMessage}"}]}`);
    },
});

// Unbanコマンド
registerCommand({
    name: 'unban',
    description: 'プレイヤーのBANを解除します。',
    usage: 'unban <プレイヤー名>',
    maxArgs: 1,
    minArgs: 1,
    config: { enabled: true, adminOnly: true, requireTag: [] },
    executor: async (player: Player, args: string[]) => {
        // 引数の数が間違っている場合の処理を追加
        if (args.length === 0) {
            player.sendMessage("引数が不足しています。使用法: /unban <プレイヤー名>");
            return;
        }

        let banList = await getBanList();
        const playerName = args[0];
        const targetBanIndex = banList.findIndex(ban => ban.name === playerName);

        if (targetBanIndex === -1) {
            player.sendMessage(`プレイヤー ${playerName} はBANされていません。`);
            return;
        }

        banList.splice(targetBanIndex, 1);
        await saveBanList(banList);

        player.sendMessage(`プレイヤー ${playerName} のBANを解除しました。`);
    },
});