import { registerCommand, Player, world } from '../backend';

let lastTickTime = Date.now();
let serverTps = 0;
let clientTps = 0;
let backendTpsCounter = 0;
let clientTpsTickCounter = 0;
let isMeasuringClientTps = false;
let clientTpsLastCheckTime = Date.now();

registerCommand({
    name: 'tps',
    description: 'TPSを表示します',
    maxArgs: 0,
    minArgs: 0,
    config: { enabled: true, adminOnly: false, requireTag: ['op'] },
    executor: async (player: Player) => {
        if (!world) {
            player.sendMessage("ワールドオブジェクトがありません");
            return;
        }
        player.sendMessage(`サーバーTPS: ${serverTps.toFixed(2)}`);
        player.sendMessage(`クライアントTPS: ${clientTps.toFixed(2)}`);
    },
});

if (world) {
    // サーバー側の TPS 計算処理
    setInterval(async () => {
        const now = Date.now();
        const elapsed = now - lastTickTime;
        serverTps = (backendTpsCounter / elapsed) * 1000;
        backendTpsCounter = 0;
        lastTickTime = now;
        const tpsObjective = await world.scoreboard.getObjective('TPSData');

        if (tpsObjective) {
            await tpsObjective.setScore('backend', Math.round(serverTps));
        } else {
            const newObjective = await world.scoreboard.addObjective('TPSData', 'TPSData');
            if (newObjective) {
                await newObjective.setScore('backend', Math.round(serverTps));
            }
        }
        // console.log(`server tps:${serverTps.toFixed(2)}`)
    }, 5000); // 5秒ごとに計算

    // クライアント側の TPS 計測処理
    setInterval(async () => {
        const now = Date.now();
        const elapsed = now - clientTpsLastCheckTime;
        clientTpsLastCheckTime = now;
        if (isMeasuringClientTps) {
            isMeasuringClientTps = false;
            const tpsObjective = await world.scoreboard.getObjective('TPSData');
            if (tpsObjective) {
                const score = await tpsObjective.getScore('minecraft')
                if (score) {
                    clientTps = score;
                    await tpsObjective.resetScore('minecraft')
                }

            }
        } else {
            isMeasuringClientTps = true;
            const tpsObjective = await world.scoreboard.getObjective('TPSData');
            if (tpsObjective) {
                await tpsObjective.addScore('minecraft', clientTpsTickCounter);
            } else {
                const newObjective = await world.scoreboard.addObjective('TPSData', 'TPSData');
                if (newObjective) {
                    await newObjective.addScore('minecraft', clientTpsTickCounter);
                }
            }
            clientTpsTickCounter = 0;
        }


    }, 1000); // 1秒ごとに処理

    // クライアント側のTPS計測用のカウンター
    setInterval(() => {
        if (isMeasuringClientTps) {
            clientTpsTickCounter++;
        }
    }, 50); // 50ミリ秒ごとに実行 (1 tick)
}