import { Player, ScoreboardIdentity, ScriptEventCommandMessageAfterEvent, ScriptEventSource, system, world } from "@minecraft/server";
import { isPlayer } from "../../Modules/Handler";
import { getServerUptime } from "../utility/server";
import { ver } from "../../Modules/version";
import { banPlayers } from "../../Modules/globalBan";
import { config } from "../../Modules/Util";
import { handleRankCommand, RankSystem, registerRank } from "../../Modules/rankSystem";


const simpleReplacements: { [key: string]: string | (() => string) } = {
    "[allPlayer]": () => world.getPlayers().length.toString(),
    "[uptime]": () => getServerUptime().match(/(\d+)d (\d+)h (\d+)m/)?.[0] || "0d 0h 0m",
    "[ver]": () => ver,
    "[banUser]": () => banPlayers.length.toString(),
};

function resolvePlayerName(key: string): string {
    let playerNameResolved = key;

    //simpleで定義されたやつを先に見る
    for (const [pattern, replacement] of Object.entries(simpleReplacements)) {
        playerNameResolved = playerNameResolved.replace(new RegExp(pattern.replace(/([\[\]])/g, "\\$1")), typeof replacement === 'function' ? replacement() : replacement);
    }

    // tagの置換(完成)
    const matchTag = playerNameResolved.match(/\[tag=([^\]]+)\]/);
    if (matchTag) {
        const tagName = matchTag[1];
        const playerCount = world.getPlayers().filter(player => player.hasTag(tagName)).length;
        playerNameResolved = playerNameResolved.replace(/\[tag=([^\]]+)\]/, playerCount.toString());
    }

    // scoreの置換(完成)
    const matchScore = playerNameResolved.match(/\[score=([^,]+)(?:,True)?\]/);
    if (matchScore) {
        const scoreTitle = matchScore[1];
        let highestScorePlayer: ScoreboardIdentity | null = null;
        let highestScore = -Infinity;

        const targetScoreboard = world.scoreboard.getObjective(scoreTitle);
        if (targetScoreboard) {
            for (const participant of targetScoreboard.getParticipants()) {
                const scoreValue = targetScoreboard.getScore(participant);
                if (scoreValue !== undefined && scoreValue > highestScore) {
                    highestScore = scoreValue;
                    highestScorePlayer = participant;
                }
            }
        } else {
            console.warn(`スコアボード "${scoreTitle}" が見つかりませんでした。`);
        }

        if (highestScorePlayer) {
            if (playerNameResolved.includes(",True")) {
                playerNameResolved = playerNameResolved.replace(`[score=${scoreTitle},True]`, highestScorePlayer.displayName);
            } else {
                playerNameResolved = playerNameResolved.replace(`[score=${scoreTitle}]`, highestScore.toString());
            }


            if (!isPlayer(highestScorePlayer.displayName) && playerNameResolved.includes(",True")) {
                playerNameResolved = playerNameResolved.replace(`[score=${scoreTitle},True]`, "オフライン");
            }

        } else {
            console.warn(`スコア ${scoreTitle} に該当するプレイヤーが見つかりませんでした。`);
        }
    }


    return playerNameResolved;
}


system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (config().module.ScoreSystem.enabled === false) return;
    const { message, id } = event;
    if (id === "ch:score") {
        try {
            const scoreboardName = message.split("=")[1];
            const originalScoreboard = world.scoreboard.getObjective(scoreboardName);

            if (!originalScoreboard) {
                console.error(`スコアボード "${scoreboardName}"が見つかりませんでした。`);
                return;
            }

            const displayScoreboardName = `ch_${originalScoreboard.id}`;
            let displayScoreboard = world.scoreboard.getObjective(displayScoreboardName);
            if (!displayScoreboard) {
                displayScoreboard = world.scoreboard.addObjective(
                    displayScoreboardName,
                    originalScoreboard.displayName,
                );
            }

            const scoreData: { [key: string]: { player: ScoreboardIdentity, score: number } } = {};

            for (const participant of originalScoreboard.getParticipants()) {
                const score = originalScoreboard.getScore(participant);
                if (score !== undefined) {
                    scoreData[participant.displayName] = { player: participant, score };
                }
            }

            for (const participant of displayScoreboard.getParticipants()) {
                displayScoreboard.removeParticipant(participant);
            }

            for (const [key, { score }] of Object.entries(scoreData)) {
                const resolvedName = resolvePlayerName(key);
                displayScoreboard.setScore(resolvedName, score);
            }

        } catch (error) {
            console.error(`スコアボード更新処理中にエラーが発生しました: ${error}`);
        }
    }
});




system.afterEvents.scriptEventReceive.subscribe((event: ScriptEventCommandMessageAfterEvent) => {
    if (config().module.ScoreSystem.enabled === false) return;

    if (event.id === "ch:team") {
        const args = event.message.replace(/^\/ch:team\s+/, "").split(/\s+/);
        // コマンドブロックで実行された場合に備えてメッセージ送信関数を作成
        const sendMessage = (message: string) => {
            if (event.sourceType === ScriptEventSource.Entity) {
                const player: Player = event.sourceEntity as Player;
                system.run(() => player.sendMessage(message));
            } else {
                console.warn(message);
            }
        };

        if (args.length === 0) {
            sendMessage("使用方法: /ch:team set <チーム数>:<チーム内上限人数> <タグ名> <スコアボードタイトル>");
            return;
        }

        const subcommand = args[0];

        if (subcommand === "set") {
            if (args.length < 4) {
                sendMessage("引数が不足しています。使用方法: /ch:team set <チーム数>:<チーム内上限人数> <タグ名> <スコアボードタイトル>");
                return;
            }
            const teamParams = args[1].split(":");
            const numTeams = parseInt(teamParams[0]);
            const maxTeamSize = parseInt(teamParams[1]);
            const tagName = args[2];
            const scoreTitle = args[3];

            if (isNaN(numTeams) || numTeams < 1) {
                sendMessage("チーム数は1以上の整数で指定してください。");
                return;
            }
            if (isNaN(maxTeamSize) || maxTeamSize < 1) {
                sendMessage("チーム内上限人数は1以上の整数で指定してください。");
                return;
            }

            const objective = world.scoreboard.getObjective(scoreTitle);
            if (!objective) {
                sendMessage(`スコアボード '${scoreTitle}' が見つかりません。`);
                return;
            }

         
            const players = world.getPlayers().filter((player) => player.hasTag(tagName));
            const teamAssignments: { [playerName: string]: number } = {};
            const teamSizes: { [teamNumber: number]: number } = {};

            // プレイヤーをシャッフル
            const shuffledPlayers = players.sort(() => Math.random() - 0.5);

            // 各チームの人数を初期化
            for (let i = 1; i <= numTeams; i++) {
                teamSizes[i] = 0;
            }

            // シャッフルされたプレイヤーリストから順番に各チームに割り当て
            let teamIndex = 1;
            for (const player of shuffledPlayers) {
                // 現在のチームが上限に達しているかチェック
                while (teamSizes[teamIndex] >= maxTeamSize) {
                    teamIndex++;
                    if (teamIndex > numTeams) {
                        teamIndex = 1; // 全チームが上限に達したら最初のチームに戻る
                    }
                }

                // プレイヤーをチームに割り当て
                teamAssignments[player.name] = teamIndex;
                objective.setScore(player, teamIndex);
                teamSizes[teamIndex]++;

                // 次のプレイヤーのためにチームインデックスを更新（必要に応じてローテーション）
                teamIndex++;
                if (teamIndex > numTeams) {
                    teamIndex = 1;
                }
            }

            sendMessage(`チーム分け完了: ${JSON.stringify(teamAssignments)}`);
        } else {
            sendMessage("無効なサブコマンドです。 set を使用してください。");
        }

    }

    if (event.id === "ch:resetScore") {
        const args = event.message.replace(/^\/ch:resetScore\s+/, "").split(/\s+/);

        // コマンドブロックで実行された場合に備えてメッセージ送信関数を作成
        const sendMessage = (message: string) => {
            if (event.sourceType === ScriptEventSource.Entity) {
                const player: Player = event.sourceEntity as Player;
                system.run(() => player.sendMessage(message));
            } else {
                console.warn(message);
            }
        };

        if (args.length < 1) {
            sendMessage("引数が不足しています。使用方法: /ch:resetScore <スコアボード名>");
            return;
        }

        const scoreboardName = args[0];
        const objective = world.scoreboard.getObjective(scoreboardName);

        if (!objective) {
            sendMessage(`スコアボード '${scoreboardName}' が見つかりません。`);
            return;
        }

        for (const participant of objective.getParticipants()) {
            objective.removeParticipant(participant);
        }

        sendMessage(`スコアボード '${scoreboardName}' のスコアをリセットしました。`);
    }

    // ランダム数値生成
    if (event.id === "ch:number") {
        // コマンドブロックで実行された場合、コンソールに直接出力する
        const consoleOutput = (message: string) => {
            console.warn(message);
        };

        const args = event.message.replace(/^\/ch:number\s+/, "").split(/\s*,\s*/);
        const numbers: number[] = [];

        for (const arg of args) {
            const num = parseInt(arg);
            if (isNaN(num)) {
                consoleOutput(`無効な数値: ${arg}`);
                return;
            }
            numbers.push(num);
        }

        if (numbers.length === 0) {
            consoleOutput("数値を1つ以上指定してください。");
            return;
        }

        const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];

        let objective = world.scoreboard.getObjective("ch:number");
        if (!objective) {
            objective = world.scoreboard.addObjective("ch:number", "ランダム数値");
        }

        objective.setScore("number", randomNumber);
        consoleOutput(`生成された数値: ${randomNumber}`);
    }

    if (event.id === "ch:rank") {
        handleRankCommand(event as ScriptEventCommandMessageAfterEvent);
    }
});



const defaultRank = new RankSystem(
    "§bMini§aGame§r",
    "xp",
    ["ルーキー", "ブロンズ", "シルバー", "ゴールド", "プラチナ", "ダイヤ", "マスター", "プレデター"],
    [0, 500, 2000, 3000, 5000, 7000, 9000, 15000]
);

registerRank(defaultRank);