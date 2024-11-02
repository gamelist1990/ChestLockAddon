import { ScoreboardIdentity, system, world } from "@minecraft/server";
import { isPlayer } from "../../Modules/Handler";

system.afterEvents.scriptEventReceive.subscribe((event) => {
    const { message, id } = event;
    if (id === "ch:score") {
        try {
            const scoreboardName = message.split("=")[1];
            const originalScoreboard = world.scoreboard.getObjective(scoreboardName);

            if (!originalScoreboard) {
                console.error(`スコアボード "${scoreboardName}"が見つかりませんでした。`);
                return;
            }

            // 表示用のスコアボードを取得 (存在しない場合は新規作成)
            const displayScoreboardName = `ch_${originalScoreboard.id}`;
            let displayScoreboard = world.scoreboard.getObjective(displayScoreboardName);
            if (!displayScoreboard) {
                displayScoreboard = world.scoreboard.addObjective(
                    displayScoreboardName,
                    originalScoreboard.displayName,
                );
            }

            // scoreData にスコア、プレイヤー名、スコアボード名を関連付けて保存
            const scoreData: { [key: string]: { player: ScoreboardIdentity, score: number, scoreboardName: string } } = {};

            for (const participant of originalScoreboard.getParticipants()) {
                const score = originalScoreboard.getScore(participant);
                if (score !== undefined) {
                    scoreData[participant.displayName] = { player: participant, score: score, scoreboardName: scoreboardName };
                    //console.log(`スコアボードクリア: ${participant.displayName} = ${score}`);
                }
            }

            for (const participant of displayScoreboard.getParticipants()) {
                displayScoreboard.removeParticipant(participant);
            }

            for (const [key, { score }] of Object.entries(scoreData)) {
                let playerNameResolved = key;
                const matchTag = key.match(/\[tag=([^\]]+)\]/);
                const matchScore = key.match(/\[score=([^,]+)(?:,True)?\]/);
                const matchPlayer = key.match(/\[allPlayer]/);

                if (matchTag) {
                    const tagName = matchTag[1];
                    const playerCount = world.getPlayers().filter(player => player.hasTag(tagName)).length;
                    playerNameResolved = key.replace(/\[tag=([^\]]+)\]/, playerCount.toString());
                } else if (matchScore) {
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
                        if (key.includes(",True")) {
                            const player = isPlayer(highestScorePlayer.displayName);
                            playerNameResolved = player
                                ? key.replace(`[score=${scoreTitle},True]`, highestScorePlayer.displayName)
                                : key.replace(`[score=${scoreTitle},True]`, "オフライン");
                        } else {
                            playerNameResolved = key.replace(`[score=${scoreTitle}]`, highestScore.toString());
                        }
                    } else {
                        console.warn(`スコア ${scoreTitle} に該当するプレイヤーが見つかりませんでした。`);
                    }
                } else if (matchPlayer) {
                    const playerCount = world.getPlayers().length;
                    playerNameResolved = key.replace(`[allPlayer]`, playerCount.toString());
                }

                displayScoreboard.setScore(playerNameResolved, score);
            }



        } catch (error) {
            console.error(`スコアボード更新処理中にエラーが発生しました: ${error}`);
        }
    }
});




system.afterEvents.scriptEventReceive.subscribe((event) => {
    const args = event.message.replace(/^\/ch:team\s+/, "").split(/\s+/);

    if (event.id === "ch:team") {
        if (args.length === 0) {
            console.error("使用方法: /ch:team set <チーム数>:<チーム内上限人数> <タグ名> <スコアボードタイトル>");
            return;
        }

        const subcommand = args[0];

        if (subcommand === "set") {
            if (args.length < 4) {
                console.error("引数が不足しています。使用方法: /ch:team set <チーム数>:<チーム内上限人数> <タグ名> <スコアボードタイトル>");
                return;
            }
            const teamParams = args[1].split(":");
            const numTeams = parseInt(teamParams[0]);
            const maxTeamSize = parseInt(teamParams[1]);
            const tagName = args[2];
            const scoreTitle = args[3];

            if (isNaN(numTeams) || numTeams < 1) {
                console.error("チーム数は1以上の整数で指定してください。");
                return;
            }
            if (isNaN(maxTeamSize) || maxTeamSize < 1) {
                console.error("チーム内上限人数は1以上の整数で指定してください。");
                return;
            }

            const objective = world.scoreboard.getObjective(scoreTitle);
            if (!objective) {
                console.error(`スコアボード '${scoreTitle}' が見つかりません。`);
                return;
            }

            const players = world.getPlayers().filter(player => player.hasTag(tagName));
            const teamAssignments: { [playerName: string]: number } = {};
            const teamSizes: { [teamNumber: number]: number } = {};

            const shuffledPlayers = players.sort(() => Math.random() - 0.5);

            for (const player of shuffledPlayers) {
                let assigned = false;
                for (let team = 1; team <= numTeams; team++) {
                    if (teamSizes[team] === undefined || teamSizes[team] < maxTeamSize) {
                        teamAssignments[player.name] = team;
                        objective.setScore(player, team);
                        teamSizes[team] = (teamSizes[team] || 0) + 1;
                        assigned = true;
                        break; 
                    }
                }
                if (!assigned) {
                  //  console.warn(`${player.name} のチーム割り当てに失敗しました。上限に達している可能性があります。`);
                }
            }

            //console.log(`チーム分け完了: ${JSON.stringify(teamAssignments)}`);

        } else {
            console.error("無効なサブコマンドです。 set を使用してください。");
        }
    }
});