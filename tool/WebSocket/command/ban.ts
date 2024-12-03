import {
    registerCommand,
    MINECRAFT_COMMAND_PREFIX,
    WorldPlayer,
    BanData,
    saveBanList,
    getBanList
} from '../index';

registerCommand('ban', `${MINECRAFT_COMMAND_PREFIX}ban <player> <reason> [duration]`, 'プレイヤーをBANします。', true, async (sender, world, args) => {
    if (args.length < 2) {
        world.sendMessage(`使用方法: ${MINECRAFT_COMMAND_PREFIX}ban <player> <reason> [duration]`, sender);
        return;
    }

    let expiresAt: number | null = null;
    let banList = await getBanList()
    const durationArg = args.slice(2).join(' ').match(/\[(.*?)\]/);

    if (durationArg) {
        // 期間計算部分は変更なし
        const durationParts = durationArg[1].split(',');
        let totalMilliseconds = 0;
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
                world.sendMessage(`期間の指定が正しくありません: ${part}`, sender);
                return;
            }
        }
        expiresAt = Date.now() + totalMilliseconds;
    }

    const playerName = args[0];
    const reason = args[1]; // reasonは2番目の引数

    const playerData = await WorldPlayer(playerName);
    if (!playerData || playerData.length === 0) {
        world.sendMessage(`プレイヤー ${playerName} は見つかりませんでした。`, sender);
        return;
    }

    const playerInfo = playerData[0];
    const uuid = playerInfo.uniqueId;

    const newBan: BanData = {
        uuid: uuid,
        name: playerName,
        reason: reason,
        bannedBy: sender,
        bannedAt: Date.now(),
        expiresAt: expiresAt,
    };

    banList.push(newBan);
    await saveBanList();

    if (world) {
        try {
            const kickMessage = `\n§4[§cBAN通知§4]\n§fあなたはBANされました。\n§f理由: §e${reason}\n§fBANした管理者: §b${sender}\n§f期限: §e${newBan.expiresAt ? new Date(newBan.expiresAt).toLocaleString() : '永久'}`;
            await world.runCommand(`kick "${playerName}" ${kickMessage}`);
        } catch (error) {
            console.error("キックコマンドの実行エラー:", error);
            world.sendMessage("キックコマンドの実行中にエラーが発生しました。", sender);
        }
    } else {
        console.error("World not found when kicking player.");
    }

    const broadcastMessage = `§6===============================\n§a[BAN通知] §e${playerName}§a ユーザーがBANされました！\n§f理由: §e${reason}\n§fBANした管理者: §b${sender}\n§6===============================`;
    world.sendMessage(broadcastMessage);
});






registerCommand('unban', `${MINECRAFT_COMMAND_PREFIX}unban <player>`, 'プレイヤーのBANを解除します。', true, async (sender, world, args) => {
    if (args.length < 1) {
        world.sendMessage(`使用方法: ${MINECRAFT_COMMAND_PREFIX}unban <player>`, sender);
        return;
    }
    let banList = await getBanList()

    const playerName = args[0];



    const targetBan = banList.find(ban => ban.name === playerName);

    if (!targetBan) {
        world.sendMessage(`プレイヤー ${playerName} はBANされていません。`, sender);
        return;
    }

    
    const targetBanIndex = banList.findIndex(ban => ban.name === playerName);

    if (targetBanIndex !== -1) {
        banList.splice(targetBanIndex, 1); 
    }
    await saveBanList();

    world.sendMessage(`プレイヤー ${playerName} のBANを解除しました。`, sender);
});