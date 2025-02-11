import { Player, registerCommand, world, wsserver } from '../backend';

interface ScoreSetting {
    enabled: boolean;
    objective: string;
}

let ScoreSettings: { [key: string]: ScoreSetting } = {
    speed: { enabled: true, objective: 'speed_m' },
    ping: { enabled: true, objective: 'Ping' },
    message: { enabled: true, objective: 'message' },
};

const playerLastPosition: {
    [playerName: string]: { x: number; z: number };
} = {};

// speed
async function updatePlayerSpeed(player: Player) {
    const currentPosition = player.position;
    const playerName = player.name;

    if (playerLastPosition[playerName]) {
        const lastPosition = playerLastPosition[playerName];

        const distance = Math.sqrt(
            Math.pow(currentPosition.x - lastPosition.x, 2) +
            Math.pow(currentPosition.z - lastPosition.z, 2),
        );

        const speed = distance;

        const speedObjective = await world.scoreboard.getObjective(ScoreSettings['speed'].objective);

        if (speedObjective) {
            speedObjective.setScore(player, Math.round(speed * 10) / 10);
        }

        playerLastPosition[playerName].x = currentPosition.x;
        playerLastPosition[playerName].z = currentPosition.z;

    } else {
        playerLastPosition[playerName] = { x: currentPosition.x, z: currentPosition.z };
    }
}

// ping
async function updatePlayerPing(player: Player) {
    const ping = player.ping;

    const pingObjective = await world.scoreboard.getObjective(ScoreSettings['ping'].objective);
    if (pingObjective) {
        pingObjective.setScore(player, ping);
    }
}

const lastChatTimes: { [key: string]: number } = {};

async function checkMessageScores() {
    if (!ScoreSettings['message'].enabled) return;

    const messageObjective = await world.scoreboard.getObjective(ScoreSettings['message'].objective);
    if (!messageObjective) return;

    const scores = await messageObjective.getScores();

    for (const scoreEntry of scores) {
        const scoreName = scoreEntry.participant;

        if (scoreName && scoreName.includes('{') && scoreName.includes('}')) {
            const startIndex = scoreName.indexOf('{') + 1;
            const endIndex = scoreName.indexOf('}');
            const content = scoreName.substring(startIndex, endIndex);

            const parts = content.split('_');
            if (parts.length >= 2) {
                const sender = parts[0];
                const message = parts.slice(1).join('_');

                const key = `${sender}:${message}`; // senderとmessageを組み合わせたキーを作成
                const now = Date.now();

                if (!lastChatTimes[key] || now - lastChatTimes[key] > 1000) { // クールダウンチェック
                    if (world) {
                        setTimeout(() => {
                            wsserver.onPlayerChat(sender, message, "scoreboard", "");
                        })
                        lastChatTimes[key] = now; // 最終チャット時刻を更新
                    } else {
                        console.warn("world is undefined");
                    }
                }

                await messageObjective.resetScore(scoreEntry.participant);
            }
        }
    }
}

// 更新処理


setInterval(async () => {
    if (ScoreSettings['speed'].enabled) {
        for (const player of await world.getPlayers()) {
            updatePlayerSpeed(player);
        }
    }

    if (ScoreSettings['ping'].enabled) {
        for (const player of await world.getPlayers()) {
            updatePlayerPing(player);
        }
    }

    // メッセージスコアボードのチェック (追加)
    await checkMessageScores();

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