import { registerCommand, Player, world, prefix } from "../backend";

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
                        // ターゲット情報を整形して送信
                        player.sendMessage(`§l--- §b${target.name} §r§lの情報 §l---\n§r` +
                            `§lName:§r ${target.name}\n` +
                            `§lUUID:§r ${target.uuid}\n` +
                            `§lID:§r ${target.id}\n` +
                            `§lDimension:§r ${target.dimension}\n` +
                            `§lPing:§r ${target.ping}`);
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
            player.sendMessage(`§l--- §b${player.name} §r§lの情報 §l---\n§r` +
                `§lName:§r ${player.name}\n` +
                `§lUUID:§r ${player.uuid}\n` +
                `§lID:§r ${player.id}\n` +
                `§lDimension:§r ${player.dimension}\n` +
                `§lPing:§r ${player.ping}`);
        }
    }
});