import { registerCommand, world, prefix } from "../backend";
import { Player } from '../module/player';


registerCommand({
    name: 'info',
    description: '自身または相手の情報を表示します',
    maxArgs: 2,
    minArgs: 0,
    config: {
        enabled: true,
        adminOnly: false,
        requireTag: []
    },
    usage: `${prefix}info [-p <targetName>]`,
    executor: async (player: Player, args: string[]) => {
        const arg = args[0];

        if (arg === "-p") {
            const targetName = args[1];
            if (targetName) {
                if (world) {
                    const target = await world.getEntityByName(targetName);
                    if (target) {
                        // ターゲット情報を分割して送信
                        player.sendMessage(`§l--- §b${target.name} §r§lの情報 §l---`);
                        player.sendMessage(`§lName:§r ${target.name}`);
                        player.sendMessage(`§lUUID:§r ${target.uuid}`);
                        player.sendMessage(`§lID:§r ${target.id}`);
                        player.sendMessage(`§lDimension:§r ${target.dimension}`);
                        player.sendMessage(`§lPing:§r ${target.ping}`);

                    } else {
                        player.sendMessage(`指定されたユーザー名:§l${targetName}§rが見つかりませんでした`);
                    }
                } else {
                    player.sendMessage(`只今この機能は使用できません (Worldオブジェクトが不明)`);
                }
            } else {
                player.sendMessage(`ターゲット名を指定してください: §r${prefix}info -p <targetName>§r`);
            }
        } else {
            // 自身の情報を分割して送信
            player.sendMessage(`§l--- §b${player.name} §r§lの情報 §l---`);
            player.sendMessage(`§lName:§r ${player.name}`);
            player.sendMessage(`§lUUID:§r ${player.uuid}`);
            player.sendMessage(`§lID:§r ${player.id}`);
            player.sendMessage(`§lDimension:§r ${player.dimension}`);
            player.sendMessage(`§lPing:§r ${player.ping}`);
        }
    }
});