import { world, system, Entity, Player } from '@minecraft/server';
import { ActionFormData, ModalFormData, ModalFormResponse, uiManager } from '@minecraft/server-ui';

interface VoteItem {
    name: string;
    score: number;
}

interface VoteData {
    duration: number;
    resultText: string;
    allowMultipleVotes: boolean;
    maxVotesPerPlayer: number;
    editingScoreboard: boolean;
    rankText?: string;
    voteText?: string;
    announceInterval: number;
    showLiveResults: boolean;
    maxResultsToShow: number;
    handleTies: boolean; 
}

const VOTE_DATA_KEY = 'vote_data';

const defaultVoteData: VoteData = {
    duration: 60,
    resultText: '投票結果:',
    allowMultipleVotes: true,
    maxVotesPerPlayer: 1,
    editingScoreboard: false,
    announceInterval: 15,
    showLiveResults: false,
    maxResultsToShow: 10,
    handleTies: false, // デフォルトでは同率順位を処理しない
};

let voteData: VoteData = defaultVoteData;
let voteResults: { [name: string]: number } = {};
let playerVotes: { [name: string]: number } = {};
let voteEndTime: number | null = null;
let lastAnnounceTime: number = 0;
let targetTag: string | null = null;


function saveVoteData(): void {
    world.setDynamicProperty(VOTE_DATA_KEY, JSON.stringify(voteData));
    console.log('投票データを保存しました:', voteData);
}

function loadVoteData(): void {
    const savedData = world.getDynamicProperty(VOTE_DATA_KEY);
    if (savedData) {
        try {
            if (typeof savedData === 'string') {
                voteData = JSON.parse(savedData);
            } else {
                console.warn('投票データが文字列型ではありません。デフォルト値を使用します:', savedData);
                voteData = defaultVoteData;
                saveVoteData();
            }
        } catch (e) {
            console.warn('投票データの読み込みに失敗しました。デフォルト値を使用します:', e);
            voteData = defaultVoteData;
            saveVoteData();
        }
    } else {
        voteData = defaultVoteData;
        saveVoteData();
    }
}


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

function getVoteItems(): VoteItem[] {
    const voteItems: VoteItem[] = [];
    for (const name in voteResults) {
        voteItems.push({ name, score: voteResults[name] });
    }
    return voteItems;
}

function announceResults(voteItems: VoteItem[], customResultText: string): void {
    const scoreboardName = "vote_channel";
    let scoreboard = world.scoreboard.getObjective(scoreboardName);
    if (!scoreboard) {
        scoreboard = world.scoreboard.addObjective(scoreboardName, "投票結果");
    }

    scoreboard.getParticipants().forEach(participant => scoreboard.removeParticipant(participant));

    let results = customResultText + '\n';
    voteItems.sort((a, b) => b.score - a.score);

    if (voteItems.length === 0) {
        sendMessageToTarget(results);
        return;
    }


    let currentRank = 1;
    let skipRank = false;
    const itemsToShow = voteItems.slice(0, voteData.maxResultsToShow);
    let previousScore = -1;


    for (let i = 0; i < itemsToShow.length; i++) {
        const item = voteItems[i];


        if (voteData.handleTies) {
            if (item.score !== previousScore) {
                skipRank = false;
            }

            if (i + 1 < itemsToShow.length && voteItems[i + 1].score === item.score) {
                skipRank = true;
            }
        }

        if (!skipRank) {
            const rankText = voteData.rankText || "位";
            const voteText = voteData.voteText || "票";
            results += `${currentRank}${rankText}: ${item.name} - ${item.score}${voteText}\n`;
            const player = world.getPlayers().find(p => p.name === item.name);
            if (player) {
                scoreboard.setScore(player, currentRank);
            }
            if (!player) {
                scoreboard.setScore(item.name, currentRank);
            }
            currentRank++;
        }
        previousScore = item.score;
    }

    sendMessageToTarget(results);
}


function startVote(duration: number): void {
    voteResults = {};
    playerVotes = {};
    voteEndTime = system.currentTick + duration * 20;
    sendMessageToTarget(`投票開始！${duration}秒後に終了します。`);
}

function checkVoteStatus(): boolean {
    return voteEndTime !== null && system.currentTick < voteEndTime;
}

system.runInterval(() => {
    if (checkVoteStatus()) {
        if (voteData.showLiveResults && system.currentTick - lastAnnounceTime >= voteData.announceInterval * 20) {
            const currentResults = getVoteItems();
            announceResults(currentResults, "現在の投票状況:");
            lastAnnounceTime = system.currentTick;
        }
    } else if (voteEndTime !== null && system.currentTick >= voteEndTime) {
        const voteItems = getVoteItems();
        announceResults(voteItems, voteData.resultText);
        voteEndTime = null;
        playerVotes = {}; 
        resetVoteScoreboard();
        sendMessageToTarget("投票が終了しました。");
        world.getPlayers().forEach(player => {
            if (targetTag === null || player.hasTag(targetTag)) {
                uiManager.closeAllForms(player as any);
            }
        });
    }
});

function resetAllVoteData() {
    voteData = defaultVoteData;
    saveVoteData();
    voteResults = {};
    playerVotes = {};
    voteEndTime = null;
    lastAnnounceTime = 0;
    sendMessageToTarget("すべての投票データと設定がリセットされました。");
}

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
        } else if (voteData.allowMultipleVotes && playerVotes[player.name] >= voteData.maxVotesPerPlayer) {
            player.sendMessage(`あなたはすでに最大投票数(${voteData.maxVotesPerPlayer}票)に達しています。`);
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

        voteResults[selectedItem.name] = (voteResults[selectedItem.name] || 0) + 1;
        playerVotes[player.name] = (playerVotes[player.name] || 0) + 1;
        if (playerVotes[player.name] === 1) {
            player.addTag("voted");
        }

        player.sendMessage(`${selectedItem.name} に投票しました。`);

    } else if (id === "ch:Vcheck" && player.hasTag("op")) {
        if (checkVoteStatus()) {
            let results = voteData.resultText + '\n';
            const sortedVotes = Object.entries(voteResults).sort(([, a], [, b]) => b - a);
            player.sendMessage("投票はまだ終了していません。");
            const timeLeft = Math.floor((voteEndTime! - system.currentTick) / 20);
            player.sendMessage(`残り時間: ${timeLeft}秒`);
            player.sendMessage(`________________________`);
            for (const [itemName, votes] of sortedVotes) {
                results += `${itemName}: ${votes}票\n`;

                const voters = Object.keys(playerVotes).filter(playerName => playerVotes[playerName] > 0);

                if (voters.length > 0) {
                    results += `  投票者: ${voters.join(', ')}\n`;
                }
            }

            player.sendMessage(results);
            player.sendMessage(`________________________`);

        } else if (voteEndTime !== null || Object.keys(playerVotes).length > 0) {
            const sortedVotes = Object.entries(voteResults).sort(([, a], [, b]) => b - a);
            
            if (sortedVotes.length === 0) {
                player.sendMessage("投票はありませんでした。");
                return;
            }
            voteEndTime = null;


        } else {
            player.sendMessage("投票が開始されていません。");
        }
    } else if (id === "ch:Vallreset" && player.hasTag("op")) {
        resetAllVoteData();
    } if (id === "ch:Vreset") {
        resetVoteScoreboard();
        voteEndTime = null;
    } else if (id === "ch:Vsettings" && player.hasTag("op")) {
        const form = new ModalFormData()
            .title("投票設定")
            .textField("投票時間（秒）", "", voteData.duration.toString())
            .textField("投票結果のタイトル", "", voteData.resultText)
            .toggle("複数投票を許可", voteData.allowMultipleVotes)
            .textField("1人あたりの最大投票数 (複数投票が許可されている場合のみ有効)", "", voteData.maxVotesPerPlayer.toString())
            .textField("投票状況アナウンス間隔（秒）", "", voteData.announceInterval.toString())
            .toggle("投票中にリアルタイム結果を表示", voteData.showLiveResults)
            .toggle("スコアボード編集", voteData.editingScoreboard)
            .textField("順位表示テキスト (例: 位、着)", "例: 位", voteData.rankText ?? "位")
            .textField("票数表示テキスト (例: 票、pt)", "例: 票", voteData.voteText ?? "票")
            .textField("表示する最大順位", "", voteData.maxResultsToShow.toString())
            .textField("対象プレイヤーのタグ (空欄は全員)", "例: voter", targetTag ?? "")
            .toggle("同率順位を処理", voteData.handleTies);
        //@ts-ignore
        form.show(player).then((response: ModalFormResponse) => {
            if (response.canceled || !response.formValues) return;

            const durationString = (response.formValues[0] ?? "60").toString();
            const resultText = response.formValues[1] as string;
            const allowMultipleVotes = response.formValues[2] as boolean;
            const maxVotesPerPlayerString = response.formValues[3] as string;
            const announceIntervalString = response.formValues[4] as string;
            voteData.showLiveResults = response.formValues[5] as boolean;
            voteData.editingScoreboard = response.formValues[6] as boolean;
            voteData.rankText = String(response.formValues[7] ?? "位");
            voteData.voteText = String(response.formValues[8] ?? "票");
            const maxResultsToShowString = response.formValues[9] as string;
            targetTag = response.formValues[10] as string;
            voteData.handleTies = response.formValues[11] as boolean;



            const newDuration = parseInt(durationString, 10);
            const newMaxVotes = parseInt(maxVotesPerPlayerString, 10);
            const newAnnounceInterval = parseInt(announceIntervalString, 10);
            const newMaxResults = parseInt(maxResultsToShowString, 10);



            if (targetTag.trim() === "") {
                targetTag = null;
            }
            if (isNaN(newDuration) || newDuration <= 0) {
                player.sendMessage("無効な投票時間です。");
                return;
            }
            if (!isNaN(newMaxVotes) && newMaxVotes > 0) {
                voteData.maxVotesPerPlayer = newMaxVotes;
                player.sendMessage(`1人あたりの最大投票数を ${newMaxVotes} 票に設定しました。`);

            }
            if (!isNaN(newAnnounceInterval) && newAnnounceInterval > 0) {
                voteData.announceInterval = newAnnounceInterval;
                player.sendMessage(`アナウンス間隔を ${newAnnounceInterval} 秒に設定しました。`);
            }
            if (!isNaN(newMaxResults) && newMaxResults > 0) {
                voteData.maxResultsToShow = newMaxResults;
                player.sendMessage(`表示する最大順位を ${newMaxResults} 位に設定しました。`);
            } else {
                player.sendMessage("無効な最大順位です。");
            }
            

            voteData.duration = newDuration;
            voteData.resultText = resultText;
            voteData.allowMultipleVotes = allowMultipleVotes;
            player.sendMessage(`投票時間を ${newDuration} 秒に設定しました。`);
            player.sendMessage(`投票結果のタイトルを "${resultText}" に設定しました。`);
            player.sendMessage(`複数投票を${allowMultipleVotes ? '許可' : '禁止'}しました。`);
            player.sendMessage(`順位表示テキストを "${voteData.rankText}" に設定しました。`);
            player.sendMessage(`票数表示テキストを "${voteData.voteText}" に設定しました。`);
            player.sendMessage(`対象プレイヤーのタグを "${targetTag ?? "全員"}" に設定しました。`);
            player.sendMessage(`同率順位処理を${voteData.handleTies ? '有効' : '無効'}にしました。`);

            saveVoteData();

            if (voteData.editingScoreboard) {
                openScoreboardEditModal(player);
            }
        });
    } else if (id === "ch:Vsetting" && player.hasTag("op")) {
        try {
            const messageData = JSON.parse(event.message);
            if (typeof messageData.duration === 'number' && messageData.duration > 0) {
                voteData.duration = messageData.duration;
                saveVoteData();
                player.sendMessage(`投票時間を ${voteData.duration} 秒に設定しました。`);
            } else if (messageData.duration) {
                player.sendMessage('無効な投票時間です。正の数字を指定してください。');
            }

            if (typeof messageData.maxResultsToShow === 'number' && messageData.maxResultsToShow > 0) {
                voteData.maxResultsToShow = messageData.maxResultsToShow;
                saveVoteData();
                player.sendMessage(`最大表示順位を ${voteData.maxResultsToShow} 位に設定しました。`);
            } else if (messageData.maxResultsToShow) {
                player.sendMessage('無効な最大表示順位です。正の数字を指定してください。');
            }

            if (typeof messageData.resultText === 'string') {
                voteData.resultText = messageData.resultText;
                saveVoteData();
                player.sendMessage(`結果テキストを "${voteData.resultText}" に設定しました。`);
            }


            if (typeof messageData.allowMultipleVotes === 'boolean') {
                voteData.allowMultipleVotes = messageData.allowMultipleVotes;
                saveVoteData();
                player.sendMessage(`複数投票を ${voteData.allowMultipleVotes ? '許可' : '禁止'} しました。`);
            }

            if (typeof messageData.maxVotesPerPlayer === 'number' && messageData.maxVotesPerPlayer > 0) {
                voteData.maxVotesPerPlayer = messageData.maxVotesPerPlayer;
                saveVoteData();
                player.sendMessage(`最大投票数を ${voteData.maxVotesPerPlayer} に設定しました。`);
            } else if (messageData.maxVotesPerPlayer) {
                player.sendMessage('無効な最大投票数です。正の数字を指定してください。');
            }
            if (typeof messageData.announceInterval === 'number' && messageData.announceInterval > 0) {
                voteData.announceInterval = messageData.announceInterval;
                saveVoteData();
                player.sendMessage(`アナウンス間隔を ${voteData.announceInterval} 秒に設定しました。`);
            } else if (messageData.announceInterval) {
                player.sendMessage('無効なアナウンス間隔です。正の数字を指定してください。');
            }
            if (typeof messageData.showLiveResults === 'boolean') {
                voteData.showLiveResults = messageData.showLiveResults;
                saveVoteData();
                player.sendMessage(`ライブ結果表示を ${voteData.showLiveResults ? '有効' : '無効'} に設定しました。`);
            }
            if (typeof messageData.rankText === 'string') {
                voteData.rankText = messageData.rankText;
                saveVoteData();
                player.sendMessage(`順位表示テキストを "${voteData.rankText}" に設定しました。`);
            }

            if (typeof messageData.voteText === 'string') {
                voteData.voteText = messageData.voteText;
                saveVoteData();
                player.sendMessage(`票数表示テキストを "${voteData.voteText}" に設定しました。`);
            }

            if (typeof messageData.targetTag === 'string') {
                targetTag = messageData.targetTag.trim() === "" ? null : messageData.targetTag;
                saveVoteData();
                player.sendMessage(`対象プレイヤータグを "${targetTag || "全員"}" に設定しました。`);
            }

            if (typeof messageData.handleTies === 'boolean') {
                voteData.handleTies = messageData.handleTies;
                saveVoteData();
                player.sendMessage(`同率順位処理を ${voteData.handleTies ? '有効' : '無効'} に設定しました。`);
            }


        } catch (error) {
            player.sendMessage('無効なJSONデータです。');
            console.error(error);
        }
    } else if (id === "ch:Vstart" && player.hasTag("op")) {
        startVote(voteData.duration);
    } else if (id === "ch:Vhelp") {
        player.sendMessage("投票コマンド一覧:\nch:Vstart で投票開始\nch:Vcheck で投票結果確認\nch:Vallreset で投票設定のデータをリセット\n ch:Vreset でスコアボードをリセット \nch:Vsettings で設定\nch:vote で　投票する");
    }
});


function sendMessageToTarget(message: string): void {
    if (targetTag) {
        const targetPlayers = world.getPlayers().filter(player => player.hasTag(targetTag as string));
        targetPlayers.forEach(player => player.sendMessage(message));
    } else {
        world.sendMessage(message);
    }
}


function openScoreboardEditModal(player: Player): void {
    const form = new ActionFormData()
        .title("スコアボード編集")
        .button("項目を追加")
        .button("項目を削除")
        .button("項目名を変更");
    //@ts-ignore
    form.show(player).then(async (response) => {
        if (response.canceled) return;

        const voteItems = getVoteItemsFromScoreboard();
        const scoreboard = world.scoreboard.getObjective('vote_scoreboard');
        if (!scoreboard) return;

        if (response.selection === 0) { // 追加
            const addForm = new ModalFormData()
                .title("追加する項目名")
                .textField("項目名", "");
            //@ts-ignore
            addForm.show(player).then((addResponse) => {
                if (addResponse.canceled || !addResponse.formValues) return;
                const newItemName = addResponse.formValues[0] as string;
                if (newItemName.trim() !== "") {
                    scoreboard.setScore(newItemName, 0);
                    player.sendMessage(`項目 "${newItemName}" を追加しました。`);
                }
                voteData.editingScoreboard = false;

            });
        } else if (response.selection === 1) { // 削除
            const deleteForm = new ActionFormData().title("削除する項目を選択");
            voteItems.forEach(item => deleteForm.button(item.name));
            //@ts-ignore
            deleteForm.show(player).then((deleteResponse) => {
                if (deleteResponse.canceled || deleteResponse.selection === undefined) return;
                const selectedItem = voteItems[deleteResponse.selection];
                scoreboard.removeParticipant(selectedItem.name);
                player.sendMessage(`項目 "${selectedItem.name}" を削除しました。`);
                voteData.editingScoreboard = false;

            });
        } else if (response.selection === 2) { // 名前変更
            const changeNameForm = new ActionFormData().title("変更する項目を選択");
            voteItems.forEach(item => changeNameForm.button(item.name));
            //@ts-ignore
            changeNameForm.show(player).then(async (changeNameResponse) => {
                if (changeNameResponse.canceled || changeNameResponse.selection === undefined) return;

                const selectedItem = voteItems[changeNameResponse.selection];

                const newNameForm = new ModalFormData()
                    .title("新しい項目名を入力")
                    .textField("新しい項目名", "", selectedItem.name);

                //@ts-ignore
                newNameForm.show(player).then((newNameResponse) => {
                    if (newNameResponse.canceled || !newNameResponse.formValues) return;

                    const newName = newNameResponse.formValues[0] as string;
                    if (newName.trim() !== "") {
                        scoreboard.removeParticipant(selectedItem.name);
                        scoreboard.setScore(newName, 0);
                        player.sendMessage(`項目名を "${selectedItem.name}" から "${newName}" に変更しました。`);
                    }
                    voteData.editingScoreboard = false;
                });
            });
        }
    });
}

system.run(() => {
    loadVoteData();
});