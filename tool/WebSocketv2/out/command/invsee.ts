import { registerCommand, Player, world, prefix } from "../backend";

registerCommand({
    name: 'invsee',
    description: '指定したプレイヤーのインベントリを表示します',
    maxArgs: 1,
    minArgs: 1,
    config: {
        enabled: true,
        adminOnly: false,
        requireTag: ["invsee","admin"]
    },
    usage: `${prefix}invsee <targetName>`,
    executor: async (player: Player, args: string[]) => {
        const targetName = args[0];

        if (!targetName) {
            player.sendMessage(`§cターゲット名を指定してください: §r${prefix}invsee <targetName>§r`);
            return;
        }

        try {
            const commandResult = await world.runCommand(`codebuilder_actorinfo inventory "${targetName}"`);

            if (commandResult.statusCode === 0 && commandResult.inventory) {
                const inventoryData = commandResult.inventory;

                player.sendMessage(`§l--- §b${targetName} §r§lのインベントリ §l---`);

                if (inventoryData.slots && inventoryData.slots.length > 0) {
                    for (const slot of inventoryData.slots) {
                        // slot が null でないことを確認してから slot.id にアクセス
                        if (slot && slot.id) {
                            let message = `§e[${inventoryData.slots.indexOf(slot)}]§r §b${slot.namespace}:${slot.id}§r x §a${slot.stackSize}§r`;

                            if (slot.enchantments && slot.enchantments.length > 0) {
                                const enchantments = slot.enchantments.map((ench: any) => `§d${ench.name} ${ench.level}§r`).join(', ');
                                message += `  §9(§r${enchantments}§9)§r`;
                            }
                            player.sendMessage(message);
                        }
                    }
                } else {
                    player.sendMessage("§6インベントリは空です。§r");
                }


            } else {
                player.sendMessage(`§cインベントリ情報の取得に失敗しました。 ターゲットが存在しないか、エラーが発生しました。§r`);
                console.error("Invsee command failed:", commandResult);
            }
        } catch (error) {
            player.sendMessage(`§cコマンドの実行中にエラーが発生しました。§r`);
            console.error("Invsee command error:", error);
        }
    }
});