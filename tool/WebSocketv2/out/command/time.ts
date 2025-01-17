import { registerCommand, Player, world } from '../backend';

const TIME_OBJECTIVE_NAME = 'TimeData';
const TIME_SCORE_NAMES = {
    SECONDS: 'time_s',
    MINUTES: 'time_m',
    HOURS: 'time_h',
    DAYS: 'time_d'
};


let timerStartTime: number | null = null;


async function updateTimeScoreboard() {
    if (!world) return;

    if (timerStartTime === null) return;

    let objective = await world?.scoreboard.getObjective(TIME_OBJECTIVE_NAME);
    if (!objective) {
        objective = await world?.scoreboard.addObjective(TIME_OBJECTIVE_NAME, 'TimeData');
    }

    if (!objective) return;

    const elapsedSeconds = Math.floor((Date.now() - timerStartTime) / 1000);
    const days = Math.floor(elapsedSeconds / (60 * 60 * 24));
    const hours = Math.floor(elapsedSeconds / (60 * 60)) % 24;
    const minutes = Math.floor(elapsedSeconds / 60) % 60;
    const seconds = elapsedSeconds % 60;



    await objective.setScore(TIME_SCORE_NAMES.SECONDS, seconds);
    await objective.setScore(TIME_SCORE_NAMES.MINUTES, minutes);
    await objective.setScore(TIME_SCORE_NAMES.HOURS, hours);
    await objective.setScore(TIME_SCORE_NAMES.DAYS, days);


}

async function resetScoreboardValues() {
    if (!world) return;
    let objective = await world?.scoreboard.getObjective(TIME_OBJECTIVE_NAME);

    if (!objective) {
        return;
    }
    await objective.setScore(TIME_SCORE_NAMES.SECONDS, 0);
    await objective.setScore(TIME_SCORE_NAMES.MINUTES, 0);
    await objective.setScore(TIME_SCORE_NAMES.HOURS, 0);
    await objective.setScore(TIME_SCORE_NAMES.DAYS, 0);
}
if (world)
    setInterval(async () => {
        updateTimeScoreboard();
    }, 1000)

registerCommand({
    name: 'time',
    description: 'タイマーを操作します (#time start | stop | reset)',
    maxArgs: 1,
    minArgs: 1,
    config: { enabled: true, adminOnly: false, requireTag: ['op'] },
    executor: async (player: Player, args: string[]) => {
        if (!world) {
            player.sendMessage("ワールドオブジェクトがありません");
            return;
        }

        const command = args[0];

        if (command === 'start') {
            if (timerStartTime != null) return player.sendMessage('タイマーは既に開始しています');
            timerStartTime = Date.now();

            let objective: any | undefined = await world.scoreboard.getObjective(TIME_OBJECTIVE_NAME);
            if (objective) await world.scoreboard.removeObjective(objective)
            await resetScoreboardValues();
            player.sendMessage("タイマーを開始しました");


        } else if (command === "stop") {
            if (timerStartTime == null) return player.sendMessage('タイマーは開始していません');

            player.sendMessage(`タイマーを停止しました.   現在までの時間は以下に表示されます \nスコアボード名 : ${TIME_OBJECTIVE_NAME}  \n  目的名 : time_s , time_m , time_h , time_d   `)

            timerStartTime = null;


        } else if (command === 'reset') {
            timerStartTime = null;
            await resetScoreboardValues();
            player.sendMessage(`タイマーをリセットしました。  スコアボードの値を0にしました`)


        } else {
            player.sendMessage(`不正な引数です.   #time start / stop / reset で操作`);

        }


    }
});