import { registerCommand, Player, world } from '../backend';

registerCommand({
    name: 'test',
    description: 'testModule',
    maxArgs: 0,
    minArgs: 0,
    config: { enabled: true, adminOnly: false, requireTag: ['op'] },
    executor: async (player: Player) => {
        player.sendMessage("Test Moduleです")
        if (world) {
            world.on("PlayerDied", async (event: any) => {
                console.log(JSON.stringify(event));
                const { cause, inRaid, killer, player } = event.event;
                const players = await world.getName(player.name);
                if (players) {
                    // プレイヤーが死んだときにメッセージを送信する前にログを出力
                    world.sendMessage(`PlayerDied Event - プレイヤー: ${players.name}, 死因: ${cause}, レイド中: ${inRaid}, キラータイプ: ${killer.type}`);
                }
            });
            world.on("ItemUsed", async (event: any) => {
                const eventCopy = JSON.parse(JSON.stringify(event));
                const { count, item, useMethod } = eventCopy.event;
               // console.log(JSON.stringify(eventCopy));
                const player = await world.getName(eventCopy.event.player.name);

                if (player) {
                    player.sendMessage(`プレイヤー: ${player.name}`);
                    player.sendMessage(`アイテム: ${item.namespace}:${item.id}`);
                    player.sendMessage(`使用個数: ${count}`);
                    player.sendMessage(`使用方法: ${useMethod}`);
                    if (item.id === "snowball" && useMethod === 4) {
                        player.sendMessage(`${player.name} が雪玉を投げました！`);
                    } else if (item.id === "fishing_rod") {
                        player.sendMessage(`${player.name} が釣竿を使いました！`);
                    }
                }
            });


        }
    },
});