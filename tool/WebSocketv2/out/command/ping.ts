import { registerCommand, Player } from '../backend';
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

registerCommand({
    name: 'ping',
    description: 'プレイヤーのPing値を表示します。',
    maxArgs: 1,
    minArgs: 0,
    config: { enabled: true, adminOnly: false, requireTag: [] },
    executor: async (player: Player, args: string[]) => {
        const targetPlayerName = args[0] || player.name;

        const data = await getData(player, targetPlayerName);
        if (data && data.ping !== undefined) {
            player.sendMessage(`§b${data.name}§aのPing: ${data.ping}ms`);
        } else if (data && data.name && data.ping === undefined) {
            player.sendMessage(`§c${data.name}はオフラインです、またはデータが取得できません。`);
        }
        else {
            player.sendMessage(`§cプレイヤー ${targetPlayerName} の情報が見つかりませんでした。`);
        }
    },
});