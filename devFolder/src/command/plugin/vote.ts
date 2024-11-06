import { world, system, Entity, Player } from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';

interface VoteItem {
    name: string;
    score: number;
}

let voteEndTime: number | null = null; // 投票終了時刻を保存する変数

function resetVoteScoreboard(): void {
    const scoreboard = world.scoreboard.getObjective('vote_scoreboard');
    if (!scoreboard) {
        console.warn('vote_scoreboard が見つかりません。');
        return;
    }

    scoreboard.getParticipants().forEach(participant => {
        scoreboard.setScore(participant, 0); // スコアを0にリセット
    });

    console.log('vote_scoreboard のスコアをリセットしました。');
}

function getVoteItemsFromScoreboard(): VoteItem[] {
    const scoreboard = world.scoreboard.getObjective('vote_scoreboard');
    if (!scoreboard) {
        console.warn('vote_scoreboard が見つかりません。');
        return [];
    }

    const voteItems: VoteItem[] = [];
    scoreboard.getParticipants().forEach(participant => {
        const score = scoreboard.getScore(participant);
        if (score !== undefined) {
            voteItems.push({ name: participant.displayName, score });
        }
    });

    return voteItems;
}

function announceResults(voteItems: VoteItem[]): void {
    const scoreboardName = "vote_channel";
    let scoreboard = world.scoreboard.getObjective(scoreboardName);
    if (!scoreboard) {
        scoreboard = world.scoreboard.addObjective(scoreboardName, "投票結果");
    }

    let results = "投票結果:\n";
    voteItems.forEach(item => {
        results += `${item.name}: ${item.score}票\n`;
        if (scoreboard) {
            scoreboard.setScore(item.name, item.score);
        }
    });
    world.sendMessage(results);
}

function startVote(duration: number): void {
    voteEndTime = system.currentTick + duration * 20; // ティック単位で計算
    world.sendMessage(`投票開始！${duration}秒後に終了します。`);
}

function checkVoteStatus(): boolean {
    return voteEndTime !== null && system.currentTick < voteEndTime; // 投票が進行中かどうか
}

// 投票終了時の処理を行うためのイベントリスナー
system.runInterval(() => {
    if (voteEndTime !== null && system.currentTick >= voteEndTime) { // 投票が終了した場合
        const voteItems = getVoteItemsFromScoreboard();
        announceResults(voteItems);
        voteEndTime = null; // 投票終了フラグをリセット
        world.sendMessage("投票が終了しました。");
    }
});

// スコアボード 'vote:settings' を自動的に生成する
function initializeVoteSettingsScoreboard(): void {
    const scoreboard = world.scoreboard.getObjective('vote:settings');
    if (!scoreboard) {
        world.scoreboard.addObjective('vote:settings', '投票設定');
        world.scoreboard.getObjective('vote:settings')?.setScore('duration', 300); // 初期値は300秒
    }
}

function getVoteDurationFromScoreboard(): number {
    const scoreboard = world.scoreboard.getObjective('vote:settings');
    if (!scoreboard) {
        console.warn('vote:settings が見つかりません。');
        return 300; // デフォルト値
    }
    const score = scoreboard.getScore('duration');
    return score !== undefined ? score : 300; // デフォルト値
}

function setVoteDurationToScoreboard(duration: number): void {
    const scoreboard = world.scoreboard.getObjective('vote:settings');
    if (!scoreboard) {
        console.warn('vote:settings が見つかりません。');
        return;
    }
    scoreboard.setScore('duration', duration);
}

// スクリプト開始時にスコアボードを初期化
initializeVoteSettingsScoreboard();

system.afterEvents.scriptEventReceive.subscribe(async (event) => {
    const { id, sourceEntity } = event;

    if (!(sourceEntity instanceof Entity && sourceEntity.typeId === 'minecraft:player')) {
        return;
    }

    const player = sourceEntity as Player;

    if (id === "ch:vote") {
        const voteItems = getVoteItemsFromScoreboard();

        if (voteItems.length === 0) {
            player.sendMessage("投票対象がありません。");
            return;
        }

        const form = new ActionFormData().title("投票");
        voteItems.forEach(item => form.button(item.name));
        //@ts-ignore
        const response = await form.show(player);
        if (response.canceled || response.selection === undefined) {
            return;
        }

        const selectedItem = voteItems[response.selection];

        const scoreboard = world.scoreboard.getObjective('vote_scoreboard');

        if (!scoreboard || selectedItem.score === undefined) {
            player.sendMessage("投票に失敗しました。");
            return;
        }


        scoreboard.setScore(selectedItem.name, selectedItem.score + 1);

        player.sendMessage(`${selectedItem.name} に投票しました。`);



    } else if (id === "ch:Vcheck" && player.hasTag("op")) {
        if (checkVoteStatus()) { // ここで checkVoteStatus を使用
            player.sendMessage("投票はまだ終了していません。");
            const timeLeft = Math.floor((voteEndTime! - system.currentTick) / 20);
            player.sendMessage(`残り時間: ${timeLeft}秒`);


        } else if (voteEndTime !== null) { // 投票が終了している場合
            const voteItems = getVoteItemsFromScoreboard();
            announceResults(voteItems);
            voteEndTime = null;
            player.sendMessage("投票結果を確認するには、`/scoreboard の vote_channel` を実行してください。");


        } else {
            player.sendMessage("投票が開始されていません。");

        }
    } else if (id === "ch:Vreset" && player.hasTag("op")) { // ch:vresetイベントを追加
        resetVoteScoreboard();
        voteEndTime = null;
        player.sendMessage("投票スコアボードをリセットしました。");


    } else if (id === "ch:Vsettings" && player.hasTag("op")) {
        const form = new ModalFormData()
            .title("投票設定")
            .textField("投票時間（秒）", "", getVoteDurationFromScoreboard().toString());
        //@ts-ignore
        form.show(player).then((response) => {
            if (response.canceled || !response.formValues) return;
            const durationString = response.formValues[0] as string;

            const newDuration = parseInt(durationString, 10);

            if (isNaN(newDuration) || newDuration <= 0) {
                player.sendMessage("無効な投票時間です。");
                return;
            }

            setVoteDurationToScoreboard(newDuration);
            player.sendMessage(`投票時間を ${newDuration} 秒に設定しました。`);
        });
    } else if (id === "ch:Vstart" && player.hasTag("op")) {
        // 設定された投票時間を使って投票を開始
        const duration = getVoteDurationFromScoreboard();
        startVote(duration);
    } else if (id === "ch:Vhelp") {
        player.sendMessage("投票コマンド一覧:\n/tag @s add vote:start で投票開始\n/tag @s add vote:check で投票結果確認\n/tag @s add vote:reset で投票リセット\n/tag @s add vote:settings で投票時間設定");
    }
});