import { registerCommand, Player, world } from '../backend';
import { getData } from '../module/Data';

export interface PlayerData {
    name: string;
    ping: number;
    randomId: number | bigint;
    activeSessionId?: string;
    avgpacketloss?: number;
    avgping?: number;
    clientId?: string;
    color?: string;
    deviceSessionId?: string;
    globalMultiplayerCorrelationId?: string;
    id?: number;
    maxbps?: number;
    packetloss?: number;
    uuid?: string;
}

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
                console.error("スコアボードからのTPSデータの取得に失敗しました:", error);
            }

            if (data && data.ping !== undefined) {
                const playerPing = data.ping;

                playerPingHistory[player.name] = (playerPingHistory[player.name] || []).concat(playerPing).slice(-MAX_HISTORY_LENGTH);
                const averagePlayerPing = playerPingHistory[player.name].reduce((sum, p) => sum + p, 0) / playerPingHistory[player.name].length;

                player.sendMessage(`§6[§ePing情報§6] §b${data.name}§aさん`);
                player.sendMessage(`§eマイクラ Ping: §b${playerPing}ms §7(平均: ${Math.round(averagePlayerPing)}ms)`);
                player.sendMessage(`§eマイクラ TPS: §b${Minecraft_tps}§a tps`);
                player.sendMessage(`§eサーバー Ping: §b${Math.round(serverPing)}ms`);
                player.sendMessage(`§eサーバー TPS: §b${world.getTPS()}§a tps`);

            } else if (data && data.name && data.ping === undefined) {
                player.sendMessage(`§c${data.name}はオフラインです、またはデータが取得できません。`);
                player.sendMessage(`§eサーバー Ping: §b${Math.round(serverPing)}ms`);
                player.sendMessage(`§eサーバー TPS: §b${world.getTPS()}`);
            } else {
                player.sendMessage(`§cプレイヤーデータの取得に失敗しました。`);
                player.sendMessage(`§eサーバー Ping: §b${Math.round(serverPing)}ms`);
                player.sendMessage(`§eサーバー TPS: §b${world.getTPS()}`);
            }
        } catch (error) {
            player.sendMessage(`§cエラーが発生しました: ${error}`);
        }
    },
});