import { registerCommand, Player, world } from '../backend';

registerCommand({
    name: 'test',
    description: 'testModule',
    maxArgs: 0,
    minArgs: 0,
    config: { enabled: true, adminOnly: false, requireTag: ['op'] },
    executor: async (player: Player) => {
        player.sendMessage("Test Moduleです");

        // プレイヤーデータを取得
        const playerData = await world.getPlayerData();

        // プレイヤーデータを表示 (最大5人まで)
        player.sendMessage("--- プレイヤーデータ (最大5人) ---");
        let count = 0;
        for (const uuid in playerData) {
            if (count >= 5) break; // 5人を超えたらループを抜ける

            const pData = playerData[uuid];
            player.sendMessage(`  UUID: ${uuid}`);
            player.sendMessage(`    名前: ${pData.name}`);
            player.sendMessage(`    過去の名前: ${pData.oldNames.join(", ") || "なし"}`);
            player.sendMessage(`    参加時刻: ${pData.join}`);
            player.sendMessage(`    退出時刻: ${pData.left || "オンライン"}`);
            player.sendMessage(`    オンライン: ${pData.isOnline ? "はい" : "いいえ"}`);

            count++;
        }
        if (Object.keys(playerData).length > 5) {
            player.sendMessage(`  ... 他 ${Object.keys(playerData).length - 5} 人のプレイヤーデータは省略`);
        }
        player.sendMessage("-----------------------");
    },
});