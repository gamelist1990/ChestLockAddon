import { Entity, EntityDieAfterEvent, EntityHurtAfterEvent, Player, PlayerSoundOptions, ScoreboardIdentity, ScriptEventCommandMessageAfterEvent, ScriptEventSource, system, world } from "@minecraft/server";
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

    if (event.id === "ch:checkBlock") {
        try {
            const args = event.message.replace(/^\/ch:checkBlock\s+/, "").split(/\s+/);

            if (args.length < 7) {
                consoleOutput("使用方法: /ch:checkBlock <x1> <y1> <z1> <x2> <y2> <z2> {\"name\":[\"minecraft:sand\",\"minecraft:stone\",...]}");
                return;
            }

            const x1 = parseInt(args[0]);
            const y1 = parseInt(args[1]);
            const z1 = parseInt(args[2]);
            const x2 = parseInt(args[3]);
            const y2 = parseInt(args[4]);
            const z2 = parseInt(args[5]);

            // ブロック名リストをパース
            const matchResult = event.message.match(/\{.*\}/);
            if (!matchResult) {
                consoleOutput("ブロック名リストが見つかりませんでした。");
                return;
            }
            const blockListStr = matchResult[0];
            const blockList = JSON.parse(blockListStr);

            if (!blockList.name || !Array.isArray(blockList.name)) {
                consoleOutput("ブロック名リストは \"name\" キーと配列形式で指定してください。例: {\"name\":[\"minecraft:sand\",\"minecraft:stone\"]}");
                return;
            }

            // ブロックの数をカウント
            const blockCounts = {};
            for (const blockName of blockList.name) {
                blockCounts[blockName] = 0;
            }

            const overworld = world.getDimension("overworld");
            let blockType, blockID;

            for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
                for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
                    for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) {
                        blockType = overworld.getBlock({ x: x, y: y, z: z });
                        if (!blockType) { continue }
                        blockID = blockType.permutation.type.id;
                        if (blockCounts.hasOwnProperty(blockID)) {
                            blockCounts[blockID]++;
                        }
                    }
                }
            }

            // スコアボードに結果を書き込む
            system.run(() => {
                try {
                    const objective = world.scoreboard.getObjective("ch:checkBlock") || world.scoreboard.addObjective("ch:checkBlock", "Block Counts");
                    for (const blockName in blockCounts) {
                        objective.setScore(blockName, blockCounts[blockName]);
                        consoleOutput(`${blockName}: ${blockCounts[blockName]}`);
                    }
                } catch (scoreboardError) {
                    consoleOutput(`スコアボード操作中にエラーが発生しました: ${scoreboardError}`);
                }
            });

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



    if (event.id === "ch:actionScore") {
        try {
            const args = event.message.replace(/^\/ch:actionScore\s+/, "").split(/\s+/);

            if (args.length < 3) {
                consoleOutput("使用方法: /ch:actionScore <スコアボード名> <スコア名1> <スコア名2> [設定(JSON形式)]");
                return;
            }

            const scoreboardName = args[0];
            const scoreName1 = args[1];
            const scoreName2 = args[2];
            let settings: any = {};

            // 引数でJSON設定が渡された場合
            if (args[3]) {
                try {
                    settings = JSON.parse(args[3]);
                } catch (error) {
                    consoleOutput(`JSON設定のパースエラー: ${error}`);
                    return;
                }
            } else {
                // デフォルト設定
                settings = {
                    fullBar1: "§d|",
                    fullBar2: "§b|",
                    emptyBar: "§f|",
                    maxBars: 10,
                    showScore: false,
                    showName: false,
                    delay: 100, // デフォルトの遅延時間(ミリ秒)
                    targetTag: "", // ターゲットタグの設定（デフォルトは空）
                    maxScore: 0, // 割合を計算する基準(maxScore)
                    sortThreshold: 100 // ソート機能の割合ハードル（デフォルトは100%）
                };
            }

            // 設定のバリデーション
            if (!settings.fullBar1 || typeof settings.fullBar1 !== "string") {
                settings.fullBar1 = "§d|";
            }
            if (!settings.fullBar2 || typeof settings.fullBar2 !== "string") {
                settings.fullBar2 = "§b|";
            }
            if (!settings.emptyBar || typeof settings.emptyBar !== "string") {
                settings.emptyBar = "§f|";
            }
            if (!settings.maxBars || typeof settings.maxBars !== "number") {
                settings.maxBars = 10;
            }
            if (typeof settings.showScore !== "boolean") {
                settings.showScore = false;
            }
            if (typeof settings.showName !== "boolean") {
                settings.showName = false;
            }
            if (!settings.delay || typeof settings.delay !== "number") {
                settings.delay = 100;
            }
            if (!settings.targetTag || typeof settings.targetTag !== "string") {
                settings.targetTag = "";
            }
            if (!settings.maxScore || typeof settings.maxScore !== "number") {
                settings.maxScore = 0; // デフォルトは0
            }
            if (!settings.sortThreshold || typeof settings.sortThreshold !== "number") {
                settings.sortThreshold = 100; // デフォルトは100%
            }

            // スコアボードからスコアを取得
            let score1: number | undefined;
            let score2: number | undefined;
            try {
                const objective = world.scoreboard.getObjective(scoreboardName);

                if (!objective) {
                    consoleOutput(`スコアボード ${scoreboardName} が見つかりません`);
                    return;
                }

                // スコア名に完全一致するスコアを取得
                const participant1 = objective.getParticipants().find(p => p.displayName === scoreName1);
                const participant2 = objective.getParticipants().find(p => p.displayName === scoreName2);

                if (participant1) {
                    score1 = objective.getScore(participant1);
                }
                if (participant2) {
                    score2 = objective.getScore(participant2);
                }

            } catch (error) {
                consoleOutput(`スコアボードの読み込みエラー: ${error}`);
                return;
            }

            // スコアが取得できなかった場合のエラーハンドリング
            if (score1 === undefined) {
                consoleOutput(`${scoreboardName} に ${scoreName1} というスコア名のスコアが見つかりません`);
                return;
            }
            if (score2 === undefined) {
                consoleOutput(`${scoreboardName} に ${scoreName2} というスコア名のスコアが見つかりません`);
                return;
            }

            // アクションバーの表示とサウンドの再生 (遅延付き)
            system.run(async () => {
                try {
                    // 割合を計算する基準
                    const maxScore = settings.maxScore > 0 ? settings.maxScore : (score1 ?? 0) + (score2 ?? 0);
                    // ソート機能の割合ハードル（%）を適用
                    const threshold = settings.sortThreshold / 100;

                    // 徐々にバーを増やして表示
                    for (let i = 0; i <= settings.maxBars; i++) {
                        // score1の割合に基づくバーの数（ハードルを適用）
                        const numBars1 = Math.min(settings.maxBars, Math.round((score1 / maxScore) * settings.maxBars * (i / settings.maxBars) / threshold));
                        // score2の割合に基づくバーの数（ハードルを適用）
                        const numBars2 = Math.min(settings.maxBars, Math.round((score2 / maxScore) * settings.maxBars * (i / settings.maxBars) / threshold));

                        // バーの生成
                        const fullBars1 = settings.fullBar1.repeat(Math.max(0, numBars1));
                        const fullBars2 = settings.fullBar2.repeat(Math.max(0, numBars2));
                        const emptyBars = settings.emptyBar.repeat(Math.max(0, settings.maxBars - Math.max(numBars1, numBars2)));

                        let actionBarMessage = "";

                        if (settings.showName) {
                            actionBarMessage += `${scoreName1}: `;
                        }
                        actionBarMessage += `${fullBars1}`;

                        actionBarMessage += `${emptyBars}`; // 空のバーを追加

                        if (settings.showName) {
                            actionBarMessage += ` :${scoreName2}`;
                        }

                        actionBarMessage += `${fullBars2}`;

                        if (settings.showScore) {
                            // ハードルを考慮した割合を表示
                            actionBarMessage += ` (${Math.min(100, Math.round((score1 / maxScore) * 100 * (i / settings.maxBars) / threshold))}%, ${Math.min(100, Math.round((score2 / maxScore) * 100 * (i / settings.maxBars) / threshold))}%)`;
                        }

                        for (const player of world.getAllPlayers()) {
                            // 指定されたタグを持つプレイヤーにのみアクションバーを表示
                            if (settings.targetTag === "" || player.hasTag(settings.targetTag)) {
                                player.onScreenDisplay.setActionBar(actionBarMessage);

                                // サウンドを再生
                                const soundOptions: PlayerSoundOptions = {
                                    location: player.location,
                                    pitch: 1,
                                    volume: 0.5,
                                };
                                // どちらかのバーが半分以上の場合に "random.orb" サウンドを再生
                                if (numBars1 >= settings.maxBars / 2 || numBars2 >= settings.maxBars / 2) {
                                    player.playSound("random.orb", soundOptions);
                                } else {
                                    player.playSound("random.click", soundOptions);
                                }
                            }
                        }

                        await new Promise<void>((resolve) => {
                            system.runTimeout(() => {
                                resolve();
                            }, settings.delay / 20);
                        });
                    }

                    // 計算結果を "ch:actionScore" スコアボードに書き込む
                    let resultObjective = world.scoreboard.getObjective("ch:actionScore");
                    if (!resultObjective) {
                        resultObjective = world.scoreboard.addObjective("ch:actionScore", "ActionScore Results");
                    }

                    if (settings.sortThreshold !== 100) {
                        resultObjective.setScore(`${scoreName1}%`, Math.min(100, Math.round((score1 / maxScore) * 100 / threshold)));
                        resultObjective.setScore(`${scoreName2}%`, Math.min(100, Math.round((score2 / maxScore) * 100 / threshold)));
                    } else {
                        resultObjective.setScore(`${scoreName1}%`, Math.round((score1 / maxScore) * 100));
                        resultObjective.setScore(`${scoreName2}%`, Math.round((score2 / maxScore) * 100));
                    }

                } catch (error) {
                    consoleOutput(`アクションバー表示中またはスコアボード書き込み中にエラーが発生しました: ${error}`);
                }
            });

        } catch (error) {
            consoleOutput(`エラーが発生しました: ${error}`);
        }
    }
});



const playerAttackMap = new Map<string, string>();
const tagTimeout = 40;

world.afterEvents.entityHurt.subscribe((event: EntityHurtAfterEvent) => {
    const attacked = event.hurtEntity;
    const damageSource = event.damageSource;
    if (config().module.ScoreSystem.enabled === false) return;
    if (!(attacked instanceof Player)) {
        //  console.log(`[EntityHurt] ${attacked.typeId} is not a player, skipping.`);
        return;
    }
    let attacker: Entity | undefined = damageSource.damagingEntity;

    if (!attacker && damageSource.damagingProjectile) {
        attacker = damageSource.damagingProjectile;
    }

    if (attacker && attacker instanceof Player) {
        playerAttackMap.set(attacked.id, attacker.id);
    } else if (attacker) {
    }
});

world.afterEvents.entityDie.subscribe((event: EntityDieAfterEvent) => {
    const deadEntity = event.deadEntity;
    if (config().module.ScoreSystem.enabled === false) return;

    if (!(deadEntity instanceof Player)) {
        return;
    }

    //const damageSource = event.damageSource;
    //if (damageSource.cause === 'suicide' || damageSource.cause === 'void') {
    //    playerAttackMap.delete(deadEntity.id);
    //    return;
    //}

    const lastAttackerId = playerAttackMap.get(deadEntity.id);

    // 攻撃者と死亡者が同一でないことを確認
    if (lastAttackerId && lastAttackerId !== deadEntity.id) {
        const lastAttacker = Array.from(world.getAllPlayers()).find(p => p.id === lastAttackerId);

        if (lastAttacker) {
            lastAttacker.addTag('lasta');
            deadEntity.addTag('lastb');

            system.runTimeout(() => {
                if (lastAttacker.hasTag('lasta')) {
                    lastAttacker.removeTag('lasta');
                }
            }, tagTimeout);

            system.runTimeout(() => {
                if (deadEntity.hasTag('lastb')) {
                    deadEntity.removeTag('lastb');
                }
            }, tagTimeout);
        }
    }
    playerAttackMap.delete(deadEntity.id);
});




const defaultRank = new RankSystem
    ("§bCombat§aCube!§r",
        "xp", ["ルーキー", "ブロンズI", "ブロンズII", "ブロンズIII", "シルバーI", "シルバーII", "シルバーIII", "シルバーIV", "ゴールドI", "ゴールドII",
        "ゴールドIII", "プラチナI", "プラチナII", "プラチナIII", "プラチナIV", "プラチナV", "エメラルドI", "エメラルドII", "エメラルドIII", "ダイヤI",
        "ダイヤII", "ダイヤIII", "ダイヤIV", "マスターI", "マスターII", "マスターIII", "プレデターI", "プレデターII", "プレデターIII", "プレデターIV",
        "伝説I", "伝説II", "伝説III", "伝説IV", "伝説V", "伝説VI"],
        [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500,
            5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 9500,
            10000, 10500, 11000, 11500, 12000, 12500, 13000, 13500, 14000, 14500,
            15000, 15500, 16000, 16500, 17000, 17500]);
registerRank(defaultRank);