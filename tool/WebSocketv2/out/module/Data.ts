import { world } from "../backend";

/**
 * 起動時間から経過時間を計算する関数
 * @param startTime サーバーの起動時間
 * @returns 経過時間を表す文字列 (例: "0日 4時間 21分 11秒")
 */
export function calculateUptime(startTime: Date): string {
    const now = new Date();
    const diff = now.getTime() - startTime.getTime();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${days}日 ${hours}時間 ${minutes}分 ${seconds}秒`;
}


export async function getData(playerName?: string): Promise<any | undefined> {
    try {
        const res = await world.runCommand('listd stats');
        if (res.statusCode !== 0) {
            return undefined;
        }

        try {
            const jsonString = res.details.replace(/^###\*|\*###$/g, '');
            const parsed = JSON.parse(jsonString.replace(/-?Infinity|-?nan\(ind\)|NaN/g, '0'));

            if (parsed && Array.isArray(parsed.result)) {
                const details: any[] = parsed.result.map((player: any) => {
                    const fixedPlayer: any = { ...player };
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