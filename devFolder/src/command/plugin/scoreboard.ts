import { Player, ScoreboardIdentity, ScriptEventCommandMessageAfterEvent, ScriptEventSource, system, world } from "@minecraft/server";
import { getServerUptime } from "../utility/server";
import { ver } from "../../Modules/version";
import { banPlayers } from "../../Modules/globalBan";
import { config, formatTimestampJST } from "../../Modules/Util";
import { handleRankCommand, RankSystem, registerRank } from "../../Modules/rankSystem";
import { runCommand } from "../../Modules/Handler";


const simpleReplacements: { [key: string]: string | (() => string) } = {
    "[allPlayer]": () => world.getPlayers().length.toString(),
    "[uptime]": () => getServerUptime().match(/(\d+)d (\d+)h (\d+)m/)?.[0] || "0d 0h 0m",
    "[ver]": () => ver,
    "[banUser]": () => banPlayers.length.toString(),
    "[time]": () => formatTimestampJST(new Date()),

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

    // scoreの置換(修正)
    const matchScore = playerNameResolved.match(/\[score=([^,]+)(?:,([^\]]+))?\]/);
    if (matchScore) {
        const scoreTitle = matchScore[1];
        const playerName = matchScore[2]; // プレイヤー名を取得

        const targetScoreboard = world.scoreboard.getObjective(scoreTitle);
        if (targetScoreboard) {
            if (playerName) {
                // プレイヤー名が指定されている場合、そのプレイヤーのスコアを取得
                let playerScore: number | undefined;
                for (const participant of targetScoreboard.getParticipants()) {
                    if (participant.displayName === playerName) {
                        playerScore = targetScoreboard.getScore(participant);
                        break;
                    }
                }

                if (playerScore !== undefined) {
                    playerNameResolved = playerNameResolved.replace(`[score=${scoreTitle},${playerName}]`, playerScore.toString());
                } else {
                    playerNameResolved = playerNameResolved.replace(`[score=${scoreTitle},${playerName}]`, "0"); // プレイヤーが見つからない場合は0を返す
                    // console.warn(`スコアボード "${scoreTitle}" にプレイヤー "${playerName}" が見つかりませんでした。`);
                }
            } else {
                // プレイヤー名が指定されていない場合、最高スコアを取得 (従来の動作)
                let highestScorePlayer: ScoreboardIdentity | null = null;
                let highestScore = -Infinity;

                for (const participant of targetScoreboard.getParticipants()) {
                    const scoreValue = targetScoreboard.getScore(participant);
                    if (scoreValue !== undefined && scoreValue > highestScore) {
                        highestScore = scoreValue;
                        highestScorePlayer = participant;
                    }
                }

                if (highestScorePlayer) {
                    playerNameResolved = playerNameResolved.replace(`[score=${scoreTitle}]`, highestScore.toString());
                } else {
                    playerNameResolved = playerNameResolved.replace(`[score=${scoreTitle}]`, "0");
                    // console.warn(`スコア ${scoreTitle} に該当するプレイヤーが見つかりませんでした。`);
                }
            }
        } else {
            //   console.warn(`スコアボード "${scoreTitle}" が見つかりませんでした。`);
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
                //  console.error(`スコアボード "${scoreboardName}"が見つかりませんでした。`);
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

        const sendMessage = (message: string) => {
            if (event.sourceType === ScriptEventSource.Entity) {
                const player: Player = event.sourceEntity as Player;
                system.run(() => player.sendMessage(message));
            } else {
                console.warn(message);
            }
        };

        if (args.length < 1) {
            sendMessage("引数が不足しています。使用方法: /ch:resetScore <スコアボード名| -all>");
            return;
        }

        const target = args[0];

        if (target === "-all") {
            // 全てのスコアボードをリセット
            for (const objective of world.scoreboard.getObjectives()) {
                for (const participant of objective.getParticipants()) {
                    objective.removeParticipant(participant);
                }
            }
            sendMessage("全てのスコアボードのスコアをリセットしました。");

        } else {
            // 指定されたスコアボードをリセット
            const objective = world.scoreboard.getObjective(target);

            if (!objective) {
                sendMessage(`スコアボード '${target}' が見つかりません。`);
                return;
            }

            for (const participant of objective.getParticipants()) {
                objective.removeParticipant(participant);
            }
            sendMessage(`スコアボード '${target}' のスコアをリセットしました。`);
        }
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
    }

    if (event.id === "ch:rank") {
        handleRankCommand(event as ScriptEventCommandMessageAfterEvent);
    }

    const consoleOutput = (message: string) => {
        console.warn(message);
    };

    if (event.id === "ch:teamCount") {
        try {
            const args = event.message.replace(/^\/ch:teamCount\s+/, "").split(/\s+/);

            if (args.length < 2) {
                consoleOutput("使用方法: /ch:teamCount <チームタグ1,チームタグ2,...> <コマンドリスト> [true]");
                return;
            }

            const teamTags = args[0].split(",");
            // JSON文字列全体をコマンドリストとして扱う
            const matchResult = event.message.match(/\[.*\]/);
            if (!matchResult) {
                consoleOutput("コマンドリストが見つかりませんでした。");
                return;
            }
            const commandListStr = matchResult[0];
            const commandList = JSON.parse(commandListStr);
            const compareMode = args.includes("true"); // trueが指定されたか

            if (!Array.isArray(commandList)) {
                consoleOutput("コマンドリストは配列形式で指定してください。例: [{\"team1\":\"command1\"},{\"team2\":\"command2\"}]");
                return;
            }

            const checkTeamCountsAndRun = () => {
                if (compareMode) {
                    // 人数比較モード
                    let maxPlayerCount = -1;
                    let winningTeam = "";
                    let isSame = false; // 同数フラグ

                    for (const teamTag of teamTags) {
                        const teamPlayerCount = world.getPlayers().filter((player) => player.hasTag(teamTag)).length;
                        if (teamPlayerCount > maxPlayerCount) {
                            maxPlayerCount = teamPlayerCount;
                            winningTeam = teamTag;
                            isSame = false; // 同数フラグをリセット
                        } else if (teamPlayerCount === maxPlayerCount) {
                            isSame = true; // 同数フラグを立てる
                            winningTeam = ""; // 同数の場合は winningTeam をリセット
                        }
                    }

                    if (isSame) {
                        // 同数の場合の処理
                        const sameCommandObj = commandList.find(obj => obj["same"]);
                        if (sameCommandObj) {
                            const sameCommand = sameCommandObj["same"];
                         //   consoleOutput(`チーム人数が同数のため、コマンド「${sameCommand}」を実行します。`);
                            system.run(() => {
                                try {
                                    world.getDimension("overworld").runCommandAsync(sameCommand);
                                } catch (commandError) {
                                    consoleOutput(`コマンド実行中にエラーが発生しました: ${commandError}`);
                                }
                            });
                        } else {
                            consoleOutput("同数の場合のコマンドが定義されていません。");
                        }
                    } else if (winningTeam !== "") {
                        // 最大人数のチームがある場合の処理 (従来の動作)
                        const commandObj = commandList.find(obj => obj[winningTeam]);
                        if (commandObj) {
                            const command = commandObj[winningTeam];
                            consoleOutput(`チーム ${winningTeam} の人数が最も多いため、コマンド「${command}」を実行します。`);
                            system.run(() => {
                                try {
                                    world.getDimension("overworld").runCommandAsync(command);
                                } catch (commandError) {
                                    consoleOutput(`コマンド実行中にエラーが発生しました: ${commandError}`);
                                }
                            });
                        } else {
                            consoleOutput(`チーム ${winningTeam} に対応するコマンドが定義されていません。`);
                        }
                    }
                } else {
                    // 0人生存確認モード (従来の動作)
                    for (const teamTag of teamTags) {
                        const teamPlayerCount = world.getPlayers().filter((player) => player.hasTag(teamTag)).length;
                        if (teamPlayerCount === 0) {
                            // コマンドリストからチームに対応するコマンドを検索
                            const commandObj = commandList.find(obj => obj[teamTag]);
                            if (commandObj) {
                                const command = commandObj[teamTag];
                            //    consoleOutput(`チーム ${teamTag} の人数が0になったため、コマンド「${command}」を実行します。`);
                                system.run(() => {
                                    try {
                                        world.getDimension("overworld").runCommandAsync(command);
                                    } catch (commandError) {
                                        consoleOutput(`コマンド実行中にエラーが発生しました: ${commandError}`);
                                    }
                                });
                            } else {
                                consoleOutput(`チーム ${teamTag} に対応するコマンドが定義されていません。`);
                            }
                        }
                    }
                }
            };

            // コマンド実行時にチェックを実行
            checkTeamCountsAndRun();

        } catch (error) {
            consoleOutput(`エラーが発生しました: ${error}`);
        }
    }

    if (event.id === "ch:randomCom") {
        try {
            const args = event.message.replace(/^\/ch:randomCom\s+/, "").split(/\s+/);

            if (args.length < 5) {
                consoleOutput("使用方法: /ch:randomCom <x1> <y1> <z1> <x2> <y2> <z2> [{\"command\":\"command1\"},{\"command\":\"command2\"},...]");
                return;
            }

            const x1 = parseInt(args[0]);
            const y1 = parseInt(args[1]);
            const z1 = parseInt(args[2]);
            const x2 = parseInt(args[3]);
            const y2 = parseInt(args[4]);
            const z2 = parseInt(args[5]);

            // JSON文字列全体をコマンドリストとして扱う
            const matchResult = event.message.match(/\[.*\]/);
            if (!matchResult) {
                consoleOutput("コマンドリストが見つかりませんでした。");
                return;
            }
            const commandListStr = matchResult[0];
            const commandList = JSON.parse(commandListStr);

            if (!Array.isArray(commandList)) {
                consoleOutput("コマンドリストは配列形式で指定してください。例: [{\"command\":\"command1\"},{\"command\":\"command2\"}]");
                return;
            }

            // ランダムな座標を生成
            const randomX = Math.floor(Math.random() * (Math.max(x1, x2) - Math.min(x1, x2) + 1)) + Math.min(x1, x2);
            const randomY = Math.floor(Math.random() * (Math.max(y1, y2) - Math.min(y1, y2) + 1)) + Math.min(y1, y2);
            const randomZ = Math.floor(Math.random() * (Math.max(z1, z2) - Math.min(z1, z2) + 1)) + Math.min(z1, z2);

            // ランダムなコマンドを選択
            const randomIndex = Math.floor(Math.random() * commandList.length);
            const selectedCommand = commandList[randomIndex].command;

            if (selectedCommand) {
                const command = selectedCommand.replace(/\$x/g, randomX).replace(/\$y/g, randomY).replace(/\$z/g, randomZ);
                consoleOutput(`座標 (${randomX}, ${randomY}, ${randomZ}) でコマンド「${command}」を実行します。`);

                system.run(() => {
                    try {
                        world.getDimension("overworld").runCommandAsync(command);
                    } catch (commandError) {
                        consoleOutput(`コマンド実行中にエラーが発生しました: ${commandError}`);
                    }
                });
            } else {
                consoleOutput("選択されたコマンドが不正です。");
            }

        } catch (error) {
            consoleOutput(`エラーが発生しました: ${error}`);
        }
    }

    if (event.id === "ch:probability") {
        try {
            const args = event.message.replace(/^\/ch:probability\s+/, "").split(/\s+/);

            if (args.length < 2) {
                consoleOutput("使用方法: /ch:probability <スコアボード名> <確率設定>");
                return;
            }

            const scoreboardName = args[0];
            const probabilitySettings = event.message.match(/\[.*\]/);

            if (!probabilitySettings) {
                consoleOutput("確率設定が見つかりませんでした。");
                return;
            }
            const probabilitySettingsStr = probabilitySettings[0];
            const probabilitySettingsList = JSON.parse(probabilitySettingsStr);

            if (!Array.isArray(probabilitySettingsList)) {
                consoleOutput("確率設定は配列形式で指定してください。例: [{\"value\":1,\"weight\":0.6},{\"value\":2,\"weight\":0.4}]");
                return;
            }

            // 重みの合計を計算 
            let totalWeight = 0;
            for (const setting of probabilitySettingsList) {
                if (typeof setting.weight !== 'number' || setting.weight < 0) {
                    consoleOutput("重みは0以上の数値で指定してください。");
                    return;
                }
                totalWeight += setting.weight;
            }

            if (totalWeight === 0) {
                consoleOutput("重みの合計は0より大きくなければなりません。");
                return;
            }

            // 重みに基づいてランダムな値を選択
            let randomValue = Math.random() * totalWeight;
            let selectedValue = null;
            let cumulativeWeight = 0;

            for (const setting of probabilitySettingsList) {
                cumulativeWeight += setting.weight;
                if (randomValue <= cumulativeWeight) {
                    selectedValue = setting.value;
                    break;
                }
            }

            // スコアボードに結果を保存
            let objective = world.scoreboard.getObjective(scoreboardName);
            if (!objective) {
                objective = world.scoreboard.addObjective(scoreboardName, scoreboardName);
            }

            if (selectedValue !== null) {
                objective.setScore("result", selectedValue);
            }


        } catch (error) {
            consoleOutput(`エラーが発生しました: ${error}`);
        }
    }

    if (event.id === "ch:command") {
        try {
            const args = event.message.replace(/^\/ch:command\s+/, "").split(/\s+/);

            if (args.length < 2) {
                consoleOutput("使用方法: /ch:command <プレイヤー名> <コマンド名> [引数...]");
                return;
            }

            const playerName = args[0];
            const commandName = args[1];
            const commandArgs = args.slice(2);

            // プレイヤーが存在するか確認
            const player = world.getAllPlayers().find(p => p.name === playerName);
            if (!player) {
                consoleOutput(`プレイヤー ${playerName} は存在しません。`);
                return;
            }

            // runCommand を使用してコマンドを実行
            runCommand(playerName, commandName, commandArgs);

        } catch (error) {
            consoleOutput(`エラーが発生しました: ${error}`);
        }
    }
});



const defaultRank = new RankSystem(
    "§bMini§aGame§r",
    "xp",
    ["ルーキー", "ブロンズ", "シルバー", "ゴールド", "プラチナ", "ダイヤ", "マスター", "プレデター"],
    [0, 500, 2000, 3000, 5000, 7000, 9000, 15000]
);

registerRank(defaultRank);