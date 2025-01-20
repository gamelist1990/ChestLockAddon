import { registerCommand, Player, world } from "../backend";
import { ver } from "../version";

registerCommand({
    name: 'about',
    description: 'このサーバーに関する情報を表示します。',
    maxArgs: 0,
    minArgs: 0,
    config: {
        enabled: true,
        adminOnly: false,
        requireTag: []
    },
    executor: async (player: Player) => {
        // ワールド情報 (存在する場合)
        if (world) {
            world.sendMessage("Worldオブジェクトのテスト");
            world.sendMessage(`Name: ${player.name}`);
            world.sendMessage(`UUID: ${player.uuid}`);
            world.sendMessage(`ID: ${player.id}`);
            world.sendMessage(`dimension: ${player.dimension}`);
            world.sendMessage(`position: x.${player.position.x} y.${player.position.y} z.${player.position.z}`);
            const block = await world.getBlock(player.position.x, player.position.y, player.position.z);
            if (block) {
                world.sendMessage(`Block Name : ${block.blockName}`)
                world.sendMessage(`Block Name : ${JSON.stringify(block.position)}`)
            }
        }
        player.sendMessage("現在のサーバーのバージョンは"+ ver)
    }
});