import { world, system, Entity, Player } from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';

interface VoteItem {
    name: string;
    score: number;
}

let voteEndTime: number | null = null;
let voteData: { duration: number; resultText: string; allowMultipleVotes: boolean } = {
    duration: 60,
    resultText: '投票結果:',
    allowMultipleVotes: true, // デフォルトは複数投票を許可
};

function resetVoteScoreboard(): void {
    const scoreboard = world.scoreboard.getObjective('vote_scoreboard');
    if (!scoreboard) {
        console.warn('vote_scoreboard が見つかりません。');
        return;
    }

    scoreboard.getParticipants().forEach(participant => {
        scoreboard.setScore(participant, 0);
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

function announceResults(voteItems: VoteItem[], customResultText: string): void {
    const scoreboardName = "vote_channel";
    let scoreboard = world.scoreboard.getObjective(scoreboardName);
    if (!scoreboard) {
        scoreboard = world.scoreboard.addObjective(scoreboardName, "投票結果");
    }

    let results = customResultText + "\n";
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
    return voteEndTime !== null && system.currentTick < voteEndTime;
}

system.runInterval(() => {
    if (voteEndTime !== null && system.currentTick >= voteEndTime) {
        const voteItems = getVoteItemsFromScoreboard();
        announceResults(voteItems, voteData.resultText);
        voteEndTime = null;
        world.sendMessage("投票が終了しました。");
    }
});

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

        if (!voteData.allowMultipleVotes && player.hasTag("voted")) {
            player.sendMessage("あなたはすでに投票済みです。");
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
        player.addTag("voted"); // 投票済みタグを追加

        player.sendMessage(`${selectedItem.name} に投票しました。`);

    } else if (id === "ch:Vcheck" && player.hasTag("op")) {
        if (checkVoteStatus()) {
            player.sendMessage("投票はまだ終了していません。");
            const timeLeft = Math.floor((voteEndTime! - system.currentTick) / 20);
            player.sendMessage(`残り時間: ${timeLeft}秒`);

        } else if (voteEndTime !== null) {
            const voteItems = getVoteItemsFromScoreboard();
            announceResults(voteItems, voteData.resultText);
            voteEndTime = null;
            player.sendMessage("投票結果を確認するには、`/scoreboard の vote_channel` を実行してください。");

        } else {
            player.sendMessage("投票が開始されていません。");

        }
    } else if (id === "ch:Vreset" && player.hasTag("op")) {
        resetVoteScoreboard();
        voteEndTime = null;
        player.sendMessage("投票スコアボードをリセットしました。");

    } else if (id === "ch:Vsettings" && player.hasTag("op")) {
        const form = new ModalFormData()
            .title("投票設定")
            .textField("投票時間（秒）", "", voteData.duration.toString())
            .textField("投票結果のタイトル", "", voteData.resultText)
            .toggle("複数投票を許可", voteData.allowMultipleVotes);
        //@ts-ignore
        form.show(player).then((response) => {
            if (response.canceled || !response.formValues) return;
            const durationString = response.formValues[0] as string;
            const resultText = response.formValues[1] as string;
            const allowMultipleVotes = response.formValues[2] as boolean;

            const newDuration = parseInt(durationString, 10);

            if (isNaN(newDuration) || newDuration <= 0) {
                player.sendMessage("無効な投票時間です。");
                return;
            }

            voteData.duration = newDuration;
            voteData.resultText = resultText;
            voteData.allowMultipleVotes = allowMultipleVotes;
            player.sendMessage(`投票時間を ${newDuration} 秒に設定しました。`);
            player.sendMessage(`投票結果のタイトルを "${resultText}" に設定しました。`);
            player.sendMessage(`複数投票を${allowMultipleVotes ? '許可' : '禁止'}しました。`);
        });
    } else if (id === "ch:Vstart" && player.hasTag("op")) {
        startVote(voteData.duration);
    } else if (id === "ch:Vhelp") {
        player.sendMessage("投票コマンド一覧:\n/tag @s add vote:start で投票開始\n/tag @s add vote:check で投票結果確認\n/tag @s add vote:reset で投票リセット\n/tag @s add vote:settings で投票時間設定");
    }
}); 