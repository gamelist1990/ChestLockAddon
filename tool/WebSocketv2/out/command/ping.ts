import { registerCommand, Player } from '../backend';

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

export async function getData(player: Player, playerName?: string): Promise<PlayerData | undefined> {
    try {
        const res = await player.runCommand('listd stats');
        if (res.statusCode !== 0) {
            return undefined;
        }

        try {
            const jsonString = res.details.replace(/^###\*|\*###$/g, '');
            const parsed = JSON.parse(jsonString.replace(/-?Infinity|-?nan\(ind\)|NaN/g, '0'));

            if (parsed && Array.isArray(parsed.result)) {
                const details: PlayerData[] = parsed.result.map((player: any) => {
                    const fixedPlayer: PlayerData = { ...player };
                    for (const key in fixedPlayer) {
                        if (typeof fixedPlayer[key] === 'number' && !Number.isFinite(fixedPlayer[key])) {
                            fixedPlayer[key] = 0;
                        }
                    }

                    // randomIdがbigintの場合、numberに変換
                    if (typeof fixedPlayer.randomId === 'bigint') {
                        fixedPlayer.randomId = Number(fixedPlayer.randomId);
                    }

                    return fixedPlayer;
                });

                if (playerName) {
                    return details.find(p => p.name && p.name.includes(playerName));
                } else {
                    return details[0];
                }
            } else {
                //   console.warn("Invalid 'listd stats' output format:", parsed);
                return undefined;
            }
        } catch (parseError) {
            // console.error("Error parsing player details:", parseError, res.details);
            return undefined;
        }
    } catch (outerError) {
        //  console.error("Outer error getting player:", outerError);
        return undefined;
    }
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