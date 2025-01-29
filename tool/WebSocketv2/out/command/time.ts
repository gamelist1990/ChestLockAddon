import { world } from '../backend';

const TIME_OBJECTIVE_NAME = 'JapanTime';

let timerInterval: NodeJS.Timer | null = null;

// 外部からアクセス可能な JapanTime 変数
export let JapanTime: boolean = false;


startJapanTime()

async function updateTimeScoreboard() {
    if (!world || !JapanTime) return; // ワールドがないか、JapanTimeが無効なら終了

    // ScoreboardObjective を取得または作成
    let objective = await world.scoreboard.getObjective(TIME_OBJECTIVE_NAME);
    if (!objective) {
        objective = await world.scoreboard.addObjective(TIME_OBJECTIVE_NAME, 'Japan Time');
        if (!objective) return; // 作成も取得も失敗したら終了
    }

    // 現在の日本時間を取得
    const japanTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));

    // スコアを設定 年、月、日、時、分、秒を個別のスコアとして設定
    await objective.setScore('Time_y', japanTime.getFullYear());
    await objective.setScore('Time_m', japanTime.getMonth() + 1); // 月は 0 から始まるため +1 する
    await objective.setScore('Time_d', japanTime.getDate());
    await objective.setScore('Time_h', japanTime.getHours());
    await objective.setScore('Time_min', japanTime.getMinutes());
    await objective.setScore('Time_s', japanTime.getSeconds());
}

// 日本時間の表示を開始する関数
export async function startJapanTime() {
    if (JapanTime) {
        console.warn('日本時間の表示は既に有効です');
        return;
    }

    JapanTime = true;

    // 既存の objective があれば削除
    await world.scoreboard.removeObjective(TIME_OBJECTIVE_NAME);

    // タイマーを開始（1秒ごとに更新）
    if (!timerInterval) {
        timerInterval = setInterval(updateTimeScoreboard, 1000);
    }

    //console.log("日本時間の表示を有効にしました");
}

// 日本時間の表示を停止する関数
export async function stopJapanTime() {
    if (!JapanTime) {
        console.warn('日本時間の表示は既に無効です');
        return;
    }

    JapanTime = false;

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    //console.log("日本時間の表示を無効にしました");
}

// 日本時間スコアをリセットする関数
export async function resetJapanTime() {
    // ScoreboardObjective を取得
    let objective = await world.scoreboard.getObjective(TIME_OBJECTIVE_NAME);
    if (objective) {
        // 既存のスコアを削除
        (await objective.getScores()).forEach(score => objective?.removeParticipant(score.participant));
    } else {
        objective = await world.scoreboard.addObjective(TIME_OBJECTIVE_NAME, 'Japan Time');
    }

    // 現在の日本時間を取得してスコアをリセット
    const japanTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    // 年、月、日、時、分、秒を個別のスコアとして設定
    await objective?.setScore('Time_y', japanTime.getFullYear());
    await objective?.setScore('Time_m', japanTime.getMonth() + 1);
    await objective?.setScore('Time_d', japanTime.getDate());
    await objective?.setScore('Time_h', japanTime.getHours());
    await objective?.setScore('Time_min', japanTime.getMinutes());
    await objective?.setScore('Time_s', japanTime.getSeconds());

    console.log("日本時間をリセットしました。スコアボードの値を現在の日本時間にしました");
}