import { registerCommand, world } from '../backend';
import { getData } from '../module/Data';
import { Player } from '../module/player';


const playerPingHistory: { [playerName: string]: number[] } = {};
const MAX_HISTORY_LENGTH = 10;

registerCommand({
    name: 'ping',
    description: 'プレイヤーのPingとTPS、サーバーのPingとTPSを表示します。',
    maxArgs: 1,
    minArgs: 0,
    config: { enabled: true, adminOnly: false, requireTag: [] },
    executor: async (player: Player) => {
        const startTime = Date.now();
        try {
            const data = await getData(player.name);
            const endTime = Date.now();
            let serverPing = endTime - startTime;
            let Minecraft_tps = 0;

            try {
                const tpsObjective = await world.scoreboard.getObjective('TPSData');
                if (tpsObjective) {
                    const tpsScore = await tpsObjective.getScore('tps');
                    if (tpsScore !== null) {
                        Minecraft_tps = tpsScore;
                    }
                }
            } catch (error) {
                // console.error("スコアボードからのTPSデータの取得に失敗しました:", error);
            }

            if (data && data.ping !== undefined) {
                const playerPing = data.ping;

                playerPingHistory[player.name] = (playerPingHistory[player.name] || []).concat(playerPing).slice(-MAX_HISTORY_LENGTH);
                const averagePlayerPing = playerPingHistory[player.name].reduce((sum, p) => sum + p, 0) / playerPingHistory[player.name].length;

                // プレイヤー情報をセクションで区切って表示
                player.sendMessage(`§6━━━ §e${data.name}のPing情報 §6━━━`);
                player.sendMessage(`§aマイクラ Ping: §b${playerPing}ms §7(平均: ${Math.round(averagePlayerPing)}ms)`);
                player.sendMessage(`§aマイクラ TPS: §b${Minecraft_tps} tps`);

                // サーバー情報をセクションで区切って表示
                player.sendMessage(`\n§6━━━ §eサーバー情報 §6━━━`);
                player.sendMessage(`§aサーバー Ping: §b${Math.round(serverPing)}ms`);
                player.sendMessage(`§aサーバー TPS: §b${world.getTPS()} tps`);

            } else if (data && data.name && data.ping === undefined) {
                player.sendMessage(`§c${data.name}はオフラインです、またはデータが取得できません。`);
                player.sendMessage(`\n§6━━━ §eサーバー情報 §6━━━`);
                player.sendMessage(`§aサーバー Ping: §b${Math.round(serverPing)}ms`);
                player.sendMessage(`§aサーバー TPS: §b${world.getTPS()} tps`);
            } else {
                player.sendMessage(`§cプレイヤーデータの取得に失敗しました。`);
                player.sendMessage(`\n§6━━━ §eサーバー情報 §6━━━`);
                player.sendMessage(`§aサーバー Ping: §b${Math.round(serverPing)}ms`);
                player.sendMessage(`§aサーバー TPS: §b${world.getTPS()} tps`);
            }
        } catch (error) {
            player.sendMessage(`§cエラーが発生しました: ${error}`);
        }
    },
});