import { world, system, Entity, Player } from '@minecraft/server';
import { ActionFormData, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

interface VoteItem {
    name: string;
    score: number;
}

interface VoteData {
    duration: number;
    resultText: string;
    allowMultipleVotes: boolean;
    editingScoreboard: boolean;
}

const VOTE_DATA_KEY = 'vote_data';

const defaultVoteData: VoteData = {
    duration: 60,
    resultText: '投票結果:',
    allowMultipleVotes: true,
    editingScoreboard: false,
};

let voteData: VoteData = defaultVoteData;

function saveVoteData(): void {
    world.setDynamicProperty(VOTE_DATA_KEY, JSON.stringify(voteData)); // 変更後のコード
    console.log('投票データを保存しました:', voteData);
}

let voteEndTime: number | null = null;

function resetVoteScoreboard(): void {
    const scoreboard = world.scoreboard.getObjective('vote_scoreboard');
    if (!scoreboard) {
        console.warn('vote_scoreboard が見つかりません。');
        return;
    }
    scoreboard.getParticipants().forEach(participant => {
        scoreboard.setScore(participant, 0);
    });

    world.getPlayers().forEach(player => player.removeTag("voted"));

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

    let results = customResultText + '\n';
    voteItems.sort((a, b) => b.score - a.score);
    voteItems.forEach((item, index) => {
        results += `${index + 1}位: ${item.name} - ${item.score}票\n`;
    });
    world.sendMessage(results);

}

function startVote(duration: number): void {
    voteEndTime = system.currentTick + duration * 20;
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
        player.addTag("voted");

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
    } else if (id === "ch:Vreset") {
        resetVoteScoreboard();
        voteEndTime = null;
    } else if (id === "ch:Vsettings" && player.hasTag("op")) {
        const form = new ModalFormData()
            .title("投票設定")
            .textField("投票時間（秒）", "", voteData.duration.toString())
            .textField("投票結果のタイトル", "", voteData.resultText)
            .toggle("複数投票を許可", voteData.allowMultipleVotes)
            .toggle("スコアボード編集", voteData.editingScoreboard);
        //@ts-ignore
        form.show(player).then((response: ModalFormResponse) => {
            if (response.canceled || !response.formValues) return;

            const durationString = response.formValues[0] as string;
            const resultText = response.formValues[1] as string;
            const allowMultipleVotes = response.formValues[2] as boolean;
            voteData.editingScoreboard = response.formValues[3] as boolean;


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

            saveVoteData();

            if (voteData.editingScoreboard) {
                openScoreboardEditModal(player);
            }
        });
    } else if (id === "ch:Vstart" && player.hasTag("op")) {
        startVote(voteData.duration);
    } else if (id === "ch:Vhelp") {
        player.sendMessage("投票コマンド一覧:\nvote:start で投票開始\nvote:check で投票結果確認\nvote:reset で投票リセット\n vote:settings で投票時間設定");
    }
});

function openScoreboardEditModal(player: Player): void {
    const voteItems = getVoteItemsFromScoreboard();

    const form = new ActionFormData()
        .title("スコアボード編集")
        .button("追加")
        .button("削除");
    //@ts-ignore
    form.show(player).then(async (response) => {
        if (response.canceled) return;

        const scoreboard = world.scoreboard.getObjective('vote_scoreboard');
        if (!scoreboard) return;

        if (response.selection === 0) {
            const addForm = new ModalFormData()
                .title("追加する項目")
                .textField("項目名", "", "");
            //@ts-ignore
            addForm.show(player).then((addResponse: ModalFormResponse) => {
                if (addResponse.canceled || !addResponse.formValues) return;
                const newItem = addResponse.formValues[0] as string;
                if (newItem.trim() !== "" && !voteItems.some(item => item.name === newItem)) {
                    scoreboard.setScore(newItem, 0);
                    player.sendMessage(`投票項目に "${newItem}" を追加しました。`);
                } else {
                    player.sendMessage(`投票項目 "${newItem}" は既に存在するか、無効です。`);
                }
                voteData.editingScoreboard = false;
            });

        } else if (response.selection === 1) {
            const deleteForm = new ActionFormData().title("削除する項目を選択");
            voteItems.forEach(item => deleteForm.button(item.name));
            //@ts-ignore
            deleteForm.show(player).then((deleteResponse) => {
                if (deleteResponse.canceled || deleteResponse.selection === undefined) return;
                const selectedItem = voteItems[deleteResponse.selection];
                if (scoreboard.removeParticipant(selectedItem.name)) {
                    player.sendMessage(`投票項目 "${selectedItem.name}" を削除しました。`);
                } else {
                    player.sendMessage(`投票項目 "${selectedItem.name}" の削除に失敗しました。`);
                }
                voteData.editingScoreboard = false;

            });
        }
    });
}


system.run(() => {
    console.log('読み込んだ投票データ:', voteData);
});