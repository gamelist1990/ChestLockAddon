import {
    registerCommand,
    MINECRAFT_COMMAND_PREFIX,
    WorldPlayer,
    BanData,
    saveBanList,
    getBanList,
} from '../index';

// 警告リストのデータ構造
export interface WarnData {
    uuid: string;
    name: string;
    reason: string;
    warnedBy: string;
    warnedAt: number;
}


export let warnList:WarnData[] = []

export const warnCount = 5;


registerCommand('warn', `${MINECRAFT_COMMAND_PREFIX}warn <player> <reason>`, 'プレイヤーに警告を発令します。', true, async (sender, world, args) => {
    if (args.length < 2) {
        world.sendMessage(`使用方法: ${MINECRAFT_COMMAND_PREFIX}warn <player> <reason>`, sender);
        return;
    }

    const playerName = args[0];
    const reason = args.slice(1).join(" "); 

    const playerData = await WorldPlayer(playerName);
    if (!playerData || playerData.length === 0) {
        world.sendMessage(`プレイヤー ${playerName} は見つかりませんでした。`, sender);
        return;
    }

    const playerInfo = playerData[0];
    const uuid = playerInfo.uniqueId;


    const newWarn: WarnData = {
        uuid: uuid,
        name: playerName,
        reason: reason,
        warnedBy: sender,
        warnedAt: Date.now(),
    };

    warnList.push(newWarn);

    const playerWarns = warnList.filter(warn => warn.uuid === uuid);

    world.sendMessage(`§aプレイヤー §e${playerName} §aに警告を発令しました。§f理由: §c${reason}`, sender);
    world.sendMessage(`§eあなたは警告を受けました。§f理由: §c${reason}§f, 発令者: §b${sender}`, playerName);


    if (playerWarns.length >= warnCount) {
        world.sendMessage(`§cプレイヤー §e${playerName} §cは${warnCount}回警告を受けたため、一時的にBANされます。`, sender);

        let banList = await getBanList();
        const newBan: BanData = {
            uuid: uuid,
            name: playerName,
            reason: `§e${warnCount}回§c警告を受けたため`,
            bannedBy: "Server",
            bannedAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        };
        banList.push(newBan);
        await saveBanList();

        // 警告リストから該当プレイヤーの警告を削除
        warnList = warnList.filter(warn => warn.uuid !== uuid);


        try {
            const kickMessage = `\n§4[§cBAN通知§4]\n§fあなたはBANされました。\n§f理由: §e${warnCount}回警告を受けたため\n§fBANした管理者: §bServer\n§f期限: §e24時間`;
            await world.runCommand(`kick "${playerName}" ${kickMessage}`);
            const broadcastMessage = `§6===============================\n§a[BAN通知] §e${playerName}§a ユーザーがBANされました！\n§f理由: §e${warnCount}回警告を受けたが改善しなかった為\n§fBANした管理者: §bServer\n§6===============================`;
            world.sendMessage(broadcastMessage);
        } catch (error) {
            console.error("キックコマンドの実行エラー:", error);
            world.sendMessage("キックコマンドの実行中にエラーが発生しました。", sender);
        }
    }
});