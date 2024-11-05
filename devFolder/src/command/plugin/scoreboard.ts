import { ScoreboardIdentity, system, world } from "@minecraft/server";
import { isPlayer } from "../../Modules/Handler";
import { getServerUptime } from "../utility/server";
import { ver } from "../../Modules/version";
import { banPlayers } from "../../Modules/globalBan";

let serverTime = getServerUptime();
let uptime = "";
if (typeof serverTime === 'string') {
    const dhmUptime = serverTime.match(/(\d+)d (\d+)h (\d+)m/)?.[0] || "0d 0h 0m"; 
    uptime = dhmUptime;
}

const simpleReplacements: { [key: string]: string | (() => string) } = {
    "[allPlayer]": () => world.getPlayers().length.toString(),
    "[uptime]": () => uptime.toString(),
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