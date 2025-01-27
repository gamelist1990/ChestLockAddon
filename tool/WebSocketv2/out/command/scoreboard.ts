import { Player, registerCommand, world } from '../backend';

interface ScoreSetting {
    enabled: boolean;
    objective: string;
}


let ScoreSettings: { [key: string]: ScoreSetting } = {
    speed: { enabled: true, objective: 'speed_m' },
    ping: { enabled: true, objective: 'Ping' },
};

const playerLastPosition: {
    [playerName: string]: { x: number; y: number; z: number };
} = {};

//speed
async function updatePlayerSpeed(player: Player) {
    const currentPosition = player.position;
    const playerName = player.name;

    if (playerLastPosition[playerName]) {
        const lastPosition = playerLastPosition[playerName];

        // 距離を計算
        const distance = Math.sqrt(
            Math.pow(currentPosition.x - lastPosition.x, 2) +
            Math.pow(currentPosition.y - lastPosition.y, 2) +
            Math.pow(currentPosition.z - lastPosition.z, 2),
        );

        const speed = distance; // 丸めない

        const speedObjective = await world.scoreboard.getObjective(ScoreSettings['speed'].objective);

        if (speedObjective) {
            if (speed % 1 === 0) {
                speedObjective.setScore(player, Math.round(speed));
            } else {
                speedObjective.setScore(player, parseFloat(speed.toFixed(1)));
            }
        }

        // 座標を更新
        playerLastPosition[playerName].x = currentPosition.x;
        playerLastPosition[playerName].y = currentPosition.y;
        playerLastPosition[playerName].z = currentPosition.z;

    } else {
        // 初回は座標を記録
        playerLastPosition[playerName] = { ...currentPosition };
    }
}

//ping
async function updatePlayerPing(player: Player) {
    const ping = player.ping; // プレイヤーのPing値を取得

    const pingObjective = await world.scoreboard.getObjective(ScoreSettings['ping'].objective);
    if (pingObjective) {
        pingObjective.setScore(player, ping);
    }
}

//更新処理
setInterval(async () => {
    if (ScoreSettings['speed'].enabled) {
        for (const player of await world.getPlayers()) {
            updatePlayerSpeed(player);
        }
    }

    // Ping値の更新はここで行う
    if (ScoreSettings['ping'].enabled) {
        for (const player of await world.getPlayers()) {
            updatePlayerPing(player);
        }
    }
}, 1000);

registerCommand({
    name: 'score',
    description: 'スコアボード機能の有効/無効を切り替えます。',
    minArgs: 2,
    maxArgs: 2,
    config: { enabled: true, adminOnly: true, requireTag: [] },
    executor: async (player: Player, args: string[]) => {
        const toggleName = args[0].toLowerCase();
        const toggleValue = args[1].toLowerCase();

        if (toggleName in ScoreSettings) {
            if (toggleValue === 'true' || toggleValue === 'false') {
                ScoreSettings[toggleName].enabled = toggleValue === 'true';

                if (toggleValue === 'true') {
                    if (!(await world.scoreboard.getObjective(ScoreSettings[toggleName].objective))) {
                        try {
                            await world.scoreboard.addObjective(
                                ScoreSettings[toggleName].objective,
                                ScoreSettings[toggleName].objective,
                            );
                        } catch (error) {
                            console.error('スコアボードオブジェクトの作成に失敗しました:', error);
                            player.sendMessage(`§cスコアボードオブジェクトの作成に失敗しました: ${error}`);
                            return;
                        }
                    }
                } else if (toggleValue === 'false') {
                    await world.scoreboard.removeObjective(ScoreSettings[toggleName].objective);
                }

                player.sendMessage(
                    `§aスコアボード機能 '${toggleName}' を ${ScoreSettings[toggleName].enabled ? '有効' : '無効'} にしました。`,
                );
            } else {
                player.sendMessage(`§c無効な値です。 'true' または 'false' を指定してください。`);
            }
        } else {
            player.sendMessage(`§c'${toggleName}' という名前のスコアボード機能は存在しません。`);
        }
    },
});